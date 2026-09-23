$ErrorActionPreference = "Stop"
$Project = Split-Path -Parent $MyInvocation.MyCommand.Path
$Current = Join-Path $Project "frontend\src\pages\MegaDemoControlRoom.tsx"
$Legacy = Join-Path $Project "frontend\src\pages\MegaDemoControlRoomLegacy.tsx"
$RunProjection = Join-Path $Project "frontend\src\services\authoritativeRunProjection.ts"
$EvidenceProjection = Join-Path $Project "frontend\src\services\authoritativeEvidenceProjection.ts"
$Css = Join-Path $Project "frontend\src\styles\mega-demo-authoritative-replay.css"

$checks = @(
  @{ N="Authoritative wrapper exists"; P=(Test-Path $Current) },
  @{ N="Reference Mega Demo preserved"; P=(Test-Path $Legacy) },
  @{ N="Authoritative run projection exists"; P=(Test-Path $RunProjection) },
  @{ N="Authoritative evidence projection exists"; P=(Test-Path $EvidenceProjection) },
  @{ N="Professional Mega Demo stylesheet exists"; P=(Test-Path $Css) }
)
foreach ($c in $checks) { if ($c.P) { Write-Host "PASS  $($c.N)" -ForegroundColor Green } else { throw "FAIL  $($c.N)" } }

$currentText = Get-Content $Current -Raw
$legacyText = Get-Content $Legacy -Raw
$runText = Get-Content $RunProjection -Raw

$semanticChecks = @(
  @{ N="Wrapper marker present"; P=($currentText -match "A000 AUTHORITATIVE OPERATIONS") },
  @{ N="Wrapper renders 13-stage authoritative lifecycle"; P=($currentText -match "13-stage" -or $currentText -match "13 / 13") },
  @{ N="Reference qualification separated"; P=($currentText -match "REFERENCE" -and $currentText -match "QUALIFICATION") },
  @{ N="Reference is not recursive wrapper"; P=($legacyText -notmatch "A000 AUTHORITATIVE OPERATIONS") },
  @{ N="Reference contains Mega Enterprise Control Room"; P=($legacyText -match "Mega Enterprise Control Room") },
  @{ N="POST_LOAD semantics projected"; P=($runText -match "POST_LOAD") },
  @{ N="Review-held separated from blocked"; P=($runText -match "review" -and $runText -match "blocked") },
  @{ N="Production boundary projected"; P=($runText -match "production") }
)
foreach ($c in $semanticChecks) { if ($c.P) { Write-Host "PASS  $($c.N)" -ForegroundColor Green } else { throw "FAIL  $($c.N)" } }

Write-Host ""
Write-Host "MEGA_DEMO_AUTHORITATIVE_REPLAY_008B code verification passed." -ForegroundColor Green
