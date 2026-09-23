# Базовая инициализация одного Security Server.
# Переменные (передаются через --variable): ss_host, ss_code, member_code, member_name
# Шаги: anchor -> init -> auth key/cert -> sign key/cert -> регистрация auth cert -> approve на CS -> activate -> TSA

# --- CS: логин и anchor ---
POST https://{{cs_host}}:4000/login
[FormParams]
username: {{admin_user}}
password: {{admin_password}}
HTTP 200
[Captures]
cs_xsrf_token: cookie "XSRF-TOKEN"

GET https://{{cs_host}}:4000/api/v1/configuration-sources/INTERNAL/anchor/download
X-XSRF-TOKEN: {{cs_xsrf_token}}
HTTP 200
[Captures]
gconf_anchor: body

# --- SS ---
GET https://{{ss_host}}:4000
HTTP 200

POST https://{{ss_host}}:4000/login
[FormParams]
username: {{admin_user}}
password: {{admin_password}}
HTTP 200
[Captures]
ss_xsrf_token: cookie "XSRF-TOKEN"

POST https://{{ss_host}}:4000/api/v1/system/anchor
X-XSRF-TOKEN: {{ss_xsrf_token}}
Content-Type: application/octet-stream
```
{{gconf_anchor}}
```
HTTP 201

POST https://{{ss_host}}:4000/api/v1/initialization
X-XSRF-TOKEN: {{ss_xsrf_token}}
Content-Type: application/json
{
  "owner_member_class": "{{member_class}}",
  "owner_member_code": "{{member_code}}",
  "security_server_code": "{{ss_code}}",
  "software_token_pin": "{{token_pin}}",
  "ignore_warnings": true
}
HTTP 201

# CA появляется только после того, как SS скачает глобальную конфигурацию — hurl с --retry дождётся
GET https://{{ss_host}}:4000/api/v1/certificate-authorities
X-XSRF-TOKEN: {{ss_xsrf_token}}
HTTP 200
[Captures]
ca_name: jsonpath "$[0].name"
[Asserts]
jsonpath "$[0].name" exists

# --- auth key ---
POST https://{{ss_host}}:4000/api/v1/tokens/0/keys-with-csrs
X-XSRF-TOKEN: {{ss_xsrf_token}}
Content-Type: application/json
{
  "key_label": "Auth key",
  "csr_generate_request": {
    "key_usage_type": "AUTHENTICATION",
    "ca_name": "{{ca_name}}",
    "csr_format": "DER",
    "subject_field_values": {
      "CN": "{{ss_host}}",
      "C": "EE",
      "O": "{{member_name}}",
      "subjectAltName": "{{ss_host}}",
      "serialNumber": "{{instance}}/{{ss_code}}/{{member_class}}"
    }
  }
}
HTTP 200
[Captures]
auth_key_id: jsonpath "$.key.id"
auth_csr_id: jsonpath "$.csr_id"

GET https://{{ss_host}}:4000/api/v1/keys/{{auth_key_id}}/csrs/{{auth_csr_id}}?csr_format=PEM
X-XSRF-TOKEN: {{ss_xsrf_token}}
HTTP 200
[Captures]
auth_csr: body

POST http://{{ca_host}}:8888/testca/sign
Content-Type: multipart/form-data; boundary=certboundary
```
--certboundary
Content-Disposition: form-data; name="type"

auth
--certboundary
Content-Disposition: form-data; name="certreq"; filename="auth.csr.pem"

{{auth_csr}}
--certboundary--
```
HTTP 200
[Captures]
auth_cert: body

POST https://{{ss_host}}:4000/api/v1/token-certificates
X-XSRF-TOKEN: {{ss_xsrf_token}}
Content-Type: application/octet-stream
```
{{auth_cert}}
```
HTTP 201
[Captures]
auth_cert_hash: jsonpath "$.certificate_details.hash"

# --- sign key владельца ---
POST https://{{ss_host}}:4000/api/v1/tokens/0/keys-with-csrs
X-XSRF-TOKEN: {{ss_xsrf_token}}
Content-Type: application/json
{
  "key_label": "Sign key",
  "csr_generate_request": {
    "key_usage_type": "SIGNING",
    "ca_name": "{{ca_name}}",
    "csr_format": "DER",
    "member_id": "{{instance}}:{{member_class}}:{{member_code}}",
    "subject_field_values": {
      "CN": "{{member_code}}",
      "C": "EE",
      "O": "{{member_name}}",
      "subjectAltName": "{{ss_host}}",
      "serialNumber": "{{instance}}/{{ss_code}}/{{member_class}}"
    }
  }
}
HTTP 200
[Captures]
sign_key_id: jsonpath "$.key.id"
sign_csr_id: jsonpath "$.csr_id"

GET https://{{ss_host}}:4000/api/v1/keys/{{sign_key_id}}/csrs/{{sign_csr_id}}?csr_format=PEM
X-XSRF-TOKEN: {{ss_xsrf_token}}
HTTP 200
[Captures]
sign_csr: body

POST http://{{ca_host}}:8888/testca/sign
Content-Type: multipart/form-data; boundary=certboundary
```
--certboundary
Content-Disposition: form-data; name="type"

sign
--certboundary
Content-Disposition: form-data; name="certreq"; filename="sign.csr.pem"

{{sign_csr}}
--certboundary--
```
HTTP 200
[Captures]
sign_cert: body

POST https://{{ss_host}}:4000/api/v1/token-certificates
X-XSRF-TOKEN: {{ss_xsrf_token}}
Content-Type: application/octet-stream
```
{{sign_cert}}
```
HTTP 201

# --- регистрация auth cert и одобрение на CS ---
PUT https://{{ss_host}}:4000/api/v1/token-certificates/{{auth_cert_hash}}/register
X-XSRF-TOKEN: {{ss_xsrf_token}}
Content-Type: application/json
{
  "address": "{{ss_host}}"
}
HTTP 204

GET https://{{cs_host}}:4000/api/v1/management-requests?sort=id&desc=true&status=WAITING
X-XSRF-TOKEN: {{cs_xsrf_token}}
HTTP 200
[Captures]
reg_req_id: jsonpath "$.items[0].id"
[Asserts]
jsonpath "$.items[0].security_server_id.server_code" == "{{ss_code}}"

POST https://{{cs_host}}:4000/api/v1/management-requests/{{reg_req_id}}/approval
X-XSRF-TOKEN: {{cs_xsrf_token}}
HTTP 200

PUT https://{{ss_host}}:4000/api/v1/token-certificates/{{auth_cert_hash}}/activate
X-XSRF-TOKEN: {{ss_xsrf_token}}
HTTP 204

# --- TSA ---
GET https://{{ss_host}}:4000/api/v1/timestamping-services
X-XSRF-TOKEN: {{ss_xsrf_token}}
HTTP 200
[Captures]
tsa_name: jsonpath "$[0].name"
tsa_url: jsonpath "$[0].url"
tsa_cost: jsonpath "$[0].cost_type"

POST https://{{ss_host}}:4000/api/v1/system/timestamping-services
X-XSRF-TOKEN: {{ss_xsrf_token}}
Content-Type: application/json
{
  "name": "{{tsa_name}}",
  "url": "{{tsa_url}}",
  "cost_type": "{{tsa_cost}}"
}
HTTP 201
