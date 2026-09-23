# ss0 как management Security Server: подсистема MANAGEMENT и management services CS.
# Переменные: ss_host (=ss0)

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

POST https://{{cs_host}}:4000/api/v1/management-services-configuration/register-provider
X-XSRF-TOKEN: {{cs_xsrf_token}}
Content-Type: application/json
{
  "security_server_id": "{{instance}}:{{member_class}}:{{mgmt_member_code}}:{{ss_code}}"
}
HTTP 200

POST https://{{ss_host}}:4000/api/v1/clients
X-XSRF-TOKEN: {{ss_xsrf_token}}
Content-Type: application/json
{
  "ignore_warnings": true,
  "client": {
    "member_class": "{{member_class}}",
    "member_code": "{{mgmt_member_code}}",
    "subsystem_code": "MANAGEMENT",
    "connection_type": "HTTP"
  }
}
HTTP 201
[Captures]
mgmt_client_id: jsonpath "$.id"

GET https://{{cs_host}}:4000/api/v1/management-services-configuration
X-XSRF-TOKEN: {{cs_xsrf_token}}
HTTP 200
[Captures]
cs_mgmt_service_address: jsonpath "$.services_address"
cs_mgmt_service_wsdl: jsonpath "$.wsdl_address"

POST https://{{ss_host}}:4000/api/v1/clients/{{mgmt_client_id}}/service-descriptions
X-XSRF-TOKEN: {{ss_xsrf_token}}
Content-Type: application/json
{
  "url": "{{cs_mgmt_service_wsdl}}",
  "type": "WSDL",
  "ignore_warnings": true
}
HTTP 201
[Captures]
mgmt_service_desc_id: jsonpath "$.id"
mgmt_first_service_id: jsonpath "$.services[0].id"

PATCH https://{{ss_host}}:4000/api/v1/services/{{mgmt_first_service_id}}
X-XSRF-TOKEN: {{ss_xsrf_token}}
Content-Type: application/json
{
  "ignore_warnings": true,
  "ssl_auth": false,
  "ssl_auth_all": true,
  "timeout": 60,
  "timeout_all": true,
  "url": "{{cs_mgmt_service_address}}",
  "url_all": true
}
HTTP 200

POST https://{{ss_host}}:4000/api/v1/clients/{{mgmt_client_id}}/service-clients/{{instance}}:security-server-owners/access-rights
X-XSRF-TOKEN: {{ss_xsrf_token}}
Content-Type: application/json
{
  "items": [
    { "service_code": "authCertDeletion" },
    { "service_code": "clientDeletion" },
    { "service_code": "clientReg" },
    { "service_code": "ownerChange" },
    { "service_code": "clientEnable" },
    { "service_code": "clientDisable" },
    { "service_code": "addressChange" },
    { "service_code": "clientRename" },
    { "service_code": "maintenanceModeEnable" },
    { "service_code": "maintenanceModeDisable" }
  ]
}
HTTP 201

PUT https://{{ss_host}}:4000/api/v1/service-descriptions/{{mgmt_service_desc_id}}/enable
X-XSRF-TOKEN: {{ss_xsrf_token}}
HTTP 200
