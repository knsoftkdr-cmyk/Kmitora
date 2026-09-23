from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class JuryVerdict:
    evaluator_id: str
    decision: str
    score: float
    evidence_ids: tuple[str, ...]
    critical_blocker: bool = False


def adjudicate(
    verdicts: list[JuryVerdict],
) -> dict[str, object]:

    if not verdicts:
        return {
            "decision": "ABSTAIN",
            "score": 0.0,
            "reason": "NO_JURY_VERDICTS",
        }

    if any(
        verdict.critical_blocker
        for verdict in verdicts
    ):
        return {
            "decision": "NO_GO",
            "score": 0.0,
            "reason": "CRITICAL_BLOCKER",
        }

    supported = [
        verdict
        for verdict in verdicts
        if verdict.evidence_ids
    ]

    if not supported:
        return {
            "decision": "ABSTAIN",
            "score": 0.0,
            "reason": "NO_EVIDENCE_BACKED_VERDICTS",
        }

    score = round(
        sum(
            verdict.score
            for verdict in supported
        ) /
        len(supported),
        2,
    )

    decisions = {
        verdict.decision
        for verdict in supported
    }

    if len(decisions) == 1:
        decision = next(
            iter(decisions)
        )
        reason = (
            "INDEPENDENT_EVIDENCE_BACKED_AGREEMENT"
        )

    else:
        decision = (
            "REVIEW_REQUIRED"
        )
        reason = (
            "JURY_DISAGREEMENT"
        )

    return {
        "decision": decision,
        "score": score,
        "reason": reason,
        "evaluator_count": len(
            supported
        ),
        "evidence_count": len({
            evidence_id
            for verdict in supported
            for evidence_id in verdict.evidence_ids
        }),
    }