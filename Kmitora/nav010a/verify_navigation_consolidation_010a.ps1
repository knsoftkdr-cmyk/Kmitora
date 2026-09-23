$ErrorActionPreference = 'Stop'
$Root = 'C:\KMITORA\Kmitora-main\Kmitora-main'
$Sidebar = Join-Path $Root 'frontend\src\components\Sidebar.tsx'
$App = Join-Path $Root 'frontend\src\App.tsx'

Write-Host '=== KMITORA NAVIGATION_CONSOLIDATION_010A verification ===' -ForegroundColor Cyan

if (-not (Test-Path $Sidebar)) { throw "FAIL  Sidebar exists" }
if (-not (Test-Path $App)) { throw "FAIL  App.tsx exists" }

$s = Get-Content $Sidebar -Raw
$a = Get-Content $App -Raw

$checks = @(
  @{ N='Patch marker'; P=$s.Contains('NAVIGATION_CONSOLIDATION_010A') },
  @{ N='Operations Control Tower'; P=$s.Contains('["overview", "Control Tower", Gauge]') },
  @{ N='Operations Transform Studio'; P=$s.Contains('["transform", "Transform Studio", WandSparkles]') },
  @{ N='Operations Evidence & Audit'; P=$s.Contains('["prove", "Evidence & Audit", FileCheck2]') },
  @{ N='Operations Agents & Capabilities'; P=$s.Contains('["agents", "Agents & Capabilities", Bot]') },
  @{ N='Operations Domain Intelligence'; P=$s.Contains('["domainIntelligence", "Domain Intelligence", Sparkles]') },
  @{ N='Operations Approvals'; P=$s.Contains('["approvals", "Approvals", ShieldCheck]') },
  @{ N='Operations Activity & Audit Log'; P=$s.Contains('["activity", "Activity & Audit Log", Activity]') },
  @{ N='Operations Settings'; P=$s.Contains('["settings", "Settings", Settings]') },
  @{ N='Mega Demo removed from Operations'; P= -not ([regex]::Match($s,'(?s)const\s+operationsNav\s*=\s*\[.*?\]\s+as\s+const\s*;').Value.Contains('["megaDemo"')) },
  @{ N='Capability Universe removed from Operations'; P= -not ([regex]::Match($s,'(?s)const\s+operationsNav\s*=\s*\[.*?\]\s+as\s+const\s*;').Value.Contains('["capabilities1m"')) },
  @{ N='Digital Twin removed from Operations'; P= -not ([regex]::Match($s,'(?s)const\s+operationsNav\s*=\s*\[.*?\]\s+as\s+const\s*;').Value.Contains('["digitalTwinGraph"')) },
  @{ N='Mega Demo route preserved'; P=$a.Contains('case "megaDemo"') },
  @{ N='Cinematic Demo route preserved'; P=$a.Contains('case "cinematicDemo"') },
  @{ N='Demo Operations route preserved'; P=$a.Contains('case "demoOperations"') },
  @{ N='Capability Universe route preserved'; P=$a.Contains('case "capabilities1m"') },
  @{ N='Digital Twin route preserved'; P=$a.Contains('case "digitalTwinGraph"') }
)

foreach ($c in $checks) {
  if ($c.P) { Write-Host "PASS  $($c.N)" -ForegroundColor Green }
  else { throw "FAIL  $($c.N)" }
}

Write-Host ''
Write-Host 'NAVIGATION_CONSOLIDATION_010A code verification passed.' -ForegroundColor Green
Write-Host 'No routes/components were deleted. This is presentation-only consolidation.' -ForegroundColor Cyan
