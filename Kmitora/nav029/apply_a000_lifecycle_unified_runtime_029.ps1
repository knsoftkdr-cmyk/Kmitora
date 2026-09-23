$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$Root = "C:\KMITORA\Kmitora-main\Kmitora-main"
$Entry = Join-Path $Root "backend\main_api\F1033_server.py"
$Python = Join-Path $Root "backend\.venv\Scripts\python.exe"
$Payload = Join-Path $PSScriptRoot "payload\backend\a000_core"
$Dest = Join-Path $Root "backend\a000_core"
$Patcher = Join-Path $PSScriptRoot "patch_f1033_lifecycle_runtime_029.py"
$ToolSrc = Join-Path $PSScriptRoot "payload\tools\run_a000_lifecycle_qualification_029.ps1"
$ToolDst = Join-Path $Root "tools\run_a000_lifecycle_qualification_029.ps1"
$BackupDir = Join-Path $Root "_kmitora_backups"
$Stamp = Get-Date -Format "yyyyMMdd_HHmmss"

foreach ($p in @($Root,$Entry,$Python,$Payload,$Dest,$Patcher,$ToolSrc)) {
    if (-not (Test-Path $p)) { throw "Required path missing: $p" }
}
$LiveBridge = Join-Path $Dest "live_bridge.py"
if (-not (Test-Path $LiveBridge)) { throw "027 live bridge is required before 029: $LiveBridge" }

if (-not (Test-Path $BackupDir)) { New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null }
$Backup = Join-Path $BackupDir "F1033_server.py.A000_029_$Stamp.bak"
Copy-Item -LiteralPath $Entry -Destination $Backup -Force

Write-Host "=== KMITORA A000 LIFECYCLE UNIFIED RUNTIME 029 ===" -ForegroundColor Cyan
$Files = @("lifecycle_bridge.py","tests\test_lifecycle_bridge_029.py")
foreach ($Rel in $Files) {
    $Src = Join-Path $Payload $Rel
    $Dst = Join-Path $Dest $Rel
    if (-not (Test-Path $Src)) { throw "Payload file missing: $Src" }
    $Parent = Split-Path $Dst -Parent
    if (-not (Test-Path $Parent)) { New-Item -ItemType Directory -Path $Parent -Force | Out-Null }
    if (Test-Path $Dst) {
        $SrcHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $Src).Hash
        $DstHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $Dst).Hash
        if ($SrcHash -eq $DstHash) {
            Write-Host "SKIP identical $Rel" -ForegroundColor DarkGray
            continue
        }
        Copy-Item -LiteralPath $Dst -Destination "$Dst.A000_029_$Stamp.bak" -Force
    }
    Copy-Item -LiteralPath $Src -Destination $Dst -Force
    Write-Host "INSTALLED $Rel" -ForegroundColor Green
}
$ToolParent = Split-Path $ToolDst -Parent
if (-not (Test-Path $ToolParent)) { New-Item -ItemType Directory -Path $ToolParent -Force | Out-Null }
Copy-Item -LiteralPath $ToolSrc -Destination $ToolDst -Force
Write-Host "INSTALLED tools\run_a000_lifecycle_qualification_029.ps1" -ForegroundColor Green

& $Python $Patcher $Entry
if ($LASTEXITCODE -ne 0) {
    Copy-Item -LiteralPath $Backup -Destination $Entry -Force
    throw "029 F1033 patch failed; original restored."
}
& $Python -m py_compile $Entry (Join-Path $Dest "lifecycle_bridge.py")
if ($LASTEXITCODE -ne 0) {
    Copy-Item -LiteralPath $Backup -Destination $Entry -Force
    throw "029 compile failed; F1033 original restored."
}
Push-Location (Join-Path $Root "backend")
try {
    & $Python -m a000_core.tests.test_lifecycle_bridge_029
    if ($LASTEXITCODE -ne 0) { throw "029 deterministic qualification failed." }
}
finally { Pop-Location }
Write-Host "Backup : $Backup" -ForegroundColor DarkGray
Write-Host "A000_LIFECYCLE_UNIFIED_RUNTIME_029 applied successfully." -ForegroundColor Green

