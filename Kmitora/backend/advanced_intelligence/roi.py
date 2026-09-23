from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ROIInput:
    baseline_hours: float
    projected_hours: float

    baseline_rework_cost: float
    projected_rework_cost: float

    baseline_incident_cost: float
    projected_incident_cost: float

    implementation_cost: float


def predict_roi(
    value: ROIInput,
) -> dict[str, float | str]:

    hours_saved = max(
        0.0,
        value.baseline_hours -
        value.projected_hours,
    )

    rework_saved = max(
        0.0,
        value.baseline_rework_cost -
        value.projected_rework_cost,
    )

    risk_saved = max(
        0.0,
        value.baseline_incident_cost -
        value.projected_incident_cost,
    )

    gross_value = (
        rework_saved +
        risk_saved
    )

    net_value = (
        gross_value -
        value.implementation_cost
    )

    roi_percent = 0.0

    if value.implementation_cost > 0:

        roi_percent = (
            net_value /
            value.implementation_cost
        ) * 100.0

    return {
        "hours_saved":
            round(hours_saved, 2),

        "rework_cost_avoided":
            round(rework_saved, 2),

        "risk_cost_avoided":
            round(risk_saved, 2),

        "gross_value":
            round(gross_value, 2),

        "net_value":
            round(net_value, 2),

        "roi_percent":
            round(roi_percent, 2),

        "classification":
            (
                "POSITIVE"
                if net_value > 0
                else "NON_POSITIVE"
            ),
    }