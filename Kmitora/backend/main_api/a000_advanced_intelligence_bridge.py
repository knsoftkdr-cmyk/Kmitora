from __future__ import annotations

from typing import Any

from backend.advanced_intelligence.enterprise_router import (
    route_enterprise_request,
)


BRIDGE_NAME = "A000_ADVANCED_INTELLIGENCE_BRIDGE"
BRIDGE_MODE = "SHADOW_READ_ONLY"


def run_a000_advanced_intelligence(
    *,
    message: str,
    shadow_runtime: dict[str, Any],
    orchestration_runtime: dict[str, Any],
    known_systems: list[str] | None = None,
    tenant_id: str = "DEV-TENANT",
) -> dict[str, Any]:
    """Attach Advanced Intelligence as non-authoritative telemetry.

    This bridge:
    - performs planning/interpretation only;
    - does not replace the existing A000 reply;
    - does not authorize tool execution;
    - does not authorize source or target writes;
    - does not authorize production or cutover;
    - reuses the current A000 trace/task/agent/environment identity.
    """

    shadow_runtime = shadow_runtime or {}
    orchestration_runtime = orchestration_runtime or {}

    trace_id = (
        shadow_runtime.get("trace_id")
        or orchestration_runtime.get("trace_id")
    )

    task_id = (
        shadow_runtime.get("task_id")
        or orchestration_runtime.get("task_id")
    )

    agent_id = (
        shadow_runtime.get("agent_id")
        or orchestration_runtime.get("agent_id")
        or "A000"
    )

    environment = (
        shadow_runtime.get("environment")
        or orchestration_runtime.get("environment")
        or "DEV"
    )

    routed = route_enterprise_request(
        prompt=message,
        tenant_id=tenant_id,
        known_systems=known_systems or [],
    )

    advanced = {
        "mode": BRIDGE_MODE,
        "bridge": BRIDGE_NAME,

        "trace_id": trace_id,
        "task_id": task_id,
        "agent_id": agent_id,
        "environment": environment,

        "intent": routed.get("intent"),
        "safety": routed.get("safety"),
        "route": routed.get("route"),

        "execution_authorized": False,
        "source_write_authorized": False,
        "target_write_authorized": False,
        "production_authorized": False,
        "cutover_authorized": False,

        "model_execution": False,
        "tool_execution": False,

        "reply_replaced": False,
        "authoritative": False,

        "source_write_executed": False,
        "target_write_executed": False,
        "production_action_executed": False,
        "cutover_executed": False,
    }

    migration_plan = routed.get(
        "migration_plan"
    )

    if migration_plan is not None:
        advanced[
            "migration_plan"
        ] = migration_plan

    blockers = []

    safety = routed.get(
        "safety"
    ) or {}

    blockers.extend(
        safety.get(
            "blockers",
            [],
        )
    )

    if environment.upper() != "DEV":
        blockers.append(
            "NON_DEV_ENVIRONMENT_DENIED"
        )

    advanced["blockers"] = sorted(
        set(blockers)
    )

    if advanced["blockers"]:
        advanced[
            "execution_authorized"
        ] = False

        advanced[
            "target_write_authorized"
        ] = False

        advanced[
            "production_authorized"
        ] = False

        advanced[
            "cutover_authorized"
        ] = False

    return advanced