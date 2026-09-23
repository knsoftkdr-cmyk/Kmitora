from __future__ import annotations

from typing import Any


def detect_architecture_drift(
    *,
    approved: dict[str, dict[str, Any]],
    actual: dict[str, dict[str, Any]],
) -> dict[str, Any]:

    missing: list[str] = []
    unexpected: list[str] = []
    changed: list[dict[str, Any]] = []

    for component_id in approved:

        if component_id not in actual:
            missing.append(
                component_id
            )
            continue

        expected = approved[
            component_id
        ]

        observed = actual[
            component_id
        ]

        differences: dict[
            str,
            dict[str, Any],
        ] = {}

        keys = set(
            expected
        ) | set(
            observed
        )

        for key in sorted(keys):

            if expected.get(key) != observed.get(key):
                differences[key] = {
                    "approved": expected.get(key),
                    "actual": observed.get(key),
                }

        if differences:
            changed.append({
                "component_id": component_id,
                "differences": differences,
            })

    for component_id in actual:

        if component_id not in approved:
            unexpected.append(
                component_id
            )

    drift_count = (
        len(missing) +
        len(unexpected) +
        len(changed)
    )

    return {
        "drift_detected": drift_count > 0,
        "drift_count": drift_count,
        "missing_components": sorted(missing),
        "unexpected_components":
            sorted(unexpected),
        "changed_components": changed,
        "production_action_executed": False,
    }