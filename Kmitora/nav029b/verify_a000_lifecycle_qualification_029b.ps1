param([string]$ProjectRoot = 'C:\KMITORA\Kmitora-main\Kmitora-main')
$ErrorActionPreference='Stop'
$P=Join-Path $ProjectRoot 'tools\run_a000_lifecycle_qualification_029b.ps1'
if (-not (Test-Path $P)) { throw '029B qualifier missing' }
$T=Get-Content $P -Raw
$Checks=@(
 @{Name='guarded HTTP error capture'; Pattern='catch \[System\.Net\.WebException\]'},
 @{Name='migration guard qualification'; Pattern="'/v1/migrations'"},
 @{Name='expected migration_gate_error'; Pattern="migration_gate_error"},
 @{Name='029 lifecycle runtime assertion'; Pattern='A000_LIFECYCLE_UNIFIED_RUNTIME_029'},
 @{Name='027 regression assertion'; Pattern='normal_message_path_integrated'},
 @{Name='zero production assertion'; Pattern='production_action_executed'}
)
foreach($C in $Checks){ if($T -notmatch $C.Pattern){throw "FAIL $($C.Name)"}; Write-Host "PASS  $($C.Name)" -ForegroundColor Green }
Write-Host 'A000_LIFECYCLE_QUALIFICATION_029B code verification passed.' -ForegroundColor Green
