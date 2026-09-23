from __future__ import annotations

from typing import Any


def reconcile_entities(
    *,
    source: dict[str, list[dict[str, Any]]],
    target: dict[str, list[dict[str, Any]]],
    key_field: str = "id",
) -> dict[str, Any]:

    entities: dict[str, Any] = {}

    total_source = 0
    total_target = 0
    total_matched = 0
    total_mismatched = 0

    for entity in sorted(
        set(source) | set(target)
    ):

        source_rows = source.get(
            entity,
            [],
        )

        target_rows = target.get(
            entity,
            [],
        )

        source_index = {
            row.get(key_field): row
            for row in source_rows
        }

        target_index = {
            row.get(key_field): row
            for row in target_rows
        }

        missing_target = sorted(
            key
            for key in source_index
            if key not in target_index
        )

        extra_target = sorted(
            key
            for key in target_index
            if key not in source_index
        )

        mismatches: list[dict[str, Any]] = []

        matched = 0

        for key in sorted(
            set(source_index) &
            set(target_index),
            key=str,
        ):

            if (
                source_index[key] ==
                target_index[key]
            ):
                matched += 1
                continue

            differences: dict[str, Any] = {}

            source_row = source_index[key]
            target_row = target_index[key]

            for field in sorted(
                set(source_row) |
                set(target_row)
            ):

                if (
                    source_row.get(field) !=
                    target_row.get(field)
                ):
                    differences[field] = {
                        "source":
                            source_row.get(field),
                        "target":
                            target_row.get(field),
                    }

            mismatches.append({
                "key": key,
                "differences": differences,
            })

        total_source += len(
            source_rows
        )

        total_target += len(
            target_rows
        )

        total_matched += matched

        total_mismatched += (
            len(missing_target) +
            len(extra_target) +
            len(mismatches)
        )

        entities[entity] = {
            "source_count": len(source_rows),
            "target_count": len(target_rows),
            "matched": matched,
            "missing_target": missing_target,
            "extra_target": extra_target,
            "mismatches": mismatches,
        }

    return {
        "entities": entities,
        "source_total": total_source,
        "target_total": total_target,
        "matched": total_matched,
        "exceptions": total_mismatched,
        "exact_match":
            total_mismatched == 0 and
            total_source == total_target,
        "target_write_executed": False,
    }


def explain_exception(
    exception: dict[str, Any],
) -> dict[str, Any]:

    if "differences" in exception:

        fields = sorted(
            exception["differences"]
        )

        return {
            "type": "VALUE_MISMATCH",
            "reason": (
                "Source and target values differ "
                "for fields: "
                + ", ".join(fields)
            ),
            "acceptable": False,
            "requires_review": True,
        }

    if "missing_target" in exception:
        return {
            "type": "MISSING_TARGET_RECORD",
            "reason":
                "Source record has no target counterpart.",
            "acceptable": False,
            "requires_review": True,
        }

    return {
        "type": "UNKNOWN_EXCEPTION",
        "reason":
            "Insufficient deterministic evidence.",
        "acceptable": False,
        "requires_review": True,
    }