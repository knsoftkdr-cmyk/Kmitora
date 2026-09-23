$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Backend = Join-Path $Root "backend\main_api\F1033_server.py"
$Migrate = Join-Path $Root "frontend\src\pages\Migrate.tsx"
$Test = Join-Path $Root "frontend\src\pages\Test.tsx"
$Validate = Join-Path $Root "frontend\src\pages\Validate.tsx"
$Reconcile = Join-Path $Root "frontend\src\pages\Reconcile.tsx"
$Api = Join-Path $Root "frontend\src\services\api.ts"

Write-Host "=== KMITORA EXECUTION_CONTEXT_001 verification ===" -ForegroundColor Cyan

$checks = @(
  @{ Name = "Persistent execution store"; File = $Backend; Pattern = "EXECUTION_CONTEXT_001" },
  @{ Name = "Persist dry-run execution"; File = $Backend; Pattern = "_persist_execution_state\(execution\)" },
  @{ Name = "Persist post-load execution"; File = $Backend; Pattern = "_persist_execution_state\(post_load\)" },
  @{ Name = "Authoritative execution getter"; File = $Backend; Pattern = "_get_authoritative_execution" },
  @{ Name = "Authoritative discovery getter in post-load"; File = $Backend; Pattern = "discovery = _get_authoritative_discovery\(migration_id\)" },
  @{ Name = "Authoritative approval getter in post-load"; File = $Backend; Pattern = "approval = _get_authoritative_approval\(approval_id\)" },
  @{ Name = "Execution retrieval API"; File = $Backend; Pattern = 'path == "/v1/executions"' },
  @{ Name = "Frontend execution rehydration API"; File = $Api; Pattern = "getLatestExecutionForMigration" },
  @{ Name = "Migrate server execution rehydration"; File = $Migrate; Pattern = "getLatestExecutionForMigration" },
  @{ Name = "Test server execution rehydration"; File = $Test; Pattern = "getLatestExecutionForMigration" },
  @{ Name = "Validate server execution rehydration"; File = $Validate; Pattern = "getLatestExecutionForMigration" },
  @{ Name = "Reconcile server execution rehydration"; File = $Reconcile; Pattern = "getLatestExecutionForMigration" }
)

$failed = $false
foreach ($c in $checks) {
  if (Select-String -Path $c.File -Pattern $c.Pattern -Quiet) {
    Write-Host ("PASS  " + $c.Name) -ForegroundColor Green
  } else {
    Write-Host ("FAIL  " + $c.Name) -ForegroundColor Red
    $failed = $true
  }
}

if ($failed) {
  throw "EXECUTION_CONTEXT_001 verification failed."
}

Write-Host "EXECUTION_CONTEXT_001 code verification passed." -ForegroundColor Green
