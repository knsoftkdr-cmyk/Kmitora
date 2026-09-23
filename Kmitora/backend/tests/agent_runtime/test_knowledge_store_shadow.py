from __future__ import annotations

from backend.agent_runtime.knowledge_store_adapter import (
    KmitoraKnowledgeStoreProvider,
    knowledge_store_capabilities,
)
from backend.agent_runtime.a000_shadow_router import (
    A000ShadowRuntimeRouter,
)
from backend.agent_runtime.knowledge_contracts import (
    RetrievalQuery,
)


def test_store_capabilities():
    capabilities = (
        knowledge_store_capabilities()
    )

    assert capabilities[
        "get_a000_learning_context"
    ] is True

    assert capabilities[
        "list_knowledge"
    ] is True

    assert capabilities[
        "list_regressions"
    ] is True


def test_provider_is_read_only_retrieval():
    provider = (
        KmitoraKnowledgeStoreProvider()
    )

    hits = provider.retrieve(
        RetrievalQuery(
            text="migration validation evidence",
            limit=6,
        )
    )

    assert isinstance(
        hits,
        list,
    )


def test_shadow_router_never_replaces_reply():
    router = (
        A000ShadowRuntimeRouter()
    )

    legacy = {
        "reply":
            "Legacy A000 reply preserved."
    }

    result = router.route(
        message=(
            "What verified migration "
            "knowledge is available?"
        ),
        current_reply=legacy,
        environment="DEV",
    )

    assert result[
        "mode"
    ] == "SHADOW_READ_ONLY"

    assert result[
        "authoritative"
    ] is False

    assert result[
        "reply_replaced"
    ] is False

    assert result[
        "comparison"
    ][
        "legacy_reply_preserved"
    ] is True

    assert result[
        "safety"
    ][
        "target_write_executed"
    ] is False

    assert result[
        "safety"
    ][
        "production_action_executed"
    ] is False