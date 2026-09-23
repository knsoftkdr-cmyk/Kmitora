param(
  [string]$Repo = (Split-Path -Parent $PSScriptRoot),
  [string]$Python = "C:\Python312\python.exe"
)

$ErrorActionPreference = "Stop"

foreach ($port in 8080, 5173) {
  if (-not (Test-NetConnection 127.0.0.1 -Port $port -InformationLevel Quiet)) {
    throw "Required KMITORA port $port is not reachable."
  }
}

Push-Location (Join-Path $Repo "backend\main_api")
try {
  & $Python ".\test_digital_twin_graph_api.py"
  if ($LASTEXITCODE -ne 0) {
    throw "Digital Twin backend tests failed."
  }
}
finally {
  Pop-Location
}

Push-Location (Join-Path $Repo "frontend")
try {
  npm run build
  if ($LASTEXITCODE -ne 0) {
    throw "Frontend build failed."
  }

  npx playwright test `
    "tests\e2e\13_digital_twin_graph.spec.ts" `
    --reporter=list

  if ($LASTEXITCODE -ne 0) {
    throw "Digital Twin Graph E2E failed."
  }
}
finally {
  Pop-Location
}

Write-Host "KMITORA LIVE DIGITAL TWIN GRAPH: PASS" -ForegroundColor Green
