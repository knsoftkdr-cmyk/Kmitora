from __future__ import annotations

from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Any


class Authority(str, Enum):
    READ_ONLY = "READ_ONLY"
    PLAN_ONLY = "PLAN_ONLY"
    SANDBOX_ONLY = "SANDBOX_ONLY"
    GOVERNED_WRITE = "GOVERNED_WRITE"
    EVIDENCE_ONLY = "EVIDENCE_ONLY"
    VERIFIED_LEARNING = "VERIFIED_LEARNING"
    EXTERNAL_GATE = "EXTERNAL_GATE"


class CapabilityState(str, Enum):
    AVAILABLE = "AVAILABLE"
    HOLD = "HOLD"
    BLOCKED = "BLOCKED"
    NOT_EVIDENCED = "NOT_EVIDENCED"


@dataclass(frozen=True)
class CapabilitySpec:
    id: str
    number: int
    name: str
    owner: str
    category: str
    authority: Authority
    dependencies: tuple[str, ...] = ()
    mandatory_evidence: tuple[str, ...] = ()
    external_dependency: bool = False
    description: str = ""


@dataclass
class EvidenceFact:
    key: str
    value: Any
    source: str
    confidence: float = 1.0
    verified: bool = False


@dataclass
class CapabilityResult:
    capability_id: str
    status: str
    confidence: float
    authoritative: bool = False
    execution_authorized: bool = False
    production_authorized: bool = False
    cutover_authorized: bool = False
    facts: list[EvidenceFact] = field(default_factory=list)
    findings: list[dict[str, Any]] = field(default_factory=list)
    actions: list[dict[str, Any]] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["facts"] = [asdict(x) for x in self.facts]
        return payload


@dataclass
class AutonomyContext:
    tenant_id: str
    workspace_id: str = "default"
    project_id: str = "default"
    environment: str = "DEV"
    trace_id: str = ""
    goal: str = ""
    payload: dict[str, Any] = field(default_factory=dict)
    evidence: dict[str, Any] = field(default_factory=dict)
    policy: dict[str, Any] = field(default_factory=dict)

    @property
    def is_production(self) -> bool:
        return self.environment.upper() in {"PROD", "PRODUCTION", "LIVE"}
