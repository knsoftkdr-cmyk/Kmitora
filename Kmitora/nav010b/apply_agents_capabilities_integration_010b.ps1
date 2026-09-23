$ErrorActionPreference = "Stop"
$Root = "C:\KMITORA\Kmitora-main\Kmitora-main"
$Frontend = Join-Path $Root "frontend"
$App = Join-Path $Frontend "src\App.tsx"
$Pages = Join-Path $Frontend "src\pages"
$Styles = Join-Path $Frontend "src\styles"
$PatchRoot = Join-Path $Root "nav010b"
$PayloadPage = Join-Path $PatchRoot "payload\pages\AgentsCapabilitiesWorkspace.tsx"
$PayloadStyle = Join-Path $PatchRoot "payload\styles\agentsCapabilities010b.css"
$TargetPage = Join-Path $Pages "AgentsCapabilitiesWorkspace.tsx"
$TargetStyle = Join-Path $Styles "agentsCapabilities010b.css"

foreach ($p in @($App, (Join-Path $Pages "AgentOperations.tsx"), (Join-Path $Pages "A000CapabilityUniverse.tsx"), $PayloadPage, $PayloadStyle)) {
  if (-not (Test-Path -LiteralPath $p)) { throw "Required file not found: $p" }
}

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
Copy-Item -LiteralPath $App -Destination "$App.bak_AGENTS_CAPABILITIES_INTEGRATION_010B_$stamp" -Force
if (Test-Path -LiteralPath $TargetPage) { Copy-Item -LiteralPath $TargetPage -Destination "$TargetPage.bak_AGENTS_CAPABILITIES_INTEGRATION_010B_$stamp" -Force }
if (Test-Path -LiteralPath $TargetStyle) { Copy-Item -LiteralPath $TargetStyle -Destination "$TargetStyle.bak_AGENTS_CAPABILITIES_INTEGRATION_010B_$stamp" -Force }

New-Item -ItemType Directory -Path $Styles -Force | Out-Null
Copy-Item -LiteralPath $PayloadPage -Destination $TargetPage -Force
Copy-Item -LiteralPath $PayloadStyle -Destination $TargetStyle -Force

$content = Get-Content -LiteralPath $App -Raw

# Add wrapper import once.
if ($content -notmatch 'AgentsCapabilitiesWorkspace') {
  $anchor = 'import AgentOperations from "./pages/AgentOperations";'
  if ($content.Contains($anchor)) {
    $content = $content.Replace($anchor, $anchor + "`r`n" + 'import AgentsCapabilitiesWorkspace from "./pages/AgentsCapabilitiesWorkspace";')
  } else {
    $firstImport = [regex]::Match($content, '(?m)^import .*?;\s*$')
    if (-not $firstImport.Success) { throw "Could not locate an import anchor in App.tsx" }
    $insertAt = $firstImport.Index + $firstImport.Length
    $content = $content.Insert($insertAt, "`r`n" + 'import AgentsCapabilitiesWorkspace from "./pages/AgentsCapabilitiesWorkspace";')
  }
}

# Route Agents to the integrated workspace. Preserve capabilities1m route unchanged.
$pattern = 'case\s+"agents"\s*:\s*return\s*<AgentOperations\s*/>\s*;'
if ([regex]::IsMatch($content, $pattern)) {
  $content = [regex]::Replace($content, $pattern, 'case "agents": return <AgentsCapabilitiesWorkspace onNavigate={setActive}/>;', 1)
} elseif ($content -notmatch 'case\s+"agents"\s*:\s*return\s*<AgentsCapabilitiesWorkspace') {
  throw 'Could not safely locate the existing agents route in App.tsx.'
}

Set-Content -LiteralPath $App -Value $content -Encoding UTF8

Write-Host ""
Write-Host "AGENTS_CAPABILITIES_INTEGRATION_010B applied successfully." -ForegroundColor Green
Write-Host "Created : $TargetPage"
Write-Host "Created : $TargetStyle"
Write-Host "Updated : $App"
Write-Host ""
Write-Host "Safety:" -ForegroundColor Cyan
Write-Host "  - AgentOperations.tsx is preserved unchanged."
Write-Host "  - A000CapabilityUniverse.tsx is preserved unchanged."
Write-Host "  - capabilities1m route is preserved for backward compatibility."
Write-Host "  - Only the agents route now opens the integrated Agents & Capabilities workspace."
