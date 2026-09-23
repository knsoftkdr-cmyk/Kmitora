from __future__ import annotations

from typing import Any

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


class AgenticRagReactRuntime(BaseRuntime):
    """
    KMITORA governed Agentic RAG runtime.

    Responsibilities:
    - scope retrieval by agent/family/context;
    - retrieve only provider-supplied knowledge;
    - retain source/evidence provenance;
    - expose retrieval diagnostics;
    - never claim system facts that were not retrieved or observed;
    - perform no writes.
    """

    runtime_pattern = "AGENTIC_RAG_REACT_RUNTIME"

    def __init__(
        self,
        provider: KnowledgeProvider | None = None,
    ) -> None:
        self.provider = (
            provider
            if provider is not None
            else InMemoryKnowledgeProvider()
        )

    @staticmethod
    def _build_namespaces(
        context: RuntimeContext,
        request: RuntimeRequest,
    ) -> tuple[str, ...]:

        requested = request.payload.get(
            "knowledge_namespaces",
            (),
        )

        namespaces: list[str] = []

        if isinstance(requested, str):
            requested = (requested,)

        if isinstance(
            requested,
            (list, tuple, set),
        ):
            for namespace in requested:
                value = str(namespace).strip()

                if value and value not in namespaces:
                    namespaces.append(value)

        if (
            context.knowledge_namespace
            and context.knowledge_namespace not in namespaces
        ):
            namespaces.append(
                context.knowledge_namespace
            )

        return tuple(namespaces)

    @staticmethod
    def _safe_limit(
        request: RuntimeRequest,
    ) -> int:

        raw = request.payload.get(
            "retrieval_limit",
            6,
        )

        try:
            value = int(raw)
        except (TypeError, ValueError):
            value = 6

        return max(
            min(value, 20),
            1,
        )

    def execute(
        self,
        context: RuntimeContext,
        request: RuntimeRequest,
    ) -> RuntimeResult:

        namespaces = self._build_namespaces(
            context=context,
            request=request,
        )

        retrieval_query = RetrievalQuery(
            text=request.objective,
            namespaces=namespaces,
            agent_id=context.agent_id,
            family_id=context.family_id,
            limit=self._safe_limit(request),
        )

        hits = self.provider.retrieve(
            retrieval_query
        )

        retrieved_items: list[dict[str, Any]] = []
        evidence: list[dict[str, Any]] = []

        for rank, hit in enumerate(
            hits,
            start=1,
        ):
            item = hit.item

            retrieved_items.append(
                {
                    "rank": rank,
                    "knowledge_id": item.knowledge_id,
                    "namespace": item.namespace,
                    "text": item.text,
                    "retrieval_score": hit.score,
                    "matched_terms": list(
                        hit.matched_terms
                    ),
                    "authority": item.authority,
                    "source_id": item.source_id,
                    "evidence_id": item.evidence_id,
                    "tags": list(item.tags),
                }
            )

            evidence.append(
                {
                    "kind": "KNOWLEDGE_RETRIEVAL",
                    "knowledge_id": item.knowledge_id,
                    "source_id": item.source_id,
                    "evidence_id": item.evidence_id,
                    "namespace": item.namespace,
                    "rank": rank,
                }
            )

        status = RuntimeStatus.COMPLETED
        message = (
            "Scoped knowledge retrieval completed."
        )

        if not hits:
            status = RuntimeStatus.INSUFFICIENT_EVIDENCE
            message = (
                "No scoped knowledge evidence matched the objective."
            )

        return RuntimeResult(
            runtime_pattern=self.runtime_pattern,
            status=status,
            output={
                "agent_id": context.agent_id,
                "family_id": context.family_id,
                "objective": request.objective,
                "query": retrieval_query.text,
                "namespaces": list(
                    retrieval_query.namespaces
                ),
                "retrieved_count": len(hits),
                "items": retrieved_items,
                "grounded": bool(hits),
                "write_capability": "NONE",
            },
            evidence=evidence,
            observations=[],
            risks=[],
            source_write_executed=False,
            target_write_executed=False,
            production_action_executed=False,
            message=message,
        )