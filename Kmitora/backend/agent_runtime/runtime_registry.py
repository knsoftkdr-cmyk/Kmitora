from __future__ import annotations

from collections.abc import Iterable

from .base_runtime import BaseRuntime
from .orchestrator_runtime import OrchestratorRuntime
from .agentic_rag_runtime import AgenticRagReactRuntime
from .react_runtime import ReactAnalysisRuntime
from .detection_runtime import DetectionValidationRuntime
from .rca_runtime import CausalRcaRuntime
from .graph_risk_runtime import GraphRiskRuntime
from .planner_runtime import PlannerRuntime
from .codeact_runtime import GovernedCodeActExecutionRuntime
from .validator_runtime import ValidatorJudgeRuntime
from .recovery_runtime import RecoveryRollbackRuntime
from .evidence_runtime import EvidenceAuditRuntime
from .learning_runtime import VerifiedLearningRuntime


class RuntimeRegistry:
    def __init__(self) -> None:
        self._runtimes: dict[str, BaseRuntime] = {}

    def register(self, runtime: BaseRuntime) -> None:
        pattern = runtime.runtime_pattern.strip()

        if not pattern:
            raise ValueError("runtime_pattern cannot be empty")

        if pattern in self._runtimes:
            raise ValueError(
                f"Runtime already registered: {pattern}"
            )

        self._runtimes[pattern] = runtime

    def register_many(
        self,
        runtimes: Iterable[BaseRuntime],
    ) -> None:
        for runtime in runtimes:
            self.register(runtime)

    def get(self, pattern: str) -> BaseRuntime:
        try:
            return self._runtimes[pattern]
        except KeyError as exc:
            raise KeyError(
                f"Unknown KMITORA runtime pattern: {pattern}"
            ) from exc

    def contains(self, pattern: str) -> bool:
        return pattern in self._runtimes

    def list_patterns(self) -> tuple[str, ...]:
        return tuple(sorted(self._runtimes.keys()))


def build_default_registry() -> RuntimeRegistry:
    registry = RuntimeRegistry()

    registry.register_many(
        (
            OrchestratorRuntime(),
            AgenticRagReactRuntime(),
            ReactAnalysisRuntime(),
            DetectionValidationRuntime(),
            CausalRcaRuntime(),
            GraphRiskRuntime(),
            PlannerRuntime(),
            GovernedCodeActExecutionRuntime(),
            ValidatorJudgeRuntime(),
            RecoveryRollbackRuntime(),
            EvidenceAuditRuntime(),
            VerifiedLearningRuntime(),
        )
    )

    return registry
