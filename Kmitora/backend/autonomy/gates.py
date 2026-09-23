from __future__ import annotations

from typing import Any


GATE_ORDER = [
    "CODE_VALIDATED", "STATIC_VALIDATED", "BUILD_VALIDATED",
    "DEV_RUNTIME_VALIDATED", "BROWSER_VALIDATED", "DATA_VALIDATED",
    "SECURITY_VALIDATED", "TENANT_ISOLATION_VALIDATED",
    "DIGITAL_TWIN_VALIDATED", "MODEL_VALIDATED",
    "SAFETY_ADVERSARIAL_VALIDATED", "ORCHESTRATION_READY",
    "DEV_AUTONOMY_READY", "MIGRATION_READY", "PRODUCTION_ELIGIBLE",
]


class FormalGateEngine:
    """Monotonic gate calculator: a downstream gate cannot pass an unmet prerequisite."""

    def compute(self, evidence: dict[str, Any], production_authorized: bool = False) -> dict[str, str]:
        result: dict[str, str] = {}
        upstream_ok = True
        for gate in GATE_ORDER:
            observed = str(evidence.get(gate, "HOLD")).upper()
            if gate == "PRODUCTION_ELIGIBLE" and not production_authorized:
                observed = "FALSE"
            if not upstream_ok:
                result[gate] = "BLOCKED_UPSTREAM"
                continue
            if observed in {"PASS", "TRUE"}:
                result[gate] = "PASS"
            elif observed == "FALSE" and gate == "PRODUCTION_ELIGIBLE":
                result[gate] = "FALSE"
                upstream_ok = False
            else:
                result[gate] = observed if observed in {"HOLD", "FAIL", "NOT_EVIDENCED", "FALSE"} else "HOLD"
                upstream_ok = False
        return result
