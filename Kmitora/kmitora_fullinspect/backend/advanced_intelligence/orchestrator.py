from __future__ import annotations

from dataclasses import asdict
from typing import Any
from uuid import uuid4

from .contracts import (
    AuthorityBoundary,
    ScoreBreakdown,
)
from .digital_twin import DigitalTwinGraph
from .evidence import EvidenceLedger
from .feature_registry import (
    FEATURE_REGISTRY,
    get_feature,
)
from .risk import build_risk_passport
from .scoring import confidence_with_evidence
from .simulation import (
    CutoverSimulator,
    CutoverStep,
    FailureInjection,
)


class AdvancedIntelligenceOrchestrator:

    def __init__(
        self,
        *,
        tenant_id: str,
        environment: str = "DEV",
    ) -> None:

        self.tenant_id = tenant_id
        self.environment = environment

        self.authority = AuthorityBoundary(
            environment=environment
        )

        self.authority.assert_safe()

        self.evidence = EvidenceLedger()
        self.twin = DigitalTwinGraph()

    def list_capabilities(
        self,
    ) -> list[dict[str, Any]]:

        return [
            {
                "feature_id": feature_id,
                **definition,
            }
            for feature_id, definition
            in sorted(
                FEATURE_REGISTRY.items()
            )
        ]

    def simulate_cutover(
        self,
        *,
        steps: list[CutoverStep],
        failures: list[FailureInjection] | None = None,
        trace_id: str | None = None,
        task_id: str | None = None,
    ) -> dict[str, Any]:

        self.authority.assert_safe()

        trace_id = (
            trace_id or
            f"TRACE-{uuid4()}"
        )

        task_id = (
            task_id or
            f"TASK-{uuid4()}"
        )

        simulator = CutoverSimulator(
            steps
        )

        result = simulator.simulate(
            failures=failures
        )

        evidence = self.evidence.record(
            trace_id=trace_id,
            task_id=task_id,
            tenant_id=self.tenant_id,
            feature_id="KAI-005",
            event_type=(
                "CUTOVER_SIMULATION"
            ),
            input_data={
                "steps": [
                    asdict(step)
                    for step in steps
                ],
                "failures": [
                    asdict(failure)
                    for failure in (
                        failures or []
                    )
                ],
            },
            output_data=result,
            verified=True,
        )

        return {
            **result,
            "trace_id": trace_id,
            "task_id": task_id,
            "evidence_id": (
                evidence.evidence_id
            ),
        }

    def digital_twin_replay(
        self,
        *,
        changes: dict[
            str,
            dict[str, Any],
        ],
        trace_id: str | None = None,
    ) -> dict[str, Any]:

        self.authority.assert_safe()

        trace_id = (
            trace_id or
            f"TRACE-{uuid4()}"
        )

        future = self.twin.replay_state(
            changes=changes
        )

        return {
            "feature": get_feature(
                "KAI-006"
            ),
            "mode": "SIMULATION_ONLY",
            "trace_id": trace_id,
            "future_state": future,
            "production_authorized": False,
            "cutover_authorized": False,
        }

    def confidence(
        self,
        *,
        evidence_coverage: float,
        validator_pass_rate: float,
        reconciliation_score: float,
        provenance_score: float,
        critical_safety_pass: bool,
    ) -> ScoreBreakdown:

        return confidence_with_evidence(
            evidence_coverage=(
                evidence_coverage
            ),
            validator_pass_rate=(
                validator_pass_rate
            ),
            reconciliation_score=(
                reconciliation_score
            ),
            provenance_score=(
                provenance_score
            ),
            critical_safety_pass=(
                critical_safety_pass
            ),
        )

    def risk_passport(
        self,
        *,
        change_id: str,
        trace_id: str,
        dependencies: list[str],
        blast_radius: list[str],
        approvals: list[str],
        rollback_requirements: list[str],
        tests: list[str],
        confidence: ScoreBreakdown,
        readiness: ScoreBreakdown,
        continuity: ScoreBreakdown,
    ):

        self.authority.assert_safe()

        return build_risk_passport(
            change_id=change_id,
            tenant_id=self.tenant_id,
            trace_id=trace_id,
            dependencies=dependencies,
            blast_radius=blast_radius,
            approvals=approvals,
            rollback_requirements=rollback_requirements,
            tests=tests,
            confidence=confidence,
            readiness=readiness,
            continuity=continuity,
        )