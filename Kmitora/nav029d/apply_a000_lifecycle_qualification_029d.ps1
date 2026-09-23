$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Source = Join-Path $Root 'tools\run_a000_lifecycle_qualification_029d.ps1'
$Target = 'C:\KMITORA\Kmitora-main\Kmitora-main\tools\run_a000_lifecycle_qualification_029d.ps1'

Write-Host '=== KMITORA A000 LIFECYCLE QUALIFICATION 029D ===' -ForegroundColor Cyan
if (-not (Test-Path $Source)) { throw "Patch source missing: $Source" }
$TargetDir = Split-Path -Parent $Target
New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
Copy-Item -LiteralPath $Source -Destination $Target -Force
Write-Host 'INSTALLED tools\run_a000_lifecycle_qualification_029d.ps1' -ForegroundColor Green
Write-Host 'No backend source changed. No restart required.' -ForegroundColor Yellow
Write-Host 'A000_LIFECYCLE_QUALIFICATION_029D applied successfully.' -ForegroundColor Green
