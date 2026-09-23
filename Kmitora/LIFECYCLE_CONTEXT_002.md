# KMITORA LIFECYCLE CONTEXT 002

Permanent DEV lifecycle hardening:
- recovers latest persisted authoritative discovery when active migration id is missing,
- supports both `/v1/lifecycle/stages/{stage}` and compatibility `/v1/lifecycle-stage`,
- frontend retries the compatibility route only on 404/not-found,
- stage navigation is disabled until the current stage is DONE,
- prevents zeroed lifecycle metrics from being treated as a completed stage.

Validated:
- Python compile: PASS
- TypeScript noEmit: PASS
