from __future__ import annotations

from .contracts import (
    RiskPassport,
    ScoreBreakdown,
)


def build_risk_passport(
    *,
    change_id: str,
    tenant_id: str,
    trace_id: str,
    dependencies: list[str],
    blast_radius: list[str],
    approvals: list[str],
    rollback_requirements: list[str],
    tests: list[str],
    confidence: ScoreBreakdown,
    readiness: ScoreBreakdown,
    continuity: ScoreBreakdown,
) -> RiskPassport:

    blockers: list[str] = []

    blockers.extend(
        confidence.blockers
    )

    blockers.extend(
        readiness.blockers
    )

    blockers.extend(
        continuity.blockers
    )

    if not approvals:
        blockers.append(
            "APPROVAL_NOT_PRESENT"
        )

    if not rollback_requirements:
        blockers.append(
            "ROLLBACK_NOT_PROVEN"
        )

    if not tests:
        blockers.append(
            "TEST_EVIDENCE_NOT_PRESENT"
        )

    decision = "GO"

    if blockers:
        decision = "NO_GO"

    elif (
        confidence.normalized < 90 or
        readiness.normalized < 90 or
        continuity.normalized < 90
    ):
        decision = "CONDITIONAL_GO"

    return RiskPassport(
        change_id=change_id,
        tenant_id=tenant_id,
        trace_id=trace_id,
        dependencies=dependencies,
        blast_radius=blast_radius,
        approvals=approvals,
        rollback_requirements=rollback_requirements,
        tests=tests,
        confidence=confidence,
        readiness=readiness,
        continuity=continuity,
        decision=decision,
        blockers=sorted(
            set(blockers)
        ),
        production_authorized=False,
        cutover_authorized=False,
    )