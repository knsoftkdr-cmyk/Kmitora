param(
  [Parameter(Mandatory = $true)]
  [string]$TargetDatabase,

  [Parameter(Mandatory = $true)]
  [string]$TargetUsername,

  [Parameter(Mandatory = $true)]
  [string]$TargetPassword,

  [string]$TargetHost = "127.0.0.1",
  [int]$TargetPort = 5432,
  [string]$TargetSchema = "public",
  [string]$PsqlPath = ""
)

$ErrorActionPreference = "Stop"

$Repo = Split-Path -Parent $PSScriptRoot
$Frontend = Join-Path $Repo "frontend"
$ResetSql = Join-Path $Repo "TEST_DATA\E2E_GOLDEN\target\postgresql\02_reset_target.sql"
$Golden = Join-Path $Repo "TEST_DATA\E2E_GOLDEN\source\happy"

if (-not $PsqlPath) {
  $candidates = Get-ChildItem `
    "C:\Program Files\PostgreSQL" `
    -Recurse `
    -Filter "psql.exe" `
    -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending

  if (-not $candidates) {
    throw "psql.exe was not found. Pass -PsqlPath with the installed PostgreSQL client path."
  }

  $PsqlPath = $candidates[0].FullName
}

if (-not (Test-Path $PsqlPath)) {
  throw "psql.exe not found at: $PsqlPath"
}

$ports = 5173, 8080, 8081, 8082
foreach ($port in $ports) {
  if (-not (Test-NetConnection 127.0.0.1 -Port $port -InformationLevel Quiet)) {
    throw "Required KMITORA port $port is not reachable."
  }
}

$env:KMITORA_UI_URL = "http://127.0.0.1:5173"
$env:KMITORA_CORE_URL = "http://127.0.0.1:8080"
$env:KMITORA_SOURCE_URL = "http://127.0.0.1:8081"
$env:KMITORA_TARGET_URL = "http://127.0.0.1:8082"
$env:KMITORA_GOLDEN_SOURCE_DIR = $Golden

$env:KMITORA_E2E_TARGET_NAME = "KMITORA E2E DEV Target"
$env:KMITORA_E2E_TARGET_TYPE = "postgresql"
$env:KMITORA_E2E_TARGET_ENV = "DEV"
$env:KMITORA_E2E_TARGET_HOST = $TargetHost
$env:KMITORA_E2E_TARGET_PORT = [string]$TargetPort
$env:KMITORA_E2E_TARGET_DATABASE = $TargetDatabase
$env:KMITORA_E2E_TARGET_SCHEMA = $TargetSchema
$env:KMITORA_E2E_TARGET_USERNAME = $TargetUsername
$env:KMITORA_E2E_TARGET_PASSWORD = $TargetPassword

Write-Host "Resetting dedicated KMITORA E2E target..."
$previousPgPassword = $env:PGPASSWORD
$env:PGPASSWORD = $TargetPassword

try {
  & $PsqlPath `
    -h $TargetHost `
    -p $TargetPort `
    -U $TargetUsername `
    -d $TargetDatabase `
    -v ON_ERROR_STOP=1 `
    -f $ResetSql

  if ($LASTEXITCODE -ne 0) {
    throw "PostgreSQL target reset failed with exit code $LASTEXITCODE."
  }

  Push-Location $Frontend
  try {
    npm run build
    if ($LASTEXITCODE -ne 0) {
      throw "Frontend build failed."
    }

    npx playwright test `
      "tests/e2e/09_real_source_target_golden_path.spec.ts" `
      --reporter=list

    if ($LASTEXITCODE -ne 0) {
      throw "Golden-path Playwright test failed."
    }
  }
  finally {
    Pop-Location
  }
}
finally {
  $env:PGPASSWORD = $previousPgPassword
}

Write-Host ""
Write-Host "Golden-path evidence:"
Write-Host (Join-Path $Frontend "test-results\golden-path\real-source-target-reconcile-evidence.json")
