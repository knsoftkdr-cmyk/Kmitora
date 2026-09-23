from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class RemediationProposal:
    remediation_id: str
    problem_id: str
    action_type: str
    target: str
    proposed_changes: dict[str, Any]
    rollback_plan: list[str]
    evidence_ids: list[str]

    simulation_passed: bool = False
    validation_passed: bool = False
    approval_granted: bool = False

    execution_authorized: bool = False
    production_authorized: bool = False
    cutover_authorized: bool = False


def evaluate_remediation(
    proposal: RemediationProposal,
) -> dict[str, Any]:

    blockers: list[str] = []

    if not proposal.evidence_ids:
        blockers.append(
            "EVIDENCE_REQUIRED"
        )

    if not proposal.rollback_plan:
        blockers.append(
            "ROLLBACK_REQUIRED"
        )

    if not proposal.simulation_passed:
        blockers.append(
            "SIMULATION_REQUIRED"
        )

    if not proposal.validation_passed:
        blockers.append(
            "VALIDATION_REQUIRED"
        )

    state = "NOT_READY"

    if not blockers:
        state = "AWAITING_APPROVAL"

    if (
        not blockers and
        proposal.approval_granted
    ):
        state = "APPROVED_FOR_GOVERNED_EXECUTION"

    # ADVANCED-002 never grants execution itself.
    proposal.execution_authorized = False
    proposal.production_authorized = False
    proposal.cutover_authorized = False

    return {
        "remediation_id": proposal.remediation_id,
        "state": state,
        "blockers": blockers,
        "simulation_passed":
            proposal.simulation_passed,
        "validation_passed":
            proposal.validation_passed,
        "approval_granted":
            proposal.approval_granted,
        "execution_authorized": False,
        "production_authorized": False,
        "cutover_authorized": False,
        "executed": False,
    }