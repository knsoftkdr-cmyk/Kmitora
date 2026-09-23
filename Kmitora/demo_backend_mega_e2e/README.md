# KMITORA Mega Enterprise Backend E2E

This package is designed as the backend-first live-demo regression scenario before
the same workflow is exposed through the frontend.

## Coverage

- Platform health, capabilities, environments and A000 self-test
- Universal Domain Intelligence: catalog, inference, client context, agents, scenarios
- Deep discovery, process mining, rule mining, entity resolution, privacy and observability
- RCA, simulation, optimization and specialist-agent planning
- Digital Twin graph, blast radius, RCA and future-state simulation
- Governance negative tests for invalid/oversized/production requests
- Representative checks across all major 1M capability ranges and KQA boundaries
- Multiple safe capability batches
- Complete governed DEV dry-run migration:
  Discover → Validate → Approval → Execute → Reconcile → Evidence
- Learning classification for representative capability outcomes
- Machine-readable JSON report, Markdown report and SHA-256 fingerprint

## Important boundary

This runner demonstrates the reference runtime and encoded deterministic controls.
It does not claim universal LLM/model accuracy and does not authorize production
writes, destructive actions, cutover or policy bypass.

## Run

Keep the KMITORA backend running on port 8080, then:

```powershell
$Repo = "C:\KMITORA\KmitoraBuild_A000_1M_UI_13Stage_Full_Integrated\Kmitora"
Set-Location $Repo
.\run-mega-backend-e2e.ps1
```

Reports are written to `demo_backend_mega_e2e\output`.
