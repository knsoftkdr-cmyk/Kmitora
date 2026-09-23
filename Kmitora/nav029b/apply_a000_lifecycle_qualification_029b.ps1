param([string]$ProjectRoot = 'C:\KMITORA\Kmitora-main\Kmitora-main')
$ErrorActionPreference = 'Stop'
$Source = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) '..\tools\run_a000_lifecycle_qualification_029b.ps1'
$Source = [IO.Path]::GetFullPath($Source)
$Tools = Join-Path $ProjectRoot 'tools'
$Dest = Join-Path $Tools 'run_a000_lifecycle_qualification_029b.ps1'
if (-not (Test-Path $ProjectRoot)) { throw "Project root not found: $ProjectRoot" }
New-Item -ItemType Directory -Path $Tools -Force | Out-Null
if (Test-Path $Dest) {
    $a=(Get-FileHash $Source -Algorithm SHA256).Hash; $b=(Get-FileHash $Dest -Algorithm SHA256).Hash
    if ($a -eq $b) { Write-Host 'SKIP identical tools\run_a000_lifecycle_qualification_029b.ps1' -ForegroundColor Yellow }
    else {
        $Backup="$Dest.bak_029b_$(Get-Date -Format yyyyMMdd_HHmmss)"; Copy-Item $Dest $Backup -Force
        Copy-Item $Source $Dest -Force; Write-Host "UPDATED qualifier. Backup: $Backup" -ForegroundColor Green
    }
} else { Copy-Item $Source $Dest -Force; Write-Host 'INSTALLED tools\run_a000_lifecycle_qualification_029b.ps1' -ForegroundColor Green }
Write-Host 'A000_LIFECYCLE_QUALIFICATION_029B applied successfully.' -ForegroundColor Green
