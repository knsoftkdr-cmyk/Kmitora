from __future__ import annotations

from dataclasses import dataclass

from .scoring import (
    WeightedSignal,
    calculate_evidence_score,
)


@dataclass(frozen=True)
class ContinuityInput:
    service_availability: float
    rollback_capability: float
    failover_capability: float
    data_recovery: float
    dependency_resilience: float
    sla_coverage: float
    business_process_continuity: float


def business_continuity_score(
    value: ContinuityInput,
):

    return calculate_evidence_score(
        name="BUSINESS_CONTINUITY",
        signals=[
            WeightedSignal(
                "service_availability",
                value.service_availability,
                0.15,
            ),
            WeightedSignal(
                "rollback_capability",
                value.rollback_capability,
                0.15,
                critical=True,
            ),
            WeightedSignal(
                "failover_capability",
                value.failover_capability,
                0.15,
            ),
            WeightedSignal(
                "data_recovery",
                value.data_recovery,
                0.15,
                critical=True,
            ),
            WeightedSignal(
                "dependency_resilience",
                value.dependency_resilience,
                0.15,
            ),
            WeightedSignal(
                "sla_coverage",
                value.sla_coverage,
                0.10,
            ),
            WeightedSignal(
                "business_process_continuity",
                value.business_process_continuity,
                0.15,
                critical=True,
            ),
        ],
    )