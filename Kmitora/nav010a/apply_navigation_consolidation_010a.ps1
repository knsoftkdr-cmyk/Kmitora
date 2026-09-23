$ErrorActionPreference = 'Stop'

$Root = 'C:\KMITORA\Kmitora-main\Kmitora-main'
$Sidebar = Join-Path $Root 'frontend\src\components\Sidebar.tsx'

if (-not (Test-Path -LiteralPath $Sidebar)) {
  throw "Sidebar.tsx not found: $Sidebar"
}

$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$backup = "$Sidebar.bak_NAVIGATION_CONSOLIDATION_010A_$stamp"
Copy-Item -LiteralPath $Sidebar -Destination $backup -Force

$text = Get-Content -LiteralPath $Sidebar -Raw

if ($text -match 'NAVIGATION_CONSOLIDATION_010A') {
  Write-Host 'NAVIGATION_CONSOLIDATION_010A is already applied.' -ForegroundColor Yellow
  Write-Host "Backup retained: $backup"
  exit 0
}

$pattern = '(?s)const\s+operationsNav\s*=\s*\[.*?\]\s+as\s+const\s*;'
if ($text -notmatch $pattern) {
  throw @"
Could not locate the operationsNav array safely.
No source file was changed.
Backup: $backup
Please send the contents of:
$Sidebar
"@
}

$newOperations = @'
// NAVIGATION_CONSOLIDATION_010A
// Operations contains only distinct day-to-day operational workspaces.
// Legacy/demo routes remain preserved in App.tsx for backward compatibility
// and will be surfaced under a dedicated Demo & Presentation section in 010E.
const operationsNav = [
  ["overview", "Control Tower", Gauge],
  ["transform", "Transform Studio", WandSparkles],
  ["prove", "Evidence & Audit", FileCheck2],
  ["agents", "Agents & Capabilities", Bot],
  ["domainIntelligence", "Domain Intelligence", Sparkles],
  ["approvals", "Approvals", ShieldCheck],
  ["activity", "Activity & Audit Log", Activity],
  ["settings", "Settings", Settings],
] as const;
'@

$updated = [regex]::Replace($text, $pattern, [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $newOperations }, 1)

# Remove GitBranch from the Sidebar icon import only when it is no longer referenced.
if (($updated | Select-String -Pattern '\bGitBranch\b' -AllMatches).Matches.Count -eq 1) {
  $updated = [regex]::Replace($updated, '(?m)^\s*GitBranch,\s*\r?\n', '', 1)
}

# Safety assertions: 010A must NOT touch route ownership or lifecycle navigation.
$required = @(
  '["overview", "Control Tower", Gauge]',
  '["transform", "Transform Studio", WandSparkles]',
  '["prove", "Evidence & Audit", FileCheck2]',
  '["agents", "Agents & Capabilities", Bot]',
  '["domainIntelligence", "Domain Intelligence", Sparkles]',
  '["approvals", "Approvals", ShieldCheck]',
  '["activity", "Activity & Audit Log", Activity]',
  '["settings", "Settings", Settings]'
)
foreach ($item in $required) {
  if (-not $updated.Contains($item)) {
    throw "Safety assertion failed before write: missing $item"
  }
}

$forbiddenInOperations = @(
  '["megaDemo", "Mega Demo Control Room"',
  '["cinematicDemo", "Cinematic Executive Demo"',
  '["demoOperations", "Demo Operations"',
  '["capabilities1m", "1M Capability Universe"',
  '["digitalTwinGraph", "Digital Twin Graph"'
)

$opsMatch = [regex]::Match($updated, $pattern)
if (-not $opsMatch.Success) { throw 'Unable to re-read patched operationsNav block.' }
foreach ($item in $forbiddenInOperations) {
  if ($opsMatch.Value.Contains($item)) {
    throw "Safety assertion failed: duplicate operational entry remains: $item"
  }
}

Set-Content -LiteralPath $Sidebar -Value $updated -Encoding UTF8

Write-Host ''
Write-Host 'NAVIGATION_CONSOLIDATION_010A applied successfully.' -ForegroundColor Green
Write-Host "Updated : $Sidebar"
Write-Host "Backup  : $backup"
Write-Host ''
Write-Host 'Important:' -ForegroundColor Cyan
Write-Host '  - No page/component files were deleted.'
Write-Host '  - No App.tsx routes were removed.'
Write-Host '  - Mega Demo, Cinematic Demo, Demo Operations, 1M Capability Universe and Digital Twin remain in code.'
Write-Host '  - This phase changes sidebar presentation only.'
