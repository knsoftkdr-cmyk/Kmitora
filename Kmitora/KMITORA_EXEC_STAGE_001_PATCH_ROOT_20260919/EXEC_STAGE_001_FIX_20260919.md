# KMITORA EXEC-STAGE-001 Fix

## Defect confirmed
Unified Discovery successfully scoped SCN-MIG-006 to 295 records, but the downstream Migration Command Center and Approval Center showed Total Planned = 0, Ready = 0. The frontend stored a metadata-only compatibility discovery result and did not automatically promote it through the authoritative backend staging planner before approval.

## Fix
1. Unified Discovery now automatically calls the authoritative backend discovery/staging engine using the same migration id immediately after UI discovery.
2. The authoritative `target_staging_plan`, `quality_findings`, `summary`, mappings and transformation plan are merged into `kmitora.dev.discoveryResult` before downstream navigation.
3. Discovery is blocked from promotion if authoritative staging returns zero ready records.
4. Any locally cached approval/execution tied to an older staging snapshot is cleared when a new authoritative discovery is promoted.
5. Migration Command Center detects stale approval snapshots and requires a fresh authoritative approval for the current staging counts.
6. Server-side approval history remains intact for audit; only stale local execution authority is invalidated.

## Expected SCN-MIG-006 result
- customers: 53 ready
- orders: 72 ready
- order_items: 170 ready
- total planned/ready: 295 (assuming no blocking findings)
- old approval with Total Planned 0 must not be reused
- a new approval must be requested and approved for the 295-record staging snapshot
- production and cutover remain disabled

## Validation
- Discover.tsx TypeScript transpile syntax: PASS
- Migrate.tsx TypeScript transpile syntax: PASS
- Full `npm run build` could not complete in the review container because installed type definitions `vite/client` and `node` were missing from the local dependency tree; this is an environment/dependency issue rather than a syntax error in the changed files.
