param(
  [string]$Repo = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = "Stop"
$Frontend = Join-Path $Repo "frontend"

foreach ($port in 5173, 8080) {
  if (-not (Test-NetConnection 127.0.0.1 -Port $port -InformationLevel Quiet)) {
    throw "Required port $port is not reachable."
  }
}

Push-Location $Frontend
try {
  npm run build
  if ($LASTEXITCODE -ne 0) {
    throw "Frontend build failed."
  }

  npx playwright test `
    "tests/e2e/13_digital_twin_graph.spec.ts" `
    --reporter=list

  if ($LASTEXITCODE -ne 0) {
    throw "Digital Twin Graph E2E failed."
  }
}
finally {
  Pop-Location
}
