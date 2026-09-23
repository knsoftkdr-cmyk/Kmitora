# KMITORA Mega Enterprise Backend E2E Report

- Scenario: `KMITORA-MEGA-E2E-001` — KMITORA Global Enterprise Transformation Mega Demo
- Total checks: **4**
- Passed: **3**
- Failed: **1**
- Pass rate: **75.0%**
- Report SHA-256: `7d4db2ed7460a6a275397dcf386e40c044a495f58937b312ed2920b52ff7cce2`

## Hard safety

- Production writes: **DENIED**
- Production cutover: **DENIED**
- Destructive actions: **DENIED**
- Policy bypass: **DENIED**

## Checks

| Phase | Check | Result | HTTP | ms |
|---|---|---:|---:|---:|
| Platform | Health | PASS | 200 | 71 |
| Platform | Capabilities | PASS | 200 | 22 |
| Platform | Environments | PASS | 200 | 1 |
| Platform | A000 status | FAIL | 200 | 1146 |
