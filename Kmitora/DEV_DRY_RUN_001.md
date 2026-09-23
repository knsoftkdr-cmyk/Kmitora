# KMITORA DEV_DRY_RUN_001

Permanent governed execution hardening.

## Fixes
- Adds an explicit **Run DEV Dry Run** action after an APPROVED migration approval.
- DEV dry run remains simulation-only: source writes = 0, target writes = 0, production action = false.
- Review/quarantine/rejected/blocked dispositions remain visible and held instead of preventing simulation.
- Real DEV replace-load is a separate action and is exposed only after `DRY_RUN_COMPLETED` for the same migration.
- Only authoritative `ready_records` are eligible for DEV replace-load; review/quarantine/rejected records are never written by this action.
- Target-table resolution is driven by Unified Discovery mappings instead of the legacy `target_` naming assumption.
- Target API replace-load now requires governed DEV execution evidence (`migration_id`, `approval_id`, `execution_id`, successful dry-run status).
- The legacy Universal DEV Certification panel is removed from the normal migration execution page so its fixed lab scenario cannot be confused with the active migration target.

## Safety invariants
- Production migration remains disabled.
- Cutover remains disabled.
- Dry run performs no source/target writes.
- DEV replace-load remains a separate explicit user action.
