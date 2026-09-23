$ErrorActionPreference = "Stop"
$Root = "C:\KMITORA\Kmitora-main\Kmitora-main"
$App = Join-Path $Root "frontend\src\App.tsx"
$Page = Join-Path $Root "frontend\src\pages\AgentsCapabilitiesWorkspace.tsx"
$Style = Join-Path $Root "frontend\src\styles\agentsCapabilities010b.css"
$Agent = Join-Path $Root "frontend\src\pages\AgentOperations.tsx"
$Universe = Join-Path $Root "frontend\src\pages\A000CapabilityUniverse.tsx"

Write-Host "=== KMITORA AGENTS_CAPABILITIES_INTEGRATION_010B verification ===" -ForegroundColor Cyan

$checks = @(
  @{N="Integrated workspace exists"; P=(Test-Path $Page)},
  @{N="Professional stylesheet exists"; P=(Test-Path $Style)},
  @{N="Agent Operations preserved"; P=(Test-Path $Agent)},
  @{N="Capability Universe preserved"; P=(Test-Path $Universe)},
  @{N="Patch marker"; P=((Get-Content $Page -Raw) -match 'AGENTS_CAPABILITIES_INTEGRATION_010B')},
  @{N="Agent Operations tab"; P=((Get-Content $Page -Raw) -match 'Agent Operations')},
  @{N="Capability Universe tab"; P=((Get-Content $Page -Raw) -match 'Capability Universe')},
  @{N="A000 orchestration context"; P=((Get-Content $Page -Raw) -match 'A000 orchestrated')},
  @{N="Agents route integrated"; P=((Get-Content $App -Raw) -match 'case\s+"agents"\s*:\s*return\s*<AgentsCapabilitiesWorkspace')},
  @{N="Integrated workspace import"; P=((Get-Content $App -Raw) -match 'import AgentsCapabilitiesWorkspace')},
  @{N="Legacy capability route preserved"; P=((Get-Content $App -Raw) -match 'case\s+"capabilities1m"')},
  @{N="No deletion of AgentOperations"; P=((Get-Content $Page -Raw) -match 'import AgentOperations from "\.\/AgentOperations"')},
  @{N="No deletion of Capability Universe"; P=((Get-Content $Page -Raw) -match 'import A000CapabilityUniverse from "\.\/A000CapabilityUniverse"')}
)

foreach ($c in $checks) {
  if ($c.P) { Write-Host "PASS  $($c.N)" -ForegroundColor Green }
  else { throw "FAIL  $($c.N)" }
}

Write-Host ""
Write-Host "AGENTS_CAPABILITIES_INTEGRATION_010B code verification passed." -ForegroundColor Green
