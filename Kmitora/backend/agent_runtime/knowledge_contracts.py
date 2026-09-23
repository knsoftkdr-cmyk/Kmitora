from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Iterable, Protocol


@dataclass(frozen=True, slots=True)
class KnowledgeItem:
    """
    One retrievable KMITORA knowledge unit.

    source_id and evidence_id preserve provenance.
    namespace scopes the knowledge domain.
    authority expresses source precedence without pretending
    to be probabilistic model confidence.
    """

    knowledge_id: str
    text: str

    namespace: str = "shared"
    source_id: str = ""
    evidence_id: str = ""

    authority: int = 0
    tags: tuple[str, ...] = ()

    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class RetrievalQuery:
    text: str
    namespaces: tuple[str, ...] = ()
    agent_id: str | None = None
    family_id: str | None = None
    limit: int = 6


@dataclass(frozen=True, slots=True)
class RetrievalHit:
    item: KnowledgeItem
    score: float
    matched_terms: tuple[str, ...]


class KnowledgeProvider(Protocol):
    def retrieve(
        self,
        query: RetrievalQuery,
    ) -> list[RetrievalHit]:
        ...


class InMemoryKnowledgeProvider:
    """
    Deterministic local retrieval provider used by the shared runtime
    and unit tests.

    This is intentionally model-independent.

    Future providers can implement vector, hybrid, graph, reranking,
    database, or KMITORA verified-learning retrieval using the same
    KnowledgeProvider interface.
    """

    def __init__(
        self,
        items: Iterable[KnowledgeItem] = (),
    ) -> None:
        self._items = list(items)

    @staticmethod
    def _tokens(value: str) -> set[str]:
        token = []
        output: set[str] = set()

        for char in value.lower():
            if char.isalnum() or char in {"_", "-"}:
                token.append(char)
                continue

            if token:
                output.add("".join(token))
                token = []

        if token:
            output.add("".join(token))

        return output

    @staticmethod
    def _namespace_allowed(
        item: KnowledgeItem,
        query: RetrievalQuery,
    ) -> bool:
        if not query.namespaces:
            return True

        return item.namespace in set(query.namespaces)

    def retrieve(
        self,
        query: RetrievalQuery,
    ) -> list[RetrievalHit]:

        query_tokens = self._tokens(query.text)

        scored: list[RetrievalHit] = []

        for item in self._items:

            if not self._namespace_allowed(item, query):
                continue

            document_text = " ".join(
                (
                    item.text,
                    item.namespace,
                    " ".join(item.tags),
                    str(item.metadata),
                )
            )

            document_tokens = self._tokens(document_text)

            matched = tuple(
                sorted(query_tokens.intersection(document_tokens))
            )

            lexical_score = float(len(matched))

            authority_score = max(
                min(item.authority, 100),
                0,
            ) / 1000.0

            agent_bonus = 0.0
            family_bonus = 0.0

            metadata_agent = str(
                item.metadata.get("agent_id", "")
            )

            metadata_family = str(
                item.metadata.get("family_id", "")
            )

            if (
                query.agent_id
                and metadata_agent
                and query.agent_id == metadata_agent
            ):
                agent_bonus = 0.25

            if (
                query.family_id
                and metadata_family
                and query.family_id == metadata_family
            ):
                family_bonus = 0.20

            score = (
                lexical_score
                + authority_score
                + agent_bonus
                + family_bonus
            )

            if score <= 0:
                continue

            scored.append(
                RetrievalHit(
                    item=item,
                    score=score,
                    matched_terms=matched,
                )
            )

        scored.sort(
            key=lambda hit: (
                -hit.score,
                -hit.item.authority,
                hit.item.knowledge_id,
            )
        )

        safe_limit = max(
            min(int(query.limit), 50),
            1,
        )

        return scored[:safe_limit]