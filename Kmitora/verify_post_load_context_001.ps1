$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Write-Host "=== KMITORA POST_LOAD_CONTEXT_001 verification ==="

$Checks = @(
  @{ Path="$Root\backend\main_api\F1033_server.py"; Pattern='/v1/post-load-executions'; Name='Authoritative post-load registration endpoint' },
  @{ Path="$Root\backend\main_api\F1033_server.py"; Pattern='POST_LOAD_COMPLETED'; Name='Post-load execution state' },
  @{ Path="$Root\backend\main_api\F1033_server.py"; Pattern='DEV_REPLACE_LOAD'; Name='Governed DEV load execution mode' },
  @{ Path="$Root\frontend\src\pages\Migrate.tsx"; Pattern='POST_LOAD_CONTEXT_001'; Name='Migration post-load propagation' },
  @{ Path="$Root\frontend\src\pages\Test.tsx"; Pattern='POST_LOAD_COMPLETED'; Name='Test bound to post-load context' },
  @{ Path="$Root\frontend\src\pages\Validate.tsx"; Pattern='postLoadQualified'; Name='Validate bound to passed post-load Test' },
  @{ Path="$Root\frontend\src\pages\Reconcile.tsx"; Pattern='POST_LOAD_COMPLETED'; Name='Reconcile bound to post-load execution' }
)

foreach ($c in $Checks) {
  if (Select-String -Path $c.Path -Pattern $c.Pattern -Quiet) {
    Write-Host "PASS  $($c.Name)"
  } else {
    throw "FAIL  $($c.Name)"
  }
}

$Py = Join-Path $Root 'backend\.venv\Scripts\python.exe'
$Server = Join-Path $Root 'backend\main_api\F1033_server.py'
if (Test-Path $Py) {
  & $Py -m py_compile $Server
  if ($LASTEXITCODE -ne 0) { throw 'FAIL  Backend Python compile' }
  Write-Host 'PASS  Backend Python compile'
} else {
  Write-Host 'INFO  Project venv not inside patch folder; compile check will run after extraction.'
}

Write-Host 'POST_LOAD_CONTEXT_001 code verification passed.'
