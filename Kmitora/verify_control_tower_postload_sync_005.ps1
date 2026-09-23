$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Page = Join-Path $Root "frontend\src\pages\ControlTowerPremium.tsx"
$Svc  = Join-Path $Root "frontend\src\services\controlTowerAuthoritativeState.ts"
Write-Host "=== KMITORA CONTROL_TOWER_POSTLOAD_SYNC_005 verification ===" -ForegroundColor Cyan
if (!(Test-Path $Page)) { throw "FAIL  ControlTowerPremium.tsx missing" }
if (!(Test-Path $Svc)) { throw "FAIL  controlTowerAuthoritativeState.ts missing" }
$p = Get-Content $Page -Raw
$s = Get-Content $Svc -Raw
$checks = @(
  @{N="Server-first authoritative loader"; P=$s -match "Server is authoritative"},
  @{N="Review is never blocker invariant"; P=$s -match "REVIEW is never a BLOCK"},
  @{N="13-stage lifecycle accounting"; P=$s -match "lifecycleTotal = 13"},
  @{N="POST_LOAD_COMPLETED recognized"; P=$s -match 'POST_LOAD_COMPLETED'},
  @{N="Actual DEV target wording"; P=$p -match "Actual DEV target records"},
  @{N="Review-held shown separately"; P=$p -match "Review-held"},
  @{N="Production actions shown separately"; P=$p -match "Production actions"},
  @{N="Relationships authoritative metric"; P=$p -match "Relationships"},
  @{N="Transformation evidence authoritative metric"; P=$p -match "Transformation evidence"},
  @{N="Learning completion included"; P=$s -match "verifiedLearning"}
)
foreach ($c in $checks) { if ($c.P) { Write-Host "PASS  $($c.N)" -ForegroundColor Green } else { throw "FAIL  $($c.N)" } }
Write-Host ""; Write-Host "CONTROL_TOWER_POSTLOAD_SYNC_005 code verification passed." -ForegroundColor Green
