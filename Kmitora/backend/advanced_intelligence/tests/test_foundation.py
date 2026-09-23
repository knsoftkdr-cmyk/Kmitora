from backend.advanced_intelligence.contracts import (
    AuthorityBoundary,
)
from backend.advanced_intelligence.digital_twin import (
    DigitalTwinGraph,
    TwinEdge,
    TwinNode,
)
from backend.advanced_intelligence.feature_registry import (
    FEATURE_REGISTRY,
    validate_registry,
)
from backend.advanced_intelligence.jury import (
    JuryVerdict,
    adjudicate,
)
from backend.advanced_intelligence.learning import (
    VerifiedLearningItem,
    VerifiedLearningVault,
)
from backend.advanced_intelligence.orchestrator import (
    AdvancedIntelligenceOrchestrator,
)
from backend.advanced_intelligence.qualification import (
    AgentQualificationInput,
    qualify_agent,
)
from backend.advanced_intelligence.scoring import (
    confidence_with_evidence,
)
from backend.advanced_intelligence.simulation import (
    CutoverStep,
    FailureInjection,
)


def main() -> None:

    validate_registry()

    assert len(
        FEATURE_REGISTRY
    ) == 36

    authority = AuthorityBoundary(
        environment="DEV"
    )

    authority.assert_safe()

    twin = DigitalTwinGraph()

    twin.add_node(
        TwinNode(
            node_id="DB1",
            node_type="DATABASE",
            name="Source DB",
            tenant_id="TENANT-A",
        )
    )

    twin.add_node(
        TwinNode(
            node_id="APP1",
            node_type="APPLICATION",
            name="Orders",
            tenant_id="TENANT-A",
        )
    )

    twin.add_node(
        TwinNode(
            node_id="API1",
            node_type="API",
            name="Orders API",
            tenant_id="TENANT-A",
        )
    )

    twin.add_edge(
        TwinEdge(
            source="APP1",
            target="DB1",
            relationship="DEPENDS_ON",
        )
    )

    twin.add_edge(
        TwinEdge(
            source="API1",
            target="APP1",
            relationship="DEPENDS_ON",
        )
    )

    assert twin.blast_radius(
        "DB1"
    ) == [
        "API1",
        "APP1",
    ]

    orchestrator = (
        AdvancedIntelligenceOrchestrator(
            tenant_id="TENANT-A",
            environment="DEV",
        )
    )

    steps = [
        CutoverStep(
            step_id="C1",
            name="Freeze writes",
            duration_minutes=5,
            critical=True,
            rollback_step="RB1",
        ),
        CutoverStep(
            step_id="C2",
            name="Final sync",
            duration_minutes=10,
            dependencies=["C1"],
            critical=True,
            rollback_step="RB2",
        ),
        CutoverStep(
            step_id="C3",
            name="Validate target",
            duration_minutes=8,
            dependencies=["C2"],
            critical=True,
        ),
    ]

    clean = orchestrator.simulate_cutover(
        steps=steps
    )

    assert clean[
        "decision"
    ] == "GO"

    assert clean[
        "production_authorized"
    ] is False

    assert clean[
        "cutover_authorized"
    ] is False

    failed = orchestrator.simulate_cutover(
        steps=steps,
        failures=[
            FailureInjection(
                step_id="C2",
                failure_type="SYNC_FAILURE",
            )
        ],
    )

    assert failed[
        "decision"
    ] == "NO_GO"

    assert "RB2" in failed[
        "rollback_required"
    ]

    confidence = (
        confidence_with_evidence(
            evidence_coverage=100,
            validator_pass_rate=100,
            reconciliation_score=100,
            provenance_score=100,
            critical_safety_pass=True,
        )
    )

    assert confidence.normalized == 100
    assert confidence.deterministic_pass is True

    qualification = qualify_agent(
        AgentQualificationInput(
            competency=96,
            safety=100,
            tool_use=95,
            domain=98,
            grounding=100,
            deterministic_validation=100,
        )
    )

    assert qualification.normalized >= 95
    assert qualification.deterministic_pass is True

    jury = adjudicate([
        JuryVerdict(
            evaluator_id="J1",
            decision="GO",
            score=98,
            evidence_ids=("E1",),
        ),
        JuryVerdict(
            evaluator_id="J2",
            decision="GO",
            score=96,
            evidence_ids=("E2",),
        ),
    ])

    assert jury[
        "decision"
    ] == "GO"

    vault = VerifiedLearningVault()

    vault.promote(
        VerifiedLearningItem(
            knowledge_id="K1",
            tenant_id="TENANT-A",
            text="Verified migration pattern",
            evidence_ids=["E1"],
            verified=True,
            regression_passed=True,
        )
    )

    assert len(
        vault.list_for_tenant(
            tenant_id="TENANT-A"
        )
    ) == 1

    assert len(
        vault.list_for_tenant(
            tenant_id="TENANT-B"
        )
    ) == 0

    print(
        "FEATURE_REGISTRY=36/36"
    )

    print(
        "CUTOVER_CLEAN_SIMULATION=PASS"
    )

    print(
        "FAILURE_INJECTION=PASS"
    )

    print(
        "ROLLBACK_TRIGGER=PASS"
    )

    print(
        "DIGITAL_TWIN_BLAST_RADIUS=PASS"
    )

    print(
        "CONFIDENCE_WITH_EVIDENCE=PASS"
    )

    print(
        "AGENT_QUALIFICATION=PASS"
    )

    print(
        "CROSS_MODEL_JURY=PASS"
    )

    print(
        "VERIFIED_LEARNING=PASS"
    )

    print(
        "TENANT_ISOLATION=PASS"
    )

    print(
        "PRODUCTION_AUTHORITY=NONE"
    )

    print(
        "CUTOVER_AUTHORITY=NONE"
    )

    print(
        "ADVANCED001_FOUNDATION_PASS"
    )


if __name__ == "__main__":
    main()