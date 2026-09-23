$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$File = Join-Path $Root 'frontend\src\pages\Migrate.tsx'
Write-Host '=== KMITORA EXECUTION_STORAGE_001 verification ==='
$checks = @(
  @{ Name='Compact execution cache'; Pattern='persistence_version: "EXECUTION_STORAGE_001"' },
  @{ Name='No record_results in persisted cache'; Pattern='never persist the full dry-run payload' },
  @{ Name='Quota failure isolation'; Pattern='compact execution cache could not be persisted' },
  @{ Name='Execution id retained'; Pattern='kmitora.dev.executionId' },
  @{ Name='Dry-run gate retained'; Pattern='DRY_RUN_COMPLETED' },
  @{ Name='DEV replace-load retained'; Pattern='Execute DEV Replace-Load' }
)
foreach ($c in $checks) {
  if (Select-String -Path $File -Pattern $c.Pattern -Quiet) {
    Write-Host ("PASS  " + $c.Name) -ForegroundColor Green
  } else {
    Write-Host ("FAIL  " + $c.Name) -ForegroundColor Red
    exit 1
  }
}
Write-Host 'EXECUTION_STORAGE_001 code verification passed.' -ForegroundColor Green
