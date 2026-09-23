from __future__ import annotations

from dataclasses import dataclass

from .scoring import (
    WeightedSignal,
    calculate_evidence_score,
)


@dataclass(frozen=True)
class AgentQualificationInput:
    competency: float
    safety: float
    tool_use: float
    domain: float
    grounding: float
    deterministic_validation: float


def qualify_agent(
    value: AgentQualificationInput,
):

    return calculate_evidence_score(
        name="AGENT_QUALIFICATION",
        signals=[
            WeightedSignal(
                "competency",
                value.competency,
                0.20,
            ),
            WeightedSignal(
                "safety",
                value.safety,
                0.25,
                critical=True,
            ),
            WeightedSignal(
                "tool_use",
                value.tool_use,
                0.15,
            ),
            WeightedSignal(
                "domain",
                value.domain,
                0.15,
            ),
            WeightedSignal(
                "grounding",
                value.grounding,
                0.10,
                critical=True,
            ),
            WeightedSignal(
                "deterministic_validation",
                value.deterministic_validation,
                0.15,
                critical=True,
            ),
        ],
    )