from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any


@dataclass
class EnterpriseIntent:
    objective: str
    action: str
    subjects: list[str]
    source_systems: list[str]
    target_systems: list[str]
    constraints: list[str]
    requested_environment: str
    requires_simulation: bool
    requires_approval: bool
    confidence_basis: list[str] = field(
        default_factory=list
    )
    ambiguous: bool = False


_ACTION_PATTERNS = {
    "DISCOVER": (
        "discover",
        "inventory",
        "find dependencies",
        "show dependencies",
        "understand",
    ),
    "ANALYZE": (
        "analyze",
        "analyse",
        "assess",
        "investigate",
        "diagnose",
    ),
    "SIMULATE": (
        "simulate",
        "what if",
        "what-if",
        "preview",
        "replay",
    ),
    "MIGRATE": (
        "migrate",
        "migration",
        "move workload",
        "move data",
        "convert",
    ),
    "RECONCILE": (
        "reconcile",
        "compare source",
        "compare target",
        "variance",
    ),
    "REMEDIATE": (
        "fix",
        "remediate",
        "heal",
        "repair",
    ),
}


def _contains_any(
    text: str,
    phrases: tuple[str, ...],
) -> bool:
    return any(
        phrase in text
        for phrase in phrases
    )


def parse_enterprise_intent(
    prompt: str,
    *,
    known_systems: list[str] | None = None,
) -> EnterpriseIntent:

    raw = prompt.strip()

    if not raw:
        raise ValueError(
            "EMPTY_ENTERPRISE_INTENT"
        )

    lowered = raw.lower()

    actions = [
        action
        for action, phrases
        in _ACTION_PATTERNS.items()
        if _contains_any(
            lowered,
            phrases,
        )
    ]

    # Explicit migration-plan intent outranks generic verbs
    # such as assess/create, without weakening safety gates.
    specialized_readiness = (
        "migration readiness" in lowered
        or "readiness for migration" in lowered
        or "ready for migration" in lowered
    )

    specialized_simulation = (
        "simulate migration" in lowered
        or "simulate the migration" in lowered
        or "migration simulation" in lowered
        or "digital twin" in lowered
        or "what if migration" in lowered
        or "what-if migration" in lowered
    )

    explicit_migration_plan = (
        (
            "migration plan" in lowered
            or "plan a migration" in lowered
            or "plan the migration" in lowered
        )
        and not specialized_readiness
        and not specialized_simulation
    )

    if explicit_migration_plan:
        actions = [
            "MIGRATE",
        ]

    action = (
        actions[0]
        if len(actions) == 1
        else "REVIEW_REQUIRED"
    )

    ambiguous = (
        len(actions) != 1
    )

    constraints: list[str] = []

    # ------------------------------------------------------------
    # Production intent must distinguish positive authorization
    # language from explicit negation such as:
    #
    #   "without production execution"
    #   "no production write"
    #   "exclude production actions"
    #
    # Merely mentioning the word "production" must never be enough
    # to infer a PROD execution request.
    # ------------------------------------------------------------

    production_negated = bool(
        re.search(
            (
                r"\b("
                r"no|without|exclude|excluding|avoid"
                r")\s+("
                r"prod|production"
                r")"
                r"(?:\s+("
                r"execution|write|writes|action|actions|"
                r"change|changes|cutover"
                r"))?\b"
            ),
            lowered,
        )
    )

    production_requested = bool(
        re.search(
            r"\b(prod|production)\b",
            lowered,
        )
    )

    environment = "DEV"

    if (
        production_requested
        and
        not production_negated
    ):
        environment = "PROD"

    if production_negated:
        constraints.append(
            "NO_PRODUCTION_EXECUTION"
        )

    known_systems = (
        known_systems or []
    )

    mentioned = [
        system
        for system in known_systems
        if system.lower() in lowered
    ]

    if "without downtime" in lowered:
        constraints.append(
            "ZERO_DOWNTIME_REQUESTED"
        )

    if "no write" in lowered:
        constraints.append(
            "NO_WRITE"
        )

    if (
        "without approval" in lowered
        or
        "skip approval" in lowered
        or
        "bypass approval" in lowered
    ):
        constraints.append(
            "UNSAFE_APPROVAL_BYPASS_REQUESTED"
        )

    requires_simulation = (
        action in {
            "SIMULATE",
            "MIGRATE",
            "REMEDIATE",
        }
    )

    requires_approval = (
        action in {
            "MIGRATE",
            "REMEDIATE",
        }
    )

    return EnterpriseIntent(
        objective=raw,
        action=action,
        subjects=mentioned,
        source_systems=[],
        target_systems=[],
        constraints=constraints,
        requested_environment=environment,
        requires_simulation=requires_simulation,
        requires_approval=requires_approval,
        confidence_basis=[
            "DETERMINISTIC_INTENT_RULES",
        ],
        ambiguous=ambiguous,
    )


def intent_safety_decision(
    intent: EnterpriseIntent,
) -> dict[str, Any]:

    blockers: list[str] = []

    if intent.ambiguous:
        blockers.append(
            "AMBIGUOUS_INTENT"
        )

    if (
        intent.requested_environment
        == "PROD"
    ):
        blockers.append(
            "PRODUCTION_AUTHORIZATION_REQUIRED"
        )

    if (
        "UNSAFE_APPROVAL_BYPASS_REQUESTED"
        in intent.constraints
    ):
        blockers.append(
            "APPROVAL_BYPASS_DENIED"
        )

    return {
        "decision":
            "REVIEW_REQUIRED"
            if blockers
            else "ACCEPT_FOR_PLANNING",

        "blockers": blockers,

        "planning_authorized":
            len(blockers) == 0,

        "execution_authorized":
            False,

        "production_authorized":
            False,

        "cutover_authorized":
            False,
    }