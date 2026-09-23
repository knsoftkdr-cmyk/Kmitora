from __future__ import annotations
from itertools import permutations
from typing import Any

class OptimizationEngine:
    def sequence_by_dependencies(self, tasks: list[str], dependencies: list[tuple[str, str]]) -> dict[str, Any]:
        if len(tasks) > 9:
            return {"status": "SOLVER_ADAPTER_RECOMMENDED", "reason": "Brute-force foundation limited to <=9 tasks", "production_action_executed": False}
        def valid(order: tuple[str, ...]) -> bool:
            pos = {task: i for i, task in enumerate(order)}
            return all(pos[a] < pos[b] for a, b in dependencies if a in pos and b in pos)
        for order in permutations(tasks):
            if valid(order):
                return {"status": "SOLUTION", "sequence": list(order), "production_action_executed": False}
        return {"status": "NO_FEASIBLE_SEQUENCE", "production_action_executed": False}
