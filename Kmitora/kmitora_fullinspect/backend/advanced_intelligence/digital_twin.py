from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class TwinNode:
    node_id: str
    node_type: str
    name: str
    tenant_id: str
    attributes: dict[str, Any] = field(
        default_factory=dict
    )


@dataclass(frozen=True)
class TwinEdge:
    source: str
    target: str
    relationship: str


class DigitalTwinGraph:

    def __init__(self) -> None:
        self.nodes: dict[str, TwinNode] = {}
        self.edges: list[TwinEdge] = []

    def add_node(
        self,
        node: TwinNode,
    ) -> None:
        self.nodes[node.node_id] = node

    def add_edge(
        self,
        edge: TwinEdge,
    ) -> None:

        if edge.source not in self.nodes:
            raise KeyError(
                f"Unknown source node: {edge.source}"
            )

        if edge.target not in self.nodes:
            raise KeyError(
                f"Unknown target node: {edge.target}"
            )

        self.edges.append(
            edge
        )

    def dependencies_of(
        self,
        node_id: str,
    ) -> list[str]:

        return sorted({
            edge.target
            for edge in self.edges
            if edge.source == node_id
        })

    def dependents_of(
        self,
        node_id: str,
    ) -> list[str]:

        return sorted({
            edge.source
            for edge in self.edges
            if edge.target == node_id
        })

    def blast_radius(
        self,
        node_id: str,
    ) -> list[str]:

        visited: set[str] = set()
        queue: list[str] = [
            node_id
        ]

        while queue:

            current = queue.pop(0)

            for dependent in self.dependents_of(
                current
            ):

                if dependent in visited:
                    continue

                visited.add(
                    dependent
                )

                queue.append(
                    dependent
                )

        visited.discard(
            node_id
        )

        return sorted(
            visited
        )

    def replay_state(
        self,
        *,
        changes: dict[str, dict[str, Any]],
    ) -> dict[str, dict[str, Any]]:

        future: dict[str, dict[str, Any]] = {}

        for node_id, node in self.nodes.items():

            attributes = dict(
                node.attributes
            )

            attributes.update(
                changes.get(
                    node_id,
                    {},
                )
            )

            future[node_id] = {
                "node_type": node.node_type,
                "name": node.name,
                "tenant_id": node.tenant_id,
                "attributes": attributes,
            }

        return future