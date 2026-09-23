"""Read-only A000 orchestration coordinator.

This module:
- builds governed handoffs;
- builds dependency DAGs;
- validates ordering;
- emits orchestration evidence.

This module does NOT:
- execute tools;
- approve work;
- perform source writes;
- perform target writes;
- authorize production;
- authorize cutover.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable, Mapping

from .orchestration_contracts import (
    DependencyEdge,
    DependencyEdgeType,
    HandoffContract,
)
from .orchestration_graph import (
    OrchestrationDependencyGraph,
)


@dataclass(frozen=True)
class OrchestrationPlanResult:
    """Read-only orchestration planning result."""

    handoffs: tuple[HandoffContract, ...]
    graph: OrchestrationDependencyGraph
    execution_order: tuple[str, ...]
    evidence: Mapping[str, Any]

    authoritative: bool = False
    execution_authorized: bool = False
    source_write_authorized: bool = False
    target_write_authorized: bool = False
    production_authorized: bool = False
    cutover_authorized: bool = False

    def as_dict(self) -> dict[str, Any]:
        return {
            "handoffs": [
                item.as_dict()
                for item in self.handoffs
            ],
            "graph": self.graph.as_dict(),
            "execution_order": list(
                self.execution_order
            ),
            "evidence": dict(
                self.evidence
            ),
            "authoritative": self.authoritative,
            "execution_authorized": self.execution_authorized,
            "source_write_authorized": self.source_write_authorized,
            "target_write_authorized": self.target_write_authorized,
            "production_authorized": self.production_authorized,
            "cutover_authorized": self.cutover_authorized,
        }


class A000OrchestrationCoordinator:
    """Read-only orchestration planner for A000."""

    def create_handoff(
        self,
        *,
        task_id: str,
        agent_id: str,
        trace_id: str,
        output_artifacts: Iterable[str] = (),
        tests_passed: Iterable[str] = (),
        risks: Iterable[str] = (),
        dependencies: Iterable[str] = (),
        confidence: float = 1.0,
        metadata: Mapping[str, Any] | None = None,
    ) -> HandoffContract:
        return HandoffContract(
            task_id=task_id,
            agent_id=agent_id,
            output_artifacts=tuple(
                output_artifacts
            ),
            confidence=float(confidence),
            tests_passed=tuple(
                tests_passed
            ),
            risks=tuple(
                risks
            ),
            dependencies=tuple(
                dependencies
            ),
            trace_id=trace_id,
            metadata=dict(
                metadata or {}
            ),
            authoritative=False,
            approval_granted=False,
            write_authorized=False,
            production_authorized=False,
            cutover_authorized=False,
        )

    def build_plan(
        self,
        *,
        handoffs: Iterable[HandoffContract],
        edges: Iterable[DependencyEdge],
        trace_id: str,
    ) -> OrchestrationPlanResult:

        handoff_items = tuple(
            handoffs
        )

        graph = OrchestrationDependencyGraph()

        graph.add_edges(
            tuple(edges)
        )

        execution_order = tuple(
            graph.execution_order()
        )

        evidence = {
            "trace_id": trace_id,
            "handoff_count": len(
                handoff_items
            ),
            "edge_count": len(
                graph.edges
            ),
            "cycle_detected": graph.has_cycle(),
            "execution_order_valid": True,
            "read_only": True,
            "tool_execution": False,
            "approval_granted": False,
            "source_write_executed": False,
            "target_write_executed": False,
            "production_action_executed": False,
            "cutover_executed": False,
        }

        return OrchestrationPlanResult(
            handoffs=handoff_items,
            graph=graph,
            execution_order=execution_order,
            evidence=evidence,
            authoritative=False,
            execution_authorized=False,
            source_write_authorized=False,
            target_write_authorized=False,
            production_authorized=False,
            cutover_authorized=False,
        )


def build_reference_dev_plan() -> OrchestrationPlanResult:
    """Build a bounded DEV reference orchestration chain."""

    coordinator = A000OrchestrationCoordinator()

    trace_id = "TRACE-4J2-REFERENCE"

    discovery = coordinator.create_handoff(
        task_id="TASK-DISCOVERY",
        agent_id="KAG-DISCOVERY",
        trace_id=trace_id,
        output_artifacts=(
            "discovery.json",
        ),
        tests_passed=(
            "schema",
            "read_only",
        ),
        risks=(
            "MODEL_VALIDATED pending",
        ),
        dependencies=(
            "A000",
        ),
    )

    mapping = coordinator.create_handoff(
        task_id="TASK-MAPPING",
        agent_id="KAG-MAPPING",
        trace_id=trace_id,
        output_artifacts=(
            "mapping.json",
        ),
        tests_passed=(
            "mapping_validation",
        ),
        risks=(),
        dependencies=(
            "KAG-DISCOVERY",
        ),
    )

    validation = coordinator.create_handoff(
        task_id="TASK-VALIDATION",
        agent_id="KAG-VALIDATION",
        trace_id=trace_id,
        output_artifacts=(
            "validation.json",
        ),
        tests_passed=(
            "deterministic_validation",
        ),
        risks=(),
        dependencies=(
            "KAG-MAPPING",
        ),
    )

    evidence = coordinator.create_handoff(
        task_id="TASK-EVIDENCE",
        agent_id="KAG-EVIDENCE",
        trace_id=trace_id,
        output_artifacts=(
            "evidence_manifest.json",
        ),
        tests_passed=(
            "evidence_integrity",
        ),
        risks=(),
        dependencies=(
            "KAG-VALIDATION",
        ),
    )

    edges = (
        DependencyEdge(
            source_agent_id="A000",
            target_agent_id="KAG-DISCOVERY",
            edge_type=DependencyEdgeType.REQUIRES,
            reason="A000 initiates bounded DEV discovery.",
            trace_id=trace_id,
        ),
        DependencyEdge(
            source_agent_id="KAG-DISCOVERY",
            target_agent_id="KAG-MAPPING",
            edge_type=DependencyEdgeType.PROVIDES_CONTEXT_TO,
            reason="Discovery context feeds mapping.",
            trace_id=trace_id,
        ),
        DependencyEdge(
            source_agent_id="KAG-MAPPING",
            target_agent_id="KAG-VALIDATION",
            edge_type=DependencyEdgeType.VALIDATES,
            reason="Mapping must be validated.",
            trace_id=trace_id,
        ),
        DependencyEdge(
            source_agent_id="KAG-VALIDATION",
            target_agent_id="KAG-EVIDENCE",
            edge_type=DependencyEdgeType.GENERATES_EVIDENCE_FOR,
            reason="Validation produces evidence.",
            trace_id=trace_id,
        ),
    )

    return coordinator.build_plan(
        handoffs=(
            discovery,
            mapping,
            validation,
            evidence,
        ),
        edges=edges,
        trace_id=trace_id,
    )


def build_live_shadow_orchestration(
    *,
    trace_id: str,
    task_id: str,
    agent_id: str,
    environment: str,
) -> dict[str, Any]:
    """Build non-authoritative live A000 orchestration telemetry.

    This function is observational only.

    It does not:
    - execute tools;
    - grant approval;
    - authorize writes;
    - perform production actions;
    - authorize cutover.
    """

    safe_trace_id = (
        str(trace_id).strip()
        or "TRACE-A000-UNSPECIFIED"
    )

    safe_task_id = (
        str(task_id).strip()
        or "TASK-A000-UNSPECIFIED"
    )

    safe_agent_id = (
        str(agent_id).strip()
        or "A000"
    )

    safe_environment = (
        str(environment).strip().upper()
        or "DEV"
    )

    coordinator = A000OrchestrationCoordinator()

    discovery = coordinator.create_handoff(
        task_id=f"{safe_task_id}:DISCOVERY",
        agent_id="KAG-DISCOVERY",
        trace_id=safe_trace_id,
        output_artifacts=(
            "discovery_context",
        ),
        tests_passed=(
            "read_only_boundary",
        ),
        risks=(
            "MODEL_VALIDATED pending",
        ),
        dependencies=(
            safe_agent_id,
        ),
        confidence=1.0,
        metadata={
            "environment": safe_environment,
            "phase": "DISCOVER",
        },
    )

    mapping = coordinator.create_handoff(
        task_id=f"{safe_task_id}:MAPPING",
        agent_id="KAG-MAPPING",
        trace_id=safe_trace_id,
        output_artifacts=(
            "mapping_context",
        ),
        tests_passed=(
            "handoff_schema",
        ),
        risks=(),
        dependencies=(
            "KAG-DISCOVERY",
        ),
        confidence=1.0,
        metadata={
            "environment": safe_environment,
            "phase": "MAP",
        },
    )

    validation = coordinator.create_handoff(
        task_id=f"{safe_task_id}:VALIDATION",
        agent_id="KAG-VALIDATION",
        trace_id=safe_trace_id,
        output_artifacts=(
            "validation_context",
        ),
        tests_passed=(
            "deterministic_boundary",
        ),
        risks=(),
        dependencies=(
            "KAG-MAPPING",
        ),
        confidence=1.0,
        metadata={
            "environment": safe_environment,
            "phase": "VALIDATE",
        },
    )

    evidence = coordinator.create_handoff(
        task_id=f"{safe_task_id}:EVIDENCE",
        agent_id="KAG-EVIDENCE",
        trace_id=safe_trace_id,
        output_artifacts=(
            "evidence_context",
        ),
        tests_passed=(
            "evidence_boundary",
        ),
        risks=(),
        dependencies=(
            "KAG-VALIDATION",
        ),
        confidence=1.0,
        metadata={
            "environment": safe_environment,
            "phase": "EVIDENCE",
        },
    )

    edges = (
        DependencyEdge(
            source_agent_id=safe_agent_id,
            target_agent_id="KAG-DISCOVERY",
            edge_type=DependencyEdgeType.REQUIRES,
            reason=(
                "A000 provides the bounded orchestration "
                "entry context."
            ),
            trace_id=safe_trace_id,
        ),
        DependencyEdge(
            source_agent_id="KAG-DISCOVERY",
            target_agent_id="KAG-MAPPING",
            edge_type=DependencyEdgeType.PROVIDES_CONTEXT_TO,
            reason=(
                "Discovery context is provided to mapping."
            ),
            trace_id=safe_trace_id,
        ),
        DependencyEdge(
            source_agent_id="KAG-MAPPING",
            target_agent_id="KAG-VALIDATION",
            edge_type=DependencyEdgeType.VALIDATES,
            reason=(
                "Mapping output proceeds through validation."
            ),
            trace_id=safe_trace_id,
        ),
        DependencyEdge(
            source_agent_id="KAG-VALIDATION",
            target_agent_id="KAG-EVIDENCE",
            edge_type=DependencyEdgeType.GENERATES_EVIDENCE_FOR,
            reason=(
                "Validated context contributes evidence."
            ),
            trace_id=safe_trace_id,
        ),
    )

    plan = coordinator.build_plan(
        handoffs=(
            discovery,
            mapping,
            validation,
            evidence,
        ),
        edges=edges,
        trace_id=safe_trace_id,
    )

    payload = plan.as_dict()

    payload.update(
        {
            "mode": "SHADOW_READ_ONLY",
            "integration": (
                "NON_AUTHORITATIVE_SHADOW_ORCHESTRATION_ATTACHMENT"
            ),
            "agent_id": safe_agent_id,
            "task_id": safe_task_id,
            "trace_id": safe_trace_id,
            "environment": safe_environment,
            "reply_replaced": False,
            "model_execution": False,
            "tool_execution": False,
            "approval_granted": False,
            "source_write_executed": False,
            "target_write_executed": False,
            "production_action_executed": False,
            "cutover_executed": False,
        }
    )

    return payload
