from __future__ import annotations

import hashlib
import importlib
import sys
from pathlib import Path
from typing import Any, Iterable

from .knowledge_contracts import (
    KnowledgeItem,
    KnowledgeProvider,
    RetrievalHit,
    RetrievalQuery,
)


def _main_api_path() -> Path:
    return (
        Path(__file__)
        .resolve()
        .parents[1]
        / "main_api"
    )


def _load_knowledge_store():
    """
    Load the existing KMITORA main_api knowledge_store module.

    This adapter deliberately reuses the current verified Knowledge Store
    instead of creating a second source of truth.
    """

    main_api = _main_api_path()

    if not main_api.exists():
        raise RuntimeError(
            f"KMITORA main_api directory not found: {main_api}"
        )

    main_api_text = str(main_api)

    if main_api_text not in sys.path:
        sys.path.insert(0, main_api_text)

    return importlib.import_module("knowledge_store")


def _safe_string(value: Any) -> str:
    if value is None:
        return ""

    if isinstance(value, str):
        return value.strip()

    return str(value).strip()


def _first_nonempty(
    source: dict[str, Any],
    keys: Iterable[str],
) -> str:

    for key in keys:
        value = _safe_string(
            source.get(key)
        )

        if value:
            return value

    return ""


def _stable_id(
    prefix: str,
    value: str,
) -> str:

    digest = hashlib.sha256(
        value.encode(
            "utf-8",
            errors="replace",
        )
    ).hexdigest()[:16]

    return f"{prefix}-{digest}"


def _extract_items(
    raw: Any,
) -> list[dict[str, Any]]:
    """
    Extract governed read-only semantic evidence.

    Supported envelope collections:
    - context_items: verified learning;
    - regression_guards: active deterministic controls;
    - alternate semantic result collections.

    The outer retrieval envelope remains control metadata and is never
    converted into semantic knowledge.
    """

    if raw is None:
        return []

    if isinstance(
        raw,
        (list, tuple),
    ):
        return [
            dict(item)
            for item in raw
            if isinstance(
                item,
                dict,
            )
        ]

    if not isinstance(
        raw,
        dict,
    ):
        return []

    extracted: list[dict[str, Any]] = []

    collection_keys = (
        "context_items",
        "regression_guards",
        "items",
        "results",
        "records",
        "knowledge_items",
    )

    for key in collection_keys:

        value = raw.get(
            key
        )

        if not isinstance(
            value,
            (list, tuple),
        ):
            continue

        for item in value:

            if not isinstance(
                item,
                dict,
            ):
                continue

            candidate = dict(
                item
            )

            if key == "regression_guards":

                candidate.setdefault(
                    "knowledge_class",
                    "REGRESSION_GUARD",
                )

                candidate.setdefault(
                    "namespace",
                    "regression_guard",
                )

            extracted.append(
                candidate
            )

    if extracted:
        return extracted

    if _has_semantic_knowledge(
        raw
    ):
        return [
            dict(raw)
        ]

    return []


_SEMANTIC_KNOWLEDGE_KEYS = {
    "text",
    "content",
    "summary",
    "learning",
    "lesson",
    "description",
    "finding",
    "rule",
    "recommendation",
    "verified_outcome",
    "outcome",
    "subject",
    "condition",
    "title",
    "required_state",
    "guard_id",
    "regression_id",
}


_CONTROL_METADATA_KEYS = {
    "query",
    "retrieval_mode",
    "context_count",
    "regression_count",
    "read_only",
    "model_training_executed",
    "automatic_model_update",
    "source_write_executed",
    "target_write_executed",
    "production_action_executed",
    "cutover_executed",
    "authoritative",
    "reply_replaced",
    "status",
    "mode",
}


def _has_semantic_knowledge(
    source: dict[str, Any],
) -> bool:

    for key in _SEMANTIC_KNOWLEDGE_KEYS:

        value = source.get(key)

        if value is None:
            continue

        if isinstance(value, str):

            if value.strip():
                return True

            continue

        if isinstance(
            value,
            (int, float, bool),
        ):
            return True

        if isinstance(
            value,
            (list, tuple, dict),
        ) and value:
            return True

    return False


def _is_control_metadata_record(
    source: dict[str, Any],
) -> bool:
    """
    Reject retrieval envelopes, status objects, query echoes and
    runtime-safety telemetry as semantic knowledge.

    A control record may describe retrieval, but it is not evidence
    supporting the query itself.
    """

    if not isinstance(
        source,
        dict,
    ):
        return False

    keys = set(
        source.keys()
    )

    has_control_keys = bool(
        keys.intersection(
            _CONTROL_METADATA_KEYS
        )
    )

    has_semantic_content = (
        _has_semantic_knowledge(
            source
        )
    )

    # Strong retrieval-envelope signature.
    if (
        "query" in keys
        and "retrieval_mode" in keys
        and not has_semantic_content
    ):
        return True

    # Runtime/safety summary with no real semantic evidence.
    safety_signature = {
        "read_only",
        "source_write_executed",
        "target_write_executed",
        "production_action_executed",
    }

    if (
        len(
            keys.intersection(
                safety_signature
            )
        ) >= 3
        and not has_semantic_content
    ):
        return True

    # General control metadata record.
    if (
        has_control_keys
        and not has_semantic_content
        and "evidence_id" not in keys
        and "source_id" not in keys
    ):
        return True

    return False


def _item_text(
    source: dict[str, Any],
) -> str:

    if _is_control_metadata_record(
        source
    ):
        return ""

    preferred = _first_nonempty(
        source,
        (
            "text",
            "content",
            "summary",
            "learning",
            "lesson",
            "description",
            "message",
            "finding",
            "rule",
            "recommendation",
            "verified_outcome",
            "outcome",
        ),
    )

    if preferred:
        return preferred

    parts: list[str] = []

    for key, value in source.items():
        if key in {
            "embedding",
            "vector",
            "raw",
        }:
            continue

        if key in _CONTROL_METADATA_KEYS:
            continue

        if isinstance(
            value,
            (str, int, float, bool),
        ):
            text = _safe_string(value)

            if text:
                parts.append(
                    f"{key}: {text}"
                )

    return " | ".join(parts)


def _authority(
    source: dict[str, Any],
) -> int:

    raw = source.get(
        "authority",
        source.get(
            "authority_score",
            source.get(
                "quality_score",
                100,
            ),
        ),
    )

    try:
        value = int(
            float(raw)
        )
    except (TypeError, ValueError):
        value = 100

    return max(
        min(value, 100),
        0,
    )


def _namespace(
    source: dict[str, Any],
) -> str:

    value = _first_nonempty(
        source,
        (
            "namespace",
            "knowledge_namespace",
            "domain",
            "family_id",
            "category",
            "kind",
        ),
    )

    return value or "verified_learning"


def _tags(
    source: dict[str, Any],
) -> tuple[str, ...]:

    raw = source.get("tags", ())

    if isinstance(raw, str):
        raw = [
            item.strip()
            for item in raw.split(",")
            if item.strip()
        ]

    if not isinstance(
        raw,
        (list, tuple, set),
    ):
        return ()

    return tuple(
        str(item).strip()
        for item in raw
        if str(item).strip()
    )


def _to_knowledge_item(
    source: dict[str, Any],
    *,
    sequence: int,
) -> KnowledgeItem | None:

    text = _item_text(source)

    if not text:
        return None

    explicit_id = _first_nonempty(
        source,
        (
            "knowledge_id",
            "learning_id",
            "id",
            "record_id",
        ),
    )

    knowledge_id = (
        explicit_id
        or _stable_id(
            "KKN",
            text,
        )
    )

    source_id = _first_nonempty(
        source,
        (
            "source_id",
            "source",
            "source_ref",
            "artifact_id",
            "trace_id",
        ),
    )

    evidence_id = _first_nonempty(
        source,
        (
            "evidence_id",
            "evidence",
            "evidence_ref",
            "validation_evidence_id",
        ),
    )

    metadata = dict(source)

    metadata[
        "kmitora_adapter_sequence"
    ] = sequence

    metadata[
        "kmitora_verified_store"
    ] = True

    return KnowledgeItem(
        knowledge_id=knowledge_id,
        text=text,
        namespace=_namespace(source),
        source_id=source_id,
        evidence_id=evidence_id,
        authority=_authority(source),
        tags=_tags(source),
        metadata=metadata,
    )




_RETRIEVAL_STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "can",
    "do",
    "does",
    "for",
    "from",
    "how",
    "in",
    "is",
    "it",
    "of",
    "on",
    "or",
    "show",
    "that",
    "the",
    "to",
    "what",
    "when",
    "where",
    "which",
    "why",
    "with",
}


_FABRICATION_PATTERNS = (
    "invent",
    "fabricate",
    "fabricated",
    "falsify",
    "fake evidence",
    "make up",
    "made up",
    "never happened",
    "nonexistent evidence",
    "non-existent evidence",
)


_GENERIC_RETRIEVAL_TERMS = {
    "data",
    "evidence",
    "migration",
    "production",
    "record",
    "records",
    "system",
    "systems",
    "verified",
    "verify",
    "validation",
    "knowledge",
    "runtime",
    "target",
    "source",
    "process",
    "result",
    "results",
}


_QUERY_FRAMING_TERMS = {
    "about",
    "automatic",
    "basis",
    "does",
    "explain",
    "exists",
    "learning",
    "outcome",
    "permit",
    "prevents",
    "protection",
    "result",
    "verified",
    "what",
}


_RETRIEVAL_TOKEN_CANONICAL = {
    "actions": "action",
    "executed": "execution",
    "execute": "execution",
    "executes": "execution",
    "executing": "execution",
    "guards": "guard",
    "promoted": "promote",
    "promotes": "promote",
    "promoting": "promote",
    "promotion": "promote",
    "written": "write",
    "writes": "write",
    "writing": "write",
}


def _expanded_retrieval_tokens(
    value: str,
) -> set[str]:

    normalized = (
        str(
            value
            or ""
        )
        .lower()
        .replace(
            "-",
            " ",
        )
        .replace(
            "_",
            " ",
        )
    )

    output: set[str] = set()
    token: list[str] = []

    def flush() -> None:

        if not token:
            return

        raw = "".join(
            token
        )

        token.clear()

        if not raw:
            return

        canonical = (
            _RETRIEVAL_TOKEN_CANONICAL
            .get(
                raw,
                raw,
            )
        )

        if canonical:
            output.add(
                canonical
            )

    for char in normalized:

        if char.isalnum():
            token.append(
                char
            )
            continue

        flush()

    flush()

    return output


def _strong_query_tokens(
    tokens: set[str],
) -> set[str]:

    return {
        token
        for token in tokens
        if token not in _GENERIC_RETRIEVAL_TERMS
        and token not in _QUERY_FRAMING_TERMS
    }


def _relevance_qualified(
    *,
    query_tokens: set[str],
    matched_tokens: set[str],
) -> bool:
    """
    Deterministic retrieval relevance gate.

    Rules:
    - generic enterprise words alone cannot establish grounding;
    - normal multi-term queries require at least two meaningful matches;
    - at least 40% of meaningful query content must be represented;
    - short focused queries remain usable.
    """

    if not query_tokens:
        return False

    strong_query = _strong_query_tokens(
        query_tokens
    )

    strong_matches = _strong_query_tokens(
        matched_tokens
    )

    # Query consisting only of generic enterprise vocabulary.
    # Require multiple direct term matches.
    if not strong_query:
        return len(matched_tokens) >= 2

    if len(strong_query) == 1:
        return len(strong_matches) >= 1

    minimum_match_count = 2

    coverage = (
        len(strong_matches)
        / len(strong_query)
    )

    return (
        len(strong_matches) >= minimum_match_count
        and coverage >= 0.40
    )


def _meaningful_tokens(
    tokens: set[str],
) -> set[str]:

    return {
        token
        for token in tokens
        if token not in _RETRIEVAL_STOPWORDS
        and len(token) >= 3
    }


def _query_requires_abstention(
    query_text: str,
) -> bool:

    normalized = (
        query_text
        or ""
    ).lower()

    return any(
        pattern in normalized
        for pattern in _FABRICATION_PATTERNS
    )


def _minimum_match_count(
    query_tokens: set[str],
) -> int:

    count = len(
        query_tokens
    )

    if count <= 2:
        return 1

    return 2


class KmitoraKnowledgeStoreProvider(KnowledgeProvider):
    """
    Adapter between #4C KnowledgeProvider and the existing
    KMITORA verified-learning Knowledge Store.

    Read-only by construction.
    """

    def __init__(
        self,
        *,
        fallback_to_catalog: bool = True,
    ) -> None:

        self._store = (
            _load_knowledge_store()
        )

        self.fallback_to_catalog = (
            fallback_to_catalog
        )

    def _learning_context(
        self,
        query: RetrievalQuery,
    ) -> Any:

        getter = getattr(
            self._store,
            "get_a000_learning_context",
            None,
        )

        if not callable(getter):
            return []

        return getter(
            query.text,
            query.limit,
        )

    def _catalog(self) -> Any:

        getter = getattr(
            self._store,
            "list_knowledge",
            None,
        )

        if not callable(getter):
            return []

        return getter()

    @staticmethod
    def _tokens(
        value: str,
    ) -> set[str]:

        output: set[str] = set()
        token: list[str] = []

        for char in value.lower():
            if char.isalnum() or char in {"_", "-"}:
                token.append(char)
                continue

            if token:
                output.add(
                    "".join(token)
                )
                token = []

        if token:
            output.add(
                "".join(token)
            )

        return output

    @staticmethod
    def _scope_allowed(
        item: KnowledgeItem,
        query: RetrievalQuery,
    ) -> bool:

        if not query.namespaces:
            return True

        namespace_set = set(
            query.namespaces
        )

        if item.namespace in namespace_set:
            return True

        family_id = _safe_string(
            item.metadata.get(
                "family_id"
            )
        )

        agent_id = _safe_string(
            item.metadata.get(
                "agent_id"
            )
        )

        if (
            query.family_id
            and family_id == query.family_id
        ):
            return True

        if (
            query.agent_id
            and agent_id == query.agent_id
        ):
            return True

        return False

    def retrieve(
        self,
        query: RetrievalQuery,
    ) -> list[RetrievalHit]:

        raw = self._learning_context(
            query
        )

        items = _extract_items(raw)

        if (
            not items
            and self.fallback_to_catalog
        ):
            items = _extract_items(
                self._catalog()
            )

        normalized: list[KnowledgeItem] = []

        for sequence, source in enumerate(
            items,
            start=1,
        ):
            item = _to_knowledge_item(
                source,
                sequence=sequence,
            )

            if item is None:
                continue

            if not self._scope_allowed(
                item,
                query,
            ):
                continue

            normalized.append(item)

        if _query_requires_abstention(
            query.text
        ):
            return []

        query_tokens = _meaningful_tokens(
            _expanded_retrieval_tokens(
                query.text
            )
        )

        minimum_matches = (
            _minimum_match_count(
                query_tokens
            )
        )

        hits: list[RetrievalHit] = []

        for item in normalized:

            document_tokens = _meaningful_tokens(
                _expanded_retrieval_tokens(
                    " ".join(
                        (
                            item.text,
                            item.namespace,
                            " ".join(
                                item.tags
                            ),
                        )
                    )
                )
            )

            matched_set = (
                query_tokens.intersection(
                    document_tokens
                )
            )

            matched = tuple(
                sorted(
                    matched_set
                )
            )

            if len(matched_set) < minimum_matches:
                continue

            if not _relevance_qualified(
                query_tokens=query_tokens,
                matched_tokens=matched_set,
            ):
                continue

            lexical = float(
                len(matched)
            )

            authority_bonus = (
                item.authority
                / 1000.0
            )

            family_bonus = 0.0
            agent_bonus = 0.0

            item_family = _safe_string(
                item.metadata.get(
                    "family_id"
                )
            )

            item_agent = _safe_string(
                item.metadata.get(
                    "agent_id"
                )
            )

            if (
                query.family_id
                and item_family == query.family_id
            ):
                family_bonus = 0.20

            if (
                query.agent_id
                and item_agent == query.agent_id
            ):
                agent_bonus = 0.25

            # Upstream retrieval is useful candidate generation,
            # but it is not sufficient evidence of relevance.
            # Local relevance qualification must also pass.
            upstream_bonus = 0.25

            score = (
                upstream_bonus
                + lexical
                + authority_bonus
                + family_bonus
                + agent_bonus
            )

            hits.append(
                RetrievalHit(
                    item=item,
                    score=score,
                    matched_terms=matched,
                )
            )

        hits.sort(
            key=lambda hit: (
                -hit.score,
                -hit.item.authority,
                hit.item.knowledge_id,
            )
        )

        safe_limit = max(
            min(
                int(query.limit),
                50,
            ),
            1,
        )

        return hits[:safe_limit]


def knowledge_store_capabilities() -> dict[str, bool]:
    store = _load_knowledge_store()

    return {
        "get_a000_learning_context":
            callable(
                getattr(
                    store,
                    "get_a000_learning_context",
                    None,
                )
            ),
        "list_knowledge":
            callable(
                getattr(
                    store,
                    "list_knowledge",
                    None,
                )
            ),
        "list_regressions":
            callable(
                getattr(
                    store,
                    "list_regressions",
                    None,
                )
            ),
        "index_verified_learning":
            callable(
                getattr(
                    store,
                    "index_verified_learning",
                    None,
                )
            ),
    }