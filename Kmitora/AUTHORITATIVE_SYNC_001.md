# KMITORA AUTHORITATIVE-SYNC-001

Permanent removal of the legacy manual Source Path / Target Schema File / Business Rules File dependency from Sync Authoritative Evidence.

## Behavior
- Reuses the exact active source and multi-format resolver from Unified Discovery.
- Reuses the active target metadata from Unified Discovery.
- Reuses saved UI-005 business rules; no requirements.txt is required.
- Carries supporting-artifact metadata from the saved requirement.
- Enforces the same logical source-entity allowlist and authoritative row counts established by Unified Discovery.
- Fails closed if the saved rules or successful source entities are missing.
- Keeps authoritative staging and approval counts aligned with the same governed discovery scope.

## Regression validation
- Python compile: PASS
- Recursive multi-format discovery tests: 4 PASS
- Includes a regression test proving authoritative sync works with inline saved rules and no business_rules_path.
