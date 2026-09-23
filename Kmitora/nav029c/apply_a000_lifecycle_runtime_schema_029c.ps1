param([string]$ProjectRoot = "C:\KMITORA\Kmitora-main\Kmitora-main")
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
Write-Host "=== KMITORA A000 LIFECYCLE RUNTIME SCHEMA 029C ===" -ForegroundColor Cyan
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$Payload = Join-Path $Here "payload"
$Backend = Join-Path $ProjectRoot "backend"
$Core = Join-Path $Backend "a000_core"
$Tools = Join-Path $ProjectRoot "tools"
$Python = Join-Path $Backend ".venv\Scripts\python.exe"
if (-not (Test-Path $Python)) { throw "Python not found: $Python" }
if (-not (Test-Path (Join-Path $Core "live_bridge.py"))) { throw "027/028A live bridge missing." }
if (-not (Test-Path (Join-Path $Core "lifecycle_bridge.py"))) { throw "029 lifecycle bridge missing." }
$Stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupDir = Join-Path $ProjectRoot "_cleanup_audit\029C_$Stamp"
New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
Copy-Item (Join-Path $Core "lifecycle_bridge.py") (Join-Path $BackupDir "lifecycle_bridge.py") -Force
New-Item -ItemType Directory -Path (Join-Path $Core "tests") -Force | Out-Null
New-Item -ItemType Directory -Path $Tools -Force | Out-Null
Copy-Item (Join-Path $Payload "backend\a000_core\lifecycle_bridge.py") (Join-Path $Core "lifecycle_bridge.py") -Force
Copy-Item (Join-Path $Payload "backend\a000_core\tests\test_lifecycle_bridge_029c.py") (Join-Path $Core "tests\test_lifecycle_bridge_029c.py") -Force
Copy-Item (Join-Path $Payload "tools\run_a000_lifecycle_qualification_029c.ps1") (Join-Path $Tools "run_a000_lifecycle_qualification_029c.ps1") -Force
Write-Host "UPDATED lifecycle_bridge.py with 029C guarded-response projection." -ForegroundColor Green
Write-Host "INSTALLED deterministic and live qualification tests." -ForegroundColor Green
& $Python -m py_compile (Join-Path $Core "lifecycle_bridge.py") (Join-Path $Core "tests\test_lifecycle_bridge_029c.py")
if ($LASTEXITCODE -ne 0) { throw "029C Python compile failed." }
Push-Location $Backend
try { & $Python -m a000_core.tests.test_lifecycle_bridge_029c } finally { Pop-Location }
if ($LASTEXITCODE -ne 0) { throw "029C deterministic qualification failed." }
Write-Host "A000_LIFECYCLE_RUNTIME_SCHEMA_029C applied successfully." -ForegroundColor Green
Write-Host "Backup: $BackupDir"
