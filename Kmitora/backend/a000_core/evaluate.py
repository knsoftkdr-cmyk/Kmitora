from __future__ import annotations
from typing import Any, Dict, Iterable, List


def calibrated_confidence(evidence_scores: Iterable[float], validator_pass_rate: float = 1.0) -> Dict[str, Any]:
    vals = [max(0.0, min(1.0, float(v))) for v in evidence_scores]
    base = sum(vals) / len(vals) if vals else 0.0
    confidence = round(base * max(0.0, min(1.0, validator_pass_rate)), 4)
    return {"confidence":confidence,"abstain":confidence < 0.70,"threshold":0.70}


def evaluate_cases(results: List[Dict[str, Any]]) -> Dict[str, Any]:
    total = len(results)
    passed = sum(1 for r in results if r.get("passed") is True)
    return {"total":total,"passed":passed,"pass_rate":round(passed/total,4) if total else 0.0,"release_gate":"PASS" if total and passed == total else "BLOCK"}
