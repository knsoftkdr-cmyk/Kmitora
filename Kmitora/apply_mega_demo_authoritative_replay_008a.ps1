$ErrorActionPreference = "Stop"

$Project = Split-Path -Parent $MyInvocation.MyCommand.Path
$Payload = Join-Path $Project "_KMITORA_PATCH_PAYLOAD_008A"
$Pages = Join-Path $Project "frontend\src\pages"
$Services = Join-Path $Project "frontend\src\services"
$Styles = Join-Path $Project "frontend\src\styles"
$Current = Join-Path $Pages "MegaDemoControlRoom.tsx"
$Legacy = Join-Path $Pages "MegaDemoControlRoomLegacy.tsx"
$WrapperPayload = Join-Path $Payload "pages\MegaDemoControlRoom.tsx"
$Marker = "A000 AUTHORITATIVE OPERATIONS"

function Test-LegacyCandidate([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { return $false }
  $text = Get-Content -LiteralPath $Path -Raw -ErrorAction SilentlyContinue
  if ([string]::IsNullOrWhiteSpace($text)) { return $false }
  return ($text -match "Mega Enterprise Control Room") -and ($text -notmatch [regex]::Escape($Marker))
}

if (-not (Test-Path -LiteralPath $Pages)) {
  throw "Frontend pages folder not found: $Pages"
}
if (-not (Test-Path -LiteralPath $WrapperPayload)) {
  throw "Patch payload missing: $WrapperPayload"
}

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$recoveredLegacy = $null
$recoverySource = $null

# 1. Keep an already valid legacy implementation.
if (Test-LegacyCandidate $Legacy) {
  $recoveredLegacy = $Legacy
  $recoverySource = "existing legacy component"
}

# 2. Recover the original tracked component from Git HEAD. This is the preferred repair
#    after the failed 008 installer, because the failed installer may have moved/overwritten
#    the working-tree file while Git still retains the original component.
if (-not $recoveredLegacy) {
  $git = Get-Command git -ErrorAction SilentlyContinue
  $gitDir = Join-Path $Project ".git"
  if ($git -and (Test-Path -LiteralPath $gitDir)) {
    $tmp = Join-Path $env:TEMP "KMITORA_MegaDemoControlRoom_HEAD_$stamp.tsx"
    $gitText = & git -C $Project show "HEAD:frontend/src/pages/MegaDemoControlRoom.tsx" 2>$null
    if ($LASTEXITCODE -eq 0 -and $gitText) {
      [string]::Join([Environment]::NewLine, $gitText) | Set-Content -LiteralPath $tmp -Encoding UTF8
      if (Test-LegacyCandidate $tmp) {
        $recoveredLegacy = $tmp
        $recoverySource = "Git HEAD"
      } else {
        Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
      }
    }
  }
}

# 3. Search safe sibling/back-up candidates without ever accepting the authoritative wrapper.
if (-not $recoveredLegacy) {
  $candidates = Get-ChildItem -LiteralPath $Pages -File -Filter "*Mega*Demo*Control*Room*.tsx" -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -ne $Current -and $_.FullName -ne $Legacy }
  foreach ($candidate in $candidates) {
    if (Test-LegacyCandidate $candidate.FullName) {
      $recoveredLegacy = $candidate.FullName
      $recoverySource = "sibling backup $($candidate.Name)"
      break
    }
  }
}

# 4. Last safe recovery: project backup files.
if (-not $recoveredLegacy) {
  $backupCandidates = Get-ChildItem -LiteralPath $Project -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like "MegaDemoControlRoom.tsx.bak*" -or $_.Name -like "MegaDemoControlRoom*.backup*" }
  foreach ($candidate in $backupCandidates) {
    if (Test-LegacyCandidate $candidate.FullName) {
      $recoveredLegacy = $candidate.FullName
      $recoverySource = "project backup $($candidate.Name)"
      break
    }
  }
}

if (-not $recoveredLegacy) {
  throw @"
Unable to recover the original Mega Demo implementation safely.
The failed 008 installer may have moved or overwritten MegaDemoControlRoom.tsx.
No files were changed by 008A.
Run this command and send the result:
Get-ChildItem "$Pages" -File | Where-Object { `$_.Name -like "*Mega*Demo*" } | Select-Object Name,FullName,Length,LastWriteTime
"@
}

# Preserve whatever currently exists before repairing.
if (Test-Path -LiteralPath $Current) {
  Copy-Item -LiteralPath $Current -Destination "$Current.bak_008A_$stamp" -Force
}
if ((Test-Path -LiteralPath $Legacy) -and $Legacy -ne $recoveredLegacy) {
  Copy-Item -LiteralPath $Legacy -Destination "$Legacy.bak_008A_$stamp" -Force
}

# Restore real reference demo as the legacy implementation.
Copy-Item -LiteralPath $recoveredLegacy -Destination $Legacy -Force

# Install authoritative wrapper from isolated payload. Never move/copy from the destination itself.
Copy-Item -LiteralPath $WrapperPayload -Destination $Current -Force
Copy-Item -LiteralPath (Join-Path $Payload "services\authoritativeEvidenceProjection.ts") -Destination (Join-Path $Services "authoritativeEvidenceProjection.ts") -Force
Copy-Item -LiteralPath (Join-Path $Payload "services\authoritativeRunProjection.ts") -Destination (Join-Path $Services "authoritativeRunProjection.ts") -Force
Copy-Item -LiteralPath (Join-Path $Payload "styles\mega-demo-authoritative-replay.css") -Destination (Join-Path $Styles "mega-demo-authoritative-replay.css") -Force

# Safety validation: wrapper and legacy must be different roles.
$currentText = Get-Content -LiteralPath $Current -Raw
$legacyText = Get-Content -LiteralPath $Legacy -Raw
if ($currentText -notmatch [regex]::Escape($Marker)) {
  throw "008A install validation failed: authoritative wrapper marker missing."
}
if ($legacyText -match [regex]::Escape($Marker)) {
  throw "008A install validation failed: legacy component still contains the authoritative wrapper."
}
if ($legacyText -notmatch "Mega Enterprise Control Room") {
  throw "008A install validation failed: recovered legacy component is not the Mega Demo implementation."
}

Write-Host "" 
Write-Host "MEGA_DEMO_AUTHORITATIVE_REPLAY_008A applied successfully." -ForegroundColor Green
Write-Host "Recovered reference Mega Demo from: $recoverySource" -ForegroundColor Green
Write-Host "Authoritative wrapper: $Current" -ForegroundColor Green
Write-Host "Preserved reference demo: $Legacy" -ForegroundColor Green
Write-Host "The self-copy/self-move defect in installer 008 is permanently removed." -ForegroundColor Green
