# KMITORA A000 1M UI + 13-Stage Lifecycle Integration

## UI entry point

Operations → **1M Capability Universe**

The frontend connects to the integrated A000 backend endpoints and provides:

- one-million catalog summary;
- master-serial lookup;
- KQA mapping and category display;
- safe single-scenario activation;
- bounded batch activation (maximum 10,000 per UI request);
- deterministic evidence hash;
- verified-learning decision;
- persistent scenario context across all 13 lifecycle stages.

## UI-only validation

`frontend/tests/e2e/11_a000_1m_ui_lifecycle.spec.ts` uses browser interactions
for the A000 1M flow. It does not use Playwright's APIRequestContext.

It validates:

1. 825251 → KQA-000001.
2. Safe activation returns PASS.
3. Production write, cutover, and policy bypass remain false.
4. Verified PASS outcome becomes eligible for governed promotion.
5. Selected A000 scenario remains visible from Understand through Learn.
6. 1000000 → KQA-174750 / Continuous certification.
7. UI batch activation is bounded and safe.

## Run

Start KMITORA frontend and Core/A000 first, then:

```powershell
.\run-a000-1m-ui.ps1
```

For the complete one-million backend reference run:

```powershell
.\run-a000-1m.ps1 `
  -Python "C:\Python312\python.exe" `
  -Start 1 `
  -End 1000000 `
  -ExportCatalog
```

## Safety

The 1M UI activates the reference DEV simulator only. It does not authorize
production writes, cutover, destructive operations, or policy bypass.
Production eligibility is never treated as production authorization.
