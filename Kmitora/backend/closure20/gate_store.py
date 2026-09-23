from __future__ import annotations

import json
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
PATH = REPO_ROOT / "backend" / "main_api" / "runtime_state" / "formal_gates.json"
GATES = [
    "CODE_VALIDATED", "STATIC_VALIDATED", "BUILD_VALIDATED", "DEV_RUNTIME_VALIDATED",
    "BROWSER_VALIDATED", "DATA_VALIDATED", "SECURITY_VALIDATED", "TENANT_ISOLATION_VALIDATED",
    "DIGITAL_TWIN_VALIDATED", "MODEL_VALIDATED", "SAFETY_ADVERSARIAL_VALIDATED",
    "ORCHESTRATION_READY", "DEV_AUTONOMY_READY", "MIGRATION_READY", "PRODUCTION_ELIGIBLE",
]


class GateStore:
    def load(self) -> dict[str, dict[str, Any]]:
        if not PATH.exists():
            return {g: {"status": "FALSE" if g == "PRODUCTION_ELIGIBLE" else "HOLD", "evidence": []} for g in GATES}
        raw = json.loads(PATH.read_text(encoding="utf-8"))
        return {g: raw.get(g, {"status": "HOLD", "evidence": []}) for g in GATES}

    def _save(self, state: dict[str, Any]) -> None:
        PATH.parent.mkdir(parents=True, exist_ok=True)
        PATH.write_text(json.dumps(state, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    def promote(self, gate: str, evidence: list[dict[str, Any]]) -> dict[str, Any]:
        if gate not in GATES:
            raise ValueError("unknown gate")
        if gate == "PRODUCTION_ELIGIBLE":
            raise PermissionError("PRODUCTION_ELIGIBLE cannot be promoted by DEV Closure-20")
        if not evidence or not all(bool(item.get("verified")) for item in evidence):
            raise ValueError("verified evidence is required")
        state = self.load()
        idx = GATES.index(gate)
        blockers = [g for g in GATES[:idx] if state[g]["status"] != "PASS"]
        if blockers:
            raise RuntimeError("upstream gates not passed: " + ", ".join(blockers))
        if gate == "MODEL_VALIDATED":
            model = next((x for x in evidence if x.get("kind") == "REAL_MODEL_EXECUTION"), None)
            if not model or not model.get("provider") or not model.get("model") or not model.get("request_id") or model.get("result") != "PASS":
                raise RuntimeError("MODEL_VALIDATED requires real external model execution evidence")
        state[gate] = {"status": "PASS", "evidence": evidence}
        state["PRODUCTION_ELIGIBLE"] = {"status": "FALSE", "evidence": [], "reason": "separate production authorization required"}
        self._save(state)
        return self.status()

    def status(self) -> dict[str, Any]:
        state = self.load()
        computed: dict[str, str] = {}
        upstream = True
        for gate in GATES:
            if gate == "PRODUCTION_ELIGIBLE":
                computed[gate] = "FALSE"
                continue
            observed = state[gate]["status"]
            if not upstream:
                computed[gate] = "BLOCKED_UPSTREAM"
            else:
                computed[gate] = observed
                if observed != "PASS":
                    upstream = False
        return {"stored": state, "computed": computed, "production_authorized": False, "cutover_authorized": False}
