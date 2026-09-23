# KMITORA A000 Lifecycle Qualification 029D1

Corrective packaging-only patch for the 029D installer self-copy condition.

## Fix

When the patch ZIP is extracted directly into the KMITORA repository root, the source qualification script and destination script are the same file. PowerShell `Copy-Item` refuses to overwrite a file with itself.

029D1 compares normalized source and target paths first. If they are the same, it safely skips the copy. If they differ but the files are identical, it also skips the copy. If they differ and content changed, the existing target is backed up before update.

No backend runtime code, lifecycle bridge, execution authority, approvals, target writes, production actions, or cutover controls are changed.
