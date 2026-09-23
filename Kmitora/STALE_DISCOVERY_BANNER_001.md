# STALE-DISCOVERY-BANNER-001

Permanent UI behavior fix for KMITORA Unified Discovery.

- Clears historical Discovery error as soon as live Unified Discovery succeeds.
- Downstream authoritative staging/evidence promotion failures are shown in the Sync Authoritative Evidence panel instead of relabeling the valid discovery as `Discovery blocked`.
- Preserves the successful discovery result and row counts.
- Repeat-discovery failure protection remains unchanged for actual discovery failures.
