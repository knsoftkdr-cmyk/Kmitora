# KMITORA APPROVAL_CONTEXT_001

Permanent DEV approval-context hardening.

## Fixes
- Approval evidence is persisted by A000 under `backend/main_api/runtime_state/approvals` and survives service/browser restarts.
- Browser localStorage is display cache only and can no longer authorize a dry run.
- Approval lookup is scoped by `migration_id` and exact `approval_id` can be verified server-side.
- A newly requested approval supersedes older approval evidence for the same migration.
- DEV approval requests cannot request execution or target writes.
- `Run DEV Dry Run` re-verifies the exact authoritative approval immediately before simulation.
- Missing server approval clears stale browser approval instead of showing `APPROVED` and `Approval request not found` at the same time.
- Production authority and cutover remain disabled.

## One-time note after applying
Approvals created before this patch were not persisted server-side. After the first restart with this patch, an old browser-only approval will be cleared. Request and approve one new approval for the active migration. From then on, it survives restarts.
