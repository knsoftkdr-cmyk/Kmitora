from __future__ import annotations

import sys
from pathlib import Path
from typing import Any


_REPO_ROOT = (
    Path(__file__)
    .resolve()
    .parents[2]
)

_REPO_TEXT = str(_REPO_ROOT)

if _REPO_TEXT not in sys.path:
    sys.path.insert(
        0,
        _REPO_TEXT,
    )


def _safe_failure(
    *,
    error: Exception,
) -> dict[str, Any]:
    """
    Shadow failure must never break the existing A000 response.
    """

    return {
        "mode": "SHADOW_READ_ONLY",
        "status": "SHADOW_ERROR",
        "authoritative": False,
        "reply_replaced": False,
        "legacy_reply_preserved": True,
        "error_type": type(error).__name__,
        "error": str(error),
        "safety": {
            "read_only": True,
            "approval_granted": False,
            "source_write_executed": False,
            "target_write_executed": False,
            "production_action_executed": False,
            "cutover_executed": False,
        },
    }


def run_a000_shadow_telemetry(
    *,
    message: str,
    current_reply: dict[str, Any],
    environment: str = "DEV",
    trace_id: str | None = None,
) -> dict[str, Any]:

    try:
        from backend.agent_runtime.a000_shadow_router import (
            run_a000_shadow,
        )

        result = run_a000_shadow(
            message=message,
            current_reply=current_reply,
            agent_id="A000",
            environment=environment,
            trace_id=trace_id,
        )

        if result.get("authoritative") is True:
            raise RuntimeError(
                "Shadow runtime attempted to become authoritative."
            )

        if result.get("reply_replaced") is True:
            raise RuntimeError(
                "Shadow runtime attempted to replace legacy reply."
            )

        safety = result.get(
            "safety",
            {},
        )

        if safety.get(
            "source_write_executed"
        ) is True:
            raise RuntimeError(
                "Shadow runtime reported source write."
            )

        if safety.get(
            "target_write_executed"
        ) is True:
            raise RuntimeError(
                "Shadow runtime reported target write."
            )

        if safety.get(
            "production_action_executed"
        ) is True:
            raise RuntimeError(
                "Shadow runtime reported production action."
            )

        if safety.get(
            "cutover_executed"
        ) is True:
            raise RuntimeError(
                "Shadow runtime reported cutover."
            )

        return result

    except Exception as exc:
        return _safe_failure(
            error=exc,
        )