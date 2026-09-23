from __future__ import annotations

from dataclasses import dataclass, field
from uuid import uuid4


@dataclass
class TemporarySpecialist:
    specialist_id: str
    task_id: str
    tenant_id: str

    role: str

    approved_skills: list[str]
    approved_tools: list[str]
    rag_namespaces: list[str]

    environment: str = "DEV"

    persistent: bool = False
    authoritative: bool = False

    production_authorized: bool = False
    cutover_authorized: bool = False

    constraints: list[str] = field(
        default_factory=list
    )


def generate_specialist(
    *,
    task_id: str,
    tenant_id: str,
    role: str,
    approved_skills: list[str],
    approved_tools: list[str],
    rag_namespaces: list[str],
) -> TemporarySpecialist:

    if not role.strip():
        raise ValueError(
            "ROLE_REQUIRED"
        )

    return TemporarySpecialist(
        specialist_id=(
            f"TEMP-{uuid4()}"
        ),
        task_id=task_id,
        tenant_id=tenant_id,
        role=role,
        approved_skills=list(
            approved_skills
        ),
        approved_tools=list(
            approved_tools
        ),
        rag_namespaces=list(
            rag_namespaces
        ),
        constraints=[
            "NO_PRODUCTION_AUTHORITY",
            "NO_CUTOVER_AUTHORITY",
            "NO_POLICY_BYPASS",
            "TENANT_ISOLATION_REQUIRED",
            "VERIFIED_EVIDENCE_REQUIRED",
        ],
    )