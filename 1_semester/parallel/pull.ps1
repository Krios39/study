[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, ValueFromRemainingArguments = $true)]
    [string[]]$RemotePaths,

    [Parameter(Mandatory = $false)]
    [string]$TargetDir = "."
)

$KEY_PATH = Join-Path $PSScriptRoot "parcomp_key"
$REMOTE_USER = "nechshadimov"
$REMOTE_HOST = "172.17.66.61"

if (-not (Test-Path $TargetDir)) {
    New-Item -ItemType Directory -Path $TargetDir | Out-Null
}

foreach ($item in $RemotePaths) {
    $cleanPath = $item.TrimEnd('/')

    if (-not $cleanPath.EndsWith("*")) {
        $remoteTarget = "$cleanPath/*"
    } else {
        $remoteTarget = $cleanPath
    }

    $source = "${REMOTE_USER}@${REMOTE_HOST}:${remoteTarget}"
    Write-Host "Download files: $source -> $TargetDir" -ForegroundColor Cyan

    scp -r -i "$KEY_PATH" "$source" "$TargetDir"

    if ($LASTEXITCODE -eq 0) {
        Write-Host "Success!" -ForegroundColor Green
    } else {
        Write-Host "Download error: $item" -ForegroundColor Red
    }
}
