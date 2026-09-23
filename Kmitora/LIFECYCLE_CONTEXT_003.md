# KMITORA LIFECYCLE_CONTEXT_003

Permanent fixes:
- Lifecycle context rows_observed now uses rows_observed/source_rows_observed/source_rows_matched/source_rows_scanned and entity totals as fallback.
- Lifecycle stage evaluation ignores malformed non-dictionary finding entries instead of crashing.
- Lifecycle stage API always returns a JSON error envelope for unexpected exceptions rather than closing with an empty response.
- Frontend parses stage responses defensively and reports empty/non-JSON responses explicitly.
- Frontend local context also reads source_rows_matched/source_rows_scanned.

Expected ADDR-1000 context: 3850 rows, 62 rules, 2 source entities, 4 target entities, 1 relationship.
