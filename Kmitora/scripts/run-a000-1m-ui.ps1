$ErrorActionPreference = "Stop"

$Repo = Split-Path -Parent $PSScriptRoot
$Frontend = Join-Path $Repo "frontend"

$ports = 5173, 8080
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
    "tests/e2e/11_a000_1m_ui_lifecycle.spec.ts" `
    --reporter=list

  if ($LASTEXITCODE -ne 0) {
    throw "A000 1M UI lifecycle tests failed."
  }
}
finally {
  Pop-Location
}
