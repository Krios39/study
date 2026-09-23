# Provider: подсистема, регистрация, REST-сервис echo, ACL для consumer.
# Переменные: ss_host, member_code, subsystem

POST https://{{cs_host}}:4000/login
[FormParams]
username: {{admin_user}}
password: {{admin_password}}
HTTP 200
[Captures]
cs_xsrf_token: cookie "XSRF-TOKEN"

POST https://{{ss_host}}:4000/login
[FormParams]
username: {{admin_user}}
password: {{admin_password}}
HTTP 200
[Captures]
ss_xsrf_token: cookie "XSRF-TOKEN"

POST https://{{ss_host}}:4000/api/v1/clients
X-XSRF-TOKEN: {{ss_xsrf_token}}
Content-Type: application/json
{
  "ignore_warnings": true,
  "client": {
    "member_class": "{{member_class}}",
    "member_code": "{{member_code}}",
    "subsystem_code": "{{subsystem}}",
    "connection_type": "HTTP"
  }
}
HTTP 201
[Captures]
client_id: jsonpath "$.id"

PUT https://{{ss_host}}:4000/api/v1/clients/{{client_id}}/register
X-XSRF-TOKEN: {{ss_xsrf_token}}
HTTP 204

GET https://{{cs_host}}:4000/api/v1/management-requests?sort=id&desc=true&status=WAITING
X-XSRF-TOKEN: {{cs_xsrf_token}}
HTTP 200
[Captures]
req_id: jsonpath "$.items[0].id"
[Asserts]
jsonpath "$.items[0].client_id.member_code" == "{{member_code}}"

POST https://{{cs_host}}:4000/api/v1/management-requests/{{req_id}}/approval
X-XSRF-TOKEN: {{cs_xsrf_token}}
HTTP 200

# REST-сервис echo
POST https://{{ss_host}}:4000/api/v1/clients/{{client_id}}/service-descriptions
X-XSRF-TOKEN: {{ss_xsrf_token}}
Content-Type: application/json
{
  "url": "{{echo_url}}",
  "type": "REST",
  "rest_service_code": "{{echo_service_code}}"
}
HTTP 201
[Captures]
echo_service_desc_id: jsonpath "$.id"
echo_service_id: jsonpath "$.services[0].id"

# таймаут 60 с, без TLS к IS
PATCH https://{{ss_host}}:4000/api/v1/services/{{echo_service_id}}
X-XSRF-TOKEN: {{ss_xsrf_token}}
Content-Type: application/json
{
  "ignore_warnings": true,
  "ssl_auth": false,
  "ssl_auth_all": false,
  "timeout": 60,
  "timeout_all": false,
  "url": "{{echo_url}}",
  "url_all": false
}
HTTP 200

PUT https://{{ss_host}}:4000/api/v1/service-descriptions/{{echo_service_desc_id}}/enable
X-XSRF-TOKEN: {{ss_xsrf_token}}
HTTP 200

# доступ consumer'у
POST https://{{ss_host}}:4000/api/v1/clients/{{client_id}}/service-clients/{{instance}}:{{member_class}}:{{consumer_member_code}}:{{consumer_subsystem}}/access-rights
X-XSRF-TOKEN: {{ss_xsrf_token}}
Content-Type: application/json
{
  "items": [
    { "service_code": "{{echo_service_code}}" }
  ]
}
HTTP 201
