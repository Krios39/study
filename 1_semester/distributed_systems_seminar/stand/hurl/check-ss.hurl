# Готовность одного SS к замерам (bench/check.js). Переменная: ss_host
POST https://{{ss_host}}:4000/login
[FormParams]
username: {{admin_user}}
password: {{admin_password}}
HTTP 200
[Captures]
ss_xsrf_token: cookie "XSRF-TOKEN"

# глобальная конфигурация свежая
GET https://{{ss_host}}:4000/api/v1/diagnostics/globalconf
X-XSRF-TOKEN: {{ss_xsrf_token}}
HTTP 200
[Asserts]
jsonpath "$.status_class" == "OK"

# TSA настроен и отвечает (WAITING — ещё не было ни одной метки, тоже нормально)
GET https://{{ss_host}}:4000/api/v1/diagnostics/timestamping-services
X-XSRF-TOKEN: {{ss_xsrf_token}}
HTTP 200
[Asserts]
jsonpath "$" count >= 1
jsonpath "$[0].status_class" matches "^(OK|WAITING)$"

# OCSP-ответчик доступен
GET https://{{ss_host}}:4000/api/v1/diagnostics/ocsp-responders
X-XSRF-TOKEN: {{ss_xsrf_token}}
HTTP 200
[Asserts]
jsonpath "$[0].ocsp_responders[0].status_class" matches "^(OK|WAITING)$"

# токен открыт, оба сертификата (auth + sign) с OCSP good
GET https://{{ss_host}}:4000/api/v1/tokens
X-XSRF-TOKEN: {{ss_xsrf_token}}
HTTP 200
[Asserts]
jsonpath "$[0].logged_in" == true
jsonpath "$[0].keys[*].certificates[?(@.ocsp_status == 'OCSP_RESPONSE_GOOD')]" count >= 2
