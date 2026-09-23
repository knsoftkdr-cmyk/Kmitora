from __future__ import annotations
from difflib import SequenceMatcher
from typing import Any

class EntityResolutionEngine:
    def compare(self, left: dict[str, Any], right: dict[str, Any], keys: list[str]) -> dict[str, Any]:
        scores = []
        for key in keys:
            a = str(left.get(key, "")).strip().casefold()
            b = str(right.get(key, "")).strip().casefold()
            if not a and not b:
                continue
            scores.append(SequenceMatcher(None, a, b).ratio())
        score = sum(scores) / len(scores) if scores else 0.0
        return {"match_score": round(score, 4), "match": score >= 0.9, "requires_review": 0.75 <= score < 0.9, "production_action_executed": False}
