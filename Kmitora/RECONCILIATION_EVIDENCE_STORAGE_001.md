# KMITORA RECONCILIATION_EVIDENCE_STORAGE_001

Permanent fix for oversized reconciliation/evidence browser storage.

- Full evidence packages are authoritative server-side artifacts.
- Reconciliation and evidence packages persist under backend runtime_state.
- Browser localStorage retains only a compact evidence certificate/ID.
- Reconcile rehydrates full evidence from A000 by evidence_id.
- Browser storage quota failures no longer turn a successful reconciliation/evidence generation into a failed stage.
- Production actions remain disabled; this patch does not enable cutover or production execution.
