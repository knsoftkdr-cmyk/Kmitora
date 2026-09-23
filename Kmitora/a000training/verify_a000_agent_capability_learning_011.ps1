param([string]$ProjectRoot = "C:\KMITORA\Kmitora-main\Kmitora-main")
$ErrorActionPreference = "Stop"
$Backend = Join-Path $ProjectRoot "backend"
$Pkg = Join-Path $Backend "a000_training"
$Entry = Join-Path $Backend "main_api\F1033_server.py"
$checks = @(
  @{N="Capability catalog"; P=(Join-Path $Pkg "capability_catalog.py")},
  @{N="Business rule router"; P=(Join-Path $Pkg "business_rule_router.py")},
  @{N="Oracle advanced seed"; P=(Join-Path $Pkg "oracle_advanced_seed.py")},
  @{N="Training API router"; P=(Join-Path $Pkg "api_router.py")}
)
foreach ($c in $checks) { if (Test-Path $c.P) { Write-Host "PASS  $($c.N)" -ForegroundColor Green } else { throw "FAIL  $($c.N)" } }
$text = Get-Content $Entry -Raw
foreach ($needle in @("KMITORA_A000_AGENT_CAPABILITY_LEARNING_011","/api/a000/training")) {
  if ($text -match [regex]::Escape($needle)) { Write-Host "PASS  $needle" -ForegroundColor Green } else { throw "FAIL  $needle" }
}
$Python = Join-Path $Backend ".venv\Scripts\python.exe"
& $Python -m compileall $Pkg | Out-Null
if ($LASTEXITCODE -ne 0) { throw "FAIL  Python compile" }
Write-Host "PASS  Python compile" -ForegroundColor Green
Write-Host ""; Write-Host "A000_AGENT_CAPABILITY_LEARNING_011 code verification passed." -ForegroundColor Green
