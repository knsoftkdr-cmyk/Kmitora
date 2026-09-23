from __future__ import annotations

from collections import defaultdict, deque
from datetime import datetime, timezone
from hashlib import sha256
from typing import Any
import json
import uuid


ENGINE_VERSION = "1.0.0"

ENVIRONMENT_AUTHORITY = {
    "DEV": {
        "planning": True,
        "dry_run": True,
        "state_change": False,
        "production": False,
        "cutover": False,
    },
    "QA": {
        "planning": True,
        "dry_run": True,
        "state_change": False,
        "production": False,
        "cutover": False,
    },
    "UAT": {
        "planning": True,
        "dry_run": True,
        "state_change": False,
        "production": False,
        "cutover": False,
    },
    "PROD": {
        "planning": True,
        "dry_run": True,
        "state_change": False,
        "production": False,
        "cutover": False,
    },
}

DEFAULT_BUDGET = {
    "max_waves": 20,
    "max_retry_per_wave": 2,
    "max_records": 1000000,
    "max_execution_time_minutes": 120,
    "max_risk_score": 75,
    "allowed_environment": "DEV",
    "allowed_write_scope": "NONE",
    "rollback_required": True,
    "approval_required_above_risk": 50,
    "stop_on_variance": True,
    "stop_on_business_rule_drift": True,
    "canary_percent": 5,
}

RETRYABLE_FAILURES = {
    "TIMEOUT",
    "TEMPORARY_NETWORK",
    "RATE_LIMIT",
    "TRANSIENT_CONNECTION",
    "TEMPORARY_TARGET_UNAVAILABLE",
}

NON_RETRYABLE_FAILURES = {
    "SCHEMA_MISMATCH",
    "BUSINESS_RULE_MISMATCH",
    "REFERENTIAL_INTEGRITY",
    "PERMISSION_DENIED",
    "APPROVAL_MISSING",
    "POLICY_VIOLATION",
    "DATA_CORRUPTION",
    "UNEXPECTED_VARIANCE",
}

STOP_CONDITIONS = {
    "CRITICAL_VALIDATION_FAILURE",
    "CRITICAL_BUSINESS_RULE_DRIFT",
    "MISSING_APPROVAL",
    "POLICY_VIOLATION",
    "REFERENTIAL_INTEGRITY_FAILURE",
    "ROLLBACK_UNAVAILABLE",
    "RISK_BUDGET_EXCEEDED",
    "UNEXPLAINED_RECONCILIATION_VARIANCE",
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


def _norm_env(value: Any) -> str:
    env = str(value or "DEV").strip().upper()
    return env if env in ENVIRONMENT_AUTHORITY else "DEV"


def _bounded(value: Any, low: int = 0, high: int = 100) -> int:
    try:
        numeric = int(float(value))
    except Exception:
        numeric = low
    return max(low, min(high, numeric))


def _normalize_assets(raw_assets: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    assets = {}

    for item in raw_assets:
        if not isinstance(item, dict):
            continue

        asset_id = str(item.get("id") or "").strip()

        if not asset_id:
            continue

        assets[asset_id] = {
            "id": asset_id,
            "name": str(item.get("name") or item.get("label") or asset_id),
            "kind": str(item.get("kind") or item.get("type") or "UNKNOWN").upper(),
            "risk_score": _bounded(item.get("risk_score", 50)),
            "record_count": max(0, int(item.get("record_count", 0) or 0)),
            "criticality": _bounded(item.get("criticality", 50)),
            "write_required": bool(item.get("write_required", True)),
            "rollback_available": bool(item.get("rollback_available", True)),
            "approval_required": bool(item.get("approval_required", False)),
            "business_rule_gate": str(
                item.get("business_rule_gate") or "PASS"
            ).upper(),
            "validation_status": str(
                item.get("validation_status") or "PASS"
            ).upper(),
            "metadata": dict(item.get("metadata") or {}),
        }

    return assets


def _normalize_dependencies(
    raw_dependencies: list[dict[str, Any]],
    assets: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:

    dependencies = []

    for item in raw_dependencies:
        if not isinstance(item, dict):
            continue

        parent = str(
            item.get("parent")
            or item.get("source")
            or item.get("from")
            or ""
        ).strip()

        child = str(
            item.get("child")
            or item.get("target")
            or item.get("to")
            or ""
        ).strip()

        if not parent or not child:
            continue

        if parent not in assets or child not in assets:
            continue

        dependencies.append(
            {
                "parent": parent,
                "child": child,
                "type": str(
                    item.get("type")
                    or item.get("relationship")
                    or "DEPENDS_ON"
                ).upper(),
                "hard": bool(item.get("hard", True)),
                "confidence": _bounded(
                    item.get("confidence", 100)
                ),
            }
        )

    return dependencies


def _topological_waves(
    assets: dict[str, dict[str, Any]],
    dependencies: list[dict[str, Any]],
) -> tuple[list[list[str]], list[list[str]]]:

    indegree = {asset_id: 0 for asset_id in assets}
    adjacency = defaultdict(list)

    for dep in dependencies:
        parent = dep["parent"]
        child = dep["child"]

        adjacency[parent].append(child)
        indegree[child] += 1

    queue = deque(
        sorted(
            [
                asset_id
                for asset_id, degree in indegree.items()
                if degree == 0
            ]
        )
    )

    waves = []
    processed = set()

    while queue:
        current_wave = list(queue)
        queue.clear()

        waves.append(current_wave)

        next_candidates = []

        for asset_id in current_wave:
            processed.add(asset_id)

            for child in adjacency.get(asset_id, []):
                indegree[child] -= 1

                if indegree[child] == 0:
                    next_candidates.append(child)

        for asset_id in sorted(set(next_candidates)):
            queue.append(asset_id)

    cycles = []

    remaining = [
        asset_id
        for asset_id in assets
        if asset_id not in processed
    ]

    if remaining:
        cycles.append(sorted(remaining))

    return waves, cycles


def _risk_band(score: int) -> str:
    if score >= 85:
        return "CRITICAL"
    if score >= 70:
        return "HIGH"
    if score >= 45:
        return "MEDIUM"
    return "LOW"


def _classify_wave(
    wave_number: int,
    asset_ids: list[str],
    assets: dict[str, dict[str, Any]],
    budget: dict[str, Any],
) -> dict[str, Any]:

    wave_assets = [assets[asset_id] for asset_id in asset_ids]

    total_records = sum(x["record_count"] for x in wave_assets)
    highest_risk = max(
        [x["risk_score"] for x in wave_assets],
        default=0,
    )

    approval_required = (
        any(x["approval_required"] for x in wave_assets)
        or highest_risk >= int(
            budget["approval_required_above_risk"]
        )
    )

    rollback_ready = all(
        x["rollback_available"]
        for x in wave_assets
        if x["write_required"]
    )

    validation_ready = all(
        x["validation_status"] == "PASS"
        for x in wave_assets
    )

    rule_ready = all(
        x["business_rule_gate"] == "PASS"
        for x in wave_assets
    )

    blockers = []

    if not rollback_ready:
        blockers.append("ROLLBACK_UNAVAILABLE")

    if not validation_ready:
        blockers.append("CRITICAL_VALIDATION_FAILURE")

    if not rule_ready:
        blockers.append("CRITICAL_BUSINESS_RULE_DRIFT")

    if highest_risk > int(budget["max_risk_score"]):
        blockers.append("RISK_BUDGET_EXCEEDED")

    canary_percent = int(budget["canary_percent"])

    canary_records = 0

    if total_records > 0:
        canary_records = max(
            1,
            int(round(total_records * canary_percent / 100.0))
        )

    return {
        "wave_number": wave_number,
        "asset_ids": asset_ids,
        "asset_names": [
            assets[asset_id]["name"]
            for asset_id in asset_ids
        ],
        "total_records": total_records,
        "highest_risk_score": highest_risk,
        "risk_band": _risk_band(highest_risk),
        "approval_required": approval_required,
        "rollback_ready": rollback_ready,
        "validation_ready": validation_ready,
        "business_rule_ready": rule_ready,
        "blockers": sorted(set(blockers)),
        "canary": {
            "enabled": total_records > 0,
            "percent": canary_percent,
            "record_count": canary_records,
        },
        "retry_policy": {
            "max_retries": int(
                budget["max_retry_per_wave"]
            ),
            "retryable_failures": sorted(RETRYABLE_FAILURES),
            "non_retryable_failures": sorted(
                NON_RETRYABLE_FAILURES
            ),
        },
        "checkpoint": {
            "required": True,
            "pre_wave_checkpoint": (
                f"WAVE-{wave_number:02d}-PRE"
            ),
            "post_wave_checkpoint": (
                f"WAVE-{wave_number:02d}-POST"
            ),
        },
    }


def classify_failure(payload: dict[str, Any]) -> dict[str, Any]:
    failure_type = str(
        payload.get("failure_type") or "UNKNOWN"
    ).upper()

    retryable = failure_type in RETRYABLE_FAILURES

    if failure_type in NON_RETRYABLE_FAILURES:
        retryable = False

    action = "STOP_AND_REVIEW"

    if retryable:
        action = "BOUNDED_RETRY"

    if failure_type in {
        "DATA_CORRUPTION",
        "REFERENTIAL_INTEGRITY",
        "POLICY_VIOLATION",
        "BUSINESS_RULE_MISMATCH",
    }:
        action = "ROLLBACK_REQUIRED"

    return {
        "failure_type": failure_type,
        "retryable": retryable,
        "recommended_action": action,
        "production_action_executed": False,
        "target_write_executed": False,
    }


def plan_autopilot(payload: dict[str, Any]) -> dict[str, Any]:

    environment = _norm_env(
        payload.get("environment")
    )

    assets = _normalize_assets(
        payload.get("assets") or []
    )

    if not assets:
        raise ValueError("assets must be a non-empty list")

    dependencies = _normalize_dependencies(
        payload.get("dependencies") or [],
        assets,
    )

    budget = dict(DEFAULT_BUDGET)
    budget.update(payload.get("autonomy_budget") or {})

    budget["allowed_environment"] = environment

    if environment == "PROD":
        budget["allowed_write_scope"] = "NONE"

    waves_raw, cycles = _topological_waves(
        assets,
        dependencies,
    )

    if cycles:
        plan_status = "BLOCKED"
    else:
        plan_status = "PLANNED"

    waves = []

    for idx, asset_ids in enumerate(
        waves_raw,
        start=1,
    ):
        waves.append(
            _classify_wave(
                idx,
                asset_ids,
                assets,
                budget,
            )
        )

    blockers = []

    for wave in waves:
        blockers.extend(wave["blockers"])

    blockers = sorted(set(blockers))

    if cycles:
        blockers.append("DEPENDENCY_CYCLE")

    if len(waves) > int(budget["max_waves"]):
        blockers.append("MAX_WAVES_EXCEEDED")

    total_records = sum(
        x["record_count"]
        for x in assets.values()
    )

    if total_records > int(budget["max_records"]):
        blockers.append("MAX_RECORDS_EXCEEDED")

    if blockers:
        plan_status = "BLOCKED"

    approval_waves = [
        wave["wave_number"]
        for wave in waves
        if wave["approval_required"]
    ]

    rollback_ready = all(
        wave["rollback_ready"]
        for wave in waves
    )

    checkpoints = []

    for wave in waves:
        checkpoints.extend(
            [
                wave["checkpoint"]["pre_wave_checkpoint"],
                wave["checkpoint"]["post_wave_checkpoint"],
            ]
        )

    stop_conditions = sorted(STOP_CONDITIONS)

    plan_material = {
        "environment": environment,
        "waves": waves,
        "dependencies": dependencies,
        "budget": budget,
        "blockers": blockers,
    }

    plan_hash = _hash(plan_material)

    return {
        "plan_id": (
            "MAP-" + uuid.uuid4().hex[:12].upper()
        ),
        "engine": "KMITORA Migration Autopilot",
        "engine_version": ENGINE_VERSION,
        "generated_at": _now(),
        "status": plan_status,
        "mode": "READ_ONLY_PLAN_AND_DRY_RUN",
        "environment": environment,
        "summary": {
            "asset_count": len(assets),
            "dependency_count": len(dependencies),
            "wave_count": len(waves),
            "approval_wave_count": len(approval_waves),
            "total_records": total_records,
            "blocker_count": len(blockers),
            "cycle_count": len(cycles),
            "rollback_ready": rollback_ready,
        },
        "waves": waves,
        "dependency_cycles": cycles,
        "blockers": blockers,
        "approval_waves": approval_waves,
        "checkpoints": checkpoints,
        "resume_policy": {
            "enabled": True,
            "strategy": "LAST_VERIFIED_POST_WAVE_CHECKPOINT",
            "full_restart_required": False,
        },
        "rollback_policy": {
            "required": True,
            "scope": "AFFECTED_COMPLETED_WAVE",
            "verify_after_rollback": True,
        },
        "retry_policy": {
            "bounded": True,
            "max_retry_per_wave": int(
                budget["max_retry_per_wave"]
            ),
            "retryable_failures": sorted(RETRYABLE_FAILURES),
            "non_retryable_failures": sorted(
                NON_RETRYABLE_FAILURES
            ),
        },
        "stop_conditions": stop_conditions,
        "autonomy_budget": budget,
        "canary_policy": {
            "enabled": True,
            "percent": int(
                budget["canary_percent"]
            ),
            "required_for_high_risk_wave": True,
        },
        "integration": {
            "what_breaks_if_required_above_risk": 60,
            "business_rule_dna_required": True,
            "validation_required": True,
            "approval_required_for_state_change": True,
            "reconciliation_required_for_completion": True,
            "evidence_required_for_completion": True,
        },
        "execution_contract": {
            "planner_may_write_target": False,
            "planner_may_execute_production": False,
            "planner_may_cutover": False,
            "actual_execution_path": (
                "EXISTING_GOVERNED_EXECUTION_AGENT_AND_TARGET_API"
            ),
        },
        "evidence": {
            "plan_hash_sha256": plan_hash,
            "deterministic": True,
        },
        "safety": {
            "authoritative": False,
            "read_only": True,
            "source_write_executed": False,
            "target_write_executed": False,
            "production_action_executed": False,
            "cutover_executed": False,
        },
    }


def simulate_autopilot(payload: dict[str, Any]) -> dict[str, Any]:

    plan = plan_autopilot(payload)

    if plan["status"] == "BLOCKED":
        outcome = "DRY_RUN_BLOCKED"
    else:
        outcome = "DRY_RUN_READY"

    simulated_waves = []

    for wave in plan["waves"]:
        state = "SIMULATED_READY"

        if wave["blockers"]:
            state = "SIMULATED_BLOCKED"

        simulated_waves.append(
            {
                "wave_number": wave["wave_number"],
                "state": state,
                "asset_ids": wave["asset_ids"],
                "checkpoint_pre": (
                    wave["checkpoint"][
                        "pre_wave_checkpoint"
                    ]
                ),
                "checkpoint_post": (
                    wave["checkpoint"][
                        "post_wave_checkpoint"
                    ]
                ),
                "target_write_executed": False,
            }
        )

    return {
        "simulation_id": (
            "MAPSIM-" + uuid.uuid4().hex[:12].upper()
        ),
        "generated_at": _now(),
        "status": outcome,
        "plan_id": plan["plan_id"],
        "plan_hash_sha256": (
            plan["evidence"]["plan_hash_sha256"]
        ),
        "simulated_waves": simulated_waves,
        "blockers": plan["blockers"],
        "next_action": (
            "RESOLVE_BLOCKERS"
            if plan["blockers"]
            else "REQUEST_GOVERNED_APPROVAL"
        ),
        "safety": {
            "read_only": True,
            "source_write_executed": False,
            "target_write_executed": False,
            "production_action_executed": False,
            "cutover_executed": False,
        },
    }


def engine_status() -> dict[str, Any]:
    return {
        "engine": "KMITORA Migration Autopilot",
        "version": ENGINE_VERSION,
        "status": "READY",
        "authority": "PLAN_AND_SIMULATE_ONLY",
        "capabilities": [
            "dependency_aware_wave_planning",
            "risk_aware_sequencing",
            "approval_segmentation",
            "checkpoint_generation",
            "bounded_retry_policy",
            "failure_classification",
            "rollback_readiness",
            "resume_from_checkpoint",
            "canary_planning",
            "autonomy_budget",
            "stop_conditions",
            "business_rule_dna_gate",
            "what_breaks_if_gate",
            "reconciliation_completion_gate",
            "evidence_completion_gate",
            "dry_run_simulation",
        ],
        "safety": {
            "read_only": True,
            "direct_target_write_path": False,
            "production_action_executed": False,
            "cutover_executed": False,
        },
    }
