# KMITORA VALIDATION_CONTEXT_002

Permanent validation-context synchronization fix.

Fixes:
- source record count no longer collapses to 0 when nested source entity row_count is absent;
- source count falls back to authoritative discovery summary, record dispositions, and staging totals;
- discovered relationships are converted to referential validation controls when a stale staging snapshot omitted them;
- post-load execution identity/status is carried into validation evidence;
- validation mode becomes POST_LOAD_READ_ONLY after a governed DEV replace-load;
- transformation/planned-check count uses the authoritative transformation plan;
- browser validation remains read-only and cannot perform source, target, production, or cutover writes.

Expected current scenario after rerunning Run Impacted Tests:
- Source records: 3850
- Ready: 2250
- Review-held: 1600
- Rejected: 0
- Referential dependencies: 1
- Transformation checks: 1714
- Mode: POST_LOAD_READ_ONLY
- Post-load execution: POST_LOAD_COMPLETED
- Validation writes: 0
- Production: disabled
- Cutover: disabled
