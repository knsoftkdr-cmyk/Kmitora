# KMITORA STORAGE-QUOTA-001 Fix

## Problem
Unified Discovery successfully scoped SCN-MIG-006 to 295 rows, but the browser failed while persisting the authoritative discovery result:

`Failed to execute 'setItem' on 'Storage': Setting the value of 'kmitora.dev.discoveryResult' exceeded the quota.`

The authoritative backend discovery can contain full staged records and evidence. Persisting that entire payload in browser localStorage is unsafe and can exceed the browser quota.

## Fix
- Store only a compact discovery projection in localStorage.
- Preserve counts, mapping metadata, scope, safety state, and lightweight staging record references.
- Keep full authoritative staged records server-side under the migration ID.
- Add `GET /v1/a000/discoveries/{migration_id}` for governed retrieval of the authoritative discovery when a real DEV target write needs the complete ready-record payload.
- Migrate now fetches full ready records from the authoritative backend only at the explicit DEV replace-load action.
- On quota errors, remove stale derived discovery caches and retry compact persistence once.

## Safety
- Source remains read-only.
- Production writes remain disabled.
- Cutover remains disabled.
- No target write occurs merely from Discovery or persistence.
