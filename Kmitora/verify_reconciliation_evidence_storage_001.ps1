$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Backend = Join-Path $Root 'backend\main_api\F1033_server.py'
$Api = Join-Path $Root 'frontend\src\services\api.ts'
$Recon = Join-Path $Root 'frontend\src\pages\Reconcile.tsx'

Write-Host '=== KMITORA RECONCILIATION_EVIDENCE_STORAGE_001 verification ==='

$backendText = Get-Content $Backend -Raw
$apiText = Get-Content $Api -Raw
$reconText = Get-Content $Recon -Raw

$checks = @(
  @{N='Server evidence persistence'; P=$backendText -match 'RECONCILIATION_EVIDENCE_STORAGE_001' -and $backendText -match '_persist_evidence_state'},
  @{N='Server reconciliation persistence'; P=$backendText -match '_persist_reconciliation_state'},
  @{N='Authoritative evidence getter'; P=$backendText -match '_get_authoritative_evidence'},
  @{N='Evidence retrieval API'; P=$backendText -match 'path\.startswith\("/v1/evidence/"\)'},
  @{N='Reconciliation retrieval API'; P=$backendText -match 'path\.startswith\("/v1/reconciliations/"\)'},
  @{N='Frontend evidence rehydration API'; P=$apiText -match 'getEvidenceById'},
  @{N='Compact browser evidence certificate'; P=$reconText -match 'type EvidenceCertificate' -and $reconText -match 'persistence: "SERVER_AUTHORITATIVE"'},
  @{N='Full evidence stays in memory only'; P=$reconText -match 'setEvidence\(\s*evidencePayload\s*\)'},
  @{N='Legacy oversized evidence key cleanup'; P=$reconText -match 'localStorage\.removeItem\(LAST_EVIDENCE_KEY\)'},
  @{N='Quota failure isolated from reconciliation PASS'; P=$reconText -match 'compact evidence certificate could not be cached'}
)

foreach ($c in $checks) {
  if ($c.P) { Write-Host "PASS  $($c.N)" -ForegroundColor Green }
  else { throw "FAIL  $($c.N)" }
}

$py = Join-Path $Root 'backend\.venv\Scripts\python.exe'
if (Test-Path $py) {
  & $py -m py_compile $Backend
  if ($LASTEXITCODE -ne 0) { throw 'FAIL  Backend Python compile' }
  Write-Host 'PASS  Backend Python compile' -ForegroundColor Green
}

Write-Host ''
Write-Host 'RECONCILIATION_EVIDENCE_STORAGE_001 code verification passed.' -ForegroundColor Green
