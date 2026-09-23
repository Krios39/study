# Consumer: подсистема клиента на SS, регистрация, одобрение на CS.
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

# Запрос уходит через management SS (ss0) — до раздачи gconf будет 500, hurl с --retry дождётся
PUT https://{{ss_host}}:4000/api/v1/clients/{{client_id}}/register
X-XSRF-TOKEN: {{ss_xsrf_token}}
HTTP 204

GET https://{{cs_host}}:4000/api/v1/management-requests?sort=id&desc=true&status=WAITING
X-XSRF-TOKEN: {{cs_xsrf_token}}
HTTP 200
[Captures]
req_id: jsonpath "$.items[0].id"
[Asserts]
jsonpath "$.items[0].client_id.subsystem_code" == "{{subsystem}}"

POST https://{{cs_host}}:4000/api/v1/management-requests/{{req_id}}/approval
X-XSRF-TOKEN: {{cs_xsrf_token}}
HTTP 200
