from __future__ import annotations
from collections import defaultdict
from typing import Any

class EnterpriseKnowledgeGraph:
    """In-memory foundation. Production deployments should replace persistence with an approved graph store."""
    def __init__(self) -> None:
        self.nodes: dict[str, dict[str, Any]] = {}
        self.edges: list[dict[str, Any]] = []
        self._adj: dict[str, list[str]] = defaultdict(list)

    def upsert_node(self, node_id: str, node_type: str, **properties: Any) -> dict[str, Any]:
        node = {"id": node_id, "type": node_type, **properties}
        self.nodes[node_id] = {**self.nodes.get(node_id, {}), **node}
        return self.nodes[node_id]

    def add_edge(self, source: str, relationship: str, target: str, **properties: Any) -> dict[str, Any]:
        edge = {"source": source, "relationship": relationship, "target": target, **properties}
        self.edges.append(edge)
        self._adj[source].append(target)
        return edge

    def neighbors(self, node_id: str) -> list[dict[str, Any]]:
        return [self.nodes[n] for n in self._adj.get(node_id, []) if n in self.nodes]

    def snapshot(self) -> dict[str, Any]:
        return {"node_count": len(self.nodes), "edge_count": len(self.edges), "nodes": list(self.nodes.values()), "edges": self.edges}
