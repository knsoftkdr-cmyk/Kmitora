from __future__ import annotations

from .base_runtime import (
    BaseRuntime,
    RuntimeRequest,
    RuntimeResult,
    RuntimeStatus,
)
from .runtime_context import RuntimeContext


class GraphRiskRuntime(BaseRuntime):
    runtime_pattern = "GRAPH_RISK_RUNTIME"

    def execute(
        self,
        context: RuntimeContext,
        request: RuntimeRequest,
    ) -> RuntimeResult:
        return RuntimeResult(
            runtime_pattern=self.runtime_pattern,
            status=RuntimeStatus.CREATED,
            output={
                "agent_id": context.agent_id,
                "family_id": context.family_id,
                "objective": request.objective,
                "runtime_ready": True,
                "execution_enabled": False,
            },
            source_write_executed=False,
            target_write_executed=False,
            production_action_executed=False,
            message=(
                "Shared runtime foundation registered. "
                "Executable behavior is not enabled in this foundation step."
            ),
        )