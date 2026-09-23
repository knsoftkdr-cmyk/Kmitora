# KMITORA A000 Lifecycle Runtime Schema 029C

Corrective hardening for 029/029B.

- Keeps the authoritative lifecycle payload unchanged.
- Keeps safety under `payload.lifecycle_runtime.safety` (the canonical 029 schema).
- Fixes the live qualification to read the nested safety object.
- Adds the read-only lifecycle projection to recognized guarded/error lifecycle responses, including the existing `/v1/migrations` 400 gate response.
- Does not bypass migration identity, approval, execution, target-write, production, or cutover gates.
- Preserves 027/028A normal A000 message integration.
