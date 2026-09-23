from __future__ import annotations
from statistics import mean
from typing import Any

class ObservabilityEngine:
    def profile_series(self, values: list[float]) -> dict[str, Any]:
        if not values:
            return {"count": 0, "status": "NO_DATA"}
        avg = mean(values)
        max_value = max(values)
        min_value = min(values)
        return {"count": len(values), "mean": avg, "min": min_value, "max": max_value, "range": max_value - min_value, "production_action_executed": False}
