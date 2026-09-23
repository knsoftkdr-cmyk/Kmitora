$ErrorActionPreference = "Stop"
$Root = "C:\KMITORA\Kmitora-main\Kmitora-main"
$Core = Join-Path $Root "backend\a000_core"
$Entry = Join-Path $Root "backend\main_api\F1033_server.py"
$Python = Join-Path $Root "backend\.venv\Scripts\python.exe"

Write-Host "=== KMITORA A000 E2E INTELLIGENCE 013-026 verification ===" -ForegroundColor Cyan

$checks = @(
    @{N="013 registry"; P=(Join-Path $Core "registry.py"); S="UniversalRegistry"},
    @{N="013 semantic dedup"; P=(Join-Path $Core "dedup.py"); S="def equivalent"},
    @{N="014 intent classifier"; P=(Join-Path $Core "intent.py"); S="def classify"},
    @{N="015 policy runtime"; P=(Join-Path $Core "policy.py"); S="PRODUCTION_STATE_CHANGE_DENIED_BY_DEFAULT"},
    @{N="016 skill/tool gateway"; P=(Join-Path $Core "dispatch.py"); S="class ToolGateway"},
    @{N="017 validator framework"; P=(Join-Path $Core "validators.py"); S="class ValidatorFramework"},
    @{N="018 database IR"; P=(Join-Path $Core "db_ir.py"); S="class DatabaseIR"},
    @{N="019 database translation"; P=(Join-Path $Core "db_translate.py"); S="def translate"},
    @{N="020 DAG planner"; P=(Join-Path $Core "dag.py"); S="class DAGPlanner"},
    @{N="021 simulation"; P=(Join-Path $Core "simulate.py"); S="def simulate"},
    @{N="022 RCA/healing"; P=(Join-Path $Core "heal.py"); S="def remediation_plan"},
    @{N="023 evaluation/calibration"; P=(Join-Path $Core "evaluate.py"); S="def calibrated_confidence"},
    @{N="024 evidence runtime"; P=(Join-Path $Core "evidence.py"); S="def build_evidence"},
    @{N="025 observability"; P=(Join-Path $Core "telemetry.py"); S="class Telemetry"},
    @{N="026 verified learning"; P=(Join-Path $Core "learning.py"); S="def promotion_gate"},
    @{N="A000 runtime"; P=(Join-Path $Core "runtime.py"); S="class A000CoreRuntime"},
    @{N="A000 API router"; P=(Join-Path $Core "api_router.py"); S="/api/a000/core"}
)
foreach ($c in $checks) {
    if (-not (Test-Path $c.P)) { throw "FAIL $($c.N): file missing $($c.P)" }
    if (-not (Select-String -LiteralPath $c.P -SimpleMatch $c.S -Quiet)) { throw "FAIL $($c.N): marker missing" }
    Write-Host "PASS  $($c.N)" -ForegroundColor Green
}

$text = Get-Content -LiteralPath $Entry -Raw
$count = ([regex]::Matches($text, [regex]::Escape("# BEGIN KMITORA_A000_E2E_INTELLIGENCE_013_026"))).Count
if ($count -ne 1) { throw "FAIL router block count: $count" }
Write-Host "PASS  router attached exactly once" -ForegroundColor Green

& $Python -m compileall $Core | Out-Null
if ($LASTEXITCODE -ne 0) { throw "FAIL Python compile" }
Write-Host "PASS  Python compile" -ForegroundColor Green

& $Python (Join-Path $Core "tests\test_a000_core_013_026.py")
if ($LASTEXITCODE -ne 0) { throw "FAIL smoke tests" }
Write-Host "PASS  dedup/planning/translation/learning smoke tests" -ForegroundColor Green

Write-Host ""
Write-Host "A000_E2E_INTELLIGENCE_013_026 code verification passed." -ForegroundColor Green
Write-Host "Note: verification proves included deterministic checks; it is not a mathematical guarantee of 100% correctness for every future scenario." -ForegroundColor Yellow
