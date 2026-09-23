# KMITORA LIFECYCLE-CONTEXT-001

Permanent lifecycle context propagation hardening.

## Included
- Persist authoritative discovery by migration_id under backend runtime_state/discoveries.
- Persist active_migration_id and stage outputs in DEV UI lifecycle state.
- Add GET /v1/lifecycle-context to rehydrate the authoritative migration context.
- Add POST /v1/lifecycle/stages/{detect|diagnose|predict|recommend|simulate}.
- Each stage deterministically evaluates the same discovery and persists its result.
- Downstream stages are gated by predecessor completion.
- Lifecycle explanation metrics now come from A000 authoritative context, not stale localStorage only.
- Execute rehydrates the authoritative discovery and clears stale approval/execution state from other migration IDs.
- Unified Discovery persists active_migration_id for downstream correlation.
- No source or target writes are introduced; production authorization remains disabled.

## Validation
- Python compile: PASS.
- Deterministic stage evaluation smoke test: PASS for Detect -> Diagnose -> Predict -> Recommend -> Simulate using 3850 rows, 62 rules, 2 source entities, 4 target entities and 1 relationship.
