from __future__ import annotations
from copy import deepcopy
from typing import Any, Callable

class SimulationEngine:
    def simulate(self, baseline: dict[str, Any], changes: dict[str, Any]) -> dict[str, Any]:
        result = deepcopy(baseline)
        result.update(changes)
        return {"baseline": baseline, "changes": changes, "simulated_state": result, "target_write_executed": False, "production_action_executed": False}
