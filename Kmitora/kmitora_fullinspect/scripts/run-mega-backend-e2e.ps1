param(
    [string]$Repo = (Split-Path -Parent $PSScriptRoot),
    [string]$Python = "C:\Python312\python.exe",
    [string]$BaseUrl = "http://127.0.0.1:8080"
)

$ErrorActionPreference = "Stop"

$Runner = Join-Path $Repo "demo_backend_mega_e2e\run_mega_backend_e2e.py"
$Scenario = Join-Path $Repo "demo_backend_mega_e2e\mega_enterprise_scenario.json"
$Output = Join-Path $Repo "demo_backend_mega_e2e\output"

if (-not (Test-Path $Runner)) {
    throw "Mega E2E runner not found: $Runner"
}

if (-not (Test-NetConnection 127.0.0.1 -Port 8080 -InformationLevel Quiet)) {
    throw "KMITORA backend is not reachable on port 8080."
}

& $Python $Runner `
    --base-url $BaseUrl `
    --repo-root $Repo `
    --scenario $Scenario `
    --output $Output

if ($LASTEXITCODE -ne 0) {
    throw "KMITORA Mega Enterprise Backend E2E failed. Review $Output\mega_e2e_report.md"
}

Write-Host ""
Write-Host "KMITORA MEGA ENTERPRISE BACKEND E2E: PASS" -ForegroundColor Green
Write-Host "JSON report: $Output\mega_e2e_report.json"
Write-Host "Markdown report: $Output\mega_e2e_report.md"
