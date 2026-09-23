$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Source = Join-Path $Root 'tools\run_a000_lifecycle_qualification_029d.ps1'
$Target = 'C:\KMITORA\Kmitora-main\Kmitora-main\tools\run_a000_lifecycle_qualification_029d.ps1'

Write-Host '=== KMITORA A000 LIFECYCLE QUALIFICATION 029D1 ===' -ForegroundColor Cyan
if (-not (Test-Path -LiteralPath $Source)) { throw "Patch source missing: $Source" }

$TargetDir = Split-Path -Parent $Target
New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null

$SourceFull = [System.IO.Path]::GetFullPath($Source)
$TargetFull = [System.IO.Path]::GetFullPath($Target)

if ([string]::Equals($SourceFull, $TargetFull, [System.StringComparison]::OrdinalIgnoreCase)) {
    Write-Host 'SKIP  qualification script already located at target path' -ForegroundColor Yellow
}
else {
    if (Test-Path -LiteralPath $Target) {
        $srcHash = (Get-FileHash -LiteralPath $Source -Algorithm SHA256).Hash
        $dstHash = (Get-FileHash -LiteralPath $Target -Algorithm SHA256).Hash
        if ($srcHash -eq $dstHash) {
            Write-Host 'SKIP  identical qualification script already installed' -ForegroundColor Yellow
        }
        else {
            $Stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
            $Backup = "$Target.pre029d1_$Stamp.bak"
            Copy-Item -LiteralPath $Target -Destination $Backup -Force
            Copy-Item -LiteralPath $Source -Destination $Target -Force
            Write-Host "BACKUP $Backup" -ForegroundColor DarkGray
            Write-Host 'UPDATED tools\run_a000_lifecycle_qualification_029d.ps1' -ForegroundColor Green
        }
    }
    else {
        Copy-Item -LiteralPath $Source -Destination $Target -Force
        Write-Host 'INSTALLED tools\run_a000_lifecycle_qualification_029d.ps1' -ForegroundColor Green
    }
}

if (-not (Test-Path -LiteralPath $Target)) { throw "Qualification script missing after apply: $Target" }

$Text = Get-Content -LiteralPath $Target -Raw
foreach ($Needle in @(
    'Invoke-KmitoraJson',
    'migration_gate_error',
    'lifecycle_runtime.safety',
    'A000_LIFECYCLE_QUALIFICATION_029D live HTTP qualification passed.'
)) {
    if ($Text -notlike ('*' + $Needle + '*')) { throw "Installed qualification script missing marker: $Needle" }
}

Write-Host 'PASS  029D qualification script is installed and current' -ForegroundColor Green
Write-Host 'No backend source changed. No restart required.' -ForegroundColor Yellow
Write-Host 'A000_LIFECYCLE_QUALIFICATION_029D1 applied successfully.' -ForegroundColor Green
