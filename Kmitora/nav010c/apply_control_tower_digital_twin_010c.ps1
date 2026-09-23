$ErrorActionPreference = "Stop"
$Root = "C:\KMITORA\Kmitora-main\Kmitora-main"
$Frontend = Join-Path $Root "frontend"
$Pages = Join-Path $Frontend "src\pages"
$Styles = Join-Path $Frontend "src\styles"
$App = Join-Path $Frontend "src\App.tsx"
$Payload = Join-Path $PSScriptRoot "payload"
$Stamp = Get-Date -Format "yyyyMMdd_HHmmss"

$Required = @(
  (Join-Path $Pages "ControlTowerPremium.tsx"),
  (Join-Path $Pages "DigitalTwinGraph.tsx"),
  $App,
  (Join-Path $Payload "pages\ControlTowerWorkspace.tsx"),
  (Join-Path $Payload "styles\controlTower010c.css")
)
foreach ($p in $Required) { if (-not (Test-Path -LiteralPath $p)) { throw "Required file missing: $p" } }

Copy-Item -LiteralPath $App -Destination "$App.bak_CONTROL_TOWER_DIGITAL_TWIN_010C_$Stamp" -Force
$ExistingWorkspace = Join-Path $Pages "ControlTowerWorkspace.tsx"
if (Test-Path $ExistingWorkspace) { Copy-Item $ExistingWorkspace "$ExistingWorkspace.bak_CONTROL_TOWER_DIGITAL_TWIN_010C_$Stamp" -Force }

Copy-Item -LiteralPath (Join-Path $Payload "pages\ControlTowerWorkspace.tsx") -Destination $ExistingWorkspace -Force
Copy-Item -LiteralPath (Join-Path $Payload "styles\controlTower010c.css") -Destination (Join-Path $Styles "controlTower010c.css") -Force

$content = Get-Content -LiteralPath $App -Raw
if ($content -notmatch 'import\s+ControlTowerWorkspace\s+from\s+["'']\.\/pages\/ControlTowerWorkspace["'']') {
  $anchor = 'import ControlTowerPremium from "./pages/ControlTowerPremium";'
  if ($content.Contains($anchor)) {
    $content = $content.Replace($anchor, $anchor + "`r`n" + 'import ControlTowerWorkspace from "./pages/ControlTowerWorkspace";')
  } else {
    $firstImport = [regex]::Match($content, '(?m)^import .+?;\s*$')
    if (-not $firstImport.Success) { throw "Unable to find import insertion point in App.tsx" }
    $content = $content.Insert($firstImport.Index, 'import ControlTowerWorkspace from "./pages/ControlTowerWorkspace";' + "`r`n")
  }
}

$pattern = 'case\s+["'']overview["'']\s*:\s*return\s*<ControlTowerPremium\s*\/?\s*>\s*;'
if ([regex]::IsMatch($content, $pattern)) {
  $content = [regex]::Replace($content, $pattern, 'case "overview": return <ControlTowerWorkspace />;', 1)
} elseif ($content -notmatch 'case\s+["'']overview["'']\s*:\s*return\s*<ControlTowerWorkspace') {
  throw "Could not safely locate the overview route in App.tsx"
}

Set-Content -LiteralPath $App -Value $content -Encoding UTF8

Write-Host ""
Write-Host "CONTROL_TOWER_DIGITAL_TWIN_010C applied successfully." -ForegroundColor Green
Write-Host "Created : $ExistingWorkspace"
Write-Host "Created : $(Join-Path $Styles 'controlTower010c.css')"
Write-Host "Updated : $App"
Write-Host ""
Write-Host "Safety:" -ForegroundColor Cyan
Write-Host "  - ControlTowerPremium.tsx is preserved unchanged."
Write-Host "  - DigitalTwinGraph.tsx is preserved unchanged."
Write-Host "  - digitalTwinGraph route remains available for backward compatibility."
Write-Host "  - Overview now opens the integrated Control Tower workspace."
Write-Host "  - No production/cutover behavior is changed."
