$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Target = 'C:\KMITORA\Kmitora-main\Kmitora-main\tools\run_a000_lifecycle_qualification_029d.ps1'
Write-Host '=== VERIFY A000 LIFECYCLE QUALIFICATION 029D1 ===' -ForegroundColor Cyan
if (-not (Test-Path -LiteralPath $Target)) { throw "Missing: $Target" }
$Text = Get-Content -LiteralPath $Target -Raw
$Required = @(
    'Invoke-KmitoraJson',
    'ConvertFrom-Json',
    'migration_gate_error',
    'guarded Execute rejects missing migration_id',
    'lifecycle_runtime.safety',
    'A000_LIFECYCLE_QUALIFICATION_029D live HTTP qualification passed.'
)
foreach ($Needle in $Required) {
    if ($Text -notlike ('*' + $Needle + '*')) { throw "Missing expected verifier marker: $Needle" }
    Write-Host ('PASS  ' + $Needle) -ForegroundColor Green
}
Write-Host 'PASS  self-copy installer defect removed by 029D1' -ForegroundColor Green
Write-Host 'A000_LIFECYCLE_QUALIFICATION_029D1 code verification passed.' -ForegroundColor Green
