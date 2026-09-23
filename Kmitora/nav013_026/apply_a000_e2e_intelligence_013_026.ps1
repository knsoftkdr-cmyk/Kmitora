$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$Root = "C:\KMITORA\Kmitora-main\Kmitora-main"
$PatchRoot = Split-Path $PSScriptRoot -Parent
$Payload = Join-Path $PatchRoot "backend\a000_core"
$Dest = Join-Path $Root "backend\a000_core"
$Entry = Join-Path $Root "backend\main_api\F1033_server.py"
$Stamp = Get-Date -Format "yyyyMMdd_HHmmss"

function Ensure-Dir([string]$p) { if (-not (Test-Path $p)) { New-Item -ItemType Directory -Path $p -Force | Out-Null } }
function Sha([string]$p) { (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash }

if (-not (Test-Path $Root)) { throw "Project root not found: $Root" }
if (-not (Test-Path $Payload)) { throw "Patch payload not found: $Payload" }
if (-not (Test-Path $Entry)) { throw "Core API entry not found: $Entry" }

Write-Host "=== KMITORA A000 E2E INTELLIGENCE 013-026 ===" -ForegroundColor Cyan
Write-Host "Rule: reuse existing functionality; do not duplicate equivalent implementations." -ForegroundColor Yellow

Ensure-Dir $Dest
Ensure-Dir (Join-Path $Root "_kmitora_backups")

$installed = 0
$skipped = 0
Get-ChildItem $Payload -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($Payload.Length).TrimStart('\')
    $target = Join-Path $Dest $rel
    Ensure-Dir (Split-Path $target -Parent)
    if (Test-Path $target) {
        if ((Sha $_.FullName) -eq (Sha $target)) {
            Write-Host "SKIP identical: $rel" -ForegroundColor DarkGray
            $script:skipped++
            return
        }
        # This namespace is owned by this patch family; preserve the prior version before update.
        $bak = Join-Path $Root ("_kmitora_backups\a000_core_{0}_{1}.bak" -f ($rel -replace '[\\/:*?"<>|]','_'), $Stamp)
        Copy-Item -LiteralPath $target -Destination $bak -Force
        Write-Host "BACKUP changed owned file: $bak" -ForegroundColor Yellow
    }
    Copy-Item -LiteralPath $_.FullName -Destination $target -Force
    Write-Host "INSTALL: $rel" -ForegroundColor Green
    $script:installed++
}

# Attach exactly once. Do not replace or alter existing semantic/training routers.
$text = Get-Content -LiteralPath $Entry -Raw
$start = "# BEGIN KMITORA_A000_E2E_INTELLIGENCE_013_026"
$end = "# END KMITORA_A000_E2E_INTELLIGENCE_013_026"
if ($text.Contains($start)) {
    Write-Host "SKIP duplicate router block already exists." -ForegroundColor DarkGray
} else {
    $entryBackup = Join-Path $Root "_kmitora_backups\F1033_server.py.A000_E2E_013_026_$Stamp.bak"
    Copy-Item -LiteralPath $Entry -Destination $entryBackup -Force
    $block = @'
# BEGIN KMITORA_A000_E2E_INTELLIGENCE_013_026
try:
    import sys as _kmitora_sys
    from pathlib import Path as _KmitoraPath
    _kmitora_backend = str(_KmitoraPath(__file__).resolve().parents[1])
    if _kmitora_backend not in _kmitora_sys.path:
        _kmitora_sys.path.insert(0, _kmitora_backend)
    from a000_core.api_router import router as kmitora_a000_core_router
    if not any(getattr(r, "path", "").startswith("/api/a000/core") for r in app.routes):
        app.include_router(kmitora_a000_core_router)
except Exception as kmitora_a000_core_error:
    print(f"[KMITORA] A000 core intelligence router not loaded: {kmitora_a000_core_error}")
# END KMITORA_A000_E2E_INTELLIGENCE_013_026
'@
    Add-Content -LiteralPath $Entry -Value "`r`n$block`r`n" -Encoding UTF8
    Write-Host "ATTACHED A000 core router exactly once." -ForegroundColor Green
    Write-Host "Backup: $entryBackup" -ForegroundColor DarkGray
}

$Python = Join-Path $Root "backend\.venv\Scripts\python.exe"
if (-not (Test-Path $Python)) { throw "Python venv not found: $Python" }

& $Python -m compileall $Dest
if ($LASTEXITCODE -ne 0) { throw "A000 core compile failed." }
& $Python -m py_compile $Entry
if ($LASTEXITCODE -ne 0) { throw "F1033_server.py compile failed." }
& $Python (Join-Path $Dest "tests\test_a000_core_013_026.py")
if ($LASTEXITCODE -ne 0) { throw "A000 core smoke tests failed." }

Write-Host ""
Write-Host "A000_E2E_INTELLIGENCE_013_026 applied successfully." -ForegroundColor Green
Write-Host "Installed/updated files : $installed"
Write-Host "Identical files skipped : $skipped"
Write-Host "Mode                    : PLAN_ONLY" -ForegroundColor Cyan
Write-Host "Production writes       : 0" -ForegroundColor Cyan
