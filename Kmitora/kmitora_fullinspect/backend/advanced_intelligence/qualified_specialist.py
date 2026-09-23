from __future__ import annotations

from dataclasses import asdict
from typing import Any

from .qualification import (
    AgentQualificationInput,
    qualify_agent,
)
from .specialist import (
    generate_specialist,
)


def generate_qualified_specialist(
    *,
    task_id: str,
    tenant_id: str,
    role: str,
    approved_skills: list[str],
    approved_tools: list[str],
    rag_namespaces: list[str],
    qualification:
        AgentQualificationInput,
    minimum_score: float = 90.0,
) -> dict[str, Any]:

    score = qualify_agent(
        qualification
    )

    if (
        not score.deterministic_pass
        or
        score.normalized
        < minimum_score
    ):
        return {
            "created": False,
            "decision":
                "QUALIFICATION_FAILED",
            "qualification_score":
                score.normalized,
            "blockers":
                score.blockers,
        }

    specialist = generate_specialist(
        task_id=task_id,
        tenant_id=tenant_id,
        role=role,
        approved_skills=(
            approved_skills
        ),
        approved_tools=(
            approved_tools
        ),
        rag_namespaces=(
            rag_namespaces
        ),
    )

    return {
        "created": True,
        "decision":
            "QUALIFIED_TEMPORARY_SPECIALIST",
        "qualification_score":
            score.normalized,
        "specialist":
            asdict(specialist),
        "production_authorized":
            False,
        "cutover_authorized":
            False,
    }