"""KMITORA A000 read-only orchestration telemetry bridge.

This bridge adapts the existing shadow telemetry envelope to the
canonical orchestration coordinator.

It does not execute tools, grant approval, perform writes,
authorize production, or authorize cutover.
"""

from __future__ import annotations

from pathlib import Path
import sys
from typing import Any, Mapping


_REPO_ROOT = Path(__file__).resolve().parents[2]

if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(
        0,
        str(_REPO_ROOT),
    )


from backend.agent_runtime.orchestration_coordinator import (
    build_live_shadow_orchestration,
)


def run_a000_orchestration_telemetry(
    shadow_runtime: Mapping[str, Any] | None,
) -> dict[str, Any]:
    """Build read-only orchestration telemetry from shadow metadata."""

    shadow = dict(
        shadow_runtime or {}
    )

    result = build_live_shadow_orchestration(
        trace_id=str(
            shadow.get(
                "trace_id",
                "",
            )
        ),
        task_id=str(
            shadow.get(
                "task_id",
                "",
            )
        ),
        agent_id=str(
            shadow.get(
                "agent_id",
                "A000",
            )
        ),
        environment=str(
            shadow.get(
                "environment",
                "DEV",
            )
        ),
    )

    result["bridge"] = (
        "A000_ORCHESTRATION_TELEMETRY_BRIDGE"
    )

    result["shadow_runtime_present"] = bool(
        shadow
    )

    result["shadow_authoritative"] = bool(
        shadow.get(
            "authoritative",
            False,
        )
    )

    result["shadow_reply_replaced"] = bool(
        shadow.get(
            "reply_replaced",
            False,
        )
    )

    # Safety contract: this bridge cannot expand authority.
    result["authoritative"] = False
    result["execution_authorized"] = False
    result["source_write_authorized"] = False
    result["target_write_authorized"] = False
    result["production_authorized"] = False
    result["cutover_authorized"] = False

    result["model_execution"] = False
    result["tool_execution"] = False
    result["approval_granted"] = False

    result["source_write_executed"] = False
    result["target_write_executed"] = False
    result["production_action_executed"] = False
    result["cutover_executed"] = False

    return result