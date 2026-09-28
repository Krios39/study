# Кривая прогрева после рестарта proxy: сколько запросов нужно, чтобы JIT вышел на плато.
#   .\warmup.ps1                 # рестарт proxy на ss1/ss2, потом 3000 запросов, окна по 100
#   .\warmup.ps1 -NoRestart      # без рестарта — кривая на уже прогретом (должна быть плоской)
# Результат печатается и пишется в warmup-<время>.tsv
param([int]$N = 3000, [int]$Window = 100, [int]$Size = 1024, [switch]$NoRestart)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

if (-not $NoRestart) {
    foreach ($ss in 'ss1', 'ss2') { docker exec $ss supervisorctl restart xroad-proxy | Out-Null }
    Start-Sleep 8
    for ($i = 0; $i -lt 30; $i++) {
        $r = docker run --rm --network xroad-network curlimages/curl -s -o /dev/null -w "%{http_code}" -H "X-Road-Client: DEV/MEMBER/SS1-CODE/CLIENT" "http://ss1:8080/r1/DEV/MEMBER/SS2-CODE/ECHO/echo?size=16"
        if ($r -eq '200') { break }
        Start-Sleep 2
    }
    Write-Host "proxy restarted, first request ok" -ForegroundColor Cyan
}

$out = Join-Path $PSScriptRoot ("warmup-{0:yyyyMMdd-HHmm}.tsv" -f (Get-Date))
docker run --rm --network xroad-network -v "${PSScriptRoot}\k6:/k6:ro" grafana/k6:latest run --quiet `
    -e N=$N -e WINDOW=$Window -e SIZE=$Size /k6/warmup.js | Tee-Object -FilePath $out
Write-Host "saved: $out"
