from __future__ import annotations

from copy import deepcopy
from typing import Any, Dict, Mapping, Optional, Tuple

from .live_bridge import run_live_unified_runtime, fail_closed_live_runtime

PATCH_ID = "A000_LIFECYCLE_UNIFIED_RUNTIME_029"
HARDENING_PATCH_ID = "A000_LIFECYCLE_RUNTIME_SCHEMA_029C"

STAGES: Tuple[str, ...] = (
    "UNDERSTAND",
    "DISCOVER",
    "DETECT",
    "DIAGNOSE",
    "PREDICT",
    "RECOMMEND",
    "SIMULATE",
    "EXECUTE",
    "TEST",
    "VALIDATE",
    "RECONCILE",
    "EVIDENCE",
    "LEARN",
)

_STAGE_RESPONSIBILITY = {
    "UNDERSTAND": "Capture business context, objectives, constraints and rules.",
    "DISCOVER": "Discover systems, schemas, records, metadata and dependencies.",
    "DETECT": "Detect anomalies, gaps, violations, drift and migration risks.",
    "DIAGNOSE": "Determine root causes, affected dependencies and failure layers.",
    "PREDICT": "Estimate likely outcomes, risks, impact and readiness.",
    "RECOMMEND": "Produce evidence-backed remediation and transformation options.",
    "SIMULATE": "Evaluate proposed changes without enterprise writes.",
    "EXECUTE": "Coordinate governed execution subject to environment and approval policy.",
    "TEST": "Run deterministic tests and regression checks.",
    "VALIDATE": "Validate technical, business-rule and safety outcomes.",
    "RECONCILE": "Compare source, target and expected outcomes and explain variance.",
    "EVIDENCE": "Assemble traceable evidence, lineage, approvals and decision proof.",
    "LEARN": "Promote only verified outcomes into reusable governed knowledge.",
}

# Exact/strong route indicators first. These map existing KMITORA operational
# routes to lifecycle stages; they do not create alternate execution paths.
_ROUTE_RULES: Tuple[Tuple[str, Tuple[str, ...]], ...] = (
    ("UNDERSTAND", ("/understand", "/requirements", "/business-context", "/domain-context")),
    ("DISCOVER", ("/discovery", "/discover", "/inventory", "/schemas", "/profiling")),
    ("DETECT", ("/issues", "/detect", "/findings", "/anomalies", "/drift")),
    ("DIAGNOSE", ("/diagnose", "/diagnostics", "/root-cause", "/root_cause", "/rca")),
    ("PREDICT", ("/predict", "/prediction", "/forecast")),
    ("RECOMMEND", ("/recommend", "/recommendations", "/fix-options", "/remediation-options")),
    ("SIMULATE", ("/simulate", "/simulation", "/dry-run", "/dry_run", "/what-breaks", "/what_breaks")),
    ("EXECUTE", ("/migrations", "/execute", "/execution", "/load")),
    ("TEST", ("/tests", "/lifecycle-test", "/regression-test")),
    ("VALIDATE", ("/validate", "/validation")),
    ("RECONCILE", ("/reconcile", "/reconciliation")),
    ("EVIDENCE", ("/evidence", "/prove")),
    ("LEARN", ("/learning", "/learn", "/knowledge", "/regressions")),
)

_KIND_RULES: Tuple[Tuple[str, Tuple[str, ...]], ...] = (
    ("UNDERSTAND", ("understand", "requirement", "business_context", "domain_context")),
    ("DISCOVER", ("discover", "discovery", "inventory", "schema", "profil")),
    ("DETECT", ("detect", "issue", "finding", "anomal", "drift", "violation")),
    ("DIAGNOSE", ("diagnos", "root_cause", "root-cause", "rca")),
    ("PREDICT", ("predict", "forecast")),
    ("RECOMMEND", ("recommend", "remediation_option", "fix_option")),
    ("SIMULATE", ("simulat", "dry_run", "dry-run", "what_breaks", "what-breaks")),
    ("EXECUTE", ("migration", "execute", "execution", "load_result")),
    ("TEST", ("test_result", "test_candidate", "regression_result")),
    ("VALIDATE", ("validat",)),
    ("RECONCILE", ("reconcil",)),
    ("EVIDENCE", ("evidence", "proof")),
    ("LEARN", ("learning", "learn", "knowledge", "regression_guard")),
)

_SKIP_PATHS = {
    "/health",
    "/v1/health",
    "/v1/a000/status",
    "/v1/a000/messages",
    "/v1/a000/self-test",
    "/v1/capabilities",
    "/v1/environments",
}


def _clean_path(path: str) -> str:
    return str(path or "").split("?", 1)[0].strip().lower()


def infer_lifecycle_stage(path: str, kind: str = "") -> Optional[str]:
    """Infer the lifecycle stage without changing route ownership.

    Exact operational routes are preferred. Response-kind inference is only a
    compatibility fallback for routes whose names evolved over time.
    """
    p = _clean_path(path)
    if not p or p in _SKIP_PATHS:
        return None

    for stage, tokens in _ROUTE_RULES:
        if any(token in p for token in tokens):
            return stage

    k = str(kind or "").strip().lower()
    if not k or k == "error":
        return None
    for stage, tokens in _KIND_RULES:
        if any(token in k for token in tokens):
            return stage
    return None


def _stage_position(stage: str) -> Dict[str, Any]:
    idx = STAGES.index(stage)
    return {
        "number": idx + 1,
        "total": len(STAGES),
        "previous": STAGES[idx - 1] if idx > 0 else None,
        "next": STAGES[idx + 1] if idx + 1 < len(STAGES) else None,
    }


def _summary(unified: Mapping[str, Any]) -> Dict[str, Any]:
    safety = dict(unified.get("safety") or {})
    evidence = dict(unified.get("evidence") or {})
    confidence = dict(unified.get("confidence") or {})
    validation = dict(unified.get("validation") or {})
    dedup = dict(unified.get("deduplication") or {})
    db = dict(unified.get("database_translation") or {})
    return {
        "unified_patch_id": unified.get("patch_id"),
        "trace_id": unified.get("trace_id"),
        "status": unified.get("status", "REVIEW"),
        "decision": unified.get("decision", "ABSTAIN_REVIEW"),
        "mode": unified.get("mode", "PLAN_ONLY"),
        "intent": unified.get("intent"),
        "selected_capabilities": list(unified.get("selected_capabilities") or []),
        "deduplication": {
            "strategy": dedup.get("strategy", "REUSE_CANONICAL_REGISTRY_FIRST"),
            "selected_count": int(dedup.get("selected_count", 0) or 0),
            "duplicate_creation_executed": bool(dedup.get("duplicate_creation_executed", False)),
        },
        "dag_step_count": int((unified.get("dag") or {}).get("step_count", 0) or 0),
        "simulation_status": (unified.get("simulation") or {}).get("status"),
        "database_translation": {
            "status": db.get("status", "NOT_REQUESTED"),
            "production_writes": int(db.get("production_writes", 0) or 0),
        },
        "validation_status": validation.get("status"),
        "confidence": confidence,
        "evidence_id": evidence.get("evidence_id"),
        "learning": unified.get("learning"),
        "safety": {
            "execution_authority": safety.get("execution_authority", "NONE"),
            "source_write_executed": bool(safety.get("source_write_executed", False)),
            "target_write_executed": bool(safety.get("target_write_executed", False)),
            "production_action_executed": bool(safety.get("production_action_executed", False)),
            "cutover_executed": bool(safety.get("cutover_executed", False)),
        },
    }


def project_lifecycle_response(
    *,
    path: str,
    code: int,
    envelope_obj: Mapping[str, Any],
) -> Dict[str, Any]:
    """Attach a read-only A000 projection to recognized lifecycle responses.

    The existing response payload remains authoritative and unchanged except for
    one additive `lifecycle_runtime` field. Guarded/error lifecycle responses are
    also projected so A000 can explain the failed gate without bypassing it.
    Non-lifecycle routes remain untouched.
    """
    original: Dict[str, Any] = deepcopy(dict(envelope_obj))

    kind = str(original.get("kind") or "")
    stage = infer_lifecycle_stage(path, kind)
    if stage is None:
        return original

    payload = original.get("payload")
    if not isinstance(payload, Mapping):
        return original
    payload_out: Dict[str, Any] = deepcopy(dict(payload))

    # Never double-attach if a response is passed through the send path twice.
    existing = payload_out.get("lifecycle_runtime")
    if isinstance(existing, Mapping) and existing.get("patch_id") == PATCH_ID:
        return original

    is_error = int(code) >= 400
    request_context: Dict[str, Any] = {
        "message": f"{stage} lifecycle operation" + (" guarded/error response" if is_error else ""),
        "objective": f"Govern and evaluate KMITORA lifecycle stage {stage}",
        "environment": str(payload_out.get("environment") or "DEV"),
        "risk": str(payload_out.get("risk") or payload_out.get("severity") or ("HIGH" if is_error else "LOW")),
        "domain": str(payload_out.get("domain") or ""),
        "technology": str(payload_out.get("technology") or ""),
        "business_rules": list(payload_out.get("business_rules") or [])
        if isinstance(payload_out.get("business_rules"), list)
        else [],
        "constraints": [
            "Reuse canonical registry before creating functionality",
            "Preserve existing lifecycle response as authoritative",
            "No production action from lifecycle projection",
            "Preserve guarded/error response and never convert it into execution authority",
        ],
    }

    try:
        unified = run_live_unified_runtime(
            message=request_context["message"],
            request=request_context,
            current_reply=payload_out,
            learning_context=None,
        )
    except Exception as exc:  # governed fail-closed projection
        unified = fail_closed_live_runtime(request_context["message"], exc)

    runtime = {
        "patch_id": PATCH_ID,
        "hardening_patch_id": HARDENING_PATCH_ID,
        "stage": stage,
        "stage_position": _stage_position(stage),
        "responsibility": _STAGE_RESPONSIBILITY[stage],
        "route": _clean_path(path),
        "response_kind": kind,
        "integration": "ADDITIVE_READ_ONLY_PROJECTION",
        "authoritative_payload_preserved": True,
        "response_status_code": int(code),
        "guarded_or_error_response": is_error,
        "backbone": "A000_E2E_INTELLIGENCE_013_026",
        "live_runtime": "A000_LIVE_UNIFIED_RUNTIME_027_028A",
        **_summary(unified),
    }

    payload_out["lifecycle_runtime"] = runtime
    original["payload"] = payload_out
    return original


def coverage_status() -> Dict[str, Any]:
    return {
        "patch_id": PATCH_ID,
        "stage_count": len(STAGES),
        "stages": [
            {
                "number": i + 1,
                "stage": stage,
                "responsibility": _STAGE_RESPONSIBILITY[stage],
            }
            for i, stage in enumerate(STAGES)
        ],
        "integration": "CENTRAL_RESPONSE_PROJECTION",
        "duplicate_lifecycle_engines_created": False,
        "execution_authority": "NONE",
        "source_write_executed": False,
        "target_write_executed": False,
        "production_action_executed": False,
        "cutover_executed": False,
    }
