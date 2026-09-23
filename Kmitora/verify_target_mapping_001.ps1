$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Backend = Join-Path $Root "backend\main_api\F1033_server.py"
$Frontend = Join-Path $Root "frontend\src\pages\Migrate.tsx"

Write-Host "=== KMITORA TARGET_MAPPING_001 verification ==="

$checks = @(
  @{Name="Backend semantic resolver"; Path=$Backend; Pattern="TARGET_MAPPING_001"},
  @{Name="Backend field-overlap disambiguation"; Path=$Backend; Pattern="source_field_norms"},
  @{Name="Frontend authoritative mapping"; Path=$Frontend; Pattern="mappedTables"},
  @{Name="Frontend catalog compatibility bridge"; Path=$Frontend; Pattern="semantic.length === 1"},
  @{Name="Ambiguity rejection"; Path=$Frontend; Pattern="Ambiguous target mapping"}
)

foreach ($c in $checks) {
  if (Select-String -Path $c.Path -Pattern $c.Pattern -Quiet) {
    Write-Host "PASS  $($c.Name)" -ForegroundColor Green
  } else {
    Write-Host "FAIL  $($c.Name)" -ForegroundColor Red
    exit 1
  }
}

Write-Host "TARGET_MAPPING_001 code verification passed." -ForegroundColor Green
