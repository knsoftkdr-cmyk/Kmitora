from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable


@dataclass(frozen=True, slots=True)
class ToolRequest:
    tool_id: str
    arguments: dict[str, Any] = field(default_factory=dict)
    state_change_requested: bool = False


@dataclass(frozen=True, slots=True)
class ToolObservation:
    tool_id: str
    status: str

    output: dict[str, Any] = field(default_factory=dict)
    evidence: tuple[dict[str, Any], ...] = ()

    source_write_executed: bool = False
    target_write_executed: bool = False
    production_action_executed: bool = False

    message: str = ""


ToolHandler = Callable[[dict[str, Any]], ToolObservation]


class GovernedToolGateway:
    """
    Minimal deterministic tool gateway.

    A tool executes only when:
    - it exists,
    - it is explicitly allowed for the agent context,
    - production state changes are not requested.

    Later phases can delegate authorization to the full KMITORA
    policy/approval engine without changing runtime callers.
    """

    def __init__(self) -> None:
        self._tools: dict[str, ToolHandler] = {}

    def register(
        self,
        tool_id: str,
        handler: ToolHandler,
    ) -> None:

        normalized = tool_id.strip()

        if not normalized:
            raise ValueError("tool_id cannot be empty")

        if normalized in self._tools:
            raise ValueError(
                f"Tool already registered: {normalized}"
            )

        self._tools[normalized] = handler

    def contains(
        self,
        tool_id: str,
    ) -> bool:
        return tool_id in self._tools

    def execute(
        self,
        *,
        tool_request: ToolRequest,
        allowed_tools: tuple[str, ...],
        environment: str,
    ) -> ToolObservation:

        tool_id = tool_request.tool_id

        if tool_id not in allowed_tools:
            return ToolObservation(
                tool_id=tool_id,
                status="BLOCKED",
                message=(
                    "Tool is not present in the agent allowed-tools contract."
                ),
            )

        if tool_id not in self._tools:
            return ToolObservation(
                tool_id=tool_id,
                status="NOT_AVAILABLE",
                message="Requested governed tool is not registered.",
            )

        is_production = environment.upper() in {
            "PROD",
            "PRODUCTION",
        }

        if (
            is_production
            and tool_request.state_change_requested
        ):
            return ToolObservation(
                tool_id=tool_id,
                status="BLOCKED",
                production_action_executed=False,
                message=(
                    "Production state-changing tool execution is denied."
                ),
            )

        observation = self._tools[tool_id](
            dict(tool_request.arguments)
        )

        if not isinstance(
            observation,
            ToolObservation,
        ):
            raise TypeError(
                "Governed tool handlers must return ToolObservation."
            )

        return observation

    def list_tools(self) -> tuple[str, ...]:
        return tuple(
            sorted(self._tools.keys())
        )