# PROVE_EVIDENCE_AUTHORITATIVE_SYNC_007

Permanent correction for contradictory KMITORA Prove / Evidence state.

## Root cause
The primary Evidence page had already rehydrated the full authoritative A000 evidence package, while `EvidencePremiumWorkspace.tsx` independently read the compact `kmitora.dev.lastEvidence` browser certificate. The compact certificate intentionally excludes large record, transformation, business-rule and proof payloads. As a result, the same screen could simultaneously show 4,026 artifacts / COMPLETE and claim that transformation, record, discovery or runtime-safety evidence was missing.

## Permanent architecture
- A000 `/v1/evidence/{evidence_id}` is the first evidence authority.
- Browser localStorage is used only to discover the evidence ID or as a compatibility fallback when it already contains a full package.
- Missing summary/proof sections may be enriched only from identity-aligned lifecycle records for the same migration/execution/reconciliation chain.
- Evidence artifact arrays are never invented or reconstructed from counts.
- Premium Evidence recalculates after the authoritative server package arrives.

## Expected result for the current golden path
- Discovery Summary: AVAILABLE
- Approval Proof: AVAILABLE
- Execution Proof: AVAILABLE
- Reconciliation Proof: AVAILABLE
- Transformation / Record Evidence: AVAILABLE
- Runtime Safety Proof: AVAILABLE
- Record results: 2250
- Transformation evidence: 1714
- Business rules: 62
- Audit gaps: 0
- Target writes: 2250 DEV
- Production actions: 0
- Production migration: DISABLED
- Cutover: DISABLED
