param(
    [string]$ReleaseRoot = "C:\KMITORA\RELEASES\KMITORA_v0_3_1_demo_ops",
    [string]$RuntimeRoot = "C:\KMITORA\DEMO_RUNTIME\v0.3.1-demo-ops"
)

$ErrorActionPreference = "Stop"
$Ops = Join-Path $ReleaseRoot "scripts\KMITORA_DEMO.ps1"
$Frontend = Join-Path $RuntimeRoot "Kmitora\frontend"

& $Ops preflight -NoBrowser

if ($LASTEXITCODE -ne 0 -and $null -ne $LASTEXITCODE) {
    throw "KMITORA preflight failed."
}

& $Ops start -NoBrowser

Push-Location $Frontend
try {
    npm run build

    if ($LASTEXITCODE -ne 0) {
        throw "Frontend production build failed."
    }

    $Found = npx playwright test `
        --list `
        --project=chromium |
        Select-String "Demo Operations exposes supervisor controls, preflight and safety state"

    if (-not $Found) {
        throw "Playwright cannot discover the Demo Operations test."
    }

    npx playwright test `
        --project=chromium `
        --grep "Demo Operations exposes supervisor controls, preflight and safety state" `
        --reporter=list `
        --trace=retain-on-failure

    if ($LASTEXITCODE -ne 0) {
        throw "Demo Operations E2E failed."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "KMITORA FRONTEND DEMO OPERATIONS: PASS" -ForegroundColor Green
Write-Host "Preflight: PASS" -ForegroundColor Green
Write-Host "Frontend production build: PASS" -ForegroundColor Green
Write-Host "Playwright Demo Operations: PASS" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
