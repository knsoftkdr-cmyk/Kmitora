from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Iterable


@dataclass(frozen=True)
class CapabilitySpec:
    id: str
    name: str
    layer: str
    execution_class: str
    description: str
    requires_external_runtime: bool = False

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


_NAMES = [
    "Universal Context Brain",
    "Persistent Session Context",
    "Context Compression",
    "Evidence-Grounded Answers",
    "Confidence Scoring",
    "Source-of-Truth Hierarchy",
    "A000 Deep Orchestration",
    "Specialist Agent Router",
    "Multi-Agent Debate",
    "Agent Confidence Arbitration",
    "Automatic Root-Cause Analysis",
    "Causal Graph",
    "Record-Level Traceability",
    "Time-Travel Investigation",
    "What-If Simulation",
    "Digital Twin Integration",
    "Recommendation Ranking",
    "Recommendation Deduplication",
    "Next-Best-Action Engine",
    "Autonomous Safe Fixes",
    "Approval-Aware Actions",
    "Action Preview",
    "Reversible Actions",
    "Idempotency Control",
    "Transaction Awareness",
    "Policy Engine Integration",
    "Role-Based Assistant",
    "Executive Mode",
    "Engineer Mode",
    "Auditor Mode",
    "Domain Intelligence",
    "Semantic Business Rule Engine",
    "Business Rule Conflict Detection",
    "Rule Impact Analysis",
    "Mapping Intelligence",
    "Mapping Confidence",
    "Transformation Synthesis",
    "Transformation Test Generation",
    "Data Quality Intelligence",
    "Temporal Reasoning",
    "Entity Resolution",
    "Cross-Format Intelligence",
    "Schema Evolution Detection",
    "Dependency Intelligence",
    "Referential Integrity Reasoning",
    "Reconciliation Intelligence",
    "Exception Clustering",
    "Anomaly Explanation",
    "Predictive Risk Engine",
    "Migration Readiness Model",
    "Performance Advisor",
    "Cost Advisor",
    "Token/Model Router",
    "Response Cache",
    "Incremental Analysis",
    "Event-Driven Assistant",
    "Proactive Alerts",
    "Watch Mode",
    "Streaming Progress",
    "Explain Agent Activity",
    "Natural-Language Commands",
    "Command Parser",
    "Ambiguity Detection",
    "Multi-Step Conversation Planning",
    "Goal Mode",
    "Constraints Mode",
    "Voice Interface",
    "Screenshot/UI Awareness",
    "Command Palette",
    "Suggested Questions",
    "Smart Action Cards",
    "Conversation Branching",
    "Project Workspace Memory",
    "Decision Log",
    "Knowledge Retrieval",
    "Prior-Migration Learning",
    "Feedback Learning",
    "Evaluation Framework",
    "Hallucination Guard",
    "Action Authorization Token",
    "Immutable Audit Trail",
    "Security-Aware Context",
    "PII Masking",
    "Prompt-Injection Defense",
    "Tool Permission Model",
    "Failure Recovery",
    "Circuit Breakers",
    "Health Awareness",
    "Offline/Degraded Mode",
    "Assistant Observability",
    "Conversation Evaluation",
    "Self-Critique Pass",
    "Dual-Control Critical Actions",
    "Sandbox Execution",
    "Test Data Generator",
    "Scenario Library",
    "Client Demo Mode",
    "KPI Assistant",
    "Autonomous Migration Copilot",
    "Universal KMITORA Control Interface",
]

if len(_NAMES) != 100:
    raise RuntimeError(f"Expected 100 Assistant capability areas, found {len(_NAMES)}")


def _layer(index: int) -> str:
    n = index + 1
    if n <= 6:
        return "CONTEXT_EVIDENCE"
    if n <= 10:
        return "A000_ORCHESTRATION"
    if n <= 16:
        return "DIAGNOSIS_SIMULATION"
    if n <= 25:
        return "RECOMMENDATION_ACTION"
    if n <= 30:
        return "GOVERNANCE_PERSONA"
    if n <= 50:
        return "DATA_MIGRATION_INTELLIGENCE"
    if n <= 60:
        return "EFFICIENCY_OPERATIONS"
    if n <= 71:
        return "CONVERSATION_EXPERIENCE"
    if n <= 78:
        return "MEMORY_LEARNING"
    if n <= 94:
        return "SAFETY_RELIABILITY"
    return "AUTONOMY_DEMO_CONTROL"


def _execution_class(index: int) -> str:
    n = index + 1
    if n in {20, 23, 24, 25, 80, 93, 94, 99, 100}:
        return "GOVERNED_ACTION"
    if n in {15, 16, 37, 38, 95}:
        return "SANDBOX_OR_SIMULATION"
    if n in {56, 57, 58, 59, 60, 67, 68, 76, 77}:
        return "RUNTIME_INTEGRATION"
    return "READ_ONLY_INTELLIGENCE"


def _description(name: str, index: int) -> str:
    n = index + 1
    return (
        f"KMITORA Assistant capability {n:03d}: {name}. "
        "Runs under evidence-first, least-privilege, environment-aware Assistant governance."
    )


CAPABILITIES: tuple[CapabilitySpec, ...] = tuple(
    CapabilitySpec(
        id=f"KA-{i + 1:03d}",
        name=name,
        layer=_layer(i),
        execution_class=_execution_class(i),
        description=_description(name, i),
        requires_external_runtime=(i + 1) in {7, 8, 9, 16, 53, 56, 57, 58, 59, 60, 67, 68, 75, 76, 77, 93, 94, 99, 100},
    )
    for i, name in enumerate(_NAMES)
)

CAPABILITY_BY_ID = {item.id: item for item in CAPABILITIES}
CAPABILITY_BY_NAME = {item.name.lower(): item for item in CAPABILITIES}


def catalog() -> list[dict[str, object]]:
    return [item.to_dict() for item in CAPABILITIES]


def summary() -> dict[str, object]:
    by_layer: dict[str, int] = {}
    by_execution: dict[str, int] = {}
    external = 0
    for item in CAPABILITIES:
        by_layer[item.layer] = by_layer.get(item.layer, 0) + 1
        by_execution[item.execution_class] = by_execution.get(item.execution_class, 0) + 1
        external += int(item.requires_external_runtime)
    return {
        "total": len(CAPABILITIES),
        "active": len(CAPABILITIES),
        "layers": by_layer,
        "execution_classes": by_execution,
        "external_runtime_dependent": external,
    }


def select(names_or_ids: Iterable[str]) -> list[CapabilitySpec]:
    selected: list[CapabilitySpec] = []
    seen: set[str] = set()
    for raw in names_or_ids:
        key = str(raw).strip()
        if not key:
            continue
        item = CAPABILITY_BY_ID.get(key.upper()) or CAPABILITY_BY_NAME.get(key.lower())
        if item and item.id not in seen:
            selected.append(item)
            seen.add(item.id)
    return selected
