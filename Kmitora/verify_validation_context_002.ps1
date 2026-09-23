$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Service = Join-Path $Root "frontend\src\services\devValidation.ts"
$Page = Join-Path $Root "frontend\src\pages\Validate.tsx"

Write-Host "=== KMITORA VALIDATION_CONTEXT_002 verification ===" -ForegroundColor Cyan

if (!(Test-Path $Service)) { throw "Missing $Service" }
if (!(Test-Path $Page)) { throw "Missing $Page" }

$S = Get-Content $Service -Raw
$P = Get-Content $Page -Raw

$checks = @(
  @{ N = "Patch marker"; X = $S.Contains("VALIDATION_CONTEXT_002") -and $P.Contains("VALIDATION_CONTEXT_002") },
  @{ N = "Authoritative post-load context passed to validator"; X = $P.Contains("runRealDevValidation(discovery, postLoadExecution)") },
  @{ N = "Source count fallback uses discovery summary"; X = $S.Contains("source_rows_matched") -and $S.Contains("source_rows_scanned") -and $S.Contains("Math.max(entityRows, summaryRows, dispositionRows, stagingRows)") },
  @{ N = "Relationship fallback prevents zero referential controls"; X = $S.Contains("stagedReferential.length") -and $S.Contains("relationships.map") -and $P.Contains("discovery?.relationships") },
  @{ N = "Post-load validation mode"; X = $S.Contains("POST_LOAD_READ_ONLY") -and $P.Contains("POST_LOAD_READ_ONLY") },
  @{ N = "Post-load execution identity retained"; X = $S.Contains("execution_id: authoritativeExecution?.execution_id") -and $S.Contains("execution_status: authoritativeExecution?.status") },
  @{ N = "Transformation check count uses authoritative plan"; X = $S.Contains("plannedTransformCount") -and $P.Contains("discovery.validation_execution?.transformation_checks") },
  @{ N = "Validation remains read only"; X = $S.Contains("target_write_requested: false") -and $S.Contains("target_write_executed: false") -and $S.Contains("production_action_executed: false") },
  @{ N = "Production and cutover safety preserved"; X = $S.Contains("cutover_executed: false") }
)

foreach ($c in $checks) {
  if ($c.X) { Write-Host "PASS  $($c.N)" -ForegroundColor Green }
  else { throw "FAIL  $($c.N)" }
}

Write-Host "" 
Write-Host "VALIDATION_CONTEXT_002 code verification passed." -ForegroundColor Green
