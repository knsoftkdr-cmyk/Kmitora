from __future__ import annotations

from dataclasses import asdict, dataclass
from hashlib import sha256
import json
import math
import re
from typing import Any

from kmitora_assistant_audit import append_audit_event
from kmitora_assistant_capabilities import catalog as capability_catalog, summary as capability_summary
from kmitora_assistant_security import detect_prompt_injection, permission_profile, redact_text, sanitize_context


@dataclass(frozen=True)
class AssistantRecommendation:
    id: str
    priority: str
    title: str
    reason: str
    category: str
    navigation_key: str | None = None
    impact: int = 3
    risk: int = 3
    effort: int = 2
    confidence: float = 0.75


@dataclass(frozen=True)
class AssistantAction:
    id: str
    label: str
    kind: str
    navigation_key: str | None
    execution_mode: str
    requires_approval: bool
    source_write: bool = False
    target_write: bool = False
    production_action: bool = False
    reversible: bool = True
    preview_required: bool = False
    expected_result: str = ""


LIFECYCLE = [
    "understand", "discover", "detect", "diagnose", "predict", "recommend",
    "simulate", "execute", "test", "validate", "reconcile", "evidence", "learn",
]

MODE_ALIASES = {
    "ask": "ASK", "explain": "EXPLAIN", "analyze": "ANALYZE", "analyse": "ANALYZE",
    "recommend": "RECOMMEND", "next": "NEXT_ACTION", "troubleshoot": "TROUBLESHOOT",
    "compare": "COMPARE", "investigate": "INVESTIGATE", "plan": "PLAN",
    "validate": "VALIDATE", "evidence": "EVIDENCE", "executive": "EXECUTIVE",
    "technical": "TECHNICAL", "engineer": "TECHNICAL", "a000": "A000",
}


def _walk(value: Any):
    if isinstance(value, dict):
        for key, child in value.items():
            yield str(key), child
            yield from _walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from _walk(child)


def _norm_key(value: str) -> str:
    return value.lower().replace("-", "_").replace(" ", "_")


def _number(value: Any) -> int | float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)) and math.isfinite(float(value)):
        return value
    if isinstance(value, str):
        raw = value.strip().replace(",", "")
        if re.fullmatch(r"-?\d+(?:\.\d+)?", raw):
            try:
                return float(raw) if "." in raw else int(raw)
            except ValueError:
                return None
    return None


def _lookup_number(root: Any, aliases: tuple[str, ...]) -> int | float | None:
    wanted = {_norm_key(x) for x in aliases}
    for key, value in _walk(root):
        if _norm_key(key) in wanted:
            n = _number(value)
            if n is not None:
                return n
    return None


def _lookup_text(root: Any, aliases: tuple[str, ...]) -> str | None:
    wanted = {_norm_key(x) for x in aliases}
    for key, value in _walk(root):
        if _norm_key(key) in wanted and isinstance(value, (str, int, float, bool)):
            text = str(value).strip()
            if text:
                return text
    return None


def _lookup_bool(root: Any, aliases: tuple[str, ...]) -> bool | None:
    wanted = {_norm_key(x) for x in aliases}
    for key, value in _walk(root):
        if _norm_key(key) not in wanted:
            continue
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            lower = value.strip().lower()
            if lower in {"true", "yes", "1", "enabled", "executed", "active", "healthy", "ready"}:
                return True
            if lower in {"false", "no", "0", "disabled", "none", "not_executed", "unhealthy", "failed"}:
                return False
    return None


def _metric_bundle(discovery: dict[str, Any] | None, ui_state: dict[str, Any]) -> dict[str, Any]:
    combined = {"discovery": discovery or {}, "ui_state": ui_state}
    ready = _lookup_number(combined, ("ready", "ready_count", "records_ready"))
    review = _lookup_number(combined, ("review", "review_count", "records_review"))
    rejected = _lookup_number(combined, ("rejected", "rejected_count", "records_rejected"))
    quarantine = _lookup_number(combined, ("quarantine", "quarantined", "quarantine_count"))
    dependencies = _lookup_number(combined, ("dependencies", "dependency_count", "dependencies_count"))
    total = _lookup_number(combined, ("totalplanned", "total_planned", "total_records", "record_count", "records"))
    scoped = _lookup_number(combined, ("scoped_records", "scoped_record_count", "discovery_scoped_records", "scoped"))
    staging = _lookup_number(combined, ("classified_records", "authoritative_staging_count", "staging_count", "classified"))
    target = _lookup_number(combined, ("target_records", "target_count", "loaded_records", "migrated_records"))
    if total is None and all(x is not None for x in (ready, review, rejected, quarantine)):
        total = sum(float(x or 0) for x in (ready, review, rejected, quarantine))
        if float(total).is_integer():
            total = int(total)
    return {
        "ready": ready, "review": review, "rejected": rejected, "quarantine": quarantine,
        "dependencies": dependencies, "total": total, "scoped_records": scoped,
        "authoritative_staging_records": staging, "target_records": target,
    }


def _current_stage(requested_stage: str, ui_state: dict[str, Any]) -> str:
    stage = (requested_stage or "").strip().lower()
    if stage:
        return stage
    outputs = ui_state.get("stage_outputs")
    if isinstance(outputs, dict):
        for candidate in reversed(LIFECYCLE):
            if candidate in outputs:
                return candidate
    return "overview"


def _next_stage(stage: str) -> str:
    try:
        return LIFECYCLE[min(LIFECYCLE.index(stage) + 1, len(LIFECYCLE) - 1)]
    except ValueError:
        return "discover"


def _navigation_for_stage(stage: str) -> str:
    allowed = set(LIFECYCLE) | {"overview", "transform", "approvals", "agents", "activity"}
    return stage if stage in allowed else "overview"


def _role(request_context: dict[str, Any]) -> str:
    raw = str(request_context.get("role") or request_context.get("assistant_role") or "ENGINEER").strip().upper()
    aliases = {"DEVELOPER": "ENGINEER", "TECHNICAL": "ENGINEER", "EXEC": "EXECUTIVE"}
    return aliases.get(raw, raw or "ENGINEER")


def _environment(request_context: dict[str, Any], ui_state: dict[str, Any]) -> str:
    raw = str(request_context.get("environment") or ui_state.get("environment") or "DEV").strip().upper()
    return raw if raw in {"DEV", "QA", "UAT", "PROD"} else "DEV"


def _mode(message: str, request_context: dict[str, Any]) -> str:
    explicit = str(request_context.get("mode") or "").strip().lower()
    if explicit in MODE_ALIASES:
        return MODE_ALIASES[explicit]
    lower = message.lower()
    for token, mapped in MODE_ALIASES.items():
        if lower.startswith(f"/{token}") or re.search(rf"\b{re.escape(token)}\b", lower):
            return mapped
    if "why" in lower or "blocked" in lower or "error" in lower or "failed" in lower:
        return "TROUBLESHOOT"
    if "should i" in lower or "next" in lower or "what now" in lower:
        return "NEXT_ACTION"
    if "ready" in lower or "can we migrate" in lower:
        return "VALIDATE"
    return "ASK"


def _intent(message: str, mode: str) -> str:
    lower = message.lower()
    if detect_prompt_injection(message)["detected"]:
        return "SECURITY_REVIEW"
    if "why" in lower and ("block" in lower or "fail" in lower):
        return "EXPLAIN_BLOCKERS"
    if "can we migrate" in lower or "ready" in lower:
        return "READINESS"
    if "what should" in lower or "next action" in lower or "what next" in lower:
        return "NEXT_ACTION"
    if "compare" in lower:
        return "COMPARE"
    if "trace" in lower or "lineage" in lower or "where did" in lower:
        return "TRACE"
    if "rule" in lower:
        return "BUSINESS_RULES"
    if "mapping" in lower:
        return "MAPPING"
    if "reconcile" in lower:
        return "RECONCILIATION"
    if "cost" in lower:
        return "COST"
    if "performance" in lower or "slow" in lower:
        return "PERFORMANCE"
    return mode


def _constraints(request_context: dict[str, Any], environment: str) -> list[str]:
    raw = request_context.get("constraints")
    values = [str(x).strip() for x in raw] if isinstance(raw, list) else []
    defaults = ["NO_SOURCE_WRITES", "NO_PRODUCTION_ACTIONS", "NO_CUTOVER"]
    if environment == "DEV":
        defaults.append("DEV_ONLY")
    merged: list[str] = []
    for item in defaults + values:
        upper = item.upper().replace(" ", "_")
        if upper and upper not in merged:
            merged.append(upper)
    return merged


def _source_hierarchy(discovery: dict[str, Any] | None, ui_state: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        {"rank": 1, "source": "AUTHORITATIVE_BACKEND_DISCOVERY", "available": bool(discovery)},
        {"rank": 2, "source": "PERSISTENT_LIFECYCLE_STATE", "available": bool(ui_state)},
        {"rank": 3, "source": "REQUEST_CONTEXT", "available": True},
        {"rank": 4, "source": "BROWSER_CACHE", "available": False, "advisory_only": True},
    ]


def _evidence_refs(discovery: dict[str, Any] | None, ui_state: dict[str, Any], migration_id: str) -> list[dict[str, str]]:
    refs: list[dict[str, str]] = []
    if discovery:
        refs.append({"type": "DISCOVERY", "ref": migration_id or "LATEST", "authority": "AUTHORITATIVE"})
    if ui_state:
        refs.append({"type": "LIFECYCLE_STATE", "ref": migration_id or "ACTIVE", "authority": "PERSISTENT"})
    if not refs:
        refs.append({"type": "REQUEST", "ref": "CURRENT", "authority": "LIMITED"})
    return refs


def _collect_blockers(metrics: dict[str, Any], discovery: dict[str, Any] | None, ui_state: dict[str, Any]) -> list[dict[str, Any]]:
    blockers: list[dict[str, Any]] = []
    scoped = metrics.get("scoped_records")
    staging = metrics.get("authoritative_staging_records")
    if scoped is not None and staging is not None and scoped != staging:
        blockers.append({
            "id": "BLK-SCOPE-MISMATCH", "severity": "CRITICAL", "category": "DISCOVERY",
            "message": f"Authoritative scope mismatch: Unified Discovery has {int(scoped)} scoped records while authoritative staging has {int(staging)}.",
            "root_cause_hint": "Discovery scope/filter or authoritative staging synchronization does not represent the same population.",
            "navigation_key": "discover",
        })
    rejected = metrics.get("rejected") or 0
    if rejected > 0:
        blockers.append({
            "id": "BLK-REJECTED", "severity": "HIGH", "category": "DATA_QUALITY",
            "message": f"{int(rejected)} rejected record(s) require evidence-backed disposition.",
            "root_cause_hint": "Review rule, required-field, mapping or data-quality rejection reasons.",
            "navigation_key": "validate",
        })
    review = metrics.get("review") or 0
    if review > 0:
        blockers.append({
            "id": "BLK-REVIEW", "severity": "HIGH", "category": "DATA_QUALITY",
            "message": f"{int(review)} record(s) remain in review.",
            "root_cause_hint": "Ambiguous or policy-dependent records require governed review.",
            "navigation_key": "validate",
        })
    status = _lookup_text(discovery or {}, ("status", "execution_status", "migration_status"))
    if status and status.upper() in {"BLOCKED", "FAILED", "ERROR"}:
        blockers.append({
            "id": "BLK-RUNTIME-STATUS", "severity": "CRITICAL", "category": "RUNTIME",
            "message": f"Authoritative discovery/runtime status is {status.upper()}.",
            "root_cause_hint": "Inspect the latest authoritative runtime evidence before any governed execution.",
            "navigation_key": "diagnose",
        })
    service_health = _lookup_text(ui_state, ("service_health", "health_status", "runtime_health"))
    if service_health and service_health.upper() in {"DOWN", "UNHEALTHY", "FAILED"}:
        blockers.append({
            "id": "BLK-HEALTH", "severity": "CRITICAL", "category": "HEALTH",
            "message": f"Runtime health is {service_health.upper()}.",
            "root_cause_hint": "Restore required Core/Source/Target services before migration actions.",
            "navigation_key": "overview",
        })
    return blockers


def _readiness(metrics: dict[str, Any], blockers: list[dict[str, Any]], authoritative: bool) -> dict[str, Any]:
    score = 100.0
    weights = {"CRITICAL": 30, "HIGH": 15, "MEDIUM": 7, "LOW": 2}
    for blocker in blockers:
        score -= weights.get(str(blocker.get("severity")), 5)
    if not authoritative:
        score = min(score, 55)
    ready = metrics.get("ready")
    total = metrics.get("total")
    if ready is not None and total:
        score = min(score, 50 + 50 * (float(ready) / max(float(total), 1.0)))
    score = round(max(0.0, min(100.0, score)), 1)
    state = "READY_FOR_NEXT_GOVERNED_CHECK" if not blockers and authoritative else "BLOCKED" if blockers else "INSUFFICIENT_EVIDENCE"
    return {
        "score": score,
        "state": state,
        "dimensions": {
            "authoritative_context": 100 if authoritative else 25,
            "data_quality": max(0, 100 - 20 * len([b for b in blockers if b["category"] == "DATA_QUALITY"])),
            "scope_consistency": 100 if not any(b["id"] == "BLK-SCOPE-MISMATCH" for b in blockers) else 0,
            "runtime_health": 100 if not any(b["category"] == "HEALTH" for b in blockers) else 0,
            "governance": 100,
        },
    }


def _confidence(authoritative: bool, blockers: list[dict[str, Any]], metrics: dict[str, Any]) -> dict[str, Any]:
    evidence_points = sum(v is not None for v in metrics.values())
    score = 0.45 + (0.25 if authoritative else 0) + min(0.20, evidence_points * 0.025) + (0.05 if blockers else 0)
    score = round(min(score, 0.98), 2)
    label = "HIGH" if score >= 0.8 else "MEDIUM" if score >= 0.6 else "LOW"
    return {"score": score, "label": label, "basis": f"authoritative={authoritative}; evidence_metrics={evidence_points}; blockers={len(blockers)}"}


def _risk(metrics: dict[str, Any], blockers: list[dict[str, Any]]) -> dict[str, Any]:
    critical = len([b for b in blockers if b["severity"] == "CRITICAL"])
    high = len([b for b in blockers if b["severity"] == "HIGH"])
    rejected = int(metrics.get("rejected") or 0)
    review = int(metrics.get("review") or 0)
    score = min(100, critical * 35 + high * 15 + min(20, rejected * 3 + review))
    level = "CRITICAL" if score >= 70 else "HIGH" if score >= 45 else "MEDIUM" if score >= 20 else "LOW"
    return {"score": score, "level": level, "drivers": [b["id"] for b in blockers]}


def _recommendations(stage: str, metrics: dict[str, Any], blockers: list[dict[str, Any]], confidence: dict[str, Any]) -> list[AssistantRecommendation]:
    recs: list[AssistantRecommendation] = []
    for blocker in blockers:
        bid = blocker["id"]
        if bid == "BLK-SCOPE-MISMATCH":
            recs.append(AssistantRecommendation("REC-SCOPE-SYNC", "HIGH", "Reconcile authoritative record scope", blocker["root_cause_hint"], "DISCOVERY", "discover", 5, 5, 3, confidence["score"]))
        elif bid == "BLK-REJECTED":
            recs.append(AssistantRecommendation("REC-REJECTED", "HIGH", "Investigate rejected records", blocker["root_cause_hint"], "DATA_QUALITY", "validate", 5, 4, 2, confidence["score"]))
        elif bid == "BLK-REVIEW":
            recs.append(AssistantRecommendation("REC-REVIEW", "HIGH", "Resolve review queue", blocker["root_cause_hint"], "DATA_QUALITY", "validate", 4, 3, 2, confidence["score"]))
        elif bid == "BLK-HEALTH":
            recs.append(AssistantRecommendation("REC-HEALTH", "HIGH", "Restore runtime health", blocker["root_cause_hint"], "OPERATIONS", "overview", 5, 5, 2, confidence["score"]))
    if not blockers:
        nxt = _next_stage(stage)
        recs.append(AssistantRecommendation("REC-NEXT", "MEDIUM", f"Continue to {nxt.title()}", "No blocker is proven from the current authoritative context.", "LIFECYCLE", _navigation_for_stage(nxt), 4, 2, 1, confidence["score"]))
    recs.append(AssistantRecommendation("REC-EVIDENCE", "MEDIUM", "Preserve correlated evidence", "Keep discovery, business rules, mapping, validation, approvals, execution and reconciliation evidence linked to the active migration id.", "GOVERNANCE", "evidence", 4, 2, 2, 0.95))
    # Rank by impact/risk/confidence versus effort, then deduplicate by title.
    unique: dict[str, AssistantRecommendation] = {}
    for rec in recs:
        unique.setdefault(rec.title.lower(), rec)
    ranked = sorted(unique.values(), key=lambda r: (r.impact * 2 + r.risk + r.confidence * 5 - r.effort), reverse=True)
    return ranked[:6]


def _actions(stage: str, blockers: list[dict[str, Any]], permissions: dict[str, bool]) -> list[AssistantAction]:
    actions: list[AssistantAction] = []
    if blockers:
        actions.extend([
            AssistantAction("ACT-DIAGNOSE", "Ask A000 to Diagnose", "ASSISTANT", "diagnose", "NAVIGATE", False, expected_result="Open evidence-first diagnosis for current blockers."),
            AssistantAction("ACT-COMPARE-SCOPE", "Compare Authoritative Scope", "NAVIGATION", "discover", "NAVIGATE", False, expected_result="Inspect discovery and staging populations side-by-side."),
            AssistantAction("ACT-VALIDATE", "Review Exceptions", "NAVIGATION", "validate", "NAVIGATE", False, expected_result="Inspect review/rejected records and validation evidence."),
        ])
        if permissions.get("simulate"):
            actions.append(AssistantAction("ACT-SAFE-REMEDIATION", "Simulate Safe Remediation", "SIMULATION", None, "SAFE_REMEDIATION_SIMULATION", False, reversible=True, preview_required=True, expected_result="Produce non-writing remediation plan and preserved governed actions."))
    else:
        nxt = _next_stage(stage)
        actions.append(AssistantAction("ACT-NEXT", f"Continue to {nxt.title()}", "NAVIGATION", _navigation_for_stage(nxt), "NAVIGATE", False, expected_result=f"Open the {nxt} lifecycle stage."))
        actions.append(AssistantAction("ACT-EVIDENCE", "Open Evidence", "NAVIGATION", "evidence", "NAVIGATE", False, expected_result="Review correlated migration evidence."))
    return actions[:5]


def _root_cause_graph(blockers: list[dict[str, Any]]) -> dict[str, Any]:
    nodes = [{"id": "CURRENT_MIGRATION", "type": "MIGRATION", "label": "Current migration"}]
    edges: list[dict[str, str]] = []
    for blocker in blockers:
        node_id = blocker["id"]
        nodes.append({"id": node_id, "type": blocker["category"], "label": blocker["message"]})
        edges.append({"from": node_id, "to": "CURRENT_MIGRATION", "relation": "BLOCKS"})
    return {"nodes": nodes, "edges": edges}


def _model_route(message: str, blockers: list[dict[str, Any]], mode: str) -> dict[str, Any]:
    complexity = len(message) + len(blockers) * 120
    if mode in {"ANALYZE", "TROUBLESHOOT", "A000", "PLAN"} or complexity > 700:
        tier = "DEEP_REASONING"
    elif complexity > 250:
        tier = "STANDARD_REASONING"
    else:
        tier = "FAST_DETERMINISTIC"
    return {"tier": tier, "reason": f"mode={mode}; context_complexity={complexity}", "provider": "A000_CONFIGURED_RUNTIME" if tier != "FAST_DETERMINISTIC" else "KMITORA_RULE_ENGINE"}


def _incremental_analysis(request_context: dict[str, Any], metrics: dict[str, Any]) -> dict[str, Any]:
    changed = request_context.get("changed_entities")
    if isinstance(changed, list) and changed:
        return {"mode": "DELTA_ONLY", "changed_entities": changed[:100], "full_rescan_required": False}
    return {"mode": "AUTHORITATIVE_SUMMARY", "changed_entities": [], "full_rescan_required": False, "records_observed": metrics.get("total")}


def _goal_plan(stage: str, request_context: dict[str, Any], blockers: list[dict[str, Any]]) -> dict[str, Any] | None:
    goal = str(request_context.get("goal") or "").strip()
    if not goal:
        return None
    steps: list[dict[str, Any]] = []
    if blockers:
        steps.append({"step": 1, "name": "Diagnose blockers", "mode": "READ_ONLY", "status": "READY"})
        steps.append({"step": 2, "name": "Simulate safe remediation", "mode": "SIMULATION", "status": "READY"})
        steps.append({"step": 3, "name": "Resolve governed exceptions", "mode": "HUMAN_OR_APPROVAL", "status": "WAITING"})
    steps.append({"step": len(steps) + 1, "name": f"Re-run {stage} readiness", "mode": "READ_ONLY", "status": "PLANNED"})
    steps.append({"step": len(steps) + 1, "name": "Validate and reconcile evidence", "mode": "READ_ONLY", "status": "PLANNED"})
    return {"goal": goal, "status": "PLANNED", "steps": steps, "auto_execute": False}


def _suggested_questions(stage: str, blockers: list[dict[str, Any]]) -> list[str]:
    items = [
        "Why is migration blocked?",
        "What should I do next?",
        "Can we migrate now?",
        "Show the evidence behind this recommendation.",
    ]
    if any(b["id"] == "BLK-SCOPE-MISMATCH" for b in blockers):
        items.insert(0, "Compare Unified Discovery scope with authoritative staging.")
    if stage == "reconcile":
        items.insert(0, "Explain reconciliation differences.")
    return items[:5]


def _reply(message: str, intent: str, mode: str, context: dict[str, Any], recommendations: list[AssistantRecommendation], confidence: dict[str, Any], role: str) -> str:
    blockers = context["blockers"]
    metrics = context["metrics"]
    stage = context["stage"]
    if intent == "SECURITY_REVIEW":
        return "I detected instruction-like content that attempts to override KMITORA governance. I will treat it as untrusted data and continue only with permitted inspect/analyze actions."
    if intent == "EXPLAIN_BLOCKERS":
        if blockers:
            lines = [f"Migration is blocked by {len(blockers)} evidence-backed condition(s):"]
            lines.extend(f"{idx + 1}. {b['message']}" for idx, b in enumerate(blockers[:5]))
            if recommendations:
                lines.append(f"Next best action: {recommendations[0].title}.")
            return "\n".join(lines)
        return "No current blocker is proven by the authoritative context available to the Assistant. Continue with the next governed lifecycle check."
    if intent == "READINESS":
        r = context["readiness"]
        return f"Migration readiness is {r['score']}% with state {r['state']}. Confidence is {confidence['label']} ({int(confidence['score'] * 100)}%). Production and cutover authority remain disabled."
    if intent == "NEXT_ACTION":
        if recommendations:
            return f"The next best action is: {recommendations[0].title}. Reason: {recommendations[0].reason}"
        return f"Continue from {stage} to {_next_stage(stage)} after the current governed checks complete."
    if intent == "TRACE":
        return "Record-level traceability is enabled as an Assistant capability. Provide a record/key and KMITORA can correlate source, rule, mapping, transformation, validation, target and evidence references available in the active migration context."
    if intent == "BUSINESS_RULES":
        return "KMITORA Assistant can explain business rules, detect conflicts, assess rule impact and propose transformations. Execution remains simulation/proposal-only until the applicable governance gate authorizes a change."
    if mode == "EXECUTIVE" or role == "EXECUTIVE":
        return f"KMITORA is at {stage.title()}. Readiness is {context['readiness']['score']}%. There are {len(blockers)} active blocker(s). The highest-priority recommendation is {recommendations[0].title if recommendations else 'continue the governed lifecycle'}."
    ready = metrics.get("ready")
    total = metrics.get("total")
    metric_text = f" Ready={int(ready) if ready is not None else 'unknown'}; Total={int(total) if total is not None else 'unknown'}."
    return f"Current stage: {stage}. Status: {context['status']}.{metric_text} Confidence={confidence['label']}. Ask me to diagnose, compare, trace, validate, recommend, plan, or explain evidence."


def build_assistant_response(
    message: str,
    *,
    stage: str = "",
    ui_state: dict[str, Any] | None = None,
    discovery: dict[str, Any] | None = None,
    request_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    ui_state = ui_state if isinstance(ui_state, dict) else {}
    request_context = request_context if isinstance(request_context, dict) else {}
    role = _role(request_context)
    env = _environment(request_context, ui_state)
    sanitized_message, sensitive_findings = redact_text(str(message or ""), mask_pii=role not in {"DBA", "DATA_STEWARD", "AUDITOR_PRIVILEGED"})
    injection = detect_prompt_injection(sanitized_message)
    safe_discovery = sanitize_context(discovery or {}, role=role)
    safe_ui_state = sanitize_context(ui_state, role=role)
    migration_id = str(
        request_context.get("migration_id")
        or safe_discovery.get("migration_id")
        or safe_ui_state.get("active_migration_id")
        or ""
    ).strip()
    current_stage = _current_stage(stage, safe_ui_state)
    current_mode = _mode(sanitized_message, request_context)
    current_intent = _intent(sanitized_message, current_mode)
    metrics = _metric_bundle(safe_discovery, safe_ui_state)
    blockers = _collect_blockers(metrics, safe_discovery, safe_ui_state)
    authoritative = bool(discovery)
    readiness = _readiness(metrics, blockers, authoritative)
    confidence = _confidence(authoritative, blockers, metrics)
    risk = _risk(metrics, blockers)
    permissions = permission_profile(role, env)
    constraints = _constraints(request_context, env)
    recs = _recommendations(current_stage, metrics, blockers, confidence)
    actions = _actions(current_stage, blockers, permissions)
    evidence = _evidence_refs(safe_discovery, safe_ui_state, migration_id)
    context_hash = sha256(json.dumps({"metrics": metrics, "blockers": blockers, "stage": current_stage, "migration_id": migration_id}, sort_keys=True, default=str).encode()).hexdigest()
    response_context = {
        "migration_id": migration_id or None,
        "stage": current_stage,
        "status": readiness["state"],
        "role": role,
        "environment": env,
        "mode": current_mode,
        "intent": current_intent,
        "metrics": metrics,
        "blockers": blockers,
        "authoritative_context_available": authoritative,
        "source_of_truth": _source_hierarchy(safe_discovery, safe_ui_state),
        "readiness": readiness,
        "risk": risk,
        "context_hash": context_hash,
    }
    reply = _reply(sanitized_message, current_intent, current_mode, response_context, recs, confidence, role)
    response: dict[str, Any] = {
        "reply": reply,
        "voice_reply": reply.replace("\n", " "),
        "intent": current_intent,
        "mode": current_mode,
        "context": response_context,
        "recommendations": [asdict(x) for x in recs],
        "next_actions": [asdict(x) for x in actions],
        "suggested_questions": _suggested_questions(current_stage, blockers),
        "confidence": confidence,
        "evidence": {"refs": evidence, "grounding_required": True, "insufficient_evidence_behavior": "STATE_LIMITATION_DO_NOT_INVENT"},
        "root_cause_graph": _root_cause_graph(blockers),
        "goal_plan": _goal_plan(current_stage, request_context, blockers),
        "constraints": constraints,
        "permissions": permissions,
        "security": {
            "prompt_injection": injection,
            "sensitive_findings": sensitive_findings,
            "pii_masking_active": role not in {"DBA", "DATA_STEWARD", "AUDITOR_PRIVILEGED"},
            "secrets_redacted": True,
        },
        "safety": {
            "source_write_executed": False,
            "target_write_executed": False,
            "production_action_executed": False,
            "cutover_authorized": False,
            "dual_control_required_for_future_production": True,
            "action_sequence": ["ASK", "ANALYZE", "RECOMMEND", "SIMULATE", "PROPOSE_ACTION", "AUTHORIZE", "EXECUTE", "VERIFY", "RECONCILE", "EVIDENCE"],
        },
        "model_route": _model_route(sanitized_message, blockers, current_mode),
        "incremental_analysis": _incremental_analysis(request_context, metrics),
        "cache": {"key": context_hash[:24], "safe_to_reuse_if_context_hash_unchanged": True},
        "observability": {
            "trace_id": f"KA-{context_hash[:16]}",
            "capabilities_considered": 100,
            "blocker_count": len(blockers),
            "recommendation_count": len(recs),
            "action_count": len(actions),
        },
        "capability_registry": capability_summary(),
        "capabilities": capability_catalog() if bool(request_context.get("include_capability_catalog")) else [],
        "explainability": {
            "basis": "Authoritative discovery + persistent lifecycle context + deterministic KMITORA Assistant policies.",
            "why_this_answer": [b["message"] for b in blockers[:5]] or ["No blocker was proven from current authoritative context."],
            "recommendation_ranking": "impact*2 + risk + confidence*5 - effort",
        },
        "watch": {
            "enabled": bool(request_context.get("watch_mode")),
            "signals": ["DISCOVERY_CHANGED", "VALIDATION_CHANGED", "RUNTIME_HEALTH_CHANGED", "APPROVAL_CHANGED", "RECONCILIATION_CHANGED"],
            "proactive_alerts": True,
        },
        "external_runtime_requirements": {
            "voice": "Requires configured browser/device speech layer.",
            "screenshots": "Requires screen/screenshot context to be supplied to A000.",
            "multi_agent_debate": "Requires configured A000 specialist-agent runtime.",
            "digital_twin": "Requires configured KMITORA digital-twin runtime.",
            "production_dual_control": "Intentionally not granted by Assistant; requires external authorization workflow.",
        },
    }
    try:
        audit = append_audit_event({
            "event_type": "ASSISTANT_RESPONSE",
            "trace_id": response["observability"]["trace_id"],
            "migration_id": migration_id or None,
            "stage": current_stage,
            "intent": current_intent,
            "mode": current_mode,
            "role": role,
            "environment": env,
            "context_hash": context_hash,
            "blockers": [b["id"] for b in blockers],
            "actions": [a.id for a in actions],
            "source_write_executed": False,
            "target_write_executed": False,
            "production_action_executed": False,
        })
        response["audit"] = {"recorded": True, "event_hash": audit["event_hash"], "previous_hash": audit["previous_hash"]}
    except Exception as exc:
        response["audit"] = {"recorded": False, "error": str(exc), "response_not_blocked": True}
    return response
