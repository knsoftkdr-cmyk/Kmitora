from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class QualityDecision:
    accepted: bool
    score: float
    reasons: tuple[str, ...]


class QualityGate:
    """Evidence-first acceptance. It never turns uncertainty into a PASS."""

    def evaluate(self, result: dict[str, Any], thresholds: dict[str, float] | None = None) -> QualityDecision:
        thresholds = thresholds or {}
        confidence_required = float(thresholds.get("confidence", 0.80))
        confidence = float(result.get("confidence", 0.0))
        errors = list(result.get("errors") or [])
        mandatory_missing = list(result.get("mandatory_evidence_missing") or [])
        reasons: list[str] = []
        if confidence < confidence_required:
            reasons.append(f"confidence {confidence:.2f} below {confidence_required:.2f}")
        if errors:
            reasons.append("execution errors present")
        if mandatory_missing:
            reasons.append("mandatory evidence missing")
        return QualityDecision(not reasons, confidence, tuple(reasons))
