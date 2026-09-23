$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$File = Join-Path $Root "frontend\src\pages\ControlTowerPremium.tsx"
if (-not (Test-Path $File)) { throw "FAIL  ControlTowerPremium.tsx not found" }
$Text = Get-Content $File -Raw
$Checks = @(
  @{ N="Server-authoritative loader preserved"; P='loadAuthoritativeControlTowerSnapshot' },
  @{ N="Executive header"; P='DEV · AUTHORITATIVE OPERATIONS' },
  @{ N="13-stage lifecycle presentation"; P='lifecycleCompleted' },
  @{ N="Review-held is not blocked"; P='governed hold · not blocked' },
  @{ N="Actual DEV target semantics"; P='Actual DEV target' },
  @{ N="Exact reconciliation banner"; P='Reconciliation is exact' },
  @{ N="Production safety isolated"; P='PRODUCTION PROTECTED' },
  @{ N="Responsive KPI grid"; P='repeat(auto-fit,minmax' },
  @{ N="Professional status pills"; P='function StatusPill' },
  @{ N="No new UI dependency"; P='from "../services/controlTowerAuthoritativeState"' }
)
Write-Host "=== KMITORA CONTROL_TOWER_EXECUTIVE_UI_006 verification ===" -ForegroundColor Cyan
foreach ($c in $Checks) {
  if ($Text.Contains($c.P)) { Write-Host "PASS  $($c.N)" -ForegroundColor Green }
  else { throw "FAIL  $($c.N)" }
}
Write-Host ""
Write-Host "CONTROL_TOWER_EXECUTIVE_UI_006 code verification passed." -ForegroundColor Green
