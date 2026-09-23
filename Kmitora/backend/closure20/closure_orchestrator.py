from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .connection_persistence import registry_status
from .digital_twin import evaluate_digital_twin
from .gate_store import GateStore
from .lifecycle import stage_result
from .security_cert import run_security_adversarial_certification
from .tenant_memory import MemoryScope, TenantMemoryVault

REPO_ROOT = Path(__file__).resolve().parents[2]


class Closure20Orchestrator:
    def __init__(self) -> None:
        self.gates = GateStore()
        self.memory = TenantMemoryVault()

    def status(self) -> dict[str, Any]:
        return {
            "product": "KMITORA",
            "agent": "A000",
            "program": "CLOSURE-20",
            "connection_registry": registry_status(),
            "formal_gates": self.gates.status(),
            "production_authorized": False,
            "cutover_authorized": False,
        }

    def digital_twin(self, evidence: dict[str, Any]) -> dict[str, Any]:
        return evaluate_digital_twin(evidence)

    def lifecycle(self, stage: str, payload: dict[str, Any]) -> dict[str, Any]:
        return stage_result(stage, payload)

    def security(self) -> dict[str, Any]:
        return run_security_adversarial_certification()

    def promote_gate(self, gate: str, evidence: list[dict[str, Any]]) -> dict[str, Any]:
        return self.gates.promote(gate, evidence)

    def learn(self, scope: dict[str, str], payload: dict[str, Any], provenance: dict[str, Any], verified: bool) -> dict[str, Any]:
        s = MemoryScope(
            scope["tenant_id"], scope["workspace_id"], scope["project_id"],
            scope.get("environment", "DEV"), scope["session_id"],
        )
        memory_id = self.memory.put(s, "VERIFIED_PATTERN" if verified else "SESSION", payload, provenance, verified)
        return {"memory_id": memory_id, "verified": verified}

    def zero_touch_replay(self, payload: dict[str, Any]) -> dict[str, Any]:
        # Reuse the existing deterministic DEV E2E runner; do not duplicate migration logic.
        from backend.dev_e2e import run_dev_certification
        e2e = run_dev_certification({"scenario": payload.get("scenario") or "failure_storm"})
        counts = ((e2e.get("target") or {}).get("replace_load") or {}).get("counts") or {}
        expected_counts = {"customers": 7, "orders": 8, "order_items": 10}
        exact_counts = all(int(counts.get(k, -1)) == v for k, v in expected_counts.items())
        total = sum(int(counts.get(k, 0)) for k in expected_counts)
        reconciled = all(bool(x.get("matched")) for x in e2e.get("post_load_reconciliation") or [])
        result = {
            "status": "PASS" if exact_counts and total == 25 and reconciled else "FAIL",
            "e2e": e2e,
            "certification": {
                "expected_counts": expected_counts,
                "actual_counts": counts,
                "total_loaded": total,
                "exact_25_records": exact_counts and total == 25,
                "reconciliation": "PASS" if reconciled else "FAIL",
            },
            "production_authorized": False,
            "cutover_authorized": False,
        }
        return result
