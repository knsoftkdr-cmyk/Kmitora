$ErrorActionPreference = 'Stop'
$Root = 'C:\KMITORA\Kmitora-main\Kmitora-main'
$Sidebar = Join-Path $Root 'frontend\src\components\Sidebar.tsx'
$App = Join-Path $Root 'frontend\src\App.tsx'
if (-not (Test-Path $Sidebar)) { throw "Missing Sidebar.tsx: $Sidebar" }
if (-not (Test-Path $App)) { throw "Missing App.tsx: $App" }
$s = Get-Content $Sidebar -Raw
$a = Get-Content $App -Raw

$checks = @(
  @{N='Operations Control Tower'; C=($s -match '"overview"\s*,\s*"Control Tower"')},
  @{N='Operations Transform Studio'; C=($s -match '"transform"\s*,\s*"Transform Studio"')},
  @{N='Operations Evidence & Audit'; C=($s -match '"prove"\s*,\s*"Evidence & Audit"')},
  @{N='Operations Agents & Capabilities'; C=($s -match '"agents"\s*,\s*"Agents & Capabilities"')},
  @{N='Operations Domain Intelligence'; C=($s -match '"domainIntelligence"\s*,\s*"Domain Intelligence"')},
  @{N='Operations Approvals'; C=($s -match '"approvals"\s*,\s*"Approvals"')},
  @{N='Operations Activity & Audit Log'; C=($s -match '"activity"\s*,\s*"Activity & Audit Log"')},
  @{N='Operations Settings'; C=($s -match '"settings"\s*,\s*"Settings"')},
  @{N='Mega Demo route preserved'; C=($a -match 'case\s+["'']megaDemo["'']\s*:')},
  @{N='Cinematic Demo route preserved'; C=($a -match 'case\s+["'']cinematicDemo["'']\s*:')},
  @{N='Demo Operations route preserved'; C=($a -match 'case\s+["'']demoOperations["'']\s*:')},
  @{N='Capability Universe route preserved'; C=($a -match 'case\s+["'']capabilities1m["'']\s*:')},
  @{N='Digital Twin route preserved'; C=($a -match 'case\s+["'']digitalTwinGraph["'']\s*:')},
  @{N='Cinematic import preserved'; C=($a -match 'import\s+CinematicExecutiveDemo\s+from\s+["'']\.\/pages\/CinematicExecutiveDemo["'']')},
  @{N='Demo Operations import preserved'; C=($a -match 'import\s+DemoOperations\s+from\s+["'']\.\/pages\/DemoOperations["'']')}
)
Write-Host '=== KMITORA NAVIGATION_CONSOLIDATION_010A1 verification ==='
foreach ($c in $checks) {
  if ($c.C) { Write-Host "PASS  $($c.N)" -ForegroundColor Green }
  else { throw "FAIL  $($c.N)" }
}
Write-Host ''
Write-Host 'NAVIGATION_CONSOLIDATION_010A1 code verification passed.' -ForegroundColor Green
