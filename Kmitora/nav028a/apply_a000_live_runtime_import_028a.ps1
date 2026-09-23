$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$Root = "C:\KMITORA\Kmitora-main\Kmitora-main"
$Entry = Join-Path $Root "backend\main_api\F1033_server.py"
$Python = Join-Path $Root "backend\.venv\Scripts\python.exe"
$Patcher = Join-Path $PSScriptRoot "patch_f1033_runtime_import_028a.py"
$ToolSrc = Join-Path $PSScriptRoot "payload\tools\run_a000_live_qualification_028a.ps1"
$ToolDst = Join-Path $Root "tools\run_a000_live_qualification_028a.ps1"
$BackupDir = Join-Path $Root "_kmitora_backups"
$Stamp = Get-Date -Format "yyyyMMdd_HHmmss"

foreach ($p in @($Root,$Entry,$Python,$Patcher,$ToolSrc)) {
    if (-not (Test-Path $p)) { throw "Required path missing: $p" }
}
if (-not (Test-Path $BackupDir)) { New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null }
if (-not (Test-Path (Split-Path $ToolDst -Parent))) { New-Item -ItemType Directory -Path (Split-Path $ToolDst -Parent) -Force | Out-Null }

Write-Host "=== KMITORA A000 LIVE RUNTIME IMPORT HARDENING 028A ===" -ForegroundColor Cyan
$Backup = Join-Path $BackupDir "F1033_server.py.A000_028A_$Stamp.bak"
Copy-Item -LiteralPath $Entry -Destination $Backup -Force

& $Python $Patcher $Entry
if ($LASTEXITCODE -ne 0) {
    Copy-Item -LiteralPath $Backup -Destination $Entry -Force
    throw "028A F1033 patch failed; original restored."
}

Copy-Item -LiteralPath $ToolSrc -Destination $ToolDst -Force
& $Python -m py_compile $Entry
if ($LASTEXITCODE -ne 0) {
    Copy-Item -LiteralPath $Backup -Destination $Entry -Force
    throw "028A compile failed; original restored."
}

Write-Host "Backup : $Backup" -ForegroundColor DarkGray
Write-Host "Tool   : $ToolDst" -ForegroundColor DarkGray
Write-Host "A000_LIVE_RUNTIME_IMPORT_028A applied successfully." -ForegroundColor Green
