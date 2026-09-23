from __future__ import annotations

from typing import Any


def build_regulatory_evidence_pack(
    *,
    framework: str,
    policy_requirements: list[str],
    evidence: dict[str, list[str]],
) -> dict[str, Any]:

    controls: list[dict[str, Any]] = []

    missing: list[str] = []

    for requirement in policy_requirements:

        evidence_ids = evidence.get(
            requirement,
            [],
        )

        satisfied = bool(
            evidence_ids
        )

        if not satisfied:
            missing.append(
                requirement
            )

        controls.append({
            "requirement": requirement,
            "satisfied": satisfied,
            "evidence_ids": evidence_ids,
        })

    return {
        "framework": framework,
        "controls": controls,
        "complete":
            len(missing) == 0,
        "missing_requirements":
            missing,
        "generated_from_verified_evidence":
            True,
        "production_authorized":
            False,
    }