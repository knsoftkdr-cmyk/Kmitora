$ErrorActionPreference = 'Stop'
$Root = 'C:\KMITORA\Kmitora-main\Kmitora-main'
$App = Join-Path $Root 'frontend\src\App.tsx'
$Pages = Join-Path $Root 'frontend\src\pages'

if (-not (Test-Path -LiteralPath $App)) { throw "App.tsx not found: $App" }

$requiredPages = @(
  @{ Key='megaDemo'; Class='MegaDemoControlRoom'; File='MegaDemoControlRoom.tsx'; Import='import MegaDemoControlRoom from "./pages/MegaDemoControlRoom";' },
  @{ Key='cinematicDemo'; Class='CinematicExecutiveDemo'; File='CinematicExecutiveDemo.tsx'; Import='import CinematicExecutiveDemo from "./pages/CinematicExecutiveDemo";' },
  @{ Key='demoOperations'; Class='DemoOperations'; File='DemoOperations.tsx'; Import='import DemoOperations from "./pages/DemoOperations";' },
  @{ Key='capabilities1m'; Class='A000CapabilityUniverse'; File='A000CapabilityUniverse.tsx'; Import='import A000CapabilityUniverse from "./pages/A000CapabilityUniverse";' },
  @{ Key='digitalTwinGraph'; Class='DigitalTwinGraph'; File='DigitalTwinGraph.tsx'; Import='import DigitalTwinGraph from "./pages/DigitalTwinGraph";' }
)

$missingFiles = @()
foreach ($p in $requiredPages) {
  if (-not (Test-Path -LiteralPath (Join-Path $Pages $p.File))) { $missingFiles += $p.File }
}
if ($missingFiles.Count -gt 0) {
  throw "Cannot preserve hidden routes because these page files are missing: $($missingFiles -join ', ')"
}

$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$backup = "$App.bak_NAVIGATION_CONSOLIDATION_010A1_$stamp"
Copy-Item -LiteralPath $App -Destination $backup -Force

$text = Get-Content -LiteralPath $App -Raw

# Add only imports that are genuinely missing. Insert before the first export default function.
$missingImports = @()
foreach ($p in $requiredPages) {
  $importPattern = [regex]::Escape($p.Import)
  if ($text -notmatch $importPattern) { $missingImports += $p.Import }
}
if ($missingImports.Count -gt 0) {
  $anchor = 'export default function App'
  $idx = $text.IndexOf($anchor)
  if ($idx -lt 0) { throw 'Unable to locate export default function App in App.tsx.' }
  $prefix = $text.Substring(0, $idx)
  $suffix = $text.Substring($idx)
  $text = $prefix.TrimEnd() + "`r`n" + ($missingImports -join "`r`n") + "`r`n`r`n" + $suffix
}

# Preserve all hidden routes. Add a missing route immediately before settings/default without removing anything.
foreach ($p in $requiredPages) {
  $casePattern = 'case\s+["'']' + [regex]::Escape($p.Key) + '["'']\s*:'
  if ($text -notmatch $casePattern) {
    $routeLine = "      case `"$($p.Key)`": return <$($p.Class)/>;"
    if ($text -match '(?m)^\s*case\s+["'']settings["'']\s*:') {
      $text = [regex]::Replace($text, '(?m)^(\s*case\s+["'']settings["'']\s*:)', ($routeLine + "`r`n`$1"), 1)
    }
    elseif ($text -match '(?m)^\s*default\s*:') {
      $text = [regex]::Replace($text, '(?m)^(\s*default\s*:)', ($routeLine + "`r`n`$1"), 1)
    }
    else {
      throw "Unable to find a safe insertion point for route $($p.Key)."
    }
  }
}

Set-Content -LiteralPath $App -Value $text -Encoding UTF8

Write-Host ''
Write-Host 'NAVIGATION_CONSOLIDATION_010A1 applied successfully.' -ForegroundColor Green
Write-Host "Updated : $App"
Write-Host "Backup  : $backup"
Write-Host ''
Write-Host 'This correction only restores/preserves hidden App.tsx routes.' -ForegroundColor Cyan
Write-Host 'Sidebar consolidation from 010A remains unchanged.' -ForegroundColor Cyan
