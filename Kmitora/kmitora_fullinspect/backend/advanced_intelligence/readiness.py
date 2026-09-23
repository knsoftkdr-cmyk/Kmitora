from __future__ import annotations

from dataclasses import dataclass

from .scoring import (
    WeightedSignal,
    calculate_evidence_score,
)


@dataclass(frozen=True)
class MigrationReadinessInput:
    source_quality: float
    target_quality: float
    mapping_coverage: float
    rule_coverage: float
    dependency_resolution: float
    validation_pass_rate: float
    reconciliation_readiness: float
    rollback_readiness: float
    approval_readiness: float


def migration_readiness_score(
    value: MigrationReadinessInput,
):

    return calculate_evidence_score(
        name="MIGRATION_READINESS",
        signals=[
            WeightedSignal(
                "source_quality",
                value.source_quality,
                0.10,
            ),
            WeightedSignal(
                "target_quality",
                value.target_quality,
                0.10,
            ),
            WeightedSignal(
                "mapping_coverage",
                value.mapping_coverage,
                0.10,
            ),
            WeightedSignal(
                "rule_coverage",
                value.rule_coverage,
                0.10,
            ),
            WeightedSignal(
                "dependency_resolution",
                value.dependency_resolution,
                0.10,
                critical=True,
            ),
            WeightedSignal(
                "validation_pass_rate",
                value.validation_pass_rate,
                0.15,
                critical=True,
            ),
            WeightedSignal(
                "reconciliation_readiness",
                value.reconciliation_readiness,
                0.15,
                critical=True,
            ),
            WeightedSignal(
                "rollback_readiness",
                value.rollback_readiness,
                0.10,
                critical=True,
            ),
            WeightedSignal(
                "approval_readiness",
                value.approval_readiness,
                0.10,
            ),
        ],
    )