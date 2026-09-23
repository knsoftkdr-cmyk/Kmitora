param(
    [string]$Repo = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = "Stop"

foreach ($port in 8080, 5173) {
    $reachable = Test-NetConnection `
        127.0.0.1 `
        -Port $port `
        -InformationLevel Quiet

    if (-not $reachable) {
        throw "Required KMITORA port $port is not reachable."
    }
}

Push-Location (Join-Path $Repo "frontend")
try {
    npm run build

    if ($LASTEXITCODE -ne 0) {
        throw "Frontend production build failed."
    }

    $cinematicTest = npx playwright test `
        --list `
        --project=chromium |
        Select-String "Cinematic Executive Demo supports scenario presets and presentation controls"

    if (-not $cinematicTest) {
        throw "Playwright cannot discover the Cinematic Executive Demo test."
    }

    Write-Host $cinematicTest -ForegroundColor Green

    npx playwright test `
        --project=chromium `
        --grep "Cinematic Executive Demo supports scenario presets and presentation controls" `
        --reporter=list `
        --trace=retain-on-failure

    if ($LASTEXITCODE -ne 0) {
        throw "Cinematic Executive Demo E2E failed."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "==============================================" -ForegroundColor Green
Write-Host "KMITORA CINEMATIC EXECUTIVE DEMO: PASS" -ForegroundColor Green
Write-Host "Frontend production build: PASS" -ForegroundColor Green
Write-Host "Scenario preset switching: PASS" -ForegroundColor Green
Write-Host "Presentation controls: PASS" -ForegroundColor Green
Write-Host "Safety banner: PASS" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green
