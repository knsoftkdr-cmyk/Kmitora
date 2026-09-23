from backend.agent_runtime import (
    AgenticRagReactRuntime,
    GovernedToolGateway,
    InMemoryKnowledgeProvider,
    KnowledgeItem,
    ReactAnalysisRuntime,
    ReactDecision,
    RuntimeContext,
    RuntimeRequest,
    RuntimeStatus,
    ToolObservation,
)


def build_provider():
    return InMemoryKnowledgeProvider(
        (
            KnowledgeItem(
                knowledge_id="KKN-001",
                text=(
                    "Target writes require approval, validation, "
                    "rollback readiness and evidence."
                ),
                namespace="safety",
                source_id="POLICY-001",
                evidence_id="EVIDENCE-001",
                authority=100,
                tags=("target-write", "approval", "safety"),
                metadata={
                    "family_id": "KFM0053",
                },
            ),
            KnowledgeItem(
                knowledge_id="KKN-002",
                text=(
                    "Customer email normalization converts "
                    "email values to lowercase."
                ),
                namespace="migration",
                source_id="BR-EMAIL",
                evidence_id="EVIDENCE-002",
                authority=90,
            ),
            KnowledgeItem(
                knowledge_id="KKN-003",
                text="Unrelated infrastructure note.",
                namespace="infrastructure",
                source_id="INFRA-001",
                evidence_id="EVIDENCE-003",
                authority=20,
            ),
        )
    )


def build_context(
    environment="DEV",
    allowed_tools=(),
):
    return RuntimeContext(
        trace_id="TRACE-4C-001",
        task_id="TASK-4C-001",
        agent_id="KAG00626",
        family_id="KFM0053",
        environment=environment,
        knowledge_namespace="safety",
        allowed_tools=tuple(allowed_tools),
    )


def test_agentic_rag_returns_only_scoped_grounded_items():
    runtime = AgenticRagReactRuntime(
        provider=build_provider(),
    )

    result = runtime.run(
        context=build_context(),
        request=RuntimeRequest(
            objective=(
                "What safety controls apply to target writes?"
            ),
        ),
    )

    assert result.status == RuntimeStatus.COMPLETED
    assert result.output["grounded"] is True
    assert result.output["retrieved_count"] >= 1

    ids = {
        item["knowledge_id"]
        for item in result.output["items"]
    }

    assert "KKN-001" in ids
    assert "KKN-003" not in ids
    assert result.target_write_executed is False
    assert result.production_action_executed is False


def test_agentic_rag_insufficient_evidence_is_explicit():
    runtime = AgenticRagReactRuntime(
        provider=build_provider(),
    )

    context = build_context()
    context.knowledge_namespace = "safety"

    result = runtime.run(
        context=context,
        request=RuntimeRequest(
            objective="quantum banana telescope",
        ),
    )

    assert (
        result.status
        == RuntimeStatus.INSUFFICIENT_EVIDENCE
    )

    assert result.output["grounded"] is False


def test_react_default_flow_retrieves_then_finishes():
    runtime = ReactAnalysisRuntime(
        provider=build_provider(),
        max_steps=4,
    )

    result = runtime.run(
        context=build_context(),
        request=RuntimeRequest(
            objective=(
                "What safety controls apply to target writes?"
            ),
        ),
    )

    assert result.status == RuntimeStatus.COMPLETED
    assert result.output["agent_id"] == "KAG00626"
    assert result.output["family_id"] == "KFM0053"
    assert result.output["grounded"] is True
    assert len(result.observations) >= 1
    assert result.production_action_executed is False


def test_react_blocks_unallowed_tool():
    gateway = GovernedToolGateway()

    gateway.register(
        "KTL-READ-001",
        lambda arguments: ToolObservation(
            tool_id="KTL-READ-001",
            status="COMPLETED",
            output={"value": 1},
            message="Read completed.",
        ),
    )

    calls = {"count": 0}

    def reasoner(context, request, observations):
        calls["count"] += 1

        if calls["count"] == 1:
            return ReactDecision(
                action="TOOL",
                tool_id="KTL-READ-001",
                tool_arguments={},
                rationale="Inspect verified state.",
            )

        return ReactDecision(
            action="FINAL",
            final={
                "observations": list(observations),
            },
        )

    runtime = ReactAnalysisRuntime(
        provider=build_provider(),
        tool_gateway=gateway,
        reasoner=reasoner,
        max_steps=3,
    )

    result = runtime.run(
        context=build_context(
            allowed_tools=(),
        ),
        request=RuntimeRequest(
            objective="Inspect state.",
        ),
    )

    assert result.status == RuntimeStatus.COMPLETED

    tool_observation = result.observations[0]

    assert tool_observation["status"] == "BLOCKED"
    assert result.target_write_executed is False


def test_react_executes_allowed_read_only_tool():
    gateway = GovernedToolGateway()

    gateway.register(
        "KTL-READ-001",
        lambda arguments: ToolObservation(
            tool_id="KTL-READ-001",
            status="COMPLETED",
            output={
                "record_count": 19,
            },
            evidence=(
                {
                    "kind": "TOOL_EVIDENCE",
                    "source": "DEV_FIXTURE",
                },
            ),
            message="Read-only inspection completed.",
        ),
    )

    calls = {"count": 0}

    def reasoner(context, request, observations):
        calls["count"] += 1

        if calls["count"] == 1:
            return ReactDecision(
                action="TOOL",
                tool_id="KTL-READ-001",
                rationale="Get deterministic record count.",
            )

        return ReactDecision(
            action="FINAL",
            final={
                "observations": list(observations),
            },
        )

    runtime = ReactAnalysisRuntime(
        provider=build_provider(),
        tool_gateway=gateway,
        reasoner=reasoner,
    )

    result = runtime.run(
        context=build_context(
            allowed_tools=("KTL-READ-001",),
        ),
        request=RuntimeRequest(
            objective="Get record count.",
        ),
    )

    assert result.status == RuntimeStatus.COMPLETED
    assert (
        result.observations[0]["output"]["record_count"]
        == 19
    )

    assert result.source_write_executed is False
    assert result.target_write_executed is False
    assert result.production_action_executed is False


def test_production_state_change_denied_before_react_execution():
    runtime = ReactAnalysisRuntime(
        provider=build_provider(),
    )

    result = runtime.run(
        context=build_context(
            environment="PROD",
        ),
        request=RuntimeRequest(
            objective="Change production target.",
            state_change_requested=True,
        ),
    )

    assert result.status == RuntimeStatus.BLOCKED
    assert result.target_write_executed is False
    assert result.production_action_executed is False


def test_tool_gateway_denies_production_write():
    gateway = GovernedToolGateway()

    gateway.register(
        "KTL-WRITE-001",
        lambda arguments: ToolObservation(
            tool_id="KTL-WRITE-001",
            status="COMPLETED",
            target_write_executed=True,
            production_action_executed=True,
        ),
    )

    observation = gateway.execute(
        tool_request=__import__(
            "backend.agent_runtime",
            fromlist=["ToolRequest"],
        ).ToolRequest(
            tool_id="KTL-WRITE-001",
            arguments={},
            state_change_requested=True,
        ),
        allowed_tools=("KTL-WRITE-001",),
        environment="PROD",
    )

    assert observation.status == "BLOCKED"
    assert observation.target_write_executed is False
    assert observation.production_action_executed is False