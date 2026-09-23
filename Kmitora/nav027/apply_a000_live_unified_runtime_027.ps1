$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$Root = "C:\KMITORA\Kmitora-main\Kmitora-main"
$PatchRoot = Split-Path $PSScriptRoot -Parent
$Payload = Join-Path $PatchRoot "backend\a000_core"
$Dest = Join-Path $Root "backend\a000_core"
$Entry = Join-Path $Root "backend\main_api\F1033_server.py"
$Patcher = Join-Path $PSScriptRoot "patch_f1033_live_runtime_027.py"
$Python = Join-Path $Root "backend\.venv\Scripts\python.exe"
$Stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupDir = Join-Path $Root "_kmitora_backups"

function Ensure-Dir([string]$p) { if (-not (Test-Path $p)) { New-Item -ItemType Directory -Path $p -Force | Out-Null } }
function Sha([string]$p) { (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash }

foreach ($p in @($Root,$Payload,$Entry,$Patcher,$Python)) {
    if (-not (Test-Path $p)) { throw "Required path missing: $p" }
}
if (-not (Test-Path (Join-Path $Dest "runtime.py"))) {
    throw "013-026 A000 core runtime is not installed. Apply/verify 013-026 before 027."
}

Write-Host "=== KMITORA A000 LIVE UNIFIED RUNTIME 027 ===" -ForegroundColor Cyan
Write-Host "Integrates the existing 013-026 intelligence backbone into /v1/a000/messages." -ForegroundColor Yellow
Write-Host "No write authority is added. Duplicate functionality is reused, not recreated." -ForegroundColor Yellow

Ensure-Dir $Dest
Ensure-Dir $BackupDir

# Install only 027-owned files. Existing 013-026 files are not overwritten.
$owned = @(
    "live_bridge.py",
    "tests\test_live_bridge_027.py"
)
foreach ($rel in $owned) {
    $src = Join-Path $Payload $rel
    $dst = Join-Path $Dest $rel
    if (-not (Test-Path $src)) { throw "027 payload missing: $src" }
    Ensure-Dir (Split-Path $dst -Parent)
    if (Test-Path $dst) {
        if ((Sha $src) -eq (Sha $dst)) {
            Write-Host "SKIP identical: $rel" -ForegroundColor DarkGray
            continue
        }
        $bakName = "a000_core_027_{0}_{1}.bak" -f ($rel -replace '[\\/:*?"<>|]','_'),$Stamp
        $bak = Join-Path $BackupDir $bakName
        Copy-Item -LiteralPath $dst -Destination $bak -Force
        Write-Host "BACKUP changed 027-owned file: $bak" -ForegroundColor Yellow
    }
    Copy-Item -LiteralPath $src -Destination $dst -Force
    Write-Host "INSTALL: $rel" -ForegroundColor Green
}

# Patch the normal A000 message handler only once and fail safely on unknown shape.
$entryBefore = Get-Content -LiteralPath $Entry -Raw
if ($entryBefore -notmatch 'KMITORA_A000_LIVE_UNIFIED_RUNTIME_027') {
    $entryBackup = Join-Path $BackupDir "F1033_server.py.A000_LIVE_027_$Stamp.bak"
    Copy-Item -LiteralPath $Entry -Destination $entryBackup -Force
    & $Python $Patcher $Entry
    if ($LASTEXITCODE -ne 0) {
        Copy-Item -LiteralPath $entryBackup -Destination $Entry -Force
        throw "027 attachment failed; F1033_server.py was restored from backup."
    }
    Write-Host "Backup: $entryBackup" -ForegroundColor DarkGray
} else {
    Write-Host "SKIP 027 message integration block already exists." -ForegroundColor DarkGray
}

& $Python -m py_compile (Join-Path $Dest "live_bridge.py")
if ($LASTEXITCODE -ne 0) { throw "027 live bridge compile failed." }
& $Python -m py_compile $Entry
if ($LASTEXITCODE -ne 0) { throw "F1033_server.py compile failed after 027." }
& $Python (Join-Path $Dest "tests\test_live_bridge_027.py")
if ($LASTEXITCODE -ne 0) { throw "027 bridge smoke test failed." }

Write-Host ""
Write-Host "A000_LIVE_UNIFIED_RUNTIME_027 applied successfully." -ForegroundColor Green
Write-Host "Normal route : /v1/a000/messages" -ForegroundColor Cyan
Write-Host "Mode         : PLAN_ONLY" -ForegroundColor Cyan
Write-Host "Write auth   : NONE" -ForegroundColor Cyan
Write-Host "Production   : DENIED BY DEFAULT" -ForegroundColor Cyan
