from __future__ import annotations
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Any, Literal

EvidenceStatus = Literal["OBSERVED", "INFERRED", "PROPOSED", "VALIDATED"]
ActionPolicy = Literal["READ_ONLY", "SAFE_SIMULATION", "APPROVAL_REQUIRED", "PROHIBITED"]


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()

@dataclass
class Evidence:
    evidence_id: str
    source: str
    kind: str
    payload: dict[str, Any]
    status: EvidenceStatus = "OBSERVED"
    confidence: float = 1.0
    collected_at: str = field(default_factory=utc_now)

@dataclass
class Finding:
    finding_id: str
    category: str
    title: str
    description: str
    severity: Literal["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"]
    confidence: float
    evidence_ids: list[str] = field(default_factory=list)
    business_impact: dict[str, Any] = field(default_factory=dict)
    recommended_action: str | None = None
    action_policy: ActionPolicy = "READ_ONLY"

@dataclass
class DecisionOption:
    option_id: str
    title: str
    description: str
    risk: str
    estimated_effort: str
    expected_benefit: str
    reversible: bool
    requires_approval: bool

@dataclass
class IntelligenceResult:
    trace_id: str
    kind: str
    authoritative: bool
    production_action_executed: bool
    payload: dict[str, Any]
    generated_at: str = field(default_factory=utc_now)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
