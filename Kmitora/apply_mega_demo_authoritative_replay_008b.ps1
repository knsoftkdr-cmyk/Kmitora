$ErrorActionPreference = "Stop"

$Project = Split-Path -Parent $MyInvocation.MyCommand.Path
$Payload = Join-Path $Project "_KMITORA_PATCH_PAYLOAD_008B"
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

function Same-Path([string]$A, [string]$B) {
  if ([string]::IsNullOrWhiteSpace($A) -or [string]::IsNullOrWhiteSpace($B)) { return $false }
  return [System.StringComparer]::OrdinalIgnoreCase.Equals(
    [System.IO.Path]::GetFullPath($A),
    [System.IO.Path]::GetFullPath($B)
  )
}

if (-not (Test-Path -LiteralPath $Pages)) { throw "Frontend pages folder not found: $Pages" }
if (-not (Test-Path -LiteralPath $WrapperPayload)) { throw "Patch payload missing: $WrapperPayload" }
New-Item -ItemType Directory -Force -Path $Services,$Styles | Out-Null

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$recoveredLegacy = $null
$recoverySource = $null

# 1. Prefer an already valid preserved reference implementation.
if (Test-LegacyCandidate $Legacy) {
  $recoveredLegacy = $Legacy
  $recoverySource = "existing legacy component"
}

# 2. If the live page is still the reference implementation, use it.
if (-not $recoveredLegacy -and (Test-LegacyCandidate $Current)) {
  $recoveredLegacy = $Current
  $recoverySource = "current live Mega Demo component"
}

# 3. Recover from Git HEAD when tracked there.
if (-not $recoveredLegacy) {
  $git = Get-Command git -ErrorAction SilentlyContinue
  if ($git -and (Test-Path -LiteralPath (Join-Path $Project ".git"))) {
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

# 4. Explicitly recover from the project's known full-inspection snapshot.
if (-not $recoveredLegacy) {
  $fullInspect = Join-Path $Project "kmitora_fullinspect\frontend\src\pages\MegaDemoControlRoom.tsx"
  if (Test-LegacyCandidate $fullInspect) {
    $recoveredLegacy = $fullInspect
    $recoverySource = "kmitora_fullinspect snapshot"
  }
}

# 5. Search sibling/back-up candidates, excluding the authoritative wrapper.
if (-not $recoveredLegacy) {
  $candidates = Get-ChildItem -LiteralPath $Pages -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like "*Mega*Demo*Control*Room*" }
  foreach ($candidate in $candidates) {
    if (Test-LegacyCandidate $candidate.FullName) {
      $recoveredLegacy = $candidate.FullName
      $recoverySource = "sibling backup $($candidate.Name)"
      break
    }
  }
}

# 6. Last safe recovery from any project backup/snapshot.
if (-not $recoveredLegacy) {
  $backupCandidates = Get-ChildItem -LiteralPath $Project -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object {
      $_.Name -eq "MegaDemoControlRoom.tsx" -or
      $_.Name -like "MegaDemoControlRoom.tsx.bak*" -or
      $_.Name -like "MegaDemoControlRoom*.backup*"
    }
  foreach ($candidate in $backupCandidates) {
    if (Test-LegacyCandidate $candidate.FullName) {
      $recoveredLegacy = $candidate.FullName
      $recoverySource = "project snapshot $($candidate.FullName)"
      break
    }
  }
}

if (-not $recoveredLegacy) {
  throw @"
Unable to recover the original Mega Demo implementation safely.
No files were changed by 008B.
Inspect candidates with:
Get-ChildItem "$Project" -Recurse -File -ErrorAction SilentlyContinue | Where-Object { `$_.Name -like "*Mega*Demo*" } | Select-Object Name,FullName,Length,LastWriteTime
"@
}

# Preserve the live wrapper/reference before modification.
if (Test-Path -LiteralPath $Current) {
  Copy-Item -LiteralPath $Current -Destination "$Current.bak_008B_$stamp" -Force
}
if ((Test-Path -LiteralPath $Legacy) -and -not (Same-Path $Legacy $recoveredLegacy)) {
  Copy-Item -LiteralPath $Legacy -Destination "$Legacy.bak_008B_$stamp" -Force
}

# Restore the reference implementation. IMPORTANT: never copy a file onto itself.
if (-not (Same-Path $recoveredLegacy $Legacy)) {
  Copy-Item -LiteralPath $recoveredLegacy -Destination $Legacy -Force
}

# Revalidate the preserved reference before installing the wrapper.
if (-not (Test-LegacyCandidate $Legacy)) {
  throw "008B safety validation failed before wrapper install: preserved reference Mega Demo is invalid."
}

# Install authoritative wrapper and projection services from isolated payload.
Copy-Item -LiteralPath $WrapperPayload -Destination $Current -Force
Copy-Item -LiteralPath (Join-Path $Payload "services\authoritativeEvidenceProjection.ts") -Destination (Join-Path $Services "authoritativeEvidenceProjection.ts") -Force
Copy-Item -LiteralPath (Join-Path $Payload "services\authoritativeRunProjection.ts") -Destination (Join-Path $Services "authoritativeRunProjection.ts") -Force
Copy-Item -LiteralPath (Join-Path $Payload "styles\mega-demo-authoritative-replay.css") -Destination (Join-Path $Styles "mega-demo-authoritative-replay.css") -Force

$currentText = Get-Content -LiteralPath $Current -Raw
$legacyText = Get-Content -LiteralPath $Legacy -Raw
if ($currentText -notmatch [regex]::Escape($Marker)) { throw "008B install validation failed: authoritative wrapper marker missing." }
if ($legacyText -match [regex]::Escape($Marker)) { throw "008B install validation failed: reference implementation contains wrapper marker." }
if ($legacyText -notmatch "Mega Enterprise Control Room") { throw "008B install validation failed: reference implementation is not the Mega Demo." }

Write-Host ""
Write-Host "MEGA_DEMO_AUTHORITATIVE_REPLAY_008B applied successfully." -ForegroundColor Green
Write-Host "Recovered reference Mega Demo from: $recoverySource" -ForegroundColor Green
Write-Host "Authoritative wrapper: $Current" -ForegroundColor Green
Write-Host "Preserved reference demo: $Legacy" -ForegroundColor Green
Write-Host "Self-copy protection: ACTIVE" -ForegroundColor Green
