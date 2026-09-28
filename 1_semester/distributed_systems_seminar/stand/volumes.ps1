# Снимок / откат всех volume'ов стенда, чтобы не инициализировать заново.
#   .\volumes.ps1 save            -> snapshots\golden\*.tgz
#   .\volumes.ps1 save  -Name pre-run-3
#   .\volumes.ps1 restore         -> откат к snapshots\golden
#   .\volumes.ps1 list
# Снимать сразу после удачного init, пока message log пустой — иначе тянет гигабайты.
param(
    [Parameter(Mandatory)][ValidateSet('save', 'restore', 'list')][string]$Action,
    [string]$Name = 'golden'
)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$vols = @('cs-db-data', 'cs-conf-data', 'ca-data') + (0..3 | ForEach-Object { "ss$_-db-data", "ss$_-conf-data", "ss$_-archive-data" })
$dir = Join-Path $PSScriptRoot "snapshots\$Name"

if ($Action -eq 'list') {
    Get-ChildItem (Join-Path $PSScriptRoot 'snapshots') -Directory -ErrorAction SilentlyContinue |
        ForEach-Object { "{0,-20} {1:yyyy-MM-dd HH:mm}  {2,6:N0} MB" -f $_.Name, $_.LastWriteTime, ((Get-ChildItem $_ | Measure-Object Length -Sum).Sum / 1MB) }
    exit
}

docker compose stop | Out-Null

if ($Action -eq 'save') {
    New-Item -ItemType Directory -Force $dir | Out-Null
    foreach ($v in $vols) {
        Write-Host "save $v"
        docker run --rm -v "${v}:/v:ro" -v "${dir}:/b" alpine tar czf "/b/$v.tgz" -C /v .
    }
}
else {
    if (-not (Test-Path $dir)) { throw "no snapshot: $dir" }
    foreach ($v in $vols) {
        Write-Host "restore $v"
        docker volume create $v | Out-Null
        docker run --rm -v "${v}:/v" -v "${dir}:/b" alpine sh -c "find /v -mindepth 1 -delete && tar xzf /b/$v.tgz -C /v"
    }
}

docker compose up -d
Write-Host "done: $Action $Name"
