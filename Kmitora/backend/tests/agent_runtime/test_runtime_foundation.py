from backend.agent_runtime import (
    RuntimeContext,
    RuntimeRequest,
    RuntimeStatus,
    build_default_registry,
)


EXPECTED_PATTERNS = {
    "ORCHESTRATOR_RUNTIME",
    "AGENTIC_RAG_REACT_RUNTIME",
    "REACT_ANALYSIS_RUNTIME",
    "DETECTION_VALIDATION_RUNTIME",
    "CAUSAL_RCA_RUNTIME",
    "GRAPH_RISK_RUNTIME",
    "PLANNER_RUNTIME",
    "GOVERNED_CODEACT_EXECUTION_RUNTIME",
    "VALIDATOR_JUDGE_RUNTIME",
    "RECOVERY_ROLLBACK_RUNTIME",
    "EVIDENCE_AUDIT_RUNTIME",
    "VERIFIED_LEARNING_RUNTIME",
}


def test_default_runtime_registry_contains_all_patterns():
    registry = build_default_registry()

    assert set(registry.list_patterns()) == EXPECTED_PATTERNS


def test_runtime_preserves_canonical_agent_identity():
    registry = build_default_registry()

    context = RuntimeContext(
        trace_id="TRACE-TEST-001",
        task_id="TASK-TEST-001",
        agent_id="KAG00001",
        family_id="KFM0001",
        environment="DEV",
    )

    request = RuntimeRequest(
        objective="Verify shared runtime identity preservation."
    )

    result = registry.get(
        "REACT_ANALYSIS_RUNTIME"
    ).run(
        context=context,
        request=request,
    )

    assert result.output["agent_id"] == "KAG00001"
    assert result.output["family_id"] == "KFM0001"
    assert result.production_action_executed is False


def test_production_state_change_is_denied():
    registry = build_default_registry()

    context = RuntimeContext(
        trace_id="TRACE-TEST-002",
        task_id="TASK-TEST-002",
        agent_id="KAG00001",
        family_id="KFM0001",
        environment="PROD",
    )

    request = RuntimeRequest(
        objective="Attempt production state change.",
        state_change_requested=True,
    )

    result = registry.get(
        "GOVERNED_CODEACT_EXECUTION_RUNTIME"
    ).run(
        context=context,
        request=request,
    )

    assert result.status == RuntimeStatus.BLOCKED
    assert result.production_action_executed is False
    assert result.target_write_executed is False
