# KMITORA POST_LOAD_CONTEXT_001

Permanent execution-context propagation fix for DEV Replace-Load -> Test -> Validate -> Reconcile -> Evidence.

## Fixed
- Successful DEV Replace-Load is registered with A000 as a new authoritative `POST_LOAD_COMPLETED` execution.
- The post-load execution is bound to the same migration, approval, target and parent dry-run execution.
- A000 verifies attempted, inserted, read-back target counts and authoritative ready count are identical before accepting post-load state.
- Test no longer qualifies the stale dry-run after a real target write. It requires the post-load execution and validates DEV-write / production-safety semantics.
- Held Review / Quarantine / Rejected records are preserved as governed dispositions and are not incorrectly treated as load failures.
- Validate requires a PASSED Test for the same `POST_LOAD_COMPLETED` execution before running impacted validation.
- Reconcile prefers the post-load execution and reconciles expected-ready versus actual DEV loaded counts.
- Evidence reflects DEV target writes while keeping production actions and cutover disabled.

## Current address scenario expected invariant
`3850 discovered = 2250 loaded-ready + 1600 review-held + 0 quarantine + 0 rejected`

Loaded reconciliation:
`2250 expected ready = 2250 DEV target loaded`
