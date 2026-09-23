from __future__ import annotations
from typing import Any

class CausalProbabilisticEngine:
    def rank_causes(self, symptom: str, candidates: list[dict[str, Any]]) -> dict[str, Any]:
        ranked = []
        total = sum(max(0.0, float(c.get("evidence_weight", 0.0))) for c in candidates) or 1.0
        for candidate in candidates:
            probability = max(0.0, float(candidate.get("evidence_weight", 0.0))) / total
            ranked.append({**candidate, "probability": round(probability, 4)})
        ranked.sort(key=lambda item: item["probability"], reverse=True)
        return {"symptom": symptom, "root_cause_candidates": ranked, "authoritative": False, "requires_validation": True, "production_action_executed": False}
