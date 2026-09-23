from __future__ import annotations
from collections import defaultdict, deque
from typing import Dict, List
from .model import SemanticFlow


class PlanError(RuntimeError):
    pass


def topological_order(flow: SemanticFlow) -> List[str]:
    indegree: Dict[str, int] = {op_id: 0 for op_id in flow.operations}
    graph = defaultdict(list)

    for a, b in flow.edges:
        if a not in flow.operations or b not in flow.operations:
            raise PlanError(f"Unknown edge: {a} -> {b}")
        graph[a].append(b)
        indegree[b] += 1

    q = deque(sorted(k for k, v in indegree.items() if v == 0))
    output = []

    while q:
        node = q.popleft()
        output.append(node)
        for nxt in sorted(graph[node]):
            indegree[nxt] -= 1
            if indegree[nxt] == 0:
                q.append(nxt)

    if len(output) != len(flow.operations):
        raise PlanError("Cycle detected.")
    return output

