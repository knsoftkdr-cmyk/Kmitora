# KMITORA A000 Lifecycle Qualification 029D3

Corrective qualification-only patch for Windows PowerShell parsing.

## Problem fixed
PowerShell parses `$Stage:` inside a double-quoted string as a scoped/drive-style variable reference. The 029D live qualification contained one such string and stopped at parse time.

## Fix
Replace only the unsafe interpolation:

`$Stage:` -> `${Stage}:`

No backend code, lifecycle runtime, approvals, execution authority, target writes, production actions, or cutover behavior are changed.

The installer carries its source under `nav029d3/payload`, preventing source/target self-copy problems when the ZIP is extracted directly into the KMITORA root.
