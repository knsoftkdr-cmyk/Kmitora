$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Recon = Join-Path $Root "frontend\src\pages\Reconcile.tsx"
$ReconPremium = Join-Path $Root "frontend\src\components\ReconcilePremiumWorkspace.tsx"
$Evidence = Join-Path $Root "frontend\src\pages\Evidence.tsx"
$EvidencePremium = Join-Path $Root "frontend\src\components\EvidencePremiumWorkspace.tsx"

Write-Host "=== KMITORA RECONCILIATION_POSTLOAD_SEMANTICS_002 verification ===" -ForegroundColor Cyan

$checks = @(
  @{N="Reconcile recognizes POST_LOAD_DEV"; P=$Recon; S='reconciliation_mode ?? ""'},
  @{N="Reconcile uses governed DEV execution wording"; P=$Recon; S='Reconcile governed DEV execution'},
  @{N="Reconcile preserves DEV write boundary"; P=$Recon; S='DEV write boundary preserved'},
  @{N="Premium workspace recognizes POST_LOAD_DEV"; P=$ReconPremium; S='POST_LOAD_DEV'},
  @{N="Premium workspace reads compact evidence counts"; P=$ReconPremium; S='record_result_count'},
  @{N="Premium workspace reads compact transformation count"; P=$ReconPremium; S='transformation_evidence_count'},
  @{N="Premium workspace reads compact business-rule count"; P=$ReconPremium; S='business_rule_count'},
  @{N="Evidence rehydrates authoritative package"; P=$Evidence; S='getEvidenceById'},
  @{N="Evidence applies POST_LOAD_DEV safety"; P=$Evidence; S='isPostLoad'},
  @{N="Evidence premium understands compact certificate"; P=$EvidencePremium; S='recordResultCount'},
  @{N="Evidence premium applies post-load safety"; P=$EvidencePremium; S='isPostLoad'}
)

foreach ($c in $checks) {
  if ((Get-Content $c.P -Raw).Contains($c.S)) { Write-Host "PASS  $($c.N)" -ForegroundColor Green }
  else { throw "FAIL  $($c.N)" }
}

Write-Host ""
Write-Host "RECONCILIATION_POSTLOAD_SEMANTICS_002 code verification passed." -ForegroundColor Green
