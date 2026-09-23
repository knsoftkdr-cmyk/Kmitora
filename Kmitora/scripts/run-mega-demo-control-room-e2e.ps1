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
    & $Python ".\test_mega_demo_controller.py"
    if ($LASTEXITCODE -ne 0) {
        throw "Mega Demo controller backend tests failed."
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
        "tests\e2e\15_mega_demo_control_room.spec.ts" `
        --reporter=list

    if ($LASTEXITCODE -ne 0) {
        throw "Mega Demo Control Room E2E failed."
    }
}
finally {
    Pop-Location
}

Write-Host "KMITORA MEGA DEMO CONTROL ROOM: PASS" -ForegroundColor Green
