# KMITORA A000 Autonomy-137 Framework

This package is the canonical non-duplicative implementation backbone for the 137-capability program.

## Design rules

1. A capability has one canonical ID and one owning engine family.
2. Common behavior (policy, evidence, quality, gates, orchestration) is implemented once.
3. Existing KMITORA engines are reused through lazy adapters; they are not copied.
4. A missing capability-specific implementation returns `PLANNED_NOT_CERTIFIED`, never a fabricated PASS.
5. Production and cutover authority are false by default.
6. `MODEL_VALIDATED` is an external gate and cannot be simulated into PASS.
7. All downstream formal gates are monotonic: an upstream HOLD/FAIL blocks later promotion.

## API

- `GET /v1/a000/autonomy-137/catalog`
- `GET /v1/a000/autonomy-137/status`
- `POST /v1/a000/autonomy-137/execute`

Example execute body:

```json
{
  "capability_ids": ["KCAP-023", "KCAP-025", "KCAP-027"],
  "context": {
    "tenant_id": "DEV-TENANT",
    "environment": "DEV",
    "goal": "diagnose migration failure without production writes"
  }
}
```

Use `"capability_ids": "ALL"` for a full dependency-aware readiness traversal. This does not mean every capability is certified; incomplete owners truthfully return `PLANNED_NOT_CERTIFIED`.
