from __future__ import annotations
from collections import defaultdict, deque
from typing import Dict, Iterable, List
from .models import PlanStep

class DAGPlanner:
    def order(self, steps: Iterable[PlanStep]) -> List[PlanStep]:
        items = {s.step_id: s for s in steps}
        indeg = {k: 0 for k in items}
        graph: Dict[str, List[str]] = defaultdict(list)
        for s in items.values():
            for dep in s.depends_on:
                if dep not in items:
                    raise ValueError(f"Unknown dependency: {dep}")
                graph[dep].append(s.step_id)
                indeg[s.step_id] += 1
        q = deque(sorted(k for k, v in indeg.items() if v == 0))
        out: List[PlanStep] = []
        while q:
            node = q.popleft(); out.append(items[node])
            for nxt in sorted(graph[node]):
                indeg[nxt] -= 1
                if indeg[nxt] == 0: q.append(nxt)
        if len(out) != len(items):
            raise ValueError("Cycle detected in execution DAG")
        return out
