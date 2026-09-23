# KMITORA A000 Lifecycle Import Fix 029A

Corrective patch for the 029 installer failure:

`ModuleNotFoundError: No module named 'a000_core'`

## Root cause

029 executed `backend/a000_core/tests/test_lifecycle_bridge_029.py` as a file. In Python, direct script execution places the test directory on `sys.path`, not necessarily the backend package root. Therefore `from a000_core...` could fail even though `backend/a000_core` was correctly installed.

The failure happened after `F1033_server.py` had already been patched, so the user's repository can be in a safe partial state: 029 runtime projection installed, deterministic post-install test failed.

## 029A fix

- adds an explicit backend-root bootstrap to the deterministic test;
- runs qualification as module `python -m a000_core.tests.test_lifecycle_bridge_029` from `backend`;
- repairs the extracted 029 installer/verifier for reproducible future reruns;
- requires exactly one existing 029 runtime marker and creates no duplicate runtime block;
- performs compile + deterministic 13-stage qualification;
- does not change execution authority or production-write controls.

No new lifecycle engine is introduced.
