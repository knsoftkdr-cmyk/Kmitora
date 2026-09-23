"""
KMITORA Shared Agent Runtime.

Canonical KAG identities remain separate from shared runtime engines.
"""

from .base_runtime import (
    BaseRuntime,
    RuntimeRequest,
    RuntimeResult,
    RuntimeStatus,
)
from .runtime_context import RuntimeContext
from .runtime_registry import (
    RuntimeRegistry,
    build_default_registry,
)
from .knowledge_contracts import (
    InMemoryKnowledgeProvider,
    KnowledgeItem,
    KnowledgeProvider,
    RetrievalHit,
    RetrievalQuery,
)
from .tool_contracts import (
    GovernedToolGateway,
    ToolObservation,
    ToolRequest,
)
from .agentic_rag_runtime import (
    AgenticRagReactRuntime,
)
from .react_runtime import (
    ReactAnalysisRuntime,
    ReactDecision,
)

__all__ = [
    "BaseRuntime",
    "RuntimeRequest",
    "RuntimeResult",
    "RuntimeStatus",
    "RuntimeContext",
    "RuntimeRegistry",
    "build_default_registry",
    "KnowledgeItem",
    "RetrievalQuery",
    "RetrievalHit",
    "KnowledgeProvider",
    "InMemoryKnowledgeProvider",
    "ToolRequest",
    "ToolObservation",
    "GovernedToolGateway",
    "AgenticRagReactRuntime",
    "ReactAnalysisRuntime",
    "ReactDecision",
]
# #4D - verified Knowledge Store + A000 shadow runtime
from .knowledge_store_adapter import (
    KmitoraKnowledgeStoreProvider,
    knowledge_store_capabilities,
)
from .a000_shadow_router import (
    A000ShadowRuntimeRouter,
    run_a000_shadow,
)
from .shadow_evidence import (
    ShadowEvidenceRecorder,
)