param([string]$ProjectRoot = "C:\KMITORA\Kmitora-main\Kmitora-main")
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
Write-Host "=== VERIFY KMITORA A000 LIFECYCLE RUNTIME SCHEMA 029C ===" -ForegroundColor Cyan
$Backend = Join-Path $ProjectRoot "backend"
$Core = Join-Path $Backend "a000_core"
$Bridge = Join-Path $Core "lifecycle_bridge.py"
$Test = Join-Path $Core "tests\test_lifecycle_bridge_029c.py"
$Live = Join-Path $ProjectRoot "tools\run_a000_lifecycle_qualification_029c.ps1"
$Python = Join-Path $Backend ".venv\Scripts\python.exe"
function Pass($m){ Write-Host "PASS  $m" -ForegroundColor Green }
foreach($f in @($Bridge,$Test,$Live)){ if(-not(Test-Path $f)){ throw "Missing: $f" } }
Pass "029C files present"
$Text = Get-Content $Bridge -Raw
if($Text -notmatch 'A000_LIFECYCLE_RUNTIME_SCHEMA_029C'){ throw "029C marker missing" }; Pass "029C marker present"
if($Text -notmatch 'guarded_or_error_response'){ throw "Guarded-response projection missing" }; Pass "guarded/error response projection present"
if($Text -notmatch '"safety"'){ throw "Nested safety schema missing" }; Pass "nested safety schema retained"
& $Python -m py_compile $Bridge $Test
if($LASTEXITCODE -ne 0){ throw "Compile failed" }; Pass "Python compile"
Push-Location $Backend
try { & $Python -m a000_core.tests.test_lifecycle_bridge_029c } finally { Pop-Location }
if($LASTEXITCODE -ne 0){ throw "Deterministic test failed" }; Pass "029C deterministic qualification"
Write-Host "A000_LIFECYCLE_RUNTIME_SCHEMA_029C code verification passed." -ForegroundColor Green
