from __future__ import annotations

from dataclasses import asdict
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from .agentic_rag_runtime import (
    AgenticRagReactRuntime,
)
from .base_runtime import (
    RuntimeRequest,
)
from .knowledge_store_adapter import (
    KmitoraKnowledgeStoreProvider,
)
from .react_runtime import (
    ReactAnalysisRuntime,
)
from .runtime_context import (
    RuntimeContext,
)


SHADOW_MODE = "SHADOW_READ_ONLY"


def _utc_now() -> str:
    return datetime.now(
        timezone.utc
    ).isoformat()


def _result_to_dict(
    result: Any,
) -> dict[str, Any]:

    return {
        "runtime_pattern":
            result.runtime_pattern,
        "status":
            result.status.value,
        "output":
            result.output,
        "evidence":
            result.evidence,
        "observations":
            result.observations,
        "risks":
            result.risks,
        "source_write_executed":
            result.source_write_executed,
        "target_write_executed":
            result.target_write_executed,
        "production_action_executed":
            result.production_action_executed,
        "message":
            result.message,
    }


class A000ShadowRuntimeRouter:
    """
    A000 shadow router for #4D.

    Critical boundaries:
    - does not replace the current A000 response;
    - performs no source or target writes;
    - performs no production actions;
    - does not grant approvals;
    - retrieves from the existing verified Knowledge Store;
    - produces comparison/evidence metadata only.
    """

    mode = SHADOW_MODE

    def __init__(
        self,
        *,
        provider: KmitoraKnowledgeStoreProvider | None = None,
    ) -> None:

        self.provider = (
            provider
            if provider is not None
            else KmitoraKnowledgeStoreProvider()
        )

        self.rag_runtime = (
            AgenticRagReactRuntime(
                provider=self.provider
            )
        )

        self.react_runtime = (
            ReactAnalysisRuntime(
                provider=self.provider,
                max_steps=4,
            )
        )

    @staticmethod
    def _context(
        *,
        message: str,
        agent_id: str,
        family_id: str | None,
        environment: str,
        trace_id: str | None,
        task_id: str | None,
        knowledge_namespace: str | None,
    ) -> RuntimeContext:

        safe_environment = (
            environment.strip().upper()
            or "DEV"
        )

        return RuntimeContext(
            trace_id=(
                trace_id
                or f"SHADOW-{uuid4()}"
            ),
            task_id=(
                task_id
                or f"SHADOW-TASK-{uuid4()}"
            ),
            agent_id=agent_id,
            family_id=family_id,
            environment=safe_environment,
            knowledge_namespace=knowledge_namespace,
            capabilities=(),
            skills=(),
            allowed_tools=(),
            approval_id=None,
            evidence_ids=(),
            metadata={
                "shadow_mode": True,
                "message": message,
            },
        )

    def route(
        self,
        *,
        message: str,
        current_reply: dict[str, Any] | None = None,
        agent_id: str = "A000",
        family_id: str | None = None,
        environment: str = "DEV",
        trace_id: str | None = None,
        task_id: str | None = None,
        knowledge_namespace: str | None = None,
    ) -> dict[str, Any]:

        text = (
            message
            or ""
        ).strip()

        if not text:
            return {
                "mode": self.mode,
                "status": "SKIPPED",
                "reason": "EMPTY_MESSAGE",
                "authoritative": False,
                "reply_replaced": False,
                "source_write_executed": False,
                "target_write_executed": False,
                "production_action_executed": False,
            }

        context = self._context(
            message=text,
            agent_id=agent_id,
            family_id=family_id,
            environment=environment,
            trace_id=trace_id,
            task_id=task_id,
            knowledge_namespace=knowledge_namespace,
        )

        request = RuntimeRequest(
            objective=text,
            payload={
                "retrieval_limit": 6,
            },
            state_change_requested=False,
        )

        rag_result = (
            self.rag_runtime.run(
                context=context,
                request=request,
            )
        )

        react_result = (
            self.react_runtime.run(
                context=context,
                request=request,
            )
        )

        write_detected = any(
            (
                rag_result.source_write_executed,
                rag_result.target_write_executed,
                rag_result.production_action_executed,
                react_result.source_write_executed,
                react_result.target_write_executed,
                react_result.production_action_executed,
            )
        )

        if write_detected:
            raise RuntimeError(
                "Shadow runtime safety violation: "
                "write activity was detected."
            )

        current_reply_present = (
            isinstance(
                current_reply,
                dict,
            )
            and bool(current_reply)
        )

        return {
            "mode": self.mode,
            "timestamp": _utc_now(),
            "trace_id": context.trace_id,
            "task_id": context.task_id,
            "agent_id": context.agent_id,
            "family_id": context.family_id,
            "environment": context.environment,

            "authoritative": False,
            "reply_replaced": False,
            "current_reply_present":
                current_reply_present,

            "knowledge_store":
                "EXISTING_VERIFIED_KMITORA_STORE",

            "agentic_rag":
                _result_to_dict(
                    rag_result
                ),

            "react":
                _result_to_dict(
                    react_result
                ),

            "comparison": {
                "legacy_reply_preserved": True,
                "shadow_runtime_executed": True,
                "shadow_grounded":
                    bool(
                        rag_result.output.get(
                            "grounded",
                            False,
                        )
                    ),
                "retrieved_count":
                    int(
                        rag_result.output.get(
                            "retrieved_count",
                            0,
                        )
                    ),
            },

            "safety": {
                "read_only": True,
                "approval_granted": False,
                "source_write_executed": False,
                "target_write_executed": False,
                "production_action_executed": False,
                "cutover_executed": False,
            },
        }


def run_a000_shadow(
    *,
    message: str,
    current_reply: dict[str, Any] | None = None,
    agent_id: str = "A000",
    family_id: str | None = None,
    environment: str = "DEV",
    trace_id: str | None = None,
    task_id: str | None = None,
    knowledge_namespace: str | None = None,
) -> dict[str, Any]:

    router = A000ShadowRuntimeRouter()

    return router.route(
        message=message,
        current_reply=current_reply,
        agent_id=agent_id,
        family_id=family_id,
        environment=environment,
        trace_id=trace_id,
        task_id=task_id,
        knowledge_namespace=knowledge_namespace,
    )