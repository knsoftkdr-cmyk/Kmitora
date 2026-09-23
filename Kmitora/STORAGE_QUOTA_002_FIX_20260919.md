# KMITORA STORAGE-QUOTA-002 Fix

## Problem
Authoritative evidence synchronization could still fail with browser localStorage quota errors because the browser projection retained per-record staging arrays.

## Fix
- Browser stores only compact discovery metadata and authoritative staging counts.
- Full staging records remain server-side under the migration ID.
- Execute UI uses authoritative summary counts when local record arrays are intentionally absent.
- DEV target write already fetches full authoritative ready records from the A000 backend at execution time.
- On quota pressure, only rebuildable derived caches are removed; source, target and business-requirement state are preserved.

## Safety
Source writes remain disabled. Production actions and cutover remain disabled. This patch does not weaken EXEC-STAGE-002 count invariants.
