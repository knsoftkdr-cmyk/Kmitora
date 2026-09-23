from backend.advanced_intelligence.assurance import (
    ToolObservation,
    shadow_assurance,
)
from backend.advanced_intelligence.continuity import (
    ContinuityInput,
    business_continuity_score,
)
from backend.advanced_intelligence.contract_guard import (
    compare_contracts,
)
from backend.advanced_intelligence.drift import (
    detect_architecture_drift,
)
from backend.advanced_intelligence.rca import (
    RootCauseSignal,
    investigate_root_cause,
)
from backend.advanced_intelligence.readiness import (
    MigrationReadinessInput,
    migration_readiness_score,
)
from backend.advanced_intelligence.reconciliation import (
    explain_exception,
    reconcile_entities,
)
from backend.advanced_intelligence.regulatory import (
    build_regulatory_evidence_pack,
)
from backend.advanced_intelligence.remediation import (
    RemediationProposal,
    evaluate_remediation,
)
from backend.advanced_intelligence.roi import (
    ROIInput,
    predict_roi,
)


def main() -> None:

    # ------------------------------------------------------------
    # RCA
    # ------------------------------------------------------------

    rca = investigate_root_cause(
        [
            RootCauseSignal(
                signal_id="S1",
                component_id="DB1",
                signal_type="LATENCY_SPIKE",
                strength=95,
                verified=True,
                evidence_ids=("E1",),
                timestamp_order=1,
            ),
            RootCauseSignal(
                signal_id="S2",
                component_id="APP1",
                signal_type="ERROR_RATE",
                strength=70,
                verified=True,
                evidence_ids=("E2",),
                timestamp_order=2,
            ),
        ],
        dependencies={
            "APP1": ["DB1"],
        },
    )

    assert rca["decision"] == "INVESTIGATED"
    assert (
        rca["ranked_causes"][0][
            "component_id"
        ]
        == "DB1"
    )

    # ------------------------------------------------------------
    # SELF HEALING GATE
    # ------------------------------------------------------------

    remediation = evaluate_remediation(
        RemediationProposal(
            remediation_id="R1",
            problem_id="P1",
            action_type="CONFIG_FIX",
            target="SERVICE-A",
            proposed_changes={
                "pool_size": 20,
            },
            rollback_plan=[
                "restore pool_size=10"
            ],
            evidence_ids=["E1"],
            simulation_passed=True,
            validation_passed=True,
            approval_granted=False,
        )
    )

    assert (
        remediation["state"]
        == "AWAITING_APPROVAL"
    )

    assert (
        remediation[
            "execution_authorized"
        ]
        is False
    )

    # ------------------------------------------------------------
    # MIGRATION READINESS
    # ------------------------------------------------------------

    readiness = migration_readiness_score(
        MigrationReadinessInput(
            source_quality=100,
            target_quality=100,
            mapping_coverage=100,
            rule_coverage=100,
            dependency_resolution=100,
            validation_pass_rate=100,
            reconciliation_readiness=100,
            rollback_readiness=100,
            approval_readiness=100,
        )
    )

    assert readiness.normalized == 100
    assert readiness.deterministic_pass

    # ------------------------------------------------------------
    # CONTINUITY
    # ------------------------------------------------------------

    continuity = business_continuity_score(
        ContinuityInput(
            service_availability=100,
            rollback_capability=100,
            failover_capability=100,
            data_recovery=100,
            dependency_resilience=100,
            sla_coverage=100,
            business_process_continuity=100,
        )
    )

    assert continuity.normalized == 100

    # ------------------------------------------------------------
    # ARCHITECTURE DRIFT
    # ------------------------------------------------------------

    drift = detect_architecture_drift(
        approved={
            "APP1": {
                "version": "1.0",
                "db": "DB1",
            }
        },
        actual={
            "APP1": {
                "version": "1.1",
                "db": "DB1",
            }
        },
    )

    assert drift["drift_detected"]
    assert drift["drift_count"] == 1

    # ------------------------------------------------------------
    # DATA CONTRACT
    # ------------------------------------------------------------

    contract = compare_contracts(
        approved={
            "fields": {
                "id": {
                    "type": "integer",
                    "nullable": False,
                },
                "name": {
                    "type": "string",
                    "nullable": True,
                },
            }
        },
        proposed={
            "fields": {
                "id": {
                    "type": "integer",
                    "nullable": False,
                },
                "name": {
                    "type": "integer",
                    "nullable": True,
                },
            }
        },
    )

    assert contract["compatible"] is False
    assert contract["decision"] == "BLOCK"

    # ------------------------------------------------------------
    # RECONCILIATION
    # ------------------------------------------------------------

    reconciliation = reconcile_entities(
        source={
            "customers": [
                {
                    "id": 1,
                    "name": "A",
                },
                {
                    "id": 2,
                    "name": "B",
                },
            ]
        },
        target={
            "customers": [
                {
                    "id": 1,
                    "name": "A",
                },
                {
                    "id": 2,
                    "name": "C",
                },
            ]
        },
    )

    assert reconciliation[
        "exact_match"
    ] is False

    assert reconciliation[
        "exceptions"
    ] == 1

    mismatch = (
        reconciliation[
            "entities"
        ][
            "customers"
        ][
            "mismatches"
        ][0]
    )

    explanation = explain_exception(
        mismatch
    )

    assert (
        explanation["type"]
        == "VALUE_MISMATCH"
    )

    # ------------------------------------------------------------
    # SHADOW / TOOL AGNOSTIC
    # ------------------------------------------------------------

    shadow = shadow_assurance(
        [
            ToolObservation(
                tool_name="Informatica",
                tool_family="ETL",
                run_id="RUN1",
                status="COMPLETED",
                records_read=100,
                records_written=100,
                errors=0,
                evidence_ids=("E10",),
            ),
            ToolObservation(
                tool_name="CustomETL",
                tool_family="CUSTOM",
                run_id="RUN2",
                status="COMPLETED",
                records_read=100,
                records_written=100,
                errors=0,
                evidence_ids=("E11",),
            ),
        ]
    )

    assert (
        shadow["mode"]
        == "SHADOW_READ_ONLY"
    )

    assert (
        shadow[
            "kmitora_write_executed"
        ]
        is False
    )

    # ------------------------------------------------------------
    # REGULATORY EVIDENCE
    # ------------------------------------------------------------

    pack = (
        build_regulatory_evidence_pack(
            framework="CLIENT_POLICY",
            policy_requirements=[
                "APPROVAL",
                "VALIDATION",
                "RECONCILIATION",
            ],
            evidence={
                "APPROVAL": ["E20"],
                "VALIDATION": ["E21"],
                "RECONCILIATION": ["E22"],
            },
        )
    )

    assert pack["complete"] is True

    # ------------------------------------------------------------
    # ROI
    # ------------------------------------------------------------

    roi = predict_roi(
        ROIInput(
            baseline_hours=1000,
            projected_hours=600,
            baseline_rework_cost=100000,
            projected_rework_cost=40000,
            baseline_incident_cost=50000,
            projected_incident_cost=20000,
            implementation_cost=50000,
        )
    )

    assert roi["hours_saved"] == 400
    assert roi["net_value"] == 40000
    assert roi["classification"] == "POSITIVE"

    print("RCA_ENGINE=PASS")
    print("SELF_HEALING_GATE=PASS")
    print("MIGRATION_READINESS=PASS")
    print("BUSINESS_CONTINUITY=PASS")
    print("ARCHITECTURE_DRIFT=PASS")
    print("DATA_CONTRACT_GUARDIAN=PASS")
    print("RECONCILIATION_RADAR=PASS")
    print("EXCEPTION_EXPLAINER=PASS")
    print("SHADOW_MODE=PASS")
    print("TOOL_AGNOSTIC_ASSURANCE=PASS")
    print("REGULATORY_EVIDENCE_PACK=PASS")
    print("ROI_PREDICTOR=PASS")

    print("EXECUTION_AUTHORITY=NONE")
    print("PRODUCTION_AUTHORITY=NONE")
    print("CUTOVER_AUTHORITY=NONE")
    print("ADVANCED002_PASS")


if __name__ == "__main__":
    main()