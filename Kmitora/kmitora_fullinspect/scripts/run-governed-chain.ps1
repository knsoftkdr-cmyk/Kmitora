$ErrorActionPreference = "Stop"

$Repo = Split-Path -Parent $PSScriptRoot
$Frontend = Join-Path $Repo "frontend"

$env:KMITORA_UI_URL = "http://127.0.0.1:5173"
$env:KMITORA_CORE_URL = "http://127.0.0.1:8080"
$env:KMITORA_SOURCE_URL = "http://127.0.0.1:8081"
$env:KMITORA_TARGET_URL = "http://127.0.0.1:8082"

$ports = 5173, 8080, 8081, 8082
foreach ($port in $ports) {
  $reachable = Test-NetConnection `
    127.0.0.1 `
    -Port $port `
    -InformationLevel Quiet

  if (-not $reachable) {
    throw "Required KMITORA port $port is not reachable."
  }
}

Push-Location $Frontend
try {
  npm run build
  if ($LASTEXITCODE -ne 0) {
    throw "Frontend build failed."
  }

  npx playwright test `
    "tests/e2e/10_governed_execution_chain.spec.ts" `
    --reporter=list

  if ($LASTEXITCODE -ne 0) {
    throw "Governed execution-chain Playwright tests failed."
  }
}
finally {
  Pop-Location
}

Write-Host ""
Write-Host "Governed-chain evidence:"
Write-Host (
  Join-Path `
    $Frontend `
    "test-results\governed-chain\approval-execute-test-validate-reconcile-evidence.json"
)
