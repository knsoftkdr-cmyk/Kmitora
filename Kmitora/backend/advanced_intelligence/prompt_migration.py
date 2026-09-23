from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
from uuid import uuid4

from .enterprise_intent import (
    EnterpriseIntent,
    intent_safety_decision,
)


@dataclass
class MigrationPlanStep:
    step_id: str
    stage: str
    name: str
    dependencies: list[str]
    required_evidence: list[str]
    write_capable: bool = False
    approval_required: bool = False


def build_prompt_to_migration_plan(
    intent: EnterpriseIntent,
    *,
    tenant_id: str,
) -> dict[str, Any]:

    safety = intent_safety_decision(
        intent
    )

    if (
        safety["decision"]
        != "ACCEPT_FOR_PLANNING"
    ):
        return {
            "plan_created": False,
            "decision":
                safety["decision"],
            "blockers":
                safety["blockers"],
            "execution_authorized":
                False,
            "production_authorized":
                False,
            "cutover_authorized":
                False,
        }

    migration_id = (
        f"MIG-{uuid4()}"
    )

    stages = [
        (
            "UNDERSTAND",
            "Capture objective, scope, rules and acceptance criteria",
        ),
        (
            "DISCOVER",
            "Discover source, target, schemas and dependencies",
        ),
        (
            "MAP",
            "Build source-to-target mappings",
        ),
        (
            "TRANSFORM",
            "Define deterministic transformation rules",
        ),
        (
            "SIMULATE",
            "Run digital-twin and dry-run simulation",
        ),
        (
            "VALIDATE",
            "Validate mappings, rules, integrity and safety",
        ),
        (
            "APPROVE",
            "Evaluate governance and approval requirements",
        ),
        (
            "EXECUTE",
            "Hold execution until governed authorization exists",
        ),
        (
            "RECONCILE",
            "Define source-to-target reconciliation plan",
        ),
        (
            "EVIDENCE",
            "Create final evidence and lineage requirements",
        ),
    ]

    steps: list[MigrationPlanStep] = []

    previous: str | None = None

    for index, (
        stage,
        name,
    ) in enumerate(
        stages,
        start=1,
    ):

        step_id = (
            f"P{index:02d}"
        )

        dependencies = (
            [previous]
            if previous
            else []
        )

        write_capable = (
            stage == "EXECUTE"
        )

        approval_required = (
            stage in {
                "APPROVE",
                "EXECUTE",
            }
        )

        steps.append(
            MigrationPlanStep(
                step_id=step_id,
                stage=stage,
                name=name,
                dependencies=dependencies,
                required_evidence=[
                    f"{stage}_EVIDENCE"
                ],
                write_capable=write_capable,
                approval_required=(
                    approval_required
                ),
            )
        )

        previous = step_id

    return {
        "plan_created": True,
        "migration_id": migration_id,
        "tenant_id": tenant_id,
        "objective":
            intent.objective,
        "requested_environment":
            intent.requested_environment,
        "steps": [
            {
                "step_id": step.step_id,
                "stage": step.stage,
                "name": step.name,
                "dependencies":
                    step.dependencies,
                "required_evidence":
                    step.required_evidence,
                "write_capable":
                    step.write_capable,
                "approval_required":
                    step.approval_required,
            }
            for step in steps
        ],
        "execution_authorized":
            False,
        "target_write_authorized":
            False,
        "production_authorized":
            False,
        "cutover_authorized":
            False,
    }