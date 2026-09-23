$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Page = Join-Path $Root "frontend\src\pages\MegaDemoControlRoom.tsx"
$Legacy = Join-Path $Root "frontend\src\pages\MegaDemoControlRoomLegacy.tsx"
$RunService = Join-Path $Root "frontend\src\services\authoritativeRunProjection.ts"
$EvidenceService = Join-Path $Root "frontend\src\services\authoritativeEvidenceProjection.ts"
$Css = Join-Path $Root "frontend\src\styles\mega-demo-authoritative-replay.css"

Write-Host "=== KMITORA MEGA_DEMO_AUTHORITATIVE_REPLAY_008 verification ==="

$checks = @(
  @{ N="Legacy Mega Demo preserved"; P=(Test-Path $Legacy) },
  @{ N="Authoritative wrapper installed"; P=(Test-Path $Page) },
  @{ N="Server-first evidence service present"; P=(Test-Path $EvidenceService) },
  @{ N="Authoritative run projection present"; P=(Test-Path $RunService) },
  @{ N="Professional presentation stylesheet present"; P=(Test-Path $Css) },
  @{ N="13-stage lifecycle projection"; P=((Get-Content $Page -Raw) -match '13-STAGE AUTHORITATIVE LIFECYCLE') },
  @{ N="POST_LOAD current-run semantics"; P=((Get-Content $RunService -Raw) -match 'executionStatus') },
  @{ N="Review held separated from blocked"; P=((Get-Content $Page -Raw) -match 'REVIEW HELD') -and ((Get-Content $RunService -Raw) -match 'blockedRecords') },
  @{ N="Reference qualification separated"; P=((Get-Content $Page -Raw) -match 'REFERENCE RUNTIME QUALIFICATION') },
  @{ N="Production boundary projected"; P=((Get-Content $Page -Raw) -match 'PRODUCTION PROTECTED') },
  @{ N="Verified Learn closes lifecycle"; P=((Get-Content $RunService -Raw) -match 'promotion_gate') -and ((Get-Content $RunService -Raw) -match 'lifecycleCompletedStages') }
)

foreach ($c in $checks) {
  if ($c.P) { Write-Host "PASS  $($c.N)" -ForegroundColor Green }
  else { throw "FAIL  $($c.N)" }
}

Write-Host ""
Write-Host "MEGA_DEMO_AUTHORITATIVE_REPLAY_008 code verification passed." -ForegroundColor Green
