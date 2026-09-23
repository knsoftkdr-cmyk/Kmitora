$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Current = Join-Path $Root "frontend\src\pages\MegaDemoControlRoom.tsx"
$Legacy = Join-Path $Root "frontend\src\pages\MegaDemoControlRoomLegacy.tsx"
$Projection = Join-Path $Root "frontend\src\services\authoritativeRunProjection.ts"
$EvidenceProjection = Join-Path $Root "frontend\src\services\authoritativeEvidenceProjection.ts"
$Css = Join-Path $Root "frontend\src\styles\mega-demo-authoritative-replay.css"

$checks = @(
  @{ N="Authoritative wrapper exists"; P=(Test-Path $Current) },
  @{ N="Reference Mega Demo preserved"; P=(Test-Path $Legacy) },
  @{ N="Authoritative run projection exists"; P=(Test-Path $Projection) },
  @{ N="Authoritative evidence projection exists"; P=(Test-Path $EvidenceProjection) },
  @{ N="Professional Mega Demo stylesheet exists"; P=(Test-Path $Css) }
)

if (Test-Path $Current) {
  $currentText = Get-Content $Current -Raw
  $checks += @{ N="Wrapper marker present"; P=($currentText -match "A000 AUTHORITATIVE OPERATIONS") }
  $checks += @{ N="Wrapper renders 13-stage authoritative lifecycle"; P=($currentText -match "13-STAGE AUTHORITATIVE LIFECYCLE") }
  $checks += @{ N="Reference qualification separated"; P=($currentText -match "REFERENCE RUNTIME QUALIFICATION") }
}
if (Test-Path $Legacy) {
  $legacyText = Get-Content $Legacy -Raw
  $checks += @{ N="Legacy is not recursive wrapper"; P=($legacyText -notmatch "A000 AUTHORITATIVE OPERATIONS") }
  $checks += @{ N="Legacy contains Mega Enterprise Control Room"; P=($legacyText -match "Mega Enterprise Control Room") }
}

Write-Host "=== KMITORA MEGA_DEMO_AUTHORITATIVE_REPLAY_008A verification ==="
foreach ($c in $checks) {
  if ($c.P) { Write-Host "PASS  $($c.N)" -ForegroundColor Green }
  else { throw "FAIL  $($c.N)" }
}
Write-Host ""
Write-Host "MEGA_DEMO_AUTHORITATIVE_REPLAY_008A code verification passed." -ForegroundColor Green
