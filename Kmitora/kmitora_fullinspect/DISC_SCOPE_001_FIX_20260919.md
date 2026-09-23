# KMITORA DISC-SCOPE-001 Fix

Date: 2026-09-19
Environment: DEV
Production writes: DISABLED
Cutover: DISABLED

## Defect
Unified Discovery captured a business rule such as:

`Process only records where scenario_id equals SCN-MIG-006.`

but still counted every row in the connected CSV files. The scenario pack therefore showed 329 rows (64 customers + 83 orders + 182 order items) instead of the SCN-MIG-006 subset.

## Implemented correction

1. Added A000/A200 governed source-scope intelligence.
2. Natural-language rules are compiled into deterministic read-only predicates.
3. The rule `scenario_id equals SCN-MIG-006` compiles to `scenario_id = SCN-MIG-006`.
4. Scope is applied before relationship inference, quality analysis, mapping, transformation planning, staging and evidence sync.
5. File-source CSV preview can apply the same scope server-side and returns exact scanned/matched row counts.
6. Discovery blocks rather than broadening scope if the required scope field is absent from an in-scope entity.
7. Discovery blocks if the compiled scope matches zero rows.
8. Source/target catalog alignment occurs before scope enforcement so unrelated files in a master scenario pack do not pollute the migration scope.
9. UI-005 now supports unnumbered substantive rules as a fallback instead of silently producing zero rules.
10. UI-005 expected entity flow is generated from `maps to` rules instead of being hard-coded to customers/orders/payments.
11. Load waves are derived from explicit `must load before` rules.
12. Discovery displays the compiled scope and matched-vs-scanned counts.

## Agent integration

The deterministic scope compiler is owned by the existing A200 Intent Migration Agent under A000 orchestration. This is code-level agent capability integration, not model-weight training. A200 now translates explicit row-scope intent into executable read-only predicates before discovery and downstream migration lifecycle stages.

## SCN-MIG-006 verified counts

| Entity | Scanned | Matched |
|---|---:|---:|
| customers.csv | 64 | 53 |
| orders.csv | 83 | 72 |
| order_items.csv | 182 | 170 |
| **Total** | **329** | **295** |

Compiled predicate:

`scenario_id = SCN-MIG-006`

Relationships on the filtered population:

- customers -> orders: 0 orphan values
- orders -> order_items: 0 orphan values

## Validation

- Python compile: PASS
- New source-scope intelligence tests: 4/4 PASS
- Source API file-format/scope tests: 6/6 PASS
- Main API suite: 90/90 PASS
- Frontend changed-file TypeScript/TSX syntax transpilation: PASS
- Full frontend `npm run build` could not be completed in the review container because npm dependency installation was incomplete; changed TypeScript files were syntax-validated with TypeScript 5.8.3.

## Changed files

- `backend/main_api/source_scope_intelligence.py` (new)
- `backend/main_api/F1033_server.py`
- `backend/main_api/advanced_capabilities.py`
- `backend/main_api/test_source_scope_intelligence.py` (new)
- `backend/source_api/kmitora_source_api.py`
- `backend/source_api/test_file_source_formats.py`
- `frontend/src/services/requirementScope.ts` (new)
- `frontend/src/features/business-requirements/KMITORABusinessRequirementsWorkspace.tsx`
- `frontend/src/pages/Discover.tsx`
