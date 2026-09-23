$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$Root = "C:\KMITORA\Kmitora-main\Kmitora-main"
$Entry = Join-Path $Root "backend\main_api\F1033_server.py"
$Core = Join-Path $Root "backend\a000_core"
$Python = Join-Path $Root "backend\.venv\Scripts\python.exe"

function Pass([string]$m) { Write-Host "PASS  $m" -ForegroundColor Green }
function Check([bool]$ok,[string]$m) { if (-not $ok) { throw "FAIL  $m" }; Pass $m }

Write-Host "=== KMITORA A000_LIVE_UNIFIED_RUNTIME_027 verification ===" -ForegroundColor Cyan

$Bridge = Join-Path $Core "live_bridge.py"
$Test = Join-Path $Core "tests\test_live_bridge_027.py"
Check (Test-Path $Bridge) "Live bridge exists"
Check (Test-Path $Test) "027 smoke test exists"
Check (Test-Path $Entry) "F1033 server exists"

$entryText = Get-Content -LiteralPath $Entry -Raw
$bridgeText = Get-Content -LiteralPath $Bridge -Raw
Check (($entryText | Select-String -Pattern 'BEGIN KMITORA_A000_LIVE_UNIFIED_RUNTIME_027' -AllMatches).Matches.Count -eq 1) "027 integration marker exactly once"
Check ($entryText.Contains('reply["unified_runtime"]')) "Unified runtime attached to normal A000 reply"
Check ($entryText.Contains('/v1/a000/messages')) "Normal A000 message route preserved"
Check ($bridgeText.Contains('REUSE_CANONICAL_REGISTRY_FIRST')) "Canonical dedup/reuse strategy"
Check ($bridgeText.Contains('execution_authority')) "Execution authority guard"
Check ($bridgeText.Contains('production_action_executed')) "Production safety guard"
Check ($bridgeText.Contains('promotion_gate')) "Verified learning gate connected"
Check ($bridgeText.Contains('_database_translation')) "Database translation connected"
Check ($bridgeText.Contains('_diagnostics')) "RCA/healing planning connected"

& $Python -m py_compile $Bridge
if ($LASTEXITCODE -ne 0) { throw "FAIL  Live bridge compile" }
Pass "Live bridge compiles"
& $Python -m py_compile $Entry
if ($LASTEXITCODE -ne 0) { throw "FAIL  F1033 compile" }
Pass "F1033 server compiles"
& $Python $Test
if ($LASTEXITCODE -ne 0) { throw "FAIL  027 deterministic smoke" }
Pass "027 deterministic smoke"

Write-Host ""
Write-Host "A000_LIVE_UNIFIED_RUNTIME_027 code verification passed." -ForegroundColor Green
Write-Host "This proves code attachment and included deterministic checks; live HTTP verification follows after restart." -ForegroundColor Yellow
