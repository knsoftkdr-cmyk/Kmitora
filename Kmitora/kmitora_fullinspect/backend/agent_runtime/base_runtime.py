from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

from .runtime_context import RuntimeContext


class RuntimeStatus(str, Enum):
    CREATED = "CREATED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    BLOCKED = "BLOCKED"
    FAILED = "FAILED"
    INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"


@dataclass(slots=True)
class RuntimeRequest:
    objective: str
    payload: dict[str, Any] = field(default_factory=dict)
    state_change_requested: bool = False


@dataclass(slots=True)
class RuntimeResult:
    runtime_pattern: str
    status: RuntimeStatus

    output: dict[str, Any] = field(default_factory=dict)
    evidence: list[dict[str, Any]] = field(default_factory=list)
    observations: list[dict[str, Any]] = field(default_factory=list)
    risks: list[dict[str, Any]] = field(default_factory=list)

    source_write_executed: bool = False
    target_write_executed: bool = False
    production_action_executed: bool = False

    message: str = ""


class BaseRuntime(ABC):
    """
    Common contract for every KMITORA shared runtime.

    Canonical agent identity lives in RuntimeContext.
    Shared runtimes execute bounded behavior.
    """

    runtime_pattern: str = "BASE_RUNTIME"

    def validate_request(
        self,
        context: RuntimeContext,
        request: RuntimeRequest,
    ) -> RuntimeResult | None:

        if not context.agent_id:
            return RuntimeResult(
                runtime_pattern=self.runtime_pattern,
                status=RuntimeStatus.BLOCKED,
                message="agent_id is required",
            )

        if not context.trace_id:
            return RuntimeResult(
                runtime_pattern=self.runtime_pattern,
                status=RuntimeStatus.BLOCKED,
                message="trace_id is required",
            )

        if not context.task_id:
            return RuntimeResult(
                runtime_pattern=self.runtime_pattern,
                status=RuntimeStatus.BLOCKED,
                message="task_id is required",
            )

        if not request.objective.strip():
            return RuntimeResult(
                runtime_pattern=self.runtime_pattern,
                status=RuntimeStatus.BLOCKED,
                message="objective is required",
            )

        if (
            request.state_change_requested
            and context.is_production()
        ):
            return RuntimeResult(
                runtime_pattern=self.runtime_pattern,
                status=RuntimeStatus.BLOCKED,
                message=(
                    "Production state-changing execution is denied "
                    "by the shared runtime foundation."
                ),
                production_action_executed=False,
            )

        return None

    def run(
        self,
        context: RuntimeContext,
        request: RuntimeRequest,
    ) -> RuntimeResult:

        invalid = self.validate_request(
            context=context,
            request=request,
        )

        if invalid is not None:
            return invalid

        return self.execute(
            context=context,
            request=request,
        )

    @abstractmethod
    def execute(
        self,
        context: RuntimeContext,
        request: RuntimeRequest,
    ) -> RuntimeResult:
        raise NotImplementedError
