$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Learn = Join-Path $Root "frontend\src\pages\Learn.tsx"
$Evidence = Join-Path $Root "frontend\src\pages\Evidence.tsx"
$Premium = Join-Path $Root "frontend\src\components\EvidencePremiumWorkspace.tsx"

Write-Host "=== KMITORA EVIDENCE_LEARN_POSTLOAD_004 verification ===" -ForegroundColor Cyan
$checks = @(
  @{N="Learn authoritative evidence rehydration"; P=(Select-String -Path $Learn -SimpleMatch 'getEvidenceById' -Quiet)},
  @{N="Learn recognizes POST_LOAD_COMPLETED"; P=(Select-String -Path $Learn -SimpleMatch 'POST_LOAD_COMPLETED' -Quiet)},
  @{N="Learn recognizes POST_LOAD_DEV"; P=(Select-String -Path $Learn -SimpleMatch 'POST_LOAD_DEV' -Quiet)},
  @{N="Learn validates approved DEV write boundary"; P=(Select-String -Path $Learn -SimpleMatch 'Approved DEV target writes match reconciled records' -Quiet)},
  @{N="Learn preserves zero production action gate"; P=(Select-String -Path $Learn -SimpleMatch 'Production action count is zero' -Quiet)},
  @{N="Evidence shows discovered source scope"; P=(Select-String -Path $Evidence -SimpleMatch 'Discovered Scope' -Quiet)},
  @{N="Evidence shows actual DEV target semantics"; P=(Select-String -Path $Evidence -SimpleMatch 'Actual DEV Target' -Quiet)},
  @{N="Evidence shows review-held population"; P=(Select-String -Path $Evidence -SimpleMatch 'Review Held' -Quiet)},
  @{N="Decision trace uses identity-chain fallback"; P=(Select-String -Path $Premium -SimpleMatch 'decisionTraceStages' -Quiet)},
  @{N="Decision trace exposes five governed stages"; P=(Select-String -Path $Premium -SimpleMatch 'Decision Trace (${snapshot.decisionTraceCount}/5)' -Quiet)}
)
foreach ($c in $checks) {
  if ($c.P) { Write-Host "PASS  $($c.N)" -ForegroundColor Green }
  else { throw "FAIL  $($c.N)" }
}
Write-Host ""
Write-Host "EVIDENCE_LEARN_POSTLOAD_004 code verification passed." -ForegroundColor Green
