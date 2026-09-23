# KMITORA EXEC-STAGE-002 — Authoritative Staging Scope Invariant

## Defect
Unified Discovery correctly scoped SCN-MIG-006 to 295 rows (53 customers, 72 orders, 170 order_items), but authoritative staging reported 11,439 classified records and 100 referential dependencies. This proves authoritative staging was not bound tightly enough to the exact Unified Discovery entity population.

## Fix
1. Unified Discovery now sends an explicit `source_entity_allowlist` to authoritative discovery.
2. Unified Discovery sends `expected_entity_row_counts` for each discovered/scoped entity.
3. Unified Discovery sends `expected_scoped_record_count`.
4. The backend fails closed if a requested entity is missing, any scoped entity count differs, any unexpected entity is included, or the total authoritative scoped population differs.
5. The frontend independently blocks promotion if authoritative disposition totals do not equal the scoped discovery total.
6. Existing stale approvals remain invalidated when staging changes.

## SCN-MIG-006 Verified Baseline
- customers.csv: 53 matched / 64 scanned
- orders.csv: 72 matched / 83 scanned
- order_items.csv: 170 matched / 182 scanned
- total scoped: 295
- authoritative staging ready: 295
- review: 0
- quarantine: 0
- rejected: 0
- referential dependencies: 2

## Safety
- Source remains read-only.
- No target write is performed by discovery/staging.
- Production remains disabled.
- A mismatch blocks execution rather than silently broadening scope.
