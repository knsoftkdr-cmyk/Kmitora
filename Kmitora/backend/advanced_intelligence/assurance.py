from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class ToolObservation:
    tool_name: str
    tool_family: str
    run_id: str
    status: str
    records_read: int
    records_written: int
    errors: int
    evidence_ids: tuple[str, ...]


def normalize_tool_observation(
    observation: ToolObservation,
) -> dict[str, Any]:

    return {
        "tool_name": observation.tool_name,
        "tool_family": observation.tool_family,
        "run_id": observation.run_id,
        "status": observation.status,
        "records_read":
            observation.records_read,
        "records_written":
            observation.records_written,
        "errors": observation.errors,
        "evidence_ids": list(
            observation.evidence_ids
        ),
    }


def shadow_assurance(
    observations: list[ToolObservation],
) -> dict[str, Any]:

    normalized = [
        normalize_tool_observation(
            observation
        )
        for observation in observations
    ]

    errors = sum(
        observation.errors
        for observation in observations
    )

    writes_observed = sum(
        observation.records_written
        for observation in observations
    )

    evidence_count = len({
        evidence_id
        for observation in observations
        for evidence_id
        in observation.evidence_ids
    })

    return {
        "mode": "SHADOW_READ_ONLY",
        "tool_runs": len(observations),
        "errors": errors,
        "observed_external_writes":
            writes_observed,
        "evidence_count":
            evidence_count,
        "observations": normalized,

        "kmitora_write_authorized": False,
        "kmitora_write_executed": False,
        "production_authorized": False,
        "cutover_authorized": False,
    }