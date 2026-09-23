"""KMITORA dependency DAG.

Structural orchestration only.

No execution authority is implemented here.
"""

from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass, field
from typing import Iterable

from .orchestration_contracts import (
    DependencyEdge,
    DependencyEdgeType,
    OrchestrationContractError,
)


class DependencyCycleError(
    OrchestrationContractError
):
    """Raised when the dependency graph contains a cycle."""


@dataclass
class OrchestrationDependencyGraph:
    """Bounded directed dependency graph for A000 orchestration."""

    edges: list[DependencyEdge] = field(
        default_factory=list
    )

    def add_edge(
        self,
        edge: DependencyEdge,
    ) -> None:
        if edge in self.edges:
            return

        self.edges.append(edge)

        if self.has_cycle():
            self.edges.pop()

            raise DependencyCycleError(
                "Dependency edge would create "
                "an unresolvable cycle."
            )

    def add_edges(
        self,
        edges: Iterable[DependencyEdge],
    ) -> None:
        for edge in edges:
            self.add_edge(edge)

    def nodes(self) -> set[str]:
        result: set[str] = set()

        for edge in self.edges:
            result.add(
                edge.source_agent_id
            )
            result.add(
                edge.target_agent_id
            )

        return result

    def outgoing(
        self,
        agent_id: str,
        edge_type: DependencyEdgeType | None = None,
    ) -> list[DependencyEdge]:
        result = []

        for edge in self.edges:
            if edge.source_agent_id != agent_id:
                continue

            if (
                edge_type is not None
                and edge.edge_type != edge_type
            ):
                continue

            result.append(edge)

        return result

    def incoming(
        self,
        agent_id: str,
        edge_type: DependencyEdgeType | None = None,
    ) -> list[DependencyEdge]:
        result = []

        for edge in self.edges:
            if edge.target_agent_id != agent_id:
                continue

            if (
                edge_type is not None
                and edge.edge_type != edge_type
            ):
                continue

            result.append(edge)

        return result

    def has_cycle(self) -> bool:
        nodes = self.nodes()

        adjacency: dict[str, list[str]] = defaultdict(
            list
        )

        indegree: dict[str, int] = {
            node: 0
            for node in nodes
        }

        for edge in self.edges:
            adjacency[
                edge.source_agent_id
            ].append(
                edge.target_agent_id
            )

            indegree[
                edge.target_agent_id
            ] += 1

        queue = deque(
            node
            for node, degree in indegree.items()
            if degree == 0
        )

        visited = 0

        while queue:
            node = queue.popleft()
            visited += 1

            for target in adjacency[node]:
                indegree[target] -= 1

                if indegree[target] == 0:
                    queue.append(target)

        return visited != len(nodes)

    def execution_order(self) -> list[str]:
        if self.has_cycle():
            raise DependencyCycleError(
                "Cannot calculate execution order "
                "for cyclic graph."
            )

        nodes = self.nodes()

        adjacency: dict[str, list[str]] = defaultdict(
            list
        )

        indegree: dict[str, int] = {
            node: 0
            for node in nodes
        }

        for edge in self.edges:
            adjacency[
                edge.source_agent_id
            ].append(
                edge.target_agent_id
            )

            indegree[
                edge.target_agent_id
            ] += 1

        queue = deque(
            sorted(
                node
                for node, degree in indegree.items()
                if degree == 0
            )
        )

        order: list[str] = []

        while queue:
            node = queue.popleft()

            order.append(node)

            for target in sorted(
                adjacency[node]
            ):
                indegree[target] -= 1

                if indegree[target] == 0:
                    queue.append(target)

        if len(order) != len(nodes):
            raise DependencyCycleError(
                "Unresolvable dependency cycle."
            )

        return order

    def as_dict(self) -> dict:
        return {
            "nodes": sorted(
                self.nodes()
            ),
            "edges": [
                edge.as_dict()
                for edge in self.edges
            ],
            "cycle_detected": self.has_cycle(),
            "execution_order": self.execution_order(),
        }