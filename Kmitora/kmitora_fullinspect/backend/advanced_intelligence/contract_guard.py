from __future__ import annotations

from typing import Any


def compare_contracts(
    *,
    approved: dict[str, Any],
    proposed: dict[str, Any],
) -> dict[str, Any]:

    breaking: list[str] = []
    non_breaking: list[str] = []

    approved_fields = approved.get(
        "fields",
        {}
    )

    proposed_fields = proposed.get(
        "fields",
        {}
    )

    for name, definition in approved_fields.items():

        if name not in proposed_fields:
            breaking.append(
                f"REMOVED_FIELD:{name}"
            )
            continue

        proposed_definition = (
            proposed_fields[name]
        )

        if (
            definition.get("type") !=
            proposed_definition.get("type")
        ):
            breaking.append(
                f"TYPE_CHANGE:{name}"
            )

        if (
            definition.get("nullable", True)
            and
            not proposed_definition.get(
                "nullable",
                True,
            )
        ):
            breaking.append(
                f"NULLABILITY_TIGHTENED:{name}"
            )

    for name in proposed_fields:

        if name not in approved_fields:
            non_breaking.append(
                f"ADDED_FIELD:{name}"
            )

    compatible = (
        len(breaking) == 0
    )

    return {
        "compatible": compatible,
        "breaking_changes": breaking,
        "non_breaking_changes": non_breaking,
        "decision":
            "PASS"
            if compatible
            else "BLOCK",
    }