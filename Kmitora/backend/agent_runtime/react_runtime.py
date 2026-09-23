from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from .base_runtime import (
    BaseRuntime,
    RuntimeRequest,
    RuntimeResult,
    RuntimeStatus,
)
from .knowledge_contracts import (
    InMemoryKnowledgeProvider,
    KnowledgeProvider,
    RetrievalQuery,
)
from .runtime_context import RuntimeContext
from .tool_contracts import (
    GovernedToolGateway,
    ToolObservation,
    ToolRequest,
)


@dataclass(frozen=True, slots=True)
class ReactDecision:
    """
    One bounded ReAct decision.

    action:
      FINAL    -> stop and return answer
      RETRIEVE -> retrieve scoped knowledge
      TOOL     -> execute one governed tool
      BLOCK    -> stop safely

    No hidden reasoning text is required or stored.
    """

    action: str
    rationale: str = ""
    query: str = ""
    tool_id: str = ""
    tool_arguments: dict[str, Any] | None = None
    final: dict[str, Any] | None = None


Reasoner = Callable[
    [
        RuntimeContext,
        RuntimeRequest,
        tuple[dict[str, Any], ...],
    ],
    ReactDecision,
]


class ReactAnalysisRuntime(BaseRuntime):
    runtime_pattern = "REACT_ANALYSIS_RUNTIME"

    def __init__(
        self,
        *,
        provider: KnowledgeProvider | None = None,
        tool_gateway: GovernedToolGateway | None = None,
        reasoner: Reasoner | None = None,
        max_steps: int = 6,
    ) -> None:

        self.provider = (
            provider
            if provider is not None
            else InMemoryKnowledgeProvider()
        )

        self.tool_gateway = (
            tool_gateway
            if tool_gateway is not None
            else GovernedToolGateway()
        )

        self.reasoner = (
            reasoner
            if reasoner is not None
            else self._default_reasoner
        )

        self.max_steps = max(
            min(int(max_steps), 20),
            1,
        )

    @staticmethod
    def _default_reasoner(
        context: RuntimeContext,
        request: RuntimeRequest,
        observations: tuple[dict[str, Any], ...],
    ) -> ReactDecision:
        """
        Deterministic safe fallback.

        It does not invent an answer.
        First retrieve evidence.
        Then return only observed/retrieved information.
        """

        if not observations:
            return ReactDecision(
                action="RETRIEVE",
                rationale=(
                    "Ground the objective before analysis."
                ),
                query=request.objective,
            )

        return ReactDecision(
            action="FINAL",
            rationale=(
                "Return only grounded observations."
            ),
            final={
                "objective": request.objective,
                "grounded_observations": list(
                    observations
                ),
            },
        )

    @staticmethod
    def _knowledge_namespaces(
        context: RuntimeContext,
        request: RuntimeRequest,
    ) -> tuple[str, ...]:

        values: list[str] = []

        configured = request.payload.get(
            "knowledge_namespaces",
            (),
        )

        if isinstance(configured, str):
            configured = (configured,)

        if isinstance(
            configured,
            (list, tuple, set),
        ):
            for item in configured:
                value = str(item).strip()

                if value and value not in values:
                    values.append(value)

        if (
            context.knowledge_namespace
            and context.knowledge_namespace not in values
        ):
            values.append(
                context.knowledge_namespace
            )

        return tuple(values)

    def _retrieve(
        self,
        *,
        context: RuntimeContext,
        request: RuntimeRequest,
        query_text: str,
    ) -> dict[str, Any]:

        query = RetrievalQuery(
            text=query_text,
            namespaces=self._knowledge_namespaces(
                context,
                request,
            ),
            agent_id=context.agent_id,
            family_id=context.family_id,
            limit=6,
        )

        hits = self.provider.retrieve(query)

        return {
            "kind": "KNOWLEDGE_OBSERVATION",
            "query": query_text,
            "items": [
                {
                    "knowledge_id": hit.item.knowledge_id,
                    "text": hit.item.text,
                    "namespace": hit.item.namespace,
                    "source_id": hit.item.source_id,
                    "evidence_id": hit.item.evidence_id,
                    "authority": hit.item.authority,
                    "retrieval_score": hit.score,
                    "matched_terms": list(
                        hit.matched_terms
                    ),
                }
                for hit in hits
            ],
            "grounded": bool(hits),
        }

    @staticmethod
    def _tool_observation_to_dict(
        observation: ToolObservation,
    ) -> dict[str, Any]:

        return {
            "kind": "TOOL_OBSERVATION",
            "tool_id": observation.tool_id,
            "status": observation.status,
            "output": observation.output,
            "evidence": list(
                observation.evidence
            ),
            "source_write_executed":
                observation.source_write_executed,
            "target_write_executed":
                observation.target_write_executed,
            "production_action_executed":
                observation.production_action_executed,
            "message": observation.message,
        }

    def execute(
        self,
        context: RuntimeContext,
        request: RuntimeRequest,
    ) -> RuntimeResult:

        observations: list[dict[str, Any]] = []
        evidence: list[dict[str, Any]] = []
        risks: list[dict[str, Any]] = []

        source_write_executed = False
        target_write_executed = False
        production_action_executed = False

        final_output: dict[str, Any] | None = None
        final_message = ""

        for step_number in range(
            1,
            self.max_steps + 1,
        ):

            decision = self.reasoner(
                context,
                request,
                tuple(observations),
            )

            action = decision.action.strip().upper()

            trace_item = {
                "kind": "REACT_STEP",
                "step": step_number,
                "action": action,
                "rationale": decision.rationale,
            }

            evidence.append(trace_item)

            if action == "RETRIEVE":

                query_text = (
                    decision.query.strip()
                    or request.objective
                )

                observation = self._retrieve(
                    context=context,
                    request=request,
                    query_text=query_text,
                )

                observations.append(
                    observation
                )

                for item in observation["items"]:
                    evidence.append(
                        {
                            "kind": "KNOWLEDGE_RETRIEVAL",
                            "knowledge_id":
                                item["knowledge_id"],
                            "source_id":
                                item["source_id"],
                            "evidence_id":
                                item["evidence_id"],
                            "step": step_number,
                        }
                    )

                continue

            if action == "TOOL":

                tool_id = decision.tool_id.strip()

                if not tool_id:
                    risks.append(
                        {
                            "kind": "INVALID_TOOL_DECISION",
                            "step": step_number,
                            "message": (
                                "Reasoner requested TOOL "
                                "without a tool_id."
                            ),
                        }
                    )

                    final_message = (
                        "ReAct execution blocked by invalid tool decision."
                    )

                    break

                tool_request = ToolRequest(
                    tool_id=tool_id,
                    arguments=(
                        dict(
                            decision.tool_arguments
                            or {}
                        )
                    ),
                    state_change_requested=(
                        request.state_change_requested
                    ),
                )

                tool_observation = (
                    self.tool_gateway.execute(
                        tool_request=tool_request,
                        allowed_tools=context.allowed_tools,
                        environment=context.environment,
                    )
                )

                observation_dict = (
                    self._tool_observation_to_dict(
                        tool_observation
                    )
                )

                observations.append(
                    observation_dict
                )

                evidence.extend(
                    list(tool_observation.evidence)
                )

                source_write_executed = (
                    source_write_executed
                    or tool_observation.source_write_executed
                )

                target_write_executed = (
                    target_write_executed
                    or tool_observation.target_write_executed
                )

                production_action_executed = (
                    production_action_executed
                    or tool_observation.production_action_executed
                )

                if tool_observation.status == "BLOCKED":
                    risks.append(
                        {
                            "kind": "TOOL_EXECUTION_BLOCKED",
                            "tool_id": tool_id,
                            "step": step_number,
                            "message":
                                tool_observation.message,
                        }
                    )

                continue

            if action == "FINAL":

                final_output = dict(
                    decision.final
                    or {}
                )

                final_message = (
                    "Bounded ReAct analysis completed."
                )

                break

            if action == "BLOCK":

                final_message = (
                    decision.rationale
                    or "ReAct analysis blocked."
                )

                risks.append(
                    {
                        "kind": "REACT_BLOCK",
                        "step": step_number,
                        "message": final_message,
                    }
                )

                break

            risks.append(
                {
                    "kind": "UNKNOWN_REACT_ACTION",
                    "step": step_number,
                    "action": action,
                }
            )

            final_message = (
                "ReAct execution stopped because "
                "the action was unsupported."
            )

            break

        if final_output is not None:
            return RuntimeResult(
                runtime_pattern=self.runtime_pattern,
                status=RuntimeStatus.COMPLETED,
                output={
                    "agent_id": context.agent_id,
                    "family_id": context.family_id,
                    "objective": request.objective,
                    "result": final_output,
                    "steps": len(
                        [
                            item
                            for item in evidence
                            if item.get("kind")
                            == "REACT_STEP"
                        ]
                    ),
                    "grounded": any(
                        bool(
                            observation.get(
                                "grounded",
                                False,
                            )
                        )
                        for observation in observations
                        if isinstance(
                            observation,
                            dict,
                        )
                    ),
                },
                evidence=evidence,
                observations=observations,
                risks=risks,
                source_write_executed=
                    source_write_executed,
                target_write_executed=
                    target_write_executed,
                production_action_executed=
                    production_action_executed,
                message=final_message,
            )

        status = RuntimeStatus.BLOCKED

        if not observations and not risks:
            status = RuntimeStatus.INSUFFICIENT_EVIDENCE

        return RuntimeResult(
            runtime_pattern=self.runtime_pattern,
            status=status,
            output={
                "agent_id": context.agent_id,
                "family_id": context.family_id,
                "objective": request.objective,
                "steps": len(
                    [
                        item
                        for item in evidence
                        if item.get("kind")
                        == "REACT_STEP"
                    ]
                ),
                "grounded": bool(
                    observations
                ),
            },
            evidence=evidence,
            observations=observations,
            risks=risks,
            source_write_executed=
                source_write_executed,
            target_write_executed=
                target_write_executed,
            production_action_executed=
                production_action_executed,
            message=(
                final_message
                or "ReAct step budget ended without final output."
            ),
        )