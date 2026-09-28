# Инициализация стенда через REST API (hurl в контейнере). Запускать из папки stand после `docker compose up -d`.
# Идемпотентности нет: повторный запуск на уже инициализированном стенде упадёт на первом же POST.
# Для чистого прогона: docker compose down -v; docker compose up -d --build; .\init.ps1
$ErrorActionPreference = "Stop"

function Hurl {
    param([string]$File, [string[]]$Vars = @())
    $args = @("compose", "run", "--rm", "hurl",
        "--insecure", "--variables-file", "/hurl-src/vars.env", "--file-root", "/hurl-files",
        "--retry", "30", "--retry-interval", "10000", "--test")
    foreach ($v in $Vars) { $args += @("--variable", $v) }
    $args += "/hurl-src/$File"
    Write-Host ">>> $File $Vars" -ForegroundColor Cyan
    & docker @args
    if ($LASTEXITCODE -ne 0) { throw "hurl failed: $File" }
}

Hurl "01-cs.hurl"
Hurl "02-ss-base.hurl" @("ss_host=ss0", "ss_code=SS0", "member_code=SS0-CODE", "member_name=SS0-NAME")
Hurl "03-ss0-management.hurl" @("ss_host=ss0", "ss_code=SS0")
Hurl "02-ss-base.hurl" @("ss_host=ss1", "ss_code=SS1", "member_code=SS1-CODE", "member_name=SS1-NAME")
Hurl "02-ss-base.hurl" @("ss_host=ss2", "ss_code=SS2", "member_code=SS2-CODE", "member_name=SS2-NAME")
Hurl "02-ss-base.hurl" @("ss_host=ss3", "ss_code=SS3", "member_code=SS3-CODE", "member_name=SS3-NAME")
Hurl "04-consumer.hurl" @("ss_host=ss1", "member_code=SS1-CODE", "subsystem=CLIENT")
Hurl "05-provider.hurl" @("ss_host=ss2", "member_code=SS2-CODE", "subsystem=ECHO")
Hurl "05-provider.hurl" @("ss_host=ss3", "member_code=SS3-CODE", "subsystem=ECHO")

Write-Host "Done. Smoke test (подожди 1-2 мин на раздачу gconf):" -ForegroundColor Green
Write-Host '  curl.exe -s -H "X-Road-Client: DEV/MEMBER/SS1-CODE/CLIENT" "http://localhost:4210/r1/DEV/MEMBER/SS2-CODE/ECHO/echo?size=16"'
