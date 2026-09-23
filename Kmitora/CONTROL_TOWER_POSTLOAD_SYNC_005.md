# KMITORA CONTROL_TOWER_POSTLOAD_SYNC_005

Permanent Control Tower authority fix.

## Design invariant
Control Tower is a projection of authoritative lifecycle evidence, not an independent source of truth.

## Fixes
- Server-first execution/reconciliation/evidence hydration.
- Browser state is fallback only.
- REVIEW is not BLOCKED.
- Correct source scope, entity, relationship, transformation and business-rule metrics.
- Correct POST_LOAD_COMPLETED / POST_LOAD_DEV semantics.
- 13-stage lifecycle accounting instead of legacy 7-milestone wording.
- Actual DEV target wording instead of simulated/dry-run wording after post-load.
- Production safety remains explicit and separate from DEV target writes.

## Regression rule
No UI module may infer blockers from REVIEW count. Hard blockers are only BLOCKED, QUARANTINE, REJECTED, or failed governed gates.
