from __future__ import annotations

from dataclasses import dataclass

from .contracts import ScoreBreakdown


@dataclass(frozen=True)
class WeightedSignal:
    name: str
    value: float
    weight: float
    verified: bool = True
    critical: bool = False


def calculate_evidence_score(
    *,
    name: str,
    signals: list[WeightedSignal],
) -> ScoreBreakdown:

    if not signals:
        return ScoreBreakdown(
            name=name,
            score=0.0,
            evidence_coverage=0.0,
            deterministic_pass=False,
            blockers=[
                "NO_EVIDENCE"
            ],
        )

    total_weight = sum(
        max(
            0.0,
            signal.weight,
        )
        for signal in signals
    )

    if total_weight <= 0:
        return ScoreBreakdown(
            name=name,
            score=0.0,
            evidence_coverage=0.0,
            deterministic_pass=False,
            blockers=[
                "INVALID_WEIGHT_CONFIGURATION"
            ],
        )

    verified_weight = sum(
        signal.weight
        for signal in signals
        if signal.verified
    )

    coverage = (
        verified_weight /
        total_weight
    ) * 100.0

    weighted_score = 0.0
    blockers: list[str] = []
    reasons: list[str] = []

    for signal in signals:

        bounded_value = max(
            0.0,
            min(
                100.0,
                signal.value,
            ),
        )

        if signal.verified:
            weighted_score += (
                bounded_value *
                signal.weight
            )

        if (
            signal.critical and
            (
                not signal.verified or
                bounded_value < 100.0
            )
        ):
            blockers.append(
                f"CRITICAL_SIGNAL_FAILED:{signal.name}"
            )

        reasons.append(
            (
                f"{signal.name}="
                f"{bounded_value:.2f}"
                f";verified={signal.verified}"
                f";weight={signal.weight:.2f}"
            )
        )

    score = (
        weighted_score /
        total_weight
    )

    deterministic_pass = (
        len(blockers) == 0
    )

    return ScoreBreakdown(
        name=name,
        score=round(
            score,
            2,
        ),
        evidence_coverage=round(
            coverage,
            2,
        ),
        deterministic_pass=deterministic_pass,
        blockers=blockers,
        reasons=reasons,
    )


def confidence_with_evidence(
    *,
    evidence_coverage: float,
    validator_pass_rate: float,
    reconciliation_score: float,
    provenance_score: float,
    critical_safety_pass: bool,
) -> ScoreBreakdown:

    signals = [
        WeightedSignal(
            "evidence_coverage",
            evidence_coverage,
            0.30,
        ),
        WeightedSignal(
            "validator_pass_rate",
            validator_pass_rate,
            0.25,
            critical=True,
        ),
        WeightedSignal(
            "reconciliation",
            reconciliation_score,
            0.20,
            critical=True,
        ),
        WeightedSignal(
            "provenance",
            provenance_score,
            0.25,
            critical=True,
        ),
    ]

    result = calculate_evidence_score(
        name="CONFIDENCE_WITH_EVIDENCE",
        signals=signals,
    )

    if not critical_safety_pass:
        result.blockers.append(
            "CRITICAL_SAFETY_FAILURE"
        )
        result.deterministic_pass = False

    return result