$ErrorActionPreference = "Stop"
$Root = "C:\KMITORA\Kmitora-main\Kmitora-main"
$Frontend = Join-Path $Root "frontend"
$Workspace = Join-Path $Frontend "src\pages\ControlTowerWorkspace.tsx"
$Premium = Join-Path $Frontend "src\pages\ControlTowerPremium.tsx"
$Twin = Join-Path $Frontend "src\pages\DigitalTwinGraph.tsx"
$Css = Join-Path $Frontend "src\styles\controlTower010c.css"
$App = Join-Path $Frontend "src\App.tsx"

Write-Host "=== KMITORA CONTROL_TOWER_DIGITAL_TWIN_010C verification ===" -ForegroundColor Cyan
$checks = @(
  @{N="Integrated Control Tower workspace exists"; P=(Test-Path $Workspace)},
  @{N="Professional stylesheet exists"; P=(Test-Path $Css)},
  @{N="ControlTowerPremium preserved"; P=(Test-Path $Premium)},
  @{N="DigitalTwinGraph preserved"; P=(Test-Path $Twin)},
  @{N="Patch marker"; P=((Get-Content $Workspace -Raw) -match 'KMITORA_CONTROL_TOWER_DIGITAL_TWIN_010C')},
  @{N="Overview tab"; P=((Get-Content $Workspace -Raw) -match 'label:\s*"Overview"')},
  @{N="Runtime tab"; P=((Get-Content $Workspace -Raw) -match 'label:\s*"Runtime"')},
  @{N="Topology and Digital Twin tab"; P=((Get-Content $Workspace -Raw) -match 'Topology & Digital Twin')},
  @{N="Dependencies tab"; P=((Get-Content $Workspace -Raw) -match 'label:\s*"Dependencies"')},
  @{N="Impact Analysis tab"; P=((Get-Content $Workspace -Raw) -match 'label:\s*"Impact Analysis"')},
  @{N="Safety and Governance tab"; P=((Get-Content $Workspace -Raw) -match 'label:\s*"Safety & Governance"')},
  @{N="Digital Twin embedded"; P=((Get-Content $Workspace -Raw) -match '<DigitalTwinGraph\s*/>')},
  @{N="Overview embeds current Control Tower"; P=((Get-Content $Workspace -Raw) -match '<ControlTowerPremium\s*/>')},
  @{N="Overview route integrated"; P=((Get-Content $App -Raw) -match 'case\s+["'']overview["'']\s*:\s*return\s*<ControlTowerWorkspace')},
  @{N="Integrated workspace import"; P=((Get-Content $App -Raw) -match 'import\s+ControlTowerWorkspace\s+from')},
  @{N="Legacy Digital Twin route preserved"; P=((Get-Content $App -Raw) -match 'case\s+["'']digitalTwinGraph["'']\s*:\s*return\s*<DigitalTwinGraph')}
)
foreach ($c in $checks) {
  if ($c.P) { Write-Host "PASS  $($c.N)" -ForegroundColor Green }
  else { throw "FAIL  $($c.N)" }
}
Write-Host ""
Write-Host "CONTROL_TOWER_DIGITAL_TWIN_010C code verification passed." -ForegroundColor Green
