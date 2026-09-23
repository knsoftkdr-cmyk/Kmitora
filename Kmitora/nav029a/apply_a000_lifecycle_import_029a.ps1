$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$Root = "C:\KMITORA\Kmitora-main\Kmitora-main"
$Python = Join-Path $Root "backend\.venv\Scripts\python.exe"
$Entry = Join-Path $Root "backend\main_api\F1033_server.py"
$DestTest = Join-Path $Root "backend\a000_core\tests\test_lifecycle_bridge_029.py"
$SrcTest = Join-Path $PSScriptRoot "payload\backend\a000_core\tests\test_lifecycle_bridge_029.py"
$Apply029 = Join-Path $Root "nav029\apply_a000_lifecycle_unified_runtime_029.ps1"
$Verify029 = Join-Path $Root "nav029\verify_a000_lifecycle_unified_runtime_029.ps1"
$BackupDir = Join-Path $Root "_kmitora_backups"
$Stamp = Get-Date -Format "yyyyMMdd_HHmmss"

foreach ($p in @($Root,$Python,$Entry,$SrcTest)) {
    if (-not (Test-Path $p)) { throw "Required path missing: $p" }
}
if (-not (Test-Path (Join-Path $Root "backend\a000_core\lifecycle_bridge.py"))) {
    throw "029 lifecycle bridge is not installed. Apply 029 first."
}

Write-Host "=== KMITORA A000 LIFECYCLE IMPORT FIX 029A ===" -ForegroundColor Cyan
if (-not (Test-Path $BackupDir)) { New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null }

# 1. Permanently repair the deterministic test so direct script execution can import a000_core.
$TestParent = Split-Path $DestTest -Parent
if (-not (Test-Path $TestParent)) { New-Item -ItemType Directory -Path $TestParent -Force | Out-Null }
if (Test-Path $DestTest) {
    Copy-Item -LiteralPath $DestTest -Destination (Join-Path $BackupDir "test_lifecycle_bridge_029.py.029A_$Stamp.bak") -Force
}
Copy-Item -LiteralPath $SrcTest -Destination $DestTest -Force
Write-Host "UPDATED backend\a000_core\tests\test_lifecycle_bridge_029.py" -ForegroundColor Green

# 2. Repair the already-extracted 029 installer/verifier for future reproducible reruns.
function Repair-029Script([string]$Path) {
    if (-not (Test-Path $Path)) { return }
    $Text = Get-Content -LiteralPath $Path -Raw
    $Original = $Text
    $Text = $Text -replace '& \$Python \(Join-Path \$Dest "tests\\test_lifecycle_bridge_029\.py"\)', '& $Python -m a000_core.tests.test_lifecycle_bridge_029'
    $Text = $Text -replace '& \$Python \$Test', '& $Python -m a000_core.tests.test_lifecycle_bridge_029'
    if ($Text -ne $Original) {
        Copy-Item -LiteralPath $Path -Destination (Join-Path $BackupDir ((Split-Path $Path -Leaf) + ".029A_$Stamp.bak")) -Force
        Set-Content -LiteralPath $Path -Value $Text -Encoding UTF8
        Write-Host "REPAIRED $(Split-Path $Path -Leaf)" -ForegroundColor Green
    } else {
        Write-Host "SKIP $(Split-Path $Path -Leaf) already compatible" -ForegroundColor DarkGray
    }
}
Repair-029Script $Apply029
Repair-029Script $Verify029

# 3. Confirm the partially applied 029 runtime marker exists exactly once.
$EntryText = Get-Content -LiteralPath $Entry -Raw
$Count = ([regex]::Matches($EntryText, 'BEGIN KMITORA_A000_LIFECYCLE_UNIFIED_RUNTIME_029')).Count
if ($Count -ne 1) {
    throw "029 lifecycle runtime marker count is $Count; expected exactly 1. No duplicate marker will be created by 029A."
}
Write-Host "PASS 029 lifecycle runtime marker exists exactly once" -ForegroundColor Green

# 4. Compile and run deterministic qualification from backend package root.
& $Python -m py_compile $Entry (Join-Path $Root "backend\a000_core\lifecycle_bridge.py") $DestTest
if ($LASTEXITCODE -ne 0) { throw "029A Python compile failed." }
Write-Host "PASS Python compile" -ForegroundColor Green

Push-Location (Join-Path $Root "backend")
try {
    & $Python -m a000_core.tests.test_lifecycle_bridge_029
    if ($LASTEXITCODE -ne 0) { throw "029A deterministic qualification failed." }
}
finally { Pop-Location }
Write-Host "PASS deterministic 13-stage qualification" -ForegroundColor Green
Write-Host "A000_LIFECYCLE_IMPORT_029A applied successfully." -ForegroundColor Green
