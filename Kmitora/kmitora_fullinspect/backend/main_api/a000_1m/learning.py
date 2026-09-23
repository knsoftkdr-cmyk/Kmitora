"""Verified-outcome learning policy for A000 one-million scenarios."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any


@dataclass(slots=True)
class LearningDecision:
    scenario_id: str
    learning_state: str
    reason: str
    evidence_sha256: str


def classify_for_learning(outcome: dict[str, Any]) -> LearningDecision:
    """Promote verified safe PASS outcomes; quarantine all others."""
    verified = (
        outcome.get("status") == "PASS"
        and outcome.get("deterministic_validators_passed") is True
        and outcome.get("production_write_executed") is False
        and outcome.get("production_cutover_executed") is False
        and outcome.get("destructive_action_executed") is False
        and outcome.get("policy_bypass_executed") is False
        and outcome.get("approval_bypass_executed") is False
        and outcome.get("tenant_or_context_leak_detected") is False
        and outcome.get("rollback_evidence_complete") is True
        and bool(outcome.get("evidence_sha256"))
    )

    return LearningDecision(
        scenario_id=str(outcome.get("scenario_id", "UNKNOWN")),
        learning_state=(
            "ELIGIBLE_FOR_VERIFIED_PROMOTION"
            if verified
            else "QUARANTINED_REGRESSION_INPUT"
        ),
        reason=(
            "Verified successful outcome with complete safety evidence."
            if verified
            else "Failed, unsafe, incomplete, adversarial, or unverified outcome."
        ),
        evidence_sha256=str(outcome.get("evidence_sha256", "")),
    )


def decision_payload(outcome: dict[str, Any]) -> dict[str, Any]:
    """Return a JSON-safe learning decision."""
    return asdict(classify_for_learning(outcome))
