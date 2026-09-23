from __future__ import annotations

from dataclasses import asdict
from typing import Any

from .risk import (
    build_risk_passport,
)
from .scoring import (
    ScoreBreakdown,
)


def aggregate_change_risk_passport(
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
    unresolved_exceptions:
        list[str] | None = None,
    contract_breaking_changes:
        list[str] | None = None,
    architecture_drift:
        list[str] | None = None,
) -> dict[str, Any]:

    unresolved_exceptions = (
        unresolved_exceptions or []
    )

    contract_breaking_changes = (
        contract_breaking_changes or []
    )

    architecture_drift = (
        architecture_drift or []
    )

    passport = build_risk_passport(
        change_id=change_id,
        tenant_id=tenant_id,
        trace_id=trace_id,
        dependencies=dependencies,
        blast_radius=blast_radius,
        approvals=approvals,
        rollback_requirements=(
            rollback_requirements
        ),
        tests=tests,
        confidence=confidence,
        readiness=readiness,
        continuity=continuity,
    )

    blockers = list(
        passport.blockers
    )

    if unresolved_exceptions:
        blockers.append(
            "UNRESOLVED_RECONCILIATION_EXCEPTIONS"
        )

    if contract_breaking_changes:
        blockers.append(
            "BREAKING_DATA_CONTRACT_CHANGE"
        )

    if architecture_drift:
        blockers.append(
            "UNRESOLVED_ARCHITECTURE_DRIFT"
        )

    blockers = sorted(
        set(blockers)
    )

    decision = passport.decision

    if blockers:
        decision = "NO_GO"

    result = asdict(
        passport
    )

    result.update({
        "decision":
            decision,

        "blockers":
            blockers,

        "unresolved_exceptions":
            unresolved_exceptions,

        "contract_breaking_changes":
            contract_breaking_changes,

        "architecture_drift":
            architecture_drift,

        "execution_authorized":
            False,

        "production_authorized":
            False,

        "cutover_authorized":
            False,
    })

    return result