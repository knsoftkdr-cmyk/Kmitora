from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping
import uuid

from .runtime import A000CoreRuntime
from .evaluate import calibrated_confidence
from .heal import root_cause, remediation_plan
from .learning import promotion_gate
from .db_ir import DatabaseIR, TableIR, ColumnIR
from .db_translate import translate

PATCH_ID = "A000_LIVE_UNIFIED_RUNTIME_027"

_PROJECT_ROOT = Path(__file__).resolve().parents[2]
_RUNTIME = A000CoreRuntime(_PROJECT_ROOT)


def _safe_list(value: Any) -> List[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, tuple):
        return list(value)
    return [value]


def _database_translation(request: Mapping[str, Any]) -> Dict[str, Any]:
    source_engine = str(request.get("source_engine") or "").strip()
    target_engine = str(request.get("target_engine") or "").strip()
    tables_in = request.get("tables")
    if not source_engine or not target_engine or not isinstance(tables_in, list):
        return {
            "status": "NOT_REQUESTED",
            "reason": "source_engine, target_engine and tables are required",
            "production_writes": 0,
        }

    tables: List[TableIR] = []
    for t in tables_in:
        if not isinstance(t, Mapping) or not t.get("name"):
            continue
        columns: List[ColumnIR] = []
        for c in _safe_list(t.get("columns")):
            if not isinstance(c, Mapping) or not c.get("name"):
                continue
            columns.append(
                ColumnIR(
                    name=str(c["name"]),
                    logical_type=str(c.get("logical_type") or c.get("type") or "STRING"),
                    nullable=bool(c.get("nullable", True)),
                )
            )
        tables.append(
            TableIR(
                name=str(t["name"]),
                columns=columns,
                primary_key=[str(x) for x in _safe_list(t.get("primary_key"))],
                foreign_keys=[str(x) for x in _safe_list(t.get("foreign_keys"))],
                indexes=[str(x) for x in _safe_list(t.get("indexes"))],
            )
        )

    ir = DatabaseIR(source_engine=source_engine, tables=tables)
    return translate(ir, target_engine)


def _diagnostics(request: Mapping[str, Any]) -> Dict[str, Any]:
    signals = request.get("signals")
    if not isinstance(signals, list) or not signals:
        return {
            "status": "NOT_REQUESTED",
            "root_cause": None,
            "remediation": None,
        }
    normalized = [dict(x) for x in signals if isinstance(x, Mapping)]
    rca = root_cause(normalized)
    primary = (rca.get("ranked_causes") or [{}])[0] if rca.get("ranked_causes") else {}
    remedy = remediation_plan(primary, bool(request.get("rollback_available", False)))
    return {"status": "ANALYZED", "root_cause": rca, "remediation": remedy}


def run_live_unified_runtime(
    *,
    message: str,
    request: Mapping[str, Any] | None = None,
    current_reply: Mapping[str, Any] | None = None,
    learning_context: Mapping[str, Any] | None = None,
) -> Dict[str, Any]:
    """Project the 013-026 intelligence backbone into the live A000 message path.

    This bridge is deliberately read-only.  It plans, validates, simulates,
    diagnoses and creates evidence metadata, but it never invokes a write tool.
    """
    req: Dict[str, Any] = dict(request or {})
    req.setdefault("message", message)
    req.setdefault("objective", message)
    req.setdefault("environment", "DEV")
    req.setdefault("risk", "LOW")

    trace_id = f"TRACE-{uuid.uuid4()}"
    _RUNTIME.telemetry.emit("a000.live027.start", trace_id=trace_id)

    plan = _RUNTIME.plan(req)
    validation = _RUNTIME.validators.validate(
        plan,
        required=("plan_id", "intent", "policy", "simulation", "evidence"),
    )
    validator_pass_rate = 1.0 if validation.get("status") == "PASS" else 0.0
    evidence_score = 1.0 if plan.get("evidence", {}).get("evidence_id") else 0.0
    objective_score = 1.0 if message.strip() else 0.0
    confidence = calibrated_confidence(
        [objective_score, evidence_score, 1.0 if plan.get("capabilities") else 0.0],
        validator_pass_rate,
    )

    db_translation = _database_translation(req)
    diagnostics = _diagnostics(req)

    candidate = {
        "evidence_id": plan.get("evidence", {}).get("evidence_id"),
        "validation_status": validation.get("status"),
        "production_action_executed": False,
        "cutover_executed": False,
    }
    regression_results = req.get("regression_results")
    if not isinstance(regression_results, list):
        regression_results = []
    learning = promotion_gate(candidate, regression_results)

    # KMITORA_A000_LIVE_RUNTIME_HARDENING_028
    # Reuse the existing shadow-grounding result when it is already attached
    # to the normal A000 reply.  Do not create a second retrieval/grounding
    # implementation here.
    shadow = (current_reply or {}).get("shadow_runtime") if isinstance(current_reply, Mapping) else None
    comparison = shadow.get("comparison") if isinstance(shadow, Mapping) else None
    grounding_available = isinstance(comparison, Mapping) and "shadow_grounded" in comparison
    grounding_value = (
        bool(comparison.get("shadow_grounded"))
        if grounding_available
        else None
    )
    retrieved_count = (
        int(comparison.get("retrieved_count", 0) or 0)
        if isinstance(comparison, Mapping)
        else 0
    )
    grounding_abstain = bool(grounding_available and not grounding_value and retrieved_count == 0)
    if grounding_abstain:
        confidence = dict(confidence)
        confidence["abstain"] = True
        confidence["grounding_reason"] = "EXISTING_SHADOW_RUNTIME_UNGROUNDED"

    abstain = (
        bool(confidence.get("abstain"))
        or validation.get("status") != "PASS"
        or grounding_abstain
    )
    decision = "ABSTAIN_REVIEW" if abstain else "PLAN_READY"

    selected = [
        {
            "capability_id": c.get("capability_id"),
            "name": c.get("name"),
        }
        for c in plan.get("capabilities", [])
        if isinstance(c, Mapping)
    ]

    result = {
        "patch_id": PATCH_ID,
        "trace_id": trace_id,
        "status": "REVIEW" if abstain else "READY",
        "decision": decision,
        "mode": "PLAN_ONLY",
        "normal_message_path_integrated": True,
        "intent": plan.get("intent"),
        "selected_capabilities": selected,
        "deduplication": {
            "registry_capability_count": len(_RUNTIME.registry.capabilities),
            "selected_count": len(selected),
            "strategy": "REUSE_CANONICAL_REGISTRY_FIRST",
            "duplicate_creation_executed": False,
        },
        "policy": plan.get("policy"),
        "dag": {
            "steps": plan.get("steps", []),
            "step_count": len(plan.get("steps", [])),
        },
        "simulation": plan.get("simulation"),
        "database_translation": db_translation,
        "diagnostics": diagnostics,
        "validation": validation,
        "confidence": confidence,
        "grounding_guard": {
            "available": grounding_available,
            "grounded": grounding_value,
            "retrieved_count": retrieved_count,
            "reused_existing_shadow_runtime": True,
            "abstain": grounding_abstain,
        },
        "execution_dispatch": {
            "status": "NOT_INVOKED",
            "reason": "PLAN_ONLY_LIVE_BRIDGE",
            "skill_dispatcher": "AVAILABLE_GOVERNED_RUNTIME",
            "tool_gateway": "AVAILABLE_GOVERNED_RUNTIME",
        },
        "evidence": plan.get("evidence"),
        "learning": learning,
        "learning_context": {
            "attached": bool(learning_context),
            "context_count": int((learning_context or {}).get("context_count", 0) or 0),
            "read_only": bool((learning_context or {}).get("read_only", True)),
        },
        "reply_projection": {
            "base_reply_present": bool(current_reply),
            "base_reply_modified": False,
        },
        "safety": {
            "execution_authority": "NONE",
            "source_write_executed": False,
            "target_write_executed": False,
            "production_action_executed": False,
            "cutover_executed": False,
        },
    }
    _RUNTIME.telemetry.emit(
        "a000.live027.end",
        trace_id=trace_id,
        status=result["status"],
        decision=decision,
    )
    result["telemetry"] = {
        "event_count": len(_RUNTIME.telemetry.events),
        "latest": _RUNTIME.telemetry.events[-4:],
    }
    return result


def fail_closed_live_runtime(message: str, exc: Exception | str) -> Dict[str, Any]:
    return {
        "patch_id": PATCH_ID,
        "status": "REVIEW",
        "decision": "ABSTAIN_REVIEW",
        "mode": "PLAN_ONLY",
        "normal_message_path_integrated": True,
        "error": str(exc),
        "message": message,
        "safety": {
            "execution_authority": "NONE",
            "source_write_executed": False,
            "target_write_executed": False,
            "production_action_executed": False,
            "cutover_executed": False,
        },
    }
