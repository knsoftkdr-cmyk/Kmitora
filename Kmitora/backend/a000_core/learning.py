from __future__ import annotations
from typing import Any, Dict, List


def promotion_gate(candidate: Dict[str, Any], regression_results: List[Dict[str, Any]]) -> Dict[str, Any]:
    evidence_ok = bool(candidate.get("evidence_id"))
    validators_ok = candidate.get("validation_status") == "PASS"
    regression_ok = bool(regression_results) and all(r.get("passed") is True for r in regression_results)
    safe = not candidate.get("production_action_executed", False) and not candidate.get("cutover_executed", False)
    passed = evidence_ok and validators_ok and regression_ok and safe
    return {
        "promotion_gate":"PASS" if passed else "BLOCK",
        "evidence_ok":evidence_ok,
        "validators_ok":validators_ok,
        "regression_ok":regression_ok,
        "safety_ok":safe,
        "durable":passed,
    }
