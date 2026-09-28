# Этап 0: откуда 120 мс. Четыре прогона, каждый — 100 прогрев + 200 замер, 1 VU, из контейнера в xroad-network.
#   A  direct         эхо напрямую, мимо X-Road (нижняя граница генератора и сети docker)
#   B  xroad          как есть
#   C  xroad-nobody   message-body-logging=false на ss1 и ss2
#   D  xroad          вернули как было (контроль, что C не сломал стенд)
# Параллельно пишет docker stats раз в секунду в probe-stats.csv.
#   .\probe.ps1
#   .\probe.ps1 -Size 10240 -N 500
param([int]$Size = 1024, [int]$Warmup = 100, [int]$N = 200)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

function K6([string]$target, [string]$label) {
    docker run --rm --network xroad-network -v "${PSScriptRoot}\k6:/k6:ro" grafana/k6:latest run --quiet `
        -e TARGET=$target -e LABEL=$label -e SIZE=$Size -e WARMUP=$Warmup -e N=$N /k6/probe.js
}

function BodyLogging([string]$value) {
    foreach ($ss in 'ss1', 'ss2') {
        docker exec $ss crudini --set /etc/xroad/conf.d/local.ini message-log message-body-logging $value
        docker exec $ss supervisorctl restart xroad-proxy | Out-Null
    }
    Start-Sleep 8
    # прогрев после рестарта, до первого успешного ответа
    for ($i = 0; $i -lt 30; $i++) {
        $r = docker run --rm --network xroad-network curlimages/curl -s -o /dev/null -w "%{http_code}" -H "X-Road-Client: DEV/MEMBER/SS1-CODE/CLIENT" "http://ss1:8080/r1/DEV/MEMBER/SS2-CODE/ECHO/echo?size=16"
        if ($r -eq '200') { return }
        Start-Sleep 2
    }
    throw "proxy did not come back after restart"
}

$statsFile = Join-Path $PSScriptRoot 'probe-stats.csv'
'ts,name,cpu,mem' | Set-Content $statsFile
$stats = Start-Job -ArgumentList $statsFile {
    param($f)
    while ($true) {
        $ts = Get-Date -Format 'HH:mm:ss'
        docker stats --no-stream --format '{{.Name}},{{.CPUPerc}},{{.MemUsage}}' cs ss1 ss2 is-provider |
            ForEach-Object { "$ts,$_" } | Add-Content $f
    }
}

try {
    Write-Host "== A direct" -ForegroundColor Cyan;                         K6 direct A-direct
    Write-Host "== B xroad, body logging on" -ForegroundColor Cyan;         K6 xroad  B-xroad
    Write-Host "== C xroad, body logging off" -ForegroundColor Cyan;        BodyLogging false; K6 xroad C-xroad-nobody
    Write-Host "== D xroad, body logging back on" -ForegroundColor Cyan;    BodyLogging true;  K6 xroad D-xroad
}
finally {
    Stop-Job $stats; Remove-Job $stats
}

Write-Host "`nCPU во время прогонов (пик по контейнерам):" -ForegroundColor Cyan
Import-Csv $statsFile | Group-Object name | ForEach-Object {
    $peak = ($_.Group | ForEach-Object { [double]($_.cpu -replace '%', '') } | Measure-Object -Maximum).Maximum
    "{0,-12} peak CPU {1,6:N1}%   (лимит SS 200%)" -f $_.Name, $peak
}
