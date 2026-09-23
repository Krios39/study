# Вернуть TSA из глобальной конфигурации на один SS. Переменная: ss_host
POST https://{{ss_host}}:4000/login
[FormParams]
username: {{admin_user}}
password: {{admin_password}}
HTTP 200
[Captures]
ss_xsrf_token: cookie "XSRF-TOKEN"

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
