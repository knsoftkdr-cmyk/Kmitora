from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class RootCauseSignal:
    signal_id: str
    component_id: str
    signal_type: str
    strength: float
    verified: bool
    evidence_ids: tuple[str, ...]
    timestamp_order: int = 0


@dataclass
class RootCauseCandidate:
    component_id: str
    score: float
    verified_evidence_count: int
    signal_count: int
    reasons: list[str]


def investigate_root_cause(
    signals: list[RootCauseSignal],
    dependencies: dict[str, list[str]] | None = None,
) -> dict[str, Any]:

    dependencies = dependencies or {}

    candidates: dict[str, dict[str, Any]] = {}

    for signal in signals:

        if not signal.verified:
            continue

        bounded = max(
            0.0,
            min(100.0, signal.strength),
        )

        component = candidates.setdefault(
            signal.component_id,
            {
                "score": 0.0,
                "evidence": set(),
                "signals": 0,
                "reasons": [],
            },
        )

        temporal_weight = (
            1.10
            if signal.timestamp_order <= 1
            else 1.0
        )

        component["score"] += (
            bounded * temporal_weight
        )

        component["signals"] += 1

        component["evidence"].update(
            signal.evidence_ids
        )

        component["reasons"].append(
            f"{signal.signal_type}:{bounded:.2f}"
        )

    ranked: list[RootCauseCandidate] = []

    for component_id, value in candidates.items():

        dependent_count = sum(
            1
            for dependents
            in dependencies.values()
            if component_id in dependents
        )

        dependency_factor = (
            1.0 +
            min(0.25, dependent_count * 0.05)
        )

        score = min(
            100.0,
            value["score"] *
            dependency_factor /
            max(1, value["signals"]),
        )

        ranked.append(
            RootCauseCandidate(
                component_id=component_id,
                score=round(score, 2),
                verified_evidence_count=len(
                    value["evidence"]
                ),
                signal_count=value["signals"],
                reasons=value["reasons"],
            )
        )

    ranked.sort(
        key=lambda item: (
            item.score,
            item.verified_evidence_count,
        ),
        reverse=True,
    )

    decision = "ABSTAIN"

    if ranked:
        decision = "INVESTIGATED"

    return {
        "decision": decision,
        "ranked_causes": [
            {
                "component_id": item.component_id,
                "score": item.score,
                "verified_evidence_count":
                    item.verified_evidence_count,
                "signal_count": item.signal_count,
                "reasons": item.reasons,
            }
            for item in ranked
        ],
        "production_authorized": False,
        "cutover_authorized": False,
        "remediation_executed": False,
    }