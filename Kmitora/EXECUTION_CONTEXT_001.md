# KMITORA EXECUTION_CONTEXT_001

Permanent restart-safe execution-context hardening for the DEV migration lifecycle.

## Problem fixed
A successful DEV dry run could remain visible in browser storage after A000 restarted, while A000 lost the in-memory dry-run execution. A later DEV replace-load could succeed at the target but post-load registration then failed with:

`Authoritative dry-run, discovery and approval evidence are required`

This created a split-brain state: the browser believed the dry run existed, while the orchestrator could not verify it.

## Permanent behavior
- DEV dry-run executions are persisted under the A000 runtime state directory.
- POST_LOAD_COMPLETED executions are persisted as authoritative server evidence.
- Discovery, approval and execution prerequisites are rehydrated through authoritative durable getters.
- The post-load endpoint reports exactly which prerequisite is missing.
- Test, Reconcile and Evidence use durable execution/discovery/approval lookup rather than process memory only.
- Read-only execution retrieval endpoints allow the frontend to rehydrate the latest execution for the active migration.
- Migrate, Test, Validate and Reconcile no longer authorize lifecycle progress from browser execution cache alone.
- Production and cutover authority remain disabled.

## One-time transition
Executions produced before this patch were not persisted by A000. After installing this patch, run the DEV dry run once more. It performs no source or target writes. Then run DEV Replace-Load once. From that point onward the execution chain survives A000/browser restarts.
