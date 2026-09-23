# KMITORA Playwright + API E2E Automation

## Scope

Automates the exact lifecycle:

Understand → Discover → Detect → Diagnose → Predict → Recommend → Simulate → Execute → Test → Validate → Reconcile → Evidence → Learn

It also verifies A000/Core, Source API, Target API, Control Tower, A000 Assistant, navigation, console stability, golden file-source inventory/preview and production-write safety.

## First run

Ensure these are already running:
- frontend 5173
- Core/A000 8080
- Source API 8081
- Target API 8082

From the Kmitora root:

```powershell
.
un-e2e.ps1 -InstallBrowsers
```

Subsequent runs:

```powershell
.
un-e2e.ps1
```

Headed browser:

```powershell
.
un-e2e.ps1 -Headed
```

## Optional PostgreSQL target tests

Create a dedicated DEV database and run:

`TEST_DATA\E2E_GOLDEN	arget\postgresql_setup_target.sql`

Then:

```powershell
.
un-e2e.ps1 `
  -TargetDatabase "kmitora_e2e" `
  -TargetUsername "postgres" `
  -TargetPassword "YOUR_DEV_PASSWORD"
```

Do not use production credentials.

## Accuracy policy

The suite is intended to enforce 100% pass for defined deterministic critical controls. It does not claim 100% probabilistic LLM accuracy.

## Real Source → PostgreSQL Target → Reconcile → Evidence

This high-value golden path uses the actual Source API and Target API.

It:
1. creates a real file source from `TEST_DATA\E2E_GOLDEN\source\happy`;
2. reads `customers.csv`, `orders.csv`, and `order_items.csv` through Source API previews;
3. connects to the configured PostgreSQL DEV target through Target API;
4. performs explicit governed DEV writes in FK-safe order;
5. reads the target back through Target API previews;
6. reconciles exact row counts, canonical row content, SHA-256 hashes, PK uniqueness, FK integrity, status domains, non-negative amounts, and positive quantities;
7. verifies production writes remain `0` and cutover remains `DISABLED`;
8. emits an auditable JSON evidence artifact.

Run from the Kmitora root:

```powershell
.\run-golden-path.ps1 `
  -TargetDatabase "kmitora_e2e" `
  -TargetUsername "kmitora_e2e_user" `
  -TargetPassword "YOUR_DEV_PASSWORD"
```

The runner resets only the dedicated E2E tables using `02_reset_target.sql` before the test.

Evidence is written to:

`frontend\test-results\golden-path\real-source-target-reconcile-evidence.json`

Do not point this runner at production.

## Governed Approval → Execute → Test → Validate → Reconcile → Evidence

This package adds deterministic governance automation against Core/A000.

Coverage:
- PENDING approval blocks Execute.
- REJECTED approval blocks Execute.
- APPROVED request still blocks explicit target-write execution in reference DEV dry-run mode.
- Authoritative approval cannot be decided twice.
- Evidence rejects unknown reconciliation IDs.
- APPROVED DEV dry-run completes the governed chain:
  Approval → Execute → Test → Validate → Reconcile → Evidence.
- Reconciliation requires exact simulated input/matched counts.
- Evidence requires PASS reconciliation.
- Target writes and production actions remain zero throughout the governed dry-run chain.

Run from the Kmitora root:

```powershell
.\run-governed-chain.ps1
```

Evidence is written to:

`frontend\test-results\governed-chain\approval-execute-test-validate-reconcile-evidence.json`

The reference Core/A000 `/v1/migrations` executor is intentionally a DEV `DRY_RUN`.
This suite validates governance and evidence controls; it does not authorize production or target writes.

