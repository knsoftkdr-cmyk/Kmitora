# KMITORA VALIDATION_STORAGE_001

Permanent correction for browser localStorage quota failures during DEV validation.

## Root cause
`runRealDevValidation()` persisted the full validation payload to
`kmitora.dev.validationEvidence`, including quality findings, thousands of
record dispositions and the full staging plan. Large scenarios exceed browser
localStorage quota and turn a successful read-only validation into a blocked UI state.

## Correction
- Full validation evidence is no longer copied into browser localStorage.
- Existing discovery evidence is not redundantly rewritten during validation.
- Browser storage keeps only a compact validation certificate and counts.
- Legacy oversized `kmitora.dev.validationEvidence` is removed before the compact write.
- Storage/quota failure is non-authoritative and cannot fail deterministic validation.
- Full result remains available to the current UI state and authoritative lifecycle/server context.
- DEV-only safety remains unchanged: validation performs no source/target/production/cutover writes.
