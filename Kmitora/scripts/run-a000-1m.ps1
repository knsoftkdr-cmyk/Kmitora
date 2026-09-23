param(
  [string]$Python = "C:\Python312\python.exe",
  [switch]$ExportCatalog,
  [int]$Start = 1,
  [int]$End = 1000000
)

$ErrorActionPreference = "Stop"
$Repo = Split-Path -Parent $PSScriptRoot
$MainApi = Join-Path $Repo "backend\main_api"

if (-not (Test-Path $Python)) {
  throw "Python interpreter not found: $Python"
}

Push-Location $MainApi
try {
  Write-Host "1. Validating A000 one-million catalog..." -ForegroundColor Cyan
  & $Python -m a000_1m.cli validate
  if ($LASTEXITCODE -ne 0) {
    throw "A000 catalog validation failed."
  }

  Write-Host "2. Running deterministic integration tests..." -ForegroundColor Cyan
  & $Python .\test_a000_1m.py
  if ($LASTEXITCODE -ne 0) {
    throw "A000 one-million integration tests failed."
  }

  if ($ExportCatalog) {
    Write-Host "3. Exporting scenario catalog..." -ForegroundColor Cyan
    & $Python -m a000_1m.cli export `
      --start $Start `
      --end $End `
      --output "runtime_evidence\a000_1m_catalog.csv"
    if ($LASTEXITCODE -ne 0) {
      throw "Catalog export failed."
    }
  }

  Write-Host "4. Running governed scenario range $Start..$End..." -ForegroundColor Cyan
  & $Python -m a000_1m.cli run `
    --start $Start `
    --end $End `
    --output "runtime_evidence\a000_1m_evidence.jsonl"

  if ($LASTEXITCODE -ne 0) {
    throw "A000 scenario run failed."
  }
}
finally {
  Pop-Location
}

Write-Host ""
Write-Host "A000 one-million engine completed successfully." -ForegroundColor Green
Write-Host "Production writes/cutover/destructive/policy bypass remain DENIED."
