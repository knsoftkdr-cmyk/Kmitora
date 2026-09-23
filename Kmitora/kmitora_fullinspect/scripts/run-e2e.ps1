param(
  [switch]$InstallBrowsers,
  [switch]$Headed,
  [string]$TargetDatabase = "",
  [string]$TargetUsername = "",
  [string]$TargetPassword = ""
)

$ErrorActionPreference = "Stop"
$Repo = Split-Path -Parent $PSScriptRoot
$Frontend = Join-Path $Repo "frontend"
$Golden = Join-Path $Repo "TEST_DATA\E2E_GOLDEN\source\happy"

$env:KMITORA_UI_URL = "http://127.0.0.1:5173"
$env:KMITORA_CORE_URL = "http://127.0.0.1:8080"
$env:KMITORA_SOURCE_URL = "http://127.0.0.1:8081"
$env:KMITORA_TARGET_URL = "http://127.0.0.1:8082"
$env:KMITORA_GOLDEN_SOURCE_DIR = $Golden

if ($TargetDatabase) { $env:KMITORA_E2E_TARGET_DATABASE = $TargetDatabase }
if ($TargetUsername) { $env:KMITORA_E2E_TARGET_USERNAME = $TargetUsername }
if ($TargetPassword) { $env:KMITORA_E2E_TARGET_PASSWORD = $TargetPassword }

$ports = 5173, 8080, 8081, 8082
foreach ($port in $ports) {
  $ok = Test-NetConnection 127.0.0.1 -Port $port -InformationLevel Quiet
  if (-not $ok) { throw "Required KMITORA port $port is not reachable." }
}

Push-Location $Frontend
try {
  npm install
  if ($InstallBrowsers) {
    npx playwright install chromium
  }

  npm run build

  if ($Headed) {
    npm run test:e2e:headed
  } else {
    npm run test:e2e
  }
}
finally {
  Pop-Location
}
