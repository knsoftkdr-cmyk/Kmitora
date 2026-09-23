$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Project = $Root
$Pages = Join-Path $Project "frontend\src\pages"
$Services = Join-Path $Project "frontend\src\services"
$Styles = Join-Path $Project "frontend\src\styles"
$Current = Join-Path $Pages "MegaDemoControlRoom.tsx"
$Legacy = Join-Path $Pages "MegaDemoControlRoomLegacy.tsx"

if (-not (Test-Path $Current) -and -not (Test-Path $Legacy)) {
  throw "MegaDemoControlRoom.tsx not found: $Current"
}

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
if ((Test-Path $Current) -and -not (Test-Path $Legacy)) {
  Copy-Item $Current "$Current.bak_MEGA_DEMO_AUTHORITATIVE_REPLAY_008_$stamp" -Force
  Move-Item $Current $Legacy -Force
}

Copy-Item (Join-Path $Root "frontend\src\pages\MegaDemoControlRoom.tsx") $Current -Force
Copy-Item (Join-Path $Root "frontend\src\services\authoritativeEvidenceProjection.ts") (Join-Path $Services "authoritativeEvidenceProjection.ts") -Force
Copy-Item (Join-Path $Root "frontend\src\services\authoritativeRunProjection.ts") (Join-Path $Services "authoritativeRunProjection.ts") -Force
Copy-Item (Join-Path $Root "frontend\src\styles\mega-demo-authoritative-replay.css") (Join-Path $Styles "mega-demo-authoritative-replay.css") -Force

Write-Host "MEGA_DEMO_AUTHORITATIVE_REPLAY_008 applied." -ForegroundColor Green
Write-Host "Current A000 run truth now renders above the preserved reference Mega Demo." -ForegroundColor Green
Write-Host "121/121 reference qualification remains separate from migration counts." -ForegroundColor Green
