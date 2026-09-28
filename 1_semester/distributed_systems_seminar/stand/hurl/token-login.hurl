# Открыть software-токен PIN'ом (после рестарта контейнера он закрыт). Переменная: ss_host
POST https://{{ss_host}}:4000/login
[FormParams]
username: {{admin_user}}
password: {{admin_password}}
HTTP 200
[Captures]
ss_xsrf_token: cookie "XSRF-TOKEN"

# 200 — открыт, 409 — уже был открыт
PUT https://{{ss_host}}:4000/api/v1/tokens/0/login
X-XSRF-TOKEN: {{ss_xsrf_token}}
Content-Type: application/json
{
  "password": "{{token_pin}}"
}
HTTP *
[Asserts]
status toString matches "^(200|409)$"
