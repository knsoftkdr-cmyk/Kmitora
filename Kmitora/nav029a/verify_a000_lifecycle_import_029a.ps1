$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$Root = "C:\KMITORA\Kmitora-main\Kmitora-main"
$Python = Join-Path $Root "backend\.venv\Scripts\python.exe"
$Entry = Join-Path $Root "backend\main_api\F1033_server.py"
$Bridge = Join-Path $Root "backend\a000_core\lifecycle_bridge.py"
$Test = Join-Path $Root "backend\a000_core\tests\test_lifecycle_bridge_029.py"
$LiveTool = Join-Path $Root "tools\run_a000_lifecycle_qualification_029.ps1"
function Pass([string]$m) { Write-Host "PASS  $m" -ForegroundColor Green }
function Check([bool]$ok,[string]$m) { if (-not $ok) { throw "FAIL  $m" }; Pass $m }

Write-Host "=== A000_LIFECYCLE_IMPORT_029A verification ===" -ForegroundColor Cyan
foreach ($p in @($Python,$Entry,$Bridge,$Test,$LiveTool)) { Check (Test-Path $p) ("exists: " + $p) }
$T = Get-Content -LiteralPath $Test -Raw
Check ($T.Contains('BACKEND_ROOT = Path(__file__).resolve().parents[2]')) "test has backend import bootstrap"
Check ($T.Contains('sys.path.insert(0, str(BACKEND_ROOT))')) "test inserts backend package root"
$E = Get-Content -LiteralPath $Entry -Raw
Check (([regex]::Matches($E,'BEGIN KMITORA_A000_LIFECYCLE_UNIFIED_RUNTIME_029')).Count -eq 1) "029 centralized projection exists exactly once"
Check (([regex]::Matches($E,'BEGIN KMITORA_A000_LIVE_UNIFIED_RUNTIME_027')).Count -eq 1) "027 normal message runtime remains exactly once"
& $Python -m py_compile $Entry $Bridge $Test
if ($LASTEXITCODE -ne 0) { throw "FAIL Python compile" }
Pass "Python compile"
Push-Location (Join-Path $Root "backend")
try {
    & $Python -m a000_core.tests.test_lifecycle_bridge_029
    if ($LASTEXITCODE -ne 0) { throw "FAIL deterministic 13-stage qualification" }
}
finally { Pop-Location }
Pass "deterministic 13-stage qualification"
Write-Host ""
Write-Host "A000_LIFECYCLE_IMPORT_029A code verification passed." -ForegroundColor Green
