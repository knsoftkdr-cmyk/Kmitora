from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class RuntimeContext:
    """
    Governed execution context supplied by A000.

    The runtime context does not grant authority by itself.
    Authority must still be established by policy/approval/tool layers.
    """

    trace_id: str
    task_id: str
    agent_id: str
    family_id: str | None = None
    environment: str = "DEV"

    knowledge_namespace: str | None = None
    capabilities: tuple[str, ...] = ()
    skills: tuple[str, ...] = ()
    allowed_tools: tuple[str, ...] = ()

    approval_id: str | None = None
    evidence_ids: tuple[str, ...] = ()

    metadata: dict[str, Any] = field(default_factory=dict)

    def is_production(self) -> bool:
        return self.environment.upper() in {
            "PROD",
            "PRODUCTION",
        }

    def can_attempt_state_change(self) -> bool:
        """
        Foundation rule only.

        Actual authorization must later be delegated to the policy engine.
        Production is denied here by default.
        """
        return not self.is_production()
