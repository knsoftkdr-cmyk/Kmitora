from __future__ import annotations

from collections import defaultdict, deque
from datetime import datetime, timezone
from hashlib import sha256
from typing import Any
import json
import math
import uuid


ENGINE_VERSION = "1.0.0"

FAILURE_LIBRARY = {
    "DB_TIMEOUT": {
        "delay_multiplier": 1.40,
        "risk_delta": 15,
        "rollback_required": False,
        "category": "DATABASE",
    },
    "DB_LATENCY": {
        "delay_multiplier": 1.25,
        "risk_delta": 10,
        "rollback_required": False,
        "category": "DATABASE",
    },
    "API_500": {
        "delay_multiplier": 1.30,
        "risk_delta": 14,
        "rollback_required": False,
        "category": "API",
    },
    "API_RATE_LIMIT": {
        "delay_multiplier": 1.20,
        "risk_delta": 8,
        "rollback_required": False,
        "category": "API",
    },
    "AUTH_FAILURE": {
        "delay_multiplier": 1.15,
        "risk_delta": 20,
        "rollback_required": False,
        "category": "SECURITY",
    },
    "CERTIFICATE_FAILURE": {
        "delay_multiplier": 1.20,
        "risk_delta": 22,
        "rollback_required": False,
        "category": "SECURITY",
    },
    "DNS_FAILURE": {
        "delay_multiplier": 1.25,
        "risk_delta": 18,
        "rollback_required": False,
        "category": "NETWORK",
    },
    "NETWORK_LATENCY": {
        "delay_multiplier": 1.30,
        "risk_delta": 10,
        "rollback_required": False,
        "category": "NETWORK",
    },
    "QUEUE_BACKLOG": {
        "delay_multiplier": 1.25,
        "risk_delta": 10,
        "rollback_required": False,
        "category": "INTEGRATION",
    },
    "JOB_TIMEOUT": {
        "delay_multiplier": 1.30,
        "risk_delta": 12,
        "rollback_required": False,
        "category": "JOB",
    },
    "DATA_VARIANCE": {
        "delay_multiplier": 1.10,
        "risk_delta": 30,
        "rollback_required": True,
        "category": "DATA",
    },
    "FK_VIOLATION": {
        "delay_multiplier": 1.05,
        "risk_delta": 35,
        "rollback_required": True,
        "category": "DATA",
    },
    "BUSINESS_RULE_DRIFT": {
        "delay_multiplier": 1.00,
        "risk_delta": 40,
        "rollback_required": True,
        "category": "BUSINESS_RULE",
    },
    "DISK_CAPACITY": {
        "delay_multiplier": 1.20,
        "risk_delta": 30,
        "rollback_required": True,
        "category": "INFRASTRUCTURE",
    },
    "CPU_SATURATION": {
        "delay_multiplier": 1.35,
        "risk_delta": 18,
        "rollback_required": False,
        "category": "INFRASTRUCTURE",
    },
    "APPROVAL_DELAY": {
        "delay_multiplier": 1.15,
        "risk_delta": 8,
        "rollback_required": False,
        "category": "GOVERNANCE",
    },
}

DEFAULT_POLICY = {
    "approved_window_minutes": 120,
    "max_p90_minutes": 90,
    "max_worst_case_minutes": 120,
    "max_rto_minutes": 45,
    "max_rpo_minutes": 15,
    "min_cutover_confidence": 80,
    "min_capacity_headroom_percent": 20,
    "require_rollback_for_every_write_step": True,
    "require_business_rule_pass": True,
    "require_impact_gate_pass": True,
    "require_autopilot_plan": True,
    "require_reconciliation_plan": True,
    "require_all_approvals": True,
    "block_on_point_of_no_return_without_approval": True,
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _hash(value: Any) -> str:
    return sha256(
        json.dumps(
            value,
            sort_keys=True,
            ensure_ascii=False,
            default=str,
        ).encode("utf-8")
    ).hexdigest()


def _bounded(value: Any, low: float = 0, high: float = 100) -> float:
    try:
        number = float(value)
    except Exception:
        number = low
    return max(low, min(high, number))


def _normalize_steps(raw_steps: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    steps = {}

    for item in raw_steps:
        if not isinstance(item, dict):
            continue

        step_id = str(item.get("id") or "").strip()

        if not step_id:
            continue

        expected = max(
            0.1,
            float(item.get("expected_minutes", item.get("duration_minutes", 1))),
        )

        optimistic = max(
            0.1,
            float(item.get("optimistic_minutes", expected * 0.80)),
        )

        worst = max(
            expected,
            float(item.get("worst_case_minutes", expected * 1.50)),
        )

        steps[step_id] = {
            "id": step_id,
            "name": str(item.get("name") or step_id),
            "kind": str(item.get("kind") or "GENERAL").upper(),
            "expected_minutes": expected,
            "optimistic_minutes": optimistic,
            "worst_case_minutes": worst,
            "risk_score": int(_bounded(item.get("risk_score", 50))),
            "write_step": bool(item.get("write_step", False)),
            "rollback_available": bool(item.get("rollback_available", True)),
            "rollback_minutes": max(
                0.0,
                float(item.get("rollback_minutes", expected * 0.50)),
            ),
            "point_of_no_return": bool(item.get("point_of_no_return", False)),
            "approval_required": bool(item.get("approval_required", False)),
            "approval_present": bool(item.get("approval_present", False)),
            "capacity_required_percent": _bounded(
                item.get("capacity_required_percent", 50)
            ),
            "team_ready": bool(item.get("team_ready", True)),
            "communication_ready": bool(item.get("communication_ready", True)),
            "reconciliation_required": bool(
                item.get("reconciliation_required", False)
            ),
            "metadata": dict(item.get("metadata") or {}),
        }

    return steps


def _normalize_dependencies(
    raw_dependencies: list[dict[str, Any]],
    steps: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:

    out = []

    for item in raw_dependencies:
        if not isinstance(item, dict):
            continue

        before = str(
            item.get("before")
            or item.get("parent")
            or item.get("source")
            or ""
        ).strip()

        after = str(
            item.get("after")
            or item.get("child")
            or item.get("target")
            or ""
        ).strip()

        if before not in steps or after not in steps:
            continue

        out.append(
            {
                "before": before,
                "after": after,
                "hard": bool(item.get("hard", True)),
                "relationship": str(
                    item.get("relationship") or "DEPENDS_ON"
                ).upper(),
            }
        )

    return out


def _topological_order(
    steps: dict[str, dict[str, Any]],
    dependencies: list[dict[str, Any]],
) -> tuple[list[str], list[str]]:

    indegree = {step_id: 0 for step_id in steps}
    adjacency = defaultdict(list)

    for dep in dependencies:
        adjacency[dep["before"]].append(dep["after"])
        indegree[dep["after"]] += 1

    queue = deque(
        sorted(
            step_id
            for step_id, degree in indegree.items()
            if degree == 0
        )
    )

    order = []

    while queue:
        step_id = queue.popleft()
        order.append(step_id)

        for child in adjacency.get(step_id, []):
            indegree[child] -= 1

            if indegree[child] == 0:
                queue.append(child)

    cycle_nodes = sorted(
        step_id
        for step_id in steps
        if step_id not in order
    )

    return order, cycle_nodes


def _schedule(
    steps: dict[str, dict[str, Any]],
    dependencies: list[dict[str, Any]],
    duration_field: str,
    multiplier: float = 1.0,
) -> tuple[list[dict[str, Any]], float, list[str]]:

    order, cycles = _topological_order(
        steps,
        dependencies,
    )

    if cycles:
        return [], 0.0, cycles

    predecessors = defaultdict(list)

    for dep in dependencies:
        predecessors[dep["after"]].append(dep["before"])

    finish = {}
    timeline = []

    for step_id in order:
        step = steps[step_id]

        start = max(
            [finish[parent] for parent in predecessors.get(step_id, [])],
            default=0.0,
        )

        duration = float(step[duration_field]) * multiplier
        end = start + duration
        finish[step_id] = end

        timeline.append(
            {
                "step_id": step_id,
                "name": step["name"],
                "start_minute": round(start, 2),
                "duration_minutes": round(duration, 2),
                "end_minute": round(end, 2),
                "risk_score": step["risk_score"],
                "write_step": step["write_step"],
                "rollback_available": step["rollback_available"],
                "point_of_no_return": step["point_of_no_return"],
            }
        )

    total = max(finish.values(), default=0.0)

    return timeline, round(total, 2), []


def _critical_path(
    steps: dict[str, dict[str, Any]],
    dependencies: list[dict[str, Any]],
) -> dict[str, Any]:

    order, cycles = _topological_order(
        steps,
        dependencies,
    )

    if cycles:
        return {
            "step_ids": [],
            "duration_minutes": 0.0,
            "blocked_by_cycle": cycles,
        }

    predecessors = defaultdict(list)

    for dep in dependencies:
        predecessors[dep["after"]].append(dep["before"])

    longest = {}
    parent = {}

    for step_id in order:
        duration = float(steps[step_id]["expected_minutes"])
        preds = predecessors.get(step_id, [])

        if not preds:
            longest[step_id] = duration
            parent[step_id] = None
            continue

        best_parent = max(
            preds,
            key=lambda p: longest.get(p, 0),
        )

        longest[step_id] = (
            longest.get(best_parent, 0)
            + duration
        )
        parent[step_id] = best_parent

    if not longest:
        return {
            "step_ids": [],
            "duration_minutes": 0.0,
            "blocked_by_cycle": [],
        }

    end = max(longest, key=longest.get)
    path = []

    current = end

    while current is not None:
        path.append(current)
        current = parent.get(current)

    path.reverse()

    return {
        "step_ids": path,
        "step_names": [
            steps[step_id]["name"]
            for step_id in path
        ],
        "duration_minutes": round(longest[end], 2),
        "blocked_by_cycle": [],
    }


def _rollback_profile(
    steps: dict[str, dict[str, Any]],
    timeline: list[dict[str, Any]],
) -> dict[str, Any]:

    rollback_points = []
    cumulative = 0.0
    point_of_no_return = None

    for item in timeline:
        step = steps[item["step_id"]]

        if step["write_step"]:
            cumulative += step["rollback_minutes"]

            rollback_points.append(
                {
                    "after_step": step["id"],
                    "step_name": step["name"],
                    "rollback_available": step["rollback_available"],
                    "estimated_rollback_minutes": round(
                        cumulative,
                        2,
                    ),
                }
            )

        if (
            point_of_no_return is None
            and step["point_of_no_return"]
        ):
            point_of_no_return = {
                "step_id": step["id"],
                "step_name": step["name"],
                "minute": item["start_minute"],
            }

    return {
        "rollback_points": rollback_points,
        "worst_rollback_minutes": round(cumulative, 2),
        "point_of_no_return": point_of_no_return,
    }


def _capacity_profile(
    payload: dict[str, Any],
    steps: dict[str, dict[str, Any]],
) -> dict[str, Any]:

    available = _bounded(
        payload.get("capacity_available_percent", 100)
    )

    peak_required = max(
        [
            step["capacity_required_percent"]
            for step in steps.values()
        ],
        default=0,
    )

    headroom = max(
        0.0,
        available - peak_required,
    )

    return {
        "available_percent": round(available, 2),
        "peak_required_percent": round(peak_required, 2),
        "headroom_percent": round(headroom, 2),
    }


def _confidence(
    timing_safe: bool,
    dependency_safe: bool,
    rollback_safe: bool,
    business_rule_safe: bool,
    impact_safe: bool,
    capacity_safe: bool,
    team_safe: bool,
    reconciliation_safe: bool,
) -> dict[str, Any]:

    factors = {
        "timing": 100 if timing_safe else 55,
        "dependency": 100 if dependency_safe else 20,
        "rollback": 100 if rollback_safe else 30,
        "business_rule": 100 if business_rule_safe else 20,
        "impact": 95 if impact_safe else 35,
        "capacity": 95 if capacity_safe else 45,
        "team_approval": 95 if team_safe else 40,
        "reconciliation": 95 if reconciliation_safe else 40,
    }

    weights = {
        "timing": 0.15,
        "dependency": 0.15,
        "rollback": 0.15,
        "business_rule": 0.15,
        "impact": 0.10,
        "capacity": 0.10,
        "team_approval": 0.10,
        "reconciliation": 0.10,
    }

    score = sum(
        factors[key] * weights[key]
        for key in factors
    )

    return {
        "score": round(score, 2),
        "factors": factors,
        "weights": weights,
    }


def plan_cutover(payload: dict[str, Any]) -> dict[str, Any]:

    steps = _normalize_steps(
        payload.get("steps") or []
    )

    if not steps:
        raise ValueError("steps must be a non-empty list")

    dependencies = _normalize_dependencies(
        payload.get("dependencies") or [],
        steps,
    )

    policy = dict(DEFAULT_POLICY)
    policy.update(payload.get("policy") or {})

    timeline, expected, cycles = _schedule(
        steps,
        dependencies,
        "expected_minutes",
    )

    optimistic_timeline, optimistic, _ = _schedule(
        steps,
        dependencies,
        "optimistic_minutes",
    )

    worst_timeline, worst, _ = _schedule(
        steps,
        dependencies,
        "worst_case_minutes",
    )

    p50 = expected
    p90 = round(
        expected + 0.75 * max(0.0, worst - expected),
        2,
    )

    critical = _critical_path(
        steps,
        dependencies,
    )

    rollback = _rollback_profile(
        steps,
        timeline,
    )

    capacity = _capacity_profile(
        payload,
        steps,
    )

    missing_approvals = [
        step["id"]
        for step in steps.values()
        if step["approval_required"]
        and not step["approval_present"]
    ]

    rollback_missing = [
        step["id"]
        for step in steps.values()
        if step["write_step"]
        and not step["rollback_available"]
    ]

    team_not_ready = [
        step["id"]
        for step in steps.values()
        if not step["team_ready"]
    ]

    communications_not_ready = [
        step["id"]
        for step in steps.values()
        if not step["communication_ready"]
    ]

    business_rule_status = str(
        payload.get("business_rule_status") or "PASS"
    ).upper()

    impact_status = str(
        payload.get("impact_status") or "PASS"
    ).upper()

    autopilot_status = str(
        payload.get("autopilot_status") or "PLANNED"
    ).upper()

    reconciliation_status = str(
        payload.get("reconciliation_plan_status")
        or "READY"
    ).upper()

    rpo_minutes = max(
        0.0,
        float(payload.get("estimated_rpo_minutes", 0)),
    )

    rto_minutes = rollback["worst_rollback_minutes"]

    blockers = []

    if cycles:
        blockers.append("DEPENDENCY_CYCLE")

    if p90 > float(policy["max_p90_minutes"]):
        blockers.append("P90_WINDOW_EXCEEDED")

    if worst > float(policy["max_worst_case_minutes"]):
        blockers.append("WORST_CASE_WINDOW_EXCEEDED")

    if rto_minutes > float(policy["max_rto_minutes"]):
        blockers.append("RTO_BUDGET_EXCEEDED")

    if rpo_minutes > float(policy["max_rpo_minutes"]):
        blockers.append("RPO_BUDGET_EXCEEDED")

    if (
        policy["require_rollback_for_every_write_step"]
        and rollback_missing
    ):
        blockers.append("ROLLBACK_COVERAGE_INCOMPLETE")

    if (
        policy["require_all_approvals"]
        and missing_approvals
    ):
        blockers.append("APPROVALS_MISSING")

    if (
        policy["require_business_rule_pass"]
        and business_rule_status != "PASS"
    ):
        blockers.append("BUSINESS_RULE_DNA_GATE_FAILED")

    if (
        policy["require_impact_gate_pass"]
        and impact_status not in {"PASS", "LOW_RISK"}
    ):
        blockers.append("WHAT_BREAKS_IF_GATE_FAILED")

    if (
        policy["require_autopilot_plan"]
        and autopilot_status not in {
            "PLANNED",
            "DRY_RUN_READY",
            "READY",
        }
    ):
        blockers.append("AUTOPILOT_GATE_FAILED")

    if (
        policy["require_reconciliation_plan"]
        and reconciliation_status != "READY"
    ):
        blockers.append("RECONCILIATION_PLAN_NOT_READY")

    capacity_safe = (
        capacity["headroom_percent"]
        >= float(
            policy["min_capacity_headroom_percent"]
        )
    )

    if not capacity_safe:
        blockers.append("CAPACITY_HEADROOM_INSUFFICIENT")

    if team_not_ready:
        blockers.append("TEAM_READINESS_INCOMPLETE")

    if communications_not_ready:
        blockers.append("COMMUNICATION_READINESS_INCOMPLETE")

    ponr = rollback["point_of_no_return"]

    if (
        policy["block_on_point_of_no_return_without_approval"]
        and ponr
        and missing_approvals
    ):
        blockers.append(
            "POINT_OF_NO_RETURN_APPROVAL_REQUIRED"
        )

    blockers = sorted(set(blockers))

    timing_safe = (
        p90 <= float(policy["max_p90_minutes"])
        and worst <= float(
            policy["max_worst_case_minutes"]
        )
    )

    dependency_safe = len(cycles) == 0
    rollback_safe = len(rollback_missing) == 0
    business_rule_safe = business_rule_status == "PASS"
    impact_safe = impact_status in {"PASS", "LOW_RISK"}
    team_safe = (
        not missing_approvals
        and not team_not_ready
        and not communications_not_ready
    )
    reconciliation_safe = reconciliation_status == "READY"

    confidence = _confidence(
        timing_safe,
        dependency_safe,
        rollback_safe,
        business_rule_safe,
        impact_safe,
        capacity_safe,
        team_safe,
        reconciliation_safe,
    )

    if confidence["score"] < float(
        policy["min_cutover_confidence"]
    ):
        blockers.append("CUTOVER_CONFIDENCE_TOO_LOW")

    blockers = sorted(set(blockers))

    result_status = (
        "CUTOVER_SIMULATION_READY"
        if not blockers
        else "CUTOVER_SIMULATION_BLOCKED"
    )

    plan_material = {
        "steps": steps,
        "dependencies": dependencies,
        "policy": policy,
        "expected": expected,
        "p90": p90,
        "worst": worst,
        "blockers": blockers,
    }

    return {
        "cutover_plan_id": (
            "CUTPLAN-" + uuid.uuid4().hex[:12].upper()
        ),
        "engine": "KMITORA Zero-Surprise Cutover Simulator",
        "engine_version": ENGINE_VERSION,
        "generated_at": _now(),
        "status": result_status,
        "mode": "READ_ONLY_CUTOVER_REHEARSAL",
        "summary": {
            "step_count": len(steps),
            "dependency_count": len(dependencies),
            "expected_minutes": expected,
            "p50_minutes": p50,
            "p90_minutes": p90,
            "worst_case_minutes": worst,
            "approved_window_minutes": float(
                policy["approved_window_minutes"]
            ),
            "rto_minutes": rto_minutes,
            "rpo_minutes": rpo_minutes,
            "blocker_count": len(blockers),
            "cutover_confidence": confidence["score"],
        },
        "timeline": timeline,
        "optimistic_timeline": optimistic_timeline,
        "worst_case_timeline": worst_timeline,
        "critical_path": critical,
        "rollback": rollback,
        "capacity": capacity,
        "missing_approvals": missing_approvals,
        "team_not_ready": team_not_ready,
        "communications_not_ready": communications_not_ready,
        "dependency_cycles": cycles,
        "blockers": blockers,
        "confidence": confidence,
        "gates": {
            "business_rule_dna": business_rule_status,
            "what_breaks_if": impact_status,
            "migration_autopilot": autopilot_status,
            "reconciliation_plan": reconciliation_status,
        },
        "policy": policy,
        "evidence": {
            "plan_hash_sha256": _hash(plan_material),
            "deterministic": True,
        },
        "safety": {
            "authoritative": False,
            "read_only": True,
            "simulation_only": True,
            "source_write_executed": False,
            "target_write_executed": False,
            "production_action_executed": False,
            "cutover_executed": False,
        },
    }


def simulate_cutover(payload: dict[str, Any]) -> dict[str, Any]:

    plan = plan_cutover(payload)

    scenarios = []

    scenario_defs = [
        ("BASELINE", 1.00, []),
        ("STRESS", 1.25, ["DB_LATENCY", "NETWORK_LATENCY"]),
        ("FAILURE", 1.15, ["API_500"]),
        ("WORST_CASE", 1.50, ["DB_TIMEOUT", "API_500", "CPU_SATURATION"]),
    ]

    for name, multiplier, failures in scenario_defs:

        risk_delta = sum(
            FAILURE_LIBRARY[f]["risk_delta"]
            for f in failures
        )

        predicted = round(
            plan["summary"]["expected_minutes"]
            * multiplier,
            2,
        )

        scenarios.append(
            {
                "scenario": name,
                "predicted_minutes": predicted,
                "failures": failures,
                "risk_delta": risk_delta,
                "within_approved_window": (
                    predicted
                    <= plan["summary"]["approved_window_minutes"]
                ),
                "target_write_executed": False,
                "cutover_executed": False,
            }
        )

    return {
        "simulation_id": (
            "CUTSIM-" + uuid.uuid4().hex[:12].upper()
        ),
        "generated_at": _now(),
        "status": (
            "SIMULATION_PASS"
            if not plan["blockers"]
            else "SIMULATION_BLOCKED"
        ),
        "cutover_plan_id": plan["cutover_plan_id"],
        "cutover_confidence": (
            plan["summary"]["cutover_confidence"]
        ),
        "scenarios": scenarios,
        "blockers": plan["blockers"],
        "critical_path": plan["critical_path"],
        "rollback": plan["rollback"],
        "evidence_hash_sha256": (
            plan["evidence"]["plan_hash_sha256"]
        ),
        "safety": plan["safety"],
    }


def stress_test(payload: dict[str, Any]) -> dict[str, Any]:

    base = plan_cutover(payload)

    stress = payload.get("stress") or {}

    volume_multiplier = max(
        1.0,
        float(stress.get("data_volume_multiplier", 2.0)),
    )

    latency_multiplier = max(
        1.0,
        float(stress.get("latency_multiplier", 1.5)),
    )

    throughput_factor = max(
        0.1,
        min(
            1.0,
            float(stress.get("throughput_factor", 0.75)),
        ),
    )

    combined = (
        math.sqrt(volume_multiplier)
        * latency_multiplier
        / throughput_factor
    )

    predicted = round(
        base["summary"]["expected_minutes"]
        * combined,
        2,
    )

    window = base["summary"]["approved_window_minutes"]

    return {
        "stress_test_id": (
            "CUTSTRESS-" + uuid.uuid4().hex[:12].upper()
        ),
        "status": (
            "STRESS_PASS"
            if predicted <= window
            else "STRESS_FAIL"
        ),
        "baseline_minutes": (
            base["summary"]["expected_minutes"]
        ),
        "stressed_minutes": predicted,
        "approved_window_minutes": window,
        "data_volume_multiplier": volume_multiplier,
        "latency_multiplier": latency_multiplier,
        "throughput_factor": throughput_factor,
        "headroom_minutes": round(
            window - predicted,
            2,
        ),
        "safety": base["safety"],
    }


def inject_failure(payload: dict[str, Any]) -> dict[str, Any]:

    failure = str(
        payload.get("failure_type") or ""
    ).upper()

    if failure not in FAILURE_LIBRARY:
        raise ValueError(
            "Unknown failure_type. Supported: "
            + ", ".join(sorted(FAILURE_LIBRARY))
        )

    definition = FAILURE_LIBRARY[failure]

    baseline_minutes = max(
        0.1,
        float(payload.get("baseline_minutes", 1)),
    )

    predicted = round(
        baseline_minutes
        * definition["delay_multiplier"],
        2,
    )

    return {
        "failure_injection_id": (
            "CUTFI-" + uuid.uuid4().hex[:12].upper()
        ),
        "failure_type": failure,
        "category": definition["category"],
        "baseline_minutes": baseline_minutes,
        "predicted_minutes": predicted,
        "risk_delta": definition["risk_delta"],
        "rollback_required": definition[
            "rollback_required"
        ],
        "recommended_action": (
            "ROLLBACK_REHEARSAL"
            if definition["rollback_required"]
            else "RECOVER_AND_CONTINUE_SIMULATION"
        ),
        "safety": {
            "read_only": True,
            "simulation_only": True,
            "target_write_executed": False,
            "production_action_executed": False,
            "cutover_executed": False,
        },
    }


def rollback_rehearsal(payload: dict[str, Any]) -> dict[str, Any]:

    plan = plan_cutover(payload)

    points = plan["rollback"]["rollback_points"]

    rehearsals = []

    for index, point in enumerate(points, start=1):

        rehearsals.append(
            {
                "scenario": f"ROLLBACK_AFTER_WRITE_{index}",
                "after_step": point["after_step"],
                "step_name": point["step_name"],
                "rollback_available": point[
                    "rollback_available"
                ],
                "estimated_minutes": point[
                    "estimated_rollback_minutes"
                ],
                "verification_required": True,
                "result": (
                    "REHEARSAL_READY"
                    if point["rollback_available"]
                    else "REHEARSAL_BLOCKED"
                ),
            }
        )

    all_ready = all(
        item["rollback_available"]
        for item in rehearsals
    )

    return {
        "rollback_rehearsal_id": (
            "CUTRB-" + uuid.uuid4().hex[:12].upper()
        ),
        "status": (
            "ROLLBACK_REHEARSAL_READY"
            if all_ready
            else "ROLLBACK_REHEARSAL_BLOCKED"
        ),
        "scenarios": rehearsals,
        "point_of_no_return": (
            plan["rollback"]["point_of_no_return"]
        ),
        "worst_rollback_minutes": (
            plan["rollback"]["worst_rollback_minutes"]
        ),
        "safety": plan["safety"],
    }


def go_no_go(payload: dict[str, Any]) -> dict[str, Any]:

    plan = plan_cutover(payload)

    confidence = plan["summary"][
        "cutover_confidence"
    ]

    if plan["blockers"]:
        decision = "NO_GO"
    else:
        decision = "GO_RECOMMENDATION"

    return {
        "decision_id": (
            "CUTDEC-" + uuid.uuid4().hex[:12].upper()
        ),
        "decision": decision,
        "approval_required": True,
        "cutover_ready": decision == "GO_RECOMMENDATION",
        "cutover_confidence": confidence,
        "blockers": plan["blockers"],
        "reason": (
            "Simulation-only recommendation. "
            "Actual cutover remains separately governed."
        ),
        "actual_cutover_authorized": False,
        "safety": plan["safety"],
    }


def engine_status() -> dict[str, Any]:
    return {
        "engine": "KMITORA Zero-Surprise Cutover Simulator",
        "version": ENGINE_VERSION,
        "status": "READY",
        "authority": "SIMULATION_ONLY",
        "capabilities": [
            "full_cutover_timeline",
            "dependency_scheduling",
            "critical_path_analysis",
            "optimistic_expected_p50_p90_worst_case",
            "downtime_window_validation",
            "rto_rpo_validation",
            "capacity_headroom",
            "cutover_confidence_score",
            "failure_injection",
            "stress_testing",
            "rollback_rehearsal",
            "point_of_no_return_detection",
            "team_readiness",
            "communication_readiness",
            "approval_readiness",
            "business_rule_dna_gate",
            "what_breaks_if_gate",
            "migration_autopilot_gate",
            "reconciliation_gate",
            "deterministic_go_no_go",
            "evidence_hashing",
        ],
        "failure_library": sorted(FAILURE_LIBRARY),
        "safety": {
            "read_only": True,
            "simulation_only": True,
            "direct_target_write_path": False,
            "production_action_executed": False,
            "cutover_executed": False,
        },
    }
