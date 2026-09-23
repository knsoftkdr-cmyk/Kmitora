from __future__ import annotations

from typing import Any

from .enterprise_intent import (
    parse_enterprise_intent,
    intent_safety_decision,
)
from .prompt_migration import (
    build_prompt_to_migration_plan,
)


def _is_explicit_migration_plan_request(
    prompt: str,
    action: str,
) -> bool:
    """
    Identify explicit migration-plan intent without consuming
    specialized readiness or simulation requests.
    """

    text = " ".join(
        str(prompt or "")
        .lower()
        .replace("-", " ")
        .split()
    )

    action_value = str(
        action or ""
    ).upper()

    if not text:
        return False

    if (
        "migration readiness" in text
        or "readiness for migration" in text
        or "ready for migration" in text
    ):
        return False

    if (
        "simulate migration" in text
        or "simulate the migration" in text
        or "migration simulation" in text
        or "digital twin" in text
        or "what if migration" in text
    ):
        return False

    if action_value == "MIGRATE":
        return True

    if "migration plan" in text:
        return True

    if "plan a migration" in text:
        return True

    if "plan the migration" in text:
        return True

    if (
        "source to target" in text
        and "migration workflow" in text
    ):
        return True

    if (
        "migration" in text
        and "discover" in text
        and "map" in text
        and "transform" in text
        and "validate" in text
        and "reconcile" in text
    ):
        return True

    return False

def route_enterprise_request(
    *,
    prompt: str,
    tenant_id: str,
    known_systems:
        list[str] | None = None,
) -> dict[str, Any]:

    intent = parse_enterprise_intent(
        prompt,
        known_systems=known_systems,
    )

    safety = intent_safety_decision(
        intent
    )

    result: dict[str, Any] = {
        "intent": {
            "objective":
                intent.objective,
            "action":
                intent.action,
            "subjects":
                intent.subjects,
            "constraints":
                intent.constraints,
            "requested_environment":
                intent.requested_environment,
            "requires_simulation":
                intent.requires_simulation,
            "requires_approval":
                intent.requires_approval,
            "ambiguous":
                intent.ambiguous,
        },
        "safety":
            safety,
        "route":
            "PLANNING_ONLY",
        "execution_authorized":
            False,
        "production_authorized":
            False,
        "cutover_authorized":
            False,
    }

    if (
        _is_explicit_migration_plan_request(
            prompt,
            intent.action,
        )
        and
        safety["decision"]
        == "ACCEPT_FOR_PLANNING"
    ):
        result[
            "migration_plan"
        ] = (
            build_prompt_to_migration_plan(
                intent,
                tenant_id=tenant_id,
            )
        )

        result["route"] = (
            "PROMPT_TO_MIGRATION"
        )

    return result