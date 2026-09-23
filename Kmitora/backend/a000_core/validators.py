from __future__ import annotations
from typing import Any, Dict, Iterable, List

class ValidatorFramework:
    def validate(self, payload: Dict[str, Any], required: Iterable[str] = ()) -> Dict[str, Any]:
        missing = [k for k in required if payload.get(k) in (None, "", [])]
        safety = {
            "source_write_executed": bool(payload.get("source_write_executed", False)),
            "target_write_executed": bool(payload.get("target_write_executed", False)),
            "production_action_executed": bool(payload.get("production_action_executed", False)),
            "cutover_executed": bool(payload.get("cutover_executed", False)),
        }
        unsafe = safety["production_action_executed"] or safety["cutover_executed"]
        return {"status":"FAIL" if missing or unsafe else "PASS","missing":missing,"safety":safety}

    def reconcile_counts(self, source_count: int, target_count: int) -> Dict[str, Any]:
        variance = target_count - source_count
        return {"status":"PASS" if variance == 0 else "REVIEW","source_count":source_count,"target_count":target_count,"variance":variance}
