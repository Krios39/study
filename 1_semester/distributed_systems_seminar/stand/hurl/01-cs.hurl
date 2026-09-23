# Central Server: init, member class, signing keys, members, CA/OCSP/TSA.
# Адаптация development/hurl/scenarios/setup.hurl из репозитория X-Road (тег 7.8.3).

GET https://{{cs_host}}:4000
HTTP 200

POST https://{{cs_host}}:4000/login
[FormParams]
username: {{admin_user}}
password: {{admin_password}}
HTTP 200
[Captures]
cs_xsrf_token: cookie "XSRF-TOKEN"

# Init (200 вместо 201 — известная особенность CS)
POST https://{{cs_host}}:4000/api/v1/initialization
X-XSRF-TOKEN: {{cs_xsrf_token}}
Content-Type: application/json
{
  "software_token_pin": "{{token_pin}}",
  "instance_identifier": "{{instance}}",
  "central_server_address": "{{cs_host}}"
}
HTTP 200

POST https://{{cs_host}}:4000/api/v1/member-classes
X-XSRF-TOKEN: {{cs_xsrf_token}}
Content-Type: application/json
{
  "code": "{{member_class}}",
  "description": "Organisations"
}
HTTP 201

PUT https://{{cs_host}}:4000/api/v1/tokens/0/login
X-XSRF-TOKEN: {{cs_xsrf_token}}
Content-Type: application/json
{
  "password": "{{token_pin}}"
}
HTTP *

POST https://{{cs_host}}:4000/api/v1/configuration-sources/INTERNAL/signing-keys
X-XSRF-TOKEN: {{cs_xsrf_token}}
Content-Type: application/json
{
  "key_label": "Internal signing key",
  "token_id": 0
}
HTTP 200

POST https://{{cs_host}}:4000/api/v1/configuration-sources/EXTERNAL/signing-keys
X-XSRF-TOKEN: {{cs_xsrf_token}}
Content-Type: application/json
{
  "key_label": "External signing key",
  "token_id": 0
}
HTTP 200

# Члены
POST https://{{cs_host}}:4000/api/v1/members
X-XSRF-TOKEN: {{cs_xsrf_token}}
Content-Type: application/json
{
  "member_id": { "member_class": "{{member_class}}", "member_code": "{{mgmt_member_code}}" },
  "member_name": "SS0-NAME"
}
HTTP 201

POST https://{{cs_host}}:4000/api/v1/members
X-XSRF-TOKEN: {{cs_xsrf_token}}
Content-Type: application/json
{
  "member_id": { "member_class": "{{member_class}}", "member_code": "{{consumer_member_code}}" },
  "member_name": "SS1-NAME"
}
HTTP 201

POST https://{{cs_host}}:4000/api/v1/members
X-XSRF-TOKEN: {{cs_xsrf_token}}
Content-Type: application/json
{
  "member_id": { "member_class": "{{member_class}}", "member_code": "{{provider_a_member_code}}" },
  "member_name": "SS2-NAME"
}
HTTP 201

POST https://{{cs_host}}:4000/api/v1/members
X-XSRF-TOKEN: {{cs_xsrf_token}}
Content-Type: application/json
{
  "member_id": { "member_class": "{{member_class}}", "member_code": "{{provider_b_member_code}}" },
  "member_name": "SS3-NAME"
}
HTTP 201

# Management-подсистема и management services
POST https://{{cs_host}}:4000/api/v1/subsystems
X-XSRF-TOKEN: {{cs_xsrf_token}}
Content-Type: application/json
{
  "subsystem_id": {
    "member_class": "{{member_class}}",
    "member_code": "{{mgmt_member_code}}",
    "subsystem_code": "MANAGEMENT"
  }
}
HTTP 201

PATCH https://{{cs_host}}:4000/api/v1/management-services-configuration
X-XSRF-TOKEN: {{cs_xsrf_token}}
Content-Type: application/json
{
  "service_provider_id": "{{instance}}:{{member_class}}:{{mgmt_member_code}}:MANAGEMENT"
}
HTTP 200

# Тестовый CA (сертификаты лежат в volume ca-data -> /hurl-files/ca/certs)
POST https://{{cs_host}}:4000/api/v1/certification-services
X-XSRF-TOKEN: {{cs_xsrf_token}}
[MultipartFormData]
certificate_profile_info: ee.ria.xroad.common.certificateprofile.impl.FiVRKCertificateProfileInfoProvider
tls_auth: false
default_csr_format: DER
certificate: file,ca/certs/ca.pem;
HTTP 201
[Captures]
ca_id: jsonpath "$.id"

POST https://{{cs_host}}:4000/api/v1/certification-services/{{ca_id}}/ocsp-responders
X-XSRF-TOKEN: {{cs_xsrf_token}}
[MultipartFormData]
url: http://{{ca_host}}:8888
cost_type: FREE
certificate: file,ca/certs/ocsp.pem;
HTTP 201

POST https://{{cs_host}}:4000/api/v1/timestamping-services
X-XSRF-TOKEN: {{cs_xsrf_token}}
[MultipartFormData]
url: http://{{ca_host}}:8899
cost_type: FREE
certificate: file,ca/certs/tsa.pem;
HTTP 201
