from backend.advanced_intelligence.change_passport import (
    aggregate_change_risk_passport,
)
from backend.advanced_intelligence.document_intelligence import (
    DocumentInput,
    extract_document_controls,
)
from backend.advanced_intelligence.enterprise_intent import (
    parse_enterprise_intent,
    intent_safety_decision,
)
from backend.advanced_intelligence.enterprise_memory import (
    EnterpriseMemoryRecord,
    EnterpriseMemoryVault,
)
from backend.advanced_intelligence.enterprise_router import (
    route_enterprise_request,
)
from backend.advanced_intelligence.legacy_archaeologist import (
    analyze_legacy_logic,
)
from backend.advanced_intelligence.prompt_migration import (
    build_prompt_to_migration_plan,
)
from backend.advanced_intelligence.qualification import (
    AgentQualificationInput,
)
from backend.advanced_intelligence.qualified_specialist import (
    generate_qualified_specialist,
)
from backend.advanced_intelligence.scoring import (
    ScoreBreakdown,
)


def main() -> None:

    # ------------------------------------------------------------
    # Natural-language control
    # ------------------------------------------------------------

    intent = parse_enterprise_intent(
        "Migrate CUSTOMERDB to TARGETDB "
        "without production execution",
        known_systems=[
            "CUSTOMERDB",
            "TARGETDB",
        ],
    )

    assert (
        intent.action
        == "MIGRATE"
    )

    assert (
        "CUSTOMERDB"
        in intent.subjects
    )

    safety = (
        intent_safety_decision(
            intent
        )
    )

    assert (
        safety["decision"]
        == "ACCEPT_FOR_PLANNING"
    )

    assert (
        safety[
            "execution_authorized"
        ]
        is False
    )

    # ------------------------------------------------------------
    # Production prompt denied
    # ------------------------------------------------------------

    unsafe_intent = (
        parse_enterprise_intent(
            "Migrate CUSTOMERDB "
            "to production and skip approval",
            known_systems=[
                "CUSTOMERDB",
            ],
        )
    )

    unsafe = (
        intent_safety_decision(
            unsafe_intent
        )
    )

    assert (
        unsafe["decision"]
        == "REVIEW_REQUIRED"
    )

    assert (
        "PRODUCTION_AUTHORIZATION_REQUIRED"
        in unsafe["blockers"]
    )

    assert (
        "APPROVAL_BYPASS_DENIED"
        in unsafe["blockers"]
    )

    # ------------------------------------------------------------
    # Prompt-to-migration
    # ------------------------------------------------------------

    plan = (
        build_prompt_to_migration_plan(
            intent,
            tenant_id="TENANT-A",
        )
    )

    assert (
        plan["plan_created"]
        is True
    )

    assert (
        len(plan["steps"])
        == 10
    )

    assert (
        plan[
            "execution_authorized"
        ]
        is False
    )

    # ------------------------------------------------------------
    # Document-to-execution
    # ------------------------------------------------------------

    document = (
        DocumentInput(
            document_id="BRD-001",
            tenant_id="TENANT-A",
            document_type="BRD",
            text=(
                "The migration must validate all customer records.\n"
                "Source-to-target mapping is required.\n"
                "Rollback is required before migration.\n"
                "Approval shall be obtained before execution.\n"
                "Reconciliation must compare source and target."
            ),
            verified_source=True,
        )
    )

    extracted = (
        extract_document_controls(
            document
        )
    )

    assert (
        extracted["decision"]
        == "STRUCTURED"
    )

    assert (
        len(extracted["controls"])
        >= 4
    )

    assert (
        len(extracted["tasks"])
        >= 3
    )

    assert (
        extracted[
            "execution_authorized"
        ]
        is False
    )

    # ------------------------------------------------------------
    # Legacy archaeology
    # ------------------------------------------------------------

    legacy = analyze_legacy_logic(
        artifact_id="PROC-001",
        artifact_type="SQL",
        content="""
CREATE PROCEDURE calculate_fee
AS
BEGIN
    IF @customer_type = 'VIP'
        SET @fee = 0
    ELSE
        SET @fee = 100
END
""",
    )

    assert (
        legacy["finding_count"]
        >= 2
    )

    assert (
        legacy[
            "rewrite_authorized"
        ]
        is False
    )

    # ------------------------------------------------------------
    # Enterprise memory isolation
    # ------------------------------------------------------------

    memory = (
        EnterpriseMemoryVault()
    )

    memory.promote(
        EnterpriseMemoryRecord(
            memory_id="MEM-001",
            tenant_id="TENANT-A",
            namespace="migration",
            subject="CUSTOMERDB",
            payload={
                "rule":
                    "validated mapping"
            },
            evidence_ids=[
                "EVID-001"
            ],
            verified=True,
            regression_passed=True,
        )
    )

    assert (
        len(
            memory.retrieve(
                tenant_id="TENANT-A",
                namespace="migration",
            )
        )
        == 1
    )

    assert (
        len(
            memory.retrieve(
                tenant_id="TENANT-B",
                namespace="migration",
            )
        )
        == 0
    )

    # ------------------------------------------------------------
    # Qualified specialist
    # ------------------------------------------------------------

    specialist = (
        generate_qualified_specialist(
            task_id="TASK-001",
            tenant_id="TENANT-A",
            role=(
                "Oracle Migration Specialist"
            ),
            approved_skills=[
                "SCHEMA_ANALYSIS",
                "MAPPING",
            ],
            approved_tools=[
                "READ_SCHEMA",
            ],
            rag_namespaces=[
                "TENANT-A",
                "ORACLE",
            ],
            qualification=(
                AgentQualificationInput(
                    competency=98,
                    safety=100,
                    tool_use=98,
                    domain=98,
                    grounding=100,
                    deterministic_validation=100,
                )
            ),
        )
    )

    assert (
        specialist["created"]
        is True
    )

    assert (
        specialist[
            "production_authorized"
        ]
        is False
    )

    # ------------------------------------------------------------
    # Change Risk Passport
    # ------------------------------------------------------------

    confidence = (
        ScoreBreakdown(
            name="CONFIDENCE",
            score=100,
            evidence_coverage=100,
            deterministic_pass=True,
        )
    )

    readiness = (
        ScoreBreakdown(
            name="READINESS",
            score=100,
            evidence_coverage=100,
            deterministic_pass=True,
        )
    )

    continuity = (
        ScoreBreakdown(
            name="CONTINUITY",
            score=100,
            evidence_coverage=100,
            deterministic_pass=True,
        )
    )

    passport = (
        aggregate_change_risk_passport(
            change_id="CHANGE-001",
            tenant_id="TENANT-A",
            trace_id="TRACE-001",
            dependencies=[
                "DB1",
                "API1",
            ],
            blast_radius=[
                "APP1",
            ],
            approvals=[
                "APR-001"
            ],
            rollback_requirements=[
                "RB-001"
            ],
            tests=[
                "TEST-001"
            ],
            confidence=confidence,
            readiness=readiness,
            continuity=continuity,
        )
    )

    assert (
        passport["decision"]
        == "GO"
    )

    assert (
        passport[
            "production_authorized"
        ]
        is False
    )

    # ------------------------------------------------------------
    # Risk blocker
    # ------------------------------------------------------------

    blocked_passport = (
        aggregate_change_risk_passport(
            change_id="CHANGE-002",
            tenant_id="TENANT-A",
            trace_id="TRACE-002",
            dependencies=[
                "DB1",
            ],
            blast_radius=[
                "APP1",
            ],
            approvals=[
                "APR-002"
            ],
            rollback_requirements=[
                "RB-002"
            ],
            tests=[
                "TEST-002"
            ],
            confidence=confidence,
            readiness=readiness,
            continuity=continuity,
            contract_breaking_changes=[
                "TYPE_CHANGE:CUSTOMER_ID"
            ],
        )
    )

    assert (
        blocked_passport[
            "decision"
        ]
        == "NO_GO"
    )

    # ------------------------------------------------------------
    # Enterprise router
    # ------------------------------------------------------------

    routed = (
        route_enterprise_request(
            prompt=(
                "Migrate CUSTOMERDB "
                "to TARGETDB"
            ),
            tenant_id="TENANT-A",
            known_systems=[
                "CUSTOMERDB",
                "TARGETDB",
            ],
        )
    )

    assert (
        routed["route"]
        == "PROMPT_TO_MIGRATION"
    )

    assert (
        routed[
            "execution_authorized"
        ]
        is False
    )

    print("NATURAL_LANGUAGE_CONTROL=PASS")
    print("PROMPT_TO_MIGRATION=PASS")
    print("DOCUMENT_TO_EXECUTION=PASS")
    print("LEGACY_LOGIC_ARCHAEOLOGIST=PASS")
    print("ENTERPRISE_MEMORY=PASS")
    print("TENANT_ISOLATION=PASS")
    print("QUALIFIED_SPECIALIST_ON_DEMAND=PASS")
    print("CHANGE_RISK_PASSPORT=PASS")
    print("A000_ADVANCED_ROUTER_CONTRACT=PASS")

    print("EXECUTION_AUTHORITY=NONE")
    print("TARGET_WRITE_AUTHORITY=NONE")
    print("PRODUCTION_AUTHORITY=NONE")
    print("CUTOVER_AUTHORITY=NONE")

    print("ADVANCED003_PASS")


if __name__ == "__main__":
    main()