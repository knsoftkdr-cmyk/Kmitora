# KMITORA A000 Lifecycle Qualification 029D

Purpose: repair only the PowerShell live qualification harness so Windows PowerShell 5.1 can parse expected HTTP 4xx JSON responses instead of terminating on `Invoke-RestMethod` WebException.

No backend runtime code is changed. The existing 029/029C lifecycle projection remains authoritative and the existing guarded Execute behavior is preserved.

029D checks:
- DETECT via `/v1/issues`
- guarded EXECUTE via `/v1/migrations` with expected `migration_gate_error` HTTP 400
- TEST via `/v1/tests`
- EVIDENCE via `/v1/evidence`
- 027 normal `/v1/a000/messages` unified runtime regression
- nested lifecycle `safety` envelope
- zero source writes, zero target writes, zero production actions, zero cutover

No backend restart is required.
