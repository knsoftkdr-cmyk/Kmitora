from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Literal
from uuid import uuid4


Decision = Literal[
    "GO",
    "CONDITIONAL_GO",
    "NO_GO",
    "REVIEW_REQUIRED",
    "ABSTAIN",
]


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass(frozen=True)
class EvidenceReference:
    evidence_id: str
    source_type: str
    source_id: str
    verified: bool
    timestamp: str
    tenant_id: str


@dataclass
class EvidenceRecord:
    evidence_id: str = field(
        default_factory=lambda: f"EVD-{uuid4()}"
    )
    trace_id: str = ""
    task_id: str = ""
    tenant_id: str = ""
    feature_id: str = ""
    event_type: str = ""
    actor_id: str = "A000"
    input_hash: str = ""
    output_hash: str = ""
    status: str = "RECORDED"
    verified: bool = False
    authoritative: bool = False
    payload: dict[str, Any] = field(default_factory=dict)
    created_at: str = field(default_factory=utc_now)


@dataclass(frozen=True)
class AuthorityBoundary:
    environment: str = "DEV"

    source_write_authorized: bool = False
    target_write_authorized: bool = False

    production_authorized: bool = False
    cutover_authorized: bool = False

    destructive_action_authorized: bool = False
    policy_bypass_authorized: bool = False

    def assert_safe(self) -> None:
        if self.production_authorized:
            raise PermissionError(
                "Production authorization is not permitted "
                "inside Advanced Intelligence simulation runtime."
            )

        if self.cutover_authorized:
            raise PermissionError(
                "Cutover authorization is not permitted "
                "inside Advanced Intelligence simulation runtime."
            )

        if self.destructive_action_authorized:
            raise PermissionError(
                "Destructive actions are not permitted."
            )

        if self.policy_bypass_authorized:
            raise PermissionError(
                "Policy bypass is never permitted."
            )


@dataclass
class ScoreBreakdown:
    name: str
    score: float
    maximum: float = 100.0
    evidence_coverage: float = 0.0
    deterministic_pass: bool = False
    blockers: list[str] = field(default_factory=list)
    reasons: list[str] = field(default_factory=list)

    @property
    def normalized(self) -> float:
        if self.maximum <= 0:
            return 0.0

        return round(
            max(
                0.0,
                min(
                    100.0,
                    (self.score / self.maximum) * 100.0,
                ),
            ),
            2,
        )


@dataclass
class RiskPassport:
    change_id: str
    tenant_id: str
    trace_id: str

    dependencies: list[str]
    blast_radius: list[str]
    approvals: list[str]
    rollback_requirements: list[str]
    tests: list[str]

    confidence: ScoreBreakdown
    readiness: ScoreBreakdown
    continuity: ScoreBreakdown

    decision: Decision
    blockers: list[str]

    production_authorized: bool = False
    cutover_authorized: bool = False

    generated_at: str = field(
        default_factory=utc_now
    )