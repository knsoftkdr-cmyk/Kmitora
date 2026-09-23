"""Canonical KMITORA orchestration contracts.

This module defines data contracts only.

It does not:
- execute tools;
- grant approvals;
- perform writes;
- authorize production;
- authorize cutover.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Mapping, Sequence


class OrchestrationContractError(ValueError):
    """Raised when an orchestration contract is invalid."""


class DependencyEdgeType(str, Enum):
    """Canonical KMITORA dependency relationship types."""

    REQUIRES = "REQUIRES"
    VALIDATES = "VALIDATES"
    PROVIDES_CONTEXT_TO = "PROVIDES_CONTEXT_TO"
    BLOCKS = "BLOCKS"
    APPROVES = "APPROVES"
    EXECUTES_AFTER = "EXECUTES_AFTER"
    ROLLS_BACK = "ROLLS_BACK"
    GENERATES_EVIDENCE_FOR = "GENERATES_EVIDENCE_FOR"


@dataclass(frozen=True)
class HandoffContract:
    """Governed handoff from A000 or one agent to another runtime path."""

    task_id: str
    agent_id: str
    output_artifacts: tuple[str, ...]
    confidence: float
    tests_passed: tuple[str, ...]
    risks: tuple[str, ...]
    dependencies: tuple[str, ...]
    trace_id: str

    metadata: Mapping[str, Any] = field(
        default_factory=dict
    )

    authoritative: bool = False
    approval_granted: bool = False
    write_authorized: bool = False
    production_authorized: bool = False
    cutover_authorized: bool = False

    def __post_init__(self) -> None:
        required_strings = {
            "task_id": self.task_id,
            "agent_id": self.agent_id,
            "trace_id": self.trace_id,
        }

        for name, value in required_strings.items():
            if not isinstance(value, str) or not value.strip():
                raise OrchestrationContractError(
                    f"{name} must be a non-empty string"
                )

        if not 0.0 <= float(self.confidence) <= 1.0:
            raise OrchestrationContractError(
                "confidence must be between 0.0 and 1.0"
            )

        self._validate_string_sequence(
            "output_artifacts",
            self.output_artifacts,
        )

        self._validate_string_sequence(
            "tests_passed",
            self.tests_passed,
        )

        self._validate_string_sequence(
            "risks",
            self.risks,
        )

        self._validate_string_sequence(
            "dependencies",
            self.dependencies,
        )

        if self.production_authorized:
            raise OrchestrationContractError(
                "Production authorization cannot be granted by "
                "the handoff contract."
            )

        if self.cutover_authorized:
            raise OrchestrationContractError(
                "Cutover authorization cannot be granted by "
                "the handoff contract."
            )

    @staticmethod
    def _validate_string_sequence(
        name: str,
        values: Sequence[str],
    ) -> None:
        if isinstance(values, (str, bytes)):
            raise OrchestrationContractError(
                f"{name} must be a sequence, not a string"
            )

        for value in values:
            if not isinstance(value, str) or not value.strip():
                raise OrchestrationContractError(
                    f"{name} contains an invalid value"
                )

    def as_dict(self) -> dict[str, Any]:
        return {
            "task_id": self.task_id,
            "agent_id": self.agent_id,
            "output_artifacts": list(
                self.output_artifacts
            ),
            "confidence": self.confidence,
            "tests_passed": list(
                self.tests_passed
            ),
            "risks": list(
                self.risks
            ),
            "dependencies": list(
                self.dependencies
            ),
            "trace_id": self.trace_id,
            "metadata": dict(
                self.metadata
            ),
            "authoritative": self.authoritative,
            "approval_granted": self.approval_granted,
            "write_authorized": self.write_authorized,
            "production_authorized": self.production_authorized,
            "cutover_authorized": self.cutover_authorized,
        }


@dataclass(frozen=True)
class DependencyEdge:
    """One typed edge within the A000 dependency DAG."""

    source_agent_id: str
    target_agent_id: str
    edge_type: DependencyEdgeType
    reason: str
    trace_id: str

    evidence_ids: tuple[str, ...] = ()
    blocking: bool = False

    def __post_init__(self) -> None:
        for name, value in {
            "source_agent_id": self.source_agent_id,
            "target_agent_id": self.target_agent_id,
            "reason": self.reason,
            "trace_id": self.trace_id,
        }.items():
            if not isinstance(value, str) or not value.strip():
                raise OrchestrationContractError(
                    f"{name} must be a non-empty string"
                )

        if self.source_agent_id == self.target_agent_id:
            raise OrchestrationContractError(
                "Self-dependency edges are not allowed."
            )

        if not isinstance(
            self.edge_type,
            DependencyEdgeType,
        ):
            raise OrchestrationContractError(
                "edge_type must be DependencyEdgeType"
            )

    def as_dict(self) -> dict[str, Any]:
        return {
            "source_agent_id": self.source_agent_id,
            "target_agent_id": self.target_agent_id,
            "edge_type": self.edge_type.value,
            "reason": self.reason,
            "trace_id": self.trace_id,
            "evidence_ids": list(
                self.evidence_ids
            ),
            "blocking": self.blocking,
        }