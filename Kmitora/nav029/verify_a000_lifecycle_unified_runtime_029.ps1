$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$Root = "C:\KMITORA\Kmitora-main\Kmitora-main"
$Entry = Join-Path $Root "backend\main_api\F1033_server.py"
$Bridge = Join-Path $Root "backend\a000_core\lifecycle_bridge.py"
$Test = Join-Path $Root "backend\a000_core\tests\test_lifecycle_bridge_029.py"
$Tool = Join-Path $Root "tools\run_a000_lifecycle_qualification_029.ps1"
$Python = Join-Path $Root "backend\.venv\Scripts\python.exe"
function Pass([string]$m) { Write-Host "PASS  $m" -ForegroundColor Green }
function Check([bool]$ok,[string]$m) { if (-not $ok) { throw "FAIL  $m" }; Pass $m }

Write-Host "=== A000_LIFECYCLE_UNIFIED_RUNTIME_029 verification ===" -ForegroundColor Cyan
Check (Test-Path $Entry) "F1033 server exists"
Check (Test-Path $Bridge) "029 lifecycle bridge exists"
Check (Test-Path $Test) "029 deterministic test exists"
Check (Test-Path $Tool) "029 live qualifier installed"
$T = Get-Content -LiteralPath $Entry -Raw
Check (($T | Select-String -Pattern 'BEGIN KMITORA_A000_LIFECYCLE_UNIFIED_RUNTIME_029' -AllMatches).Matches.Count -eq 1) "029 centralized send projection exists exactly once"
Check (($T | Select-String -Pattern 'BEGIN KMITORA_A000_LIVE_UNIFIED_RUNTIME_027' -AllMatches).Matches.Count -eq 1) "027 message runtime remains exactly once"
$B = Get-Content -LiteralPath $Bridge -Raw
foreach ($Stage in @('UNDERSTAND','DISCOVER','DETECT','DIAGNOSE','PREDICT','RECOMMEND','SIMULATE','EXECUTE','TEST','VALIDATE','RECONCILE','EVIDENCE','LEARN')) {
    Check ($B.Contains('"' + $Stage + '"')) "stage supported: $Stage"
}
Check ($B.Contains('run_live_unified_runtime')) "029 reuses 027 unified runtime"
Check ($B.Contains('duplicate_lifecycle_engines_created')) "duplicate-engine guard present"
Check ($B.Contains('authoritative_payload_preserved')) "authoritative payload preservation present"
& $Python -m py_compile $Entry $Bridge
if ($LASTEXITCODE -ne 0) { throw "FAIL  Python compile" }
Pass "Python compile"
Push-Location (Join-Path $Root "backend")
try {
    & $Python -m a000_core.tests.test_lifecycle_bridge_029
    if ($LASTEXITCODE -ne 0) { throw "FAIL  deterministic 13-stage qualification" }
}
finally { Pop-Location }
Pass "deterministic 13-stage qualification"
Write-Host ""
Write-Host "A000_LIFECYCLE_UNIFIED_RUNTIME_029 code verification passed." -ForegroundColor Green

