$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$Root = "C:\KMITORA\Kmitora-main\Kmitora-main"
$Bridge = Join-Path $Root "backend\a000_core\live_bridge.py"
$Entry = Join-Path $Root "backend\main_api\F1033_server.py"
$Test = Join-Path $Root "backend\a000_core\tests\test_live_runtime_hardening_028.py"
$Live = Join-Path $Root "tools\run_a000_live_qualification_028.ps1"
$Python = Join-Path $Root "backend\.venv\Scripts\python.exe"

function Pass([string]$m) { Write-Host "PASS  $m" -ForegroundColor Green }
function Check([bool]$ok,[string]$m) { if (-not $ok) { throw "FAIL  $m" }; Pass $m }

Write-Host "=== KMITORA A000_LIVE_RUNTIME_HARDENING_028 verification ===" -ForegroundColor Cyan

foreach ($p in @($Bridge,$Entry,$Test,$Live,$Python)) { Check (Test-Path $p) "Exists: $p" }
$bridgeText = Get-Content -LiteralPath $Bridge -Raw
$entryText = Get-Content -LiteralPath $Entry -Raw
Check ($bridgeText.Contains('KMITORA_A000_LIVE_RUNTIME_HARDENING_028')) "028 hardening marker"
Check ($bridgeText.Contains('reused_existing_shadow_runtime')) "Existing shadow runtime is reused"
Check ($bridgeText.Contains('EXISTING_SHADOW_RUNTIME_UNGROUNDED')) "Ungrounded requests fail to abstention"
Check ($bridgeText.Contains('grounding_guard')) "Grounding guard emitted"
Check (($entryText | Select-String -Pattern 'BEGIN KMITORA_A000_LIVE_UNIFIED_RUNTIME_027' -AllMatches).Matches.Count -eq 1) "027 message integration remains exactly once"
Check (($entryText | Select-String -Pattern 'if path == ["'']/v1/a000/messages["'']:' -AllMatches).Matches.Count -eq 1) "A000 message route remains exactly once"
Check ($entryText.Contains('reply["unified_runtime"]')) "Unified runtime attachment preserved"

& $Python -m py_compile $Bridge
if ($LASTEXITCODE -ne 0) { throw "FAIL  live bridge compile" }
Pass "Live bridge compiles"
& $Python -m py_compile $Entry
if ($LASTEXITCODE -ne 0) { throw "FAIL  F1033 compile" }
Pass "F1033 compiles"
& $Python $Test
if ($LASTEXITCODE -ne 0) { throw "FAIL  028 deterministic hardening test" }
Pass "028 deterministic hardening test"

Write-Host ""
Write-Host "A000_LIVE_RUNTIME_HARDENING_028 code verification passed." -ForegroundColor Green
Write-Host "Restart Core and run tools\run_a000_live_qualification_028.ps1 for live HTTP qualification." -ForegroundColor Yellow
