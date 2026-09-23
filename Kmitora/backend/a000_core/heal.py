from __future__ import annotations
from typing import Any, Dict, List


def root_cause(signals: List[Dict[str, Any]]) -> Dict[str, Any]:
    ranked = sorted(signals, key=lambda x: (-float(x.get("evidence_strength", 0)), -float(x.get("likelihood", 0))))
    return {"status":"ANALYZED","ranked_causes":ranked[:10],"grounded":bool(ranked)}


def remediation_plan(cause: Dict[str, Any], rollback_available: bool) -> Dict[str, Any]:
    writable = bool(cause.get("requires_write", False))
    return {
        "status":"PLAN_ONLY",
        "recommended_action":cause.get("recommended_action","Investigate and validate"),
        "requires_approval":writable,
        "rollback_required":writable,
        "rollback_available":rollback_available,
        "eligible_for_execution":False,
    }
