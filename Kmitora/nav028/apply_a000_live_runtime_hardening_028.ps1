$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$Root = "C:\KMITORA\Kmitora-main\Kmitora-main"
$PatchRoot = Split-Path $PSScriptRoot -Parent
$Bridge = Join-Path $Root "backend\a000_core\live_bridge.py"
$Entry = Join-Path $Root "backend\main_api\F1033_server.py"
$Python = Join-Path $Root "backend\.venv\Scripts\python.exe"
$Patcher = Join-Path $PSScriptRoot "patch_live_bridge_028.py"
$TestSrc = Join-Path $PSScriptRoot "payload\backend\a000_core\tests\test_live_runtime_hardening_028.py"
$ToolSrc = Join-Path $PSScriptRoot "payload\tools\run_a000_live_qualification_028.ps1"
$TestDst = Join-Path $Root "backend\a000_core\tests\test_live_runtime_hardening_028.py"
$ToolDst = Join-Path $Root "tools\run_a000_live_qualification_028.ps1"
$BackupDir = Join-Path $Root "_kmitora_backups"
$Stamp = Get-Date -Format "yyyyMMdd_HHmmss"

function Ensure-Dir([string]$p) { if (-not (Test-Path $p)) { New-Item -ItemType Directory -Path $p -Force | Out-Null } }
function Sha([string]$p) { (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash }

foreach ($p in @($Root,$Bridge,$Entry,$Python,$Patcher,$TestSrc,$ToolSrc)) {
    if (-not (Test-Path $p)) { throw "Required path missing: $p" }
}

$entryText = Get-Content -LiteralPath $Entry -Raw
if ($entryText -notmatch 'KMITORA_A000_LIVE_UNIFIED_RUNTIME_027') {
    throw "027 is not integrated into F1033_server.py. Apply/verify 027 before 028."
}

Write-Host "=== KMITORA A000 LIVE RUNTIME HARDENING 028 ===" -ForegroundColor Cyan
Write-Host "Reuses existing shadow grounding; adds no duplicate retrieval implementation." -ForegroundColor Yellow

Ensure-Dir $BackupDir
if ((Get-Content -LiteralPath $Bridge -Raw) -notmatch 'KMITORA_A000_LIVE_RUNTIME_HARDENING_028') {
    $bak = Join-Path $BackupDir "live_bridge.py.A000_028_$Stamp.bak"
    Copy-Item -LiteralPath $Bridge -Destination $bak -Force
    & $Python $Patcher $Bridge
    if ($LASTEXITCODE -ne 0) {
        Copy-Item -LiteralPath $bak -Destination $Bridge -Force
        throw "028 bridge patch failed; live_bridge.py restored."
    }
    Write-Host "Backup: $bak" -ForegroundColor DarkGray
} else {
    Write-Host "SKIP 028 bridge hardening already installed." -ForegroundColor DarkGray
}

foreach ($pair in @(@($TestSrc,$TestDst),@($ToolSrc,$ToolDst))) {
    $src = $pair[0]; $dst = $pair[1]
    Ensure-Dir (Split-Path $dst -Parent)
    if ((Test-Path $dst) -and ((Sha $src) -eq (Sha $dst))) {
        Write-Host "SKIP identical: $dst" -ForegroundColor DarkGray
    } else {
        if (Test-Path $dst) {
            $bak = Join-Path $BackupDir ((Split-Path $dst -Leaf) + ".A000_028_$Stamp.bak")
            Copy-Item -LiteralPath $dst -Destination $bak -Force
        }
        Copy-Item -LiteralPath $src -Destination $dst -Force
        Write-Host "INSTALL: $dst" -ForegroundColor Green
    }
}

& $Python -m py_compile $Bridge
if ($LASTEXITCODE -ne 0) { throw "028 live bridge compile failed." }
& $Python $TestDst
if ($LASTEXITCODE -ne 0) { throw "028 deterministic test failed." }

Write-Host ""
Write-Host "A000_LIVE_RUNTIME_HARDENING_028 applied successfully." -ForegroundColor Green
Write-Host "Next: restart port 8080, then run tools\run_a000_live_qualification_028.ps1" -ForegroundColor Cyan
