$ErrorActionPreference = "Stop"

Write-Host "=== KMITORA A000 LIFECYCLE QUALIFICATION 029D3 ===" -ForegroundColor Cyan

$Root = "C:\KMITORA\Kmitora-main\Kmitora-main"
$Source = Join-Path $PSScriptRoot "payload\run_a000_lifecycle_qualification_029d.ps1"
$Target = Join-Path $Root "tools\run_a000_lifecycle_qualification_029d.ps1"
$BackupRoot = Join-Path $Root "_kmitora_backups"

if (-not (Test-Path -LiteralPath $Source)) { throw "029D3 payload missing: $Source" }
if (-not (Test-Path -LiteralPath (Split-Path -Parent $Target))) { throw "KMITORA tools folder missing: $(Split-Path -Parent $Target)" }

if (Test-Path -LiteralPath $Target) {
    $srcHash = (Get-FileHash -LiteralPath $Source -Algorithm SHA256).Hash
    $dstHash = (Get-FileHash -LiteralPath $Target -Algorithm SHA256).Hash
    if ($srcHash -eq $dstHash) {
        Write-Host "SKIP  corrected qualification script already installed" -ForegroundColor DarkGray
    }
    else {
        New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null
        $Stamp = Get-Date -Format "yyyyMMdd_HHmmss"
        $Backup = Join-Path $BackupRoot "run_a000_lifecycle_qualification_029d.pre029d3.$Stamp.ps1"
        Copy-Item -LiteralPath $Target -Destination $Backup -Force
        Copy-Item -LiteralPath $Source -Destination $Target -Force
        Write-Host "BACKUP $Backup" -ForegroundColor DarkGray
        Write-Host "INSTALLED corrected PowerShell qualifier" -ForegroundColor Green
    }
}
else {
    Copy-Item -LiteralPath $Source -Destination $Target -Force
    Write-Host "INSTALLED corrected PowerShell qualifier" -ForegroundColor Green
}

$Text = Get-Content -LiteralPath $Target -Raw
if ($Text -match '\$Stage:') { throw 'Invalid PowerShell variable-colon interpolation remains: $Stage:' }
if ($Text -notmatch '\$\{Stage\}:') { throw '029D3 ${Stage}: parser-safe interpolation marker missing.' }
if ($Text -notmatch '\$Payload\.lifecycle_runtime') { throw 'lifecycle runtime projection check missing.' }
if ($Text -notmatch '\$L\.safety') { throw 'nested safety check missing.' }
if ($Text -notmatch 'WebException') { throw 'guarded HTTP response handling missing.' }

Write-Host "PASS  parser-unsafe `$Stage: interpolation removed" -ForegroundColor Green
Write-Host "PASS  parser-safe `${Stage}: interpolation installed" -ForegroundColor Green
Write-Host "PASS  029C nested safety qualification preserved" -ForegroundColor Green
Write-Host "PASS  guarded HTTP handling preserved" -ForegroundColor Green
Write-Host "No backend source changed. No restart required." -ForegroundColor Yellow
Write-Host "A000_LIFECYCLE_QUALIFICATION_029D3 applied successfully." -ForegroundColor Green
