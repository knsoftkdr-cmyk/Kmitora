$ErrorActionPreference = "Stop"

Write-Host "=== VERIFY KMITORA A000 LIFECYCLE QUALIFICATION 029D3 ===" -ForegroundColor Cyan

$Target = "C:\KMITORA\Kmitora-main\Kmitora-main\tools\run_a000_lifecycle_qualification_029d.ps1"
if (-not (Test-Path -LiteralPath $Target)) { throw "Qualification script missing: $Target" }

$Text = Get-Content -LiteralPath $Target -Raw
if ($Text -match '\$Stage:') { throw 'FAIL parser-unsafe interpolation remains: $Stage:' }
if ($Text -notmatch '\$\{Stage\}:') { throw 'FAIL parser-safe ${Stage}: marker missing.' }
if ($Text -notmatch '\$Payload\.lifecycle_runtime') { throw 'FAIL lifecycle_runtime check missing.' }
if ($Text -notmatch '\$L\.safety') { throw 'FAIL nested safety check missing.' }
if ($Text -notmatch 'WebException') { throw 'FAIL guarded HTTP handling missing.' }

Write-Host "PASS  parser-safe Stage interpolation" -ForegroundColor Green
Write-Host "PASS  lifecycle runtime check" -ForegroundColor Green
Write-Host "PASS  nested safety check" -ForegroundColor Green
Write-Host "PASS  guarded HTTP handling" -ForegroundColor Green
Write-Host "A000_LIFECYCLE_QUALIFICATION_029D3 code verification passed." -ForegroundColor Green
