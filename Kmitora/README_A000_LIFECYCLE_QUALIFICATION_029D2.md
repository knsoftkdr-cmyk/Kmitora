# KMITORA A000 Lifecycle Qualification 029D2

Corrective verifier-only hardening for the 029D qualification installer marker check.

## Fix

When the patch ZIP is extracted directly into the KMITORA repository root, the source qualification script and destination script are the same file. PowerShell `Copy-Item` refuses to overwrite a file with itself.

029D2 compares normalized source and target paths first. If they are the same, it safely skips the copy. If they differ but the files are identical, it also skips the copy. If they differ and content changed, the existing target is backed up before update.

No backend runtime code, lifecycle bridge, execution authority, approvals, target writes, production actions, or cutover controls are changed.

029D2 fixes the verifier to validate the actual implemented schema access tokens (`lifecycle_runtime` and `$L.safety`) instead of requiring the nonexistent literal text `lifecycle_runtime.safety`. No backend source is changed.
