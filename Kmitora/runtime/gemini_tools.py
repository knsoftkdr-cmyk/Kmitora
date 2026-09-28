"""Gemini function declarations and executors for KMITORA document-driven DEV migrations.

Every tool maps onto an endpoint that already exists in the Source API
(kmitora_source_api.py), Target API (kmitora_target_api.py) or Core API
(F1033_server.py). Service ports are read live from runtime/port_state/ on
every call, so the self-healing port fallback keeps working.

Tools are grouped into gated phases. document_flow.py only executes a gated
tool after the user confirmed that phase in chat:

    CONNECT  -> create_source_connection, create_target_connection
    VALIDATE -> discover_source_schema, apply_business_rules
    MIGRATE  -> run_dev_migration
    READ     -> get_migration_evidence (read-only, never gated)

Production mutation and cutover are never reachable from here: targets are
forced to environment DEV, executions are DEV only, and any argument that
asks for anything else is refused before a request is sent.
"""
from __future__ import annotations

import json
import re
import time
import uuid
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

PROJECT_ROOT = Path(__file__).resolve().parents[1]
PORT_STATE_DIR = PROJECT_ROOT / "runtime" / "port_state"
# Same defaults the services themselves bind to when no port_state file exists.
DEFAULT_PORTS = {"core": 8080, "source": 8081, "target": 8082}

PHASE_CONNECT = "CONNECT"
PHASE_VALIDATE = "VALIDATE"
PHASE_MIGRATE = "MIGRATE"
PHASE_READ = "READ"
GATED_PHASES = [PHASE_CONNECT, PHASE_VALIDATE, PHASE_MIGRATE]
PHASE_TITLES = {
    PHASE_CONNECT: "Create source and target connections",
    PHASE_VALIDATE: "Discover source schema and validate business rules",
    PHASE_MIGRATE: "Run the governed DEV migration",
}

APPROVER = "KMITORA Assistant (DEV operator confirmation in chat)"
DB_TYPES = ["mysql", "postgresql", "oracle", "sqlserver", "snowflake"]


class ToolError(Exception):
    """A tool call that must not (or could not) be executed. The message is returned to Gemini."""


# ---------------------------------------------------------------------------
# Service access
# ---------------------------------------------------------------------------

def service_port(service: str) -> int:
    try:
        data = json.loads((PORT_STATE_DIR / f"{service}.json").read_text(encoding="utf-8"))
        if isinstance(data.get("port"), int):
            return data["port"]
    except (OSError, ValueError):
        pass
    return DEFAULT_PORTS[service]


def service_url(service: str) -> str:
    return f"http://127.0.0.1:{service_port(service)}"


def call_api(service: str, method: str, path: str, body: Any = None, timeout: int = 180) -> tuple[int, Any]:
    url = service_url(service) + path
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = Request(url, data=data, method=method, headers={"Content-Type": "application/json"})
    try:
        with urlopen(req, timeout=timeout) as r:
            return r.status, _parse(r.read())
    except HTTPError as e:
        return e.code, _parse(e.read())
    except URLError as e:
        raise ToolError(f"KMITORA {service} API is unreachable at {service_url(service)}: {e.reason}") from e


def _parse(raw: bytes) -> Any:
    try:
        return json.loads(raw.decode("utf-8") or "null")
    except ValueError:
        return {"raw": raw.decode("utf-8", "replace")[:2000]}


def _payload(obj: Any) -> Any:
    """Core API responses are wrapped in an envelope; Source/Target API responses are not."""
    if isinstance(obj, dict) and "kind" in obj and "payload" in obj:
        return obj["payload"]
    return obj


def _error_text(obj: Any) -> str:
    p = _payload(obj)
    if isinstance(p, dict):
        return str(p.get("error") or p.get("message") or p)[:800]
    return str(p)[:800]


def _expect(service: str, method: str, path: str, body: Any = None, ok: tuple[int, ...] = (200, 201, 202)) -> Any:
    status, obj = call_api(service, method, path, body)
    if status not in ok:
        raise ToolError(f"{method} {service}{path} failed with HTTP {status}: {_error_text(obj)}")
    return _payload(obj)


# ---------------------------------------------------------------------------
# Gemini function declarations (native format: tools=[{"function_declarations": [...]}])
# ---------------------------------------------------------------------------

_CONNECTION_PROPS = {
    "name": {"type": "string", "description": "Display name for the connection, e.g. 'Customer & Order Migration - DEV source'."},
    "type": {"type": "string", "enum": DB_TYPES, "description": "Database engine, lower case."},
    "host": {"type": "string"},
    "port": {"type": "integer"},
    "database": {"type": "string"},
    "schema": {"type": "string", "description": "Schema name if the document gives one."},
    "username": {"type": "string"},
}

FUNCTION_DECLARATIONS: list[dict[str, Any]] = [
    {
        "name": "create_source_connection",
        "description": (
            "Register the read-only SOURCE database connection with the KMITORA Source API "
            "(POST /v1/sources). The API tests the connection before registering it and returns the source id "
            "(SRC-...). Use the exact values from the migration request. The password is injected by KMITORA "
            "from the uploaded document and must not be passed."
        ),
        "parameters_json_schema": {
            "type": "object",
            "properties": _CONNECTION_PROPS,
            "required": ["name", "type", "host", "port", "database", "username"],
        },
    },
    {
        "name": "create_target_connection",
        "description": (
            "Register the DEV TARGET database connection with the KMITORA Target API (POST /v1/targets). "
            "The API tests the connection and returns the target id (TGT-...). Environment is always DEV; "
            "production targets are not supported. The password is injected by KMITORA and must not be passed."
        ),
        "parameters_json_schema": {
            "type": "object",
            "properties": {**_CONNECTION_PROPS, "environment": {"type": "string", "enum": ["DEV"]}},
            "required": ["name", "type", "host", "port", "database", "username", "environment"],
        },
    },
    {
        "name": "discover_source_schema",
        "description": (
            "Discover the connected source schema against the DEV target catalog and the document's business "
            "rules (Target API /v1/targets/{id}/objects + /structure, then Core POST /v1/discovery/jobs). "
            "Read-only for source and target. Returns a new migration_id with entity, mapping, quality-finding "
            "and staging (ready/review/quarantine/rejected) counts."
        ),
        "parameters_json_schema": {
            "type": "object",
            "properties": {
                "source_id": {"type": "string", "description": "SRC-... id from create_source_connection."},
                "target_id": {"type": "string", "description": "TGT-... id from create_target_connection."},
                "tables": {"type": "array", "items": {"type": "string"}, "description": "Source tables in scope."},
                "target_schema": {"type": "string", "description": "Target schema, e.g. public."},
            },
            "required": ["source_id", "target_id", "tables"],
        },
    },
    {
        "name": "apply_business_rules",
        "description": (
            "Resolve governed validation of the business rules against a discovery result "
            "(Core POST /v1/validations/resolve-governed). Returns READY or REVIEW_REQUIRED with pass (ready), "
            "review, quarantine and rejected record counts plus blocking findings. No writes."
        ),
        "parameters_json_schema": {
            "type": "object",
            "properties": {"migration_id": {"type": "string"}},
            "required": ["migration_id"],
        },
    },
    {
        "name": "run_dev_migration",
        "description": (
            "Run the governed DEV migration for a validated migration_id: approval request + decision recorded "
            "from the user's chat confirmation (Core /v1/approvals), DEV dry run (Core POST /v1/migrations), "
            "dependency-ordered DEV replace-load of the ready records only (Target API /v1/targets/{id}/replace-load, "
            "idempotent on re-run), post-load registration, test qualification, reconciliation and evidence package. "
            "DEV only; production migration and cutover are disabled."
        ),
        "parameters_json_schema": {
            "type": "object",
            "properties": {
                "migration_id": {"type": "string"},
                "target_id": {"type": "string"},
                "dry_run_only": {"type": "boolean", "description": "true = simulate only, do not write to the DEV target."},
            },
            "required": ["migration_id", "target_id"],
        },
    },
    {
        "name": "get_migration_evidence",
        "description": (
            "Read-only: fetch the execution, reconciliation and evidence package for a completed DEV migration "
            "(Core GET /v1/executions/{id}, /v1/reconciliations/{id}, /v1/evidence/{id})."
        ),
        "parameters_json_schema": {
            "type": "object",
            "properties": {
                "execution_id": {"type": "string"},
                "reconciliation_id": {"type": "string"},
                "evidence_id": {"type": "string"},
            },
            "required": ["execution_id"],
        },
    },
]

TOOL_PHASES = {
    "create_source_connection": PHASE_CONNECT,
    "create_target_connection": PHASE_CONNECT,
    "discover_source_schema": PHASE_VALIDATE,
    "apply_business_rules": PHASE_VALIDATE,
    "run_dev_migration": PHASE_MIGRATE,
    "get_migration_evidence": PHASE_READ,
}


# ---------------------------------------------------------------------------
# Validation / proposal text
# ---------------------------------------------------------------------------

_PROD_WORDS = re.compile(r"\b(prod|production|cutover|live)\b", re.I)


def _refuse_production(args: dict[str, Any]) -> None:
    for key in ("environment", "name", "database", "execution_mode"):
        value = str(args.get(key) or "")
        if key == "environment" and value and value.upper() != "DEV":
            raise ToolError(f"Refused: environment '{value}' is not DEV. Production migration and cutover are DISABLED.")
        if key != "environment" and _PROD_WORDS.search(value):
            raise ToolError(f"Refused: '{key}={value}' refers to production/cutover. Only DEV is permitted.")


def _connection_payload(side: str, args: dict[str, Any], session: Any) -> dict[str, Any]:
    """Build the exact API payload. Connection coordinates must match the uploaded document."""
    doc = session.plan[side]
    mismatches = []
    for key in ("type", "host", "port", "database", "username"):
        if str(args.get(key, "")).strip().lower() != str(doc.get(key, "")).strip().lower():
            mismatches.append(f"{key}: proposed '{args.get(key)}' vs document '{doc.get(key)}'")
    doc_schema = str(doc.get("schema") or "").strip()
    if args.get("schema") and doc_schema and str(args["schema"]).strip().lower() != doc_schema.lower():
        mismatches.append(f"schema: proposed '{args.get('schema')}' vs document '{doc_schema}'")
    if mismatches:
        raise ToolError("Connection arguments do not match the uploaded document: " + "; ".join(mismatches))
    payload = {
        "name": str(args.get("name") or f"{session.plan.get('project') or 'KMITORA'} {side}").strip(),
        "type": str(doc["type"]).lower(),
        "host": str(doc["host"]),
        "port": int(doc["port"]),
        "database": str(doc["database"]),
        "username": str(doc["username"]),
    }
    if doc_schema:
        payload["schema"] = doc_schema
    if side == "target":
        payload["environment"] = "DEV"
    return payload


def _require(value: Any, what: str) -> str:
    value = str(value or "").strip()
    if not value:
        raise ToolError(f"{what} is required (run the previous step first).")
    return value


def validate_call(name: str, args: dict[str, Any], session: Any) -> None:
    """Raise ToolError if the call must not be proposed. Called before any proposal is shown."""
    if name not in TOOL_PHASES:
        raise ToolError(f"Unknown tool {name}.")
    _refuse_production(args)
    if name == "create_source_connection":
        _connection_payload("source", args, session)
    elif name == "create_target_connection":
        if str(args.get("environment") or "DEV").upper() != "DEV":
            raise ToolError("Refused: target environment must be DEV.")
        _connection_payload("target", args, session)
    elif name == "discover_source_schema":
        _require(args.get("source_id") or session.source_id, "source_id")
        _require(args.get("target_id") or session.target_id, "target_id")
        if not session.source_id or not session.target_id:
            raise ToolError("Both connections must be created before discovery.")
    elif name == "apply_business_rules":
        mid = _require(args.get("migration_id"), "migration_id")
        if mid != session.migration_id:
            raise ToolError(f"migration_id {mid} was not produced by discover_source_schema in this session ({session.migration_id}).")
    elif name == "run_dev_migration":
        mid = _require(args.get("migration_id"), "migration_id")
        if mid != session.migration_id:
            raise ToolError(f"migration_id {mid} does not match this session's discovery ({session.migration_id}).")
        if not session.validation or session.validation.get("migration_id") != mid:
            raise ToolError("apply_business_rules must complete for this migration before it can run.")
        if int((session.validation.get("counts") or {}).get("ready_records") or 0) <= 0:
            raise ToolError("Validation produced zero ready records; there is nothing eligible to migrate.")
        tid = _require(args.get("target_id") or session.target_id, "target_id")
        if tid != session.target_id:
            raise ToolError(f"target_id {tid} is not the DEV target created in this session ({session.target_id}).")


def describe_call(name: str, args: dict[str, Any], session: Any) -> list[str]:
    """Human-readable lines describing exactly what executing the call will do."""
    if name in ("create_source_connection", "create_target_connection"):
        side = "source" if name == "create_source_connection" else "target"
        p = _connection_payload(side, args, session)
        svc = "Source" if side == "source" else "Target"
        env = " | environment DEV" if side == "target" else " | read-only"
        schema = f" | schema {p['schema']}" if p.get("schema") else ""
        return [
            f"Create {side.upper()} connection '{p['name']}': POST {svc} API {service_url(side)}/v1/{side}s",
            f"   {p['type']}://{p['username']}@{p['host']}:{p['port']}/{p['database']}{schema}{env} | password: from document (not shown)",
        ]
    if name == "discover_source_schema":
        tables = args.get("tables") or session.plan["source"].get("tables") or []
        return [
            f"Discover source {args.get('source_id') or session.source_id} against DEV target {args.get('target_id') or session.target_id}"
            f" (schema {args.get('target_schema') or session.plan['target'].get('schema') or 'public'})",
            f"   tables: {', '.join(tables) or 'all'} | business rules: {len(session.plan['business_rules'])}"
            f" | Core POST {service_url('core')}/v1/discovery/jobs (read-only)",
            "   then validate the business rules on the result: Core POST /v1/validations/resolve-governed (no writes)",
        ]
    if name == "apply_business_rules":
        return [f"Validate business rules for {args.get('migration_id')}: Core POST /v1/validations/resolve-governed (no writes)"]
    if name == "run_dev_migration":
        counts = (session.validation or {}).get("counts") or {}
        held = sum(int(counts.get(k) or 0) for k in ("review_records", "quarantine_records", "rejected_records"))
        load = "SIMULATION ONLY (no target write)" if args.get("dry_run_only") else (
            f"DEV replace-load of {counts.get('ready_records', 0)} ready records into target {session.target_id}"
            f" (schema public, parents before children, idempotent re-run)"
        )
        return [
            f"Governed DEV migration {args.get('migration_id')}:",
            "   1) record approval from your confirmation (Core /v1/approvals, decision_by: KMITORA Assistant)",
            "   2) DEV dry run (Core POST /v1/migrations, execution_mode DRY_RUN)",
            f"   3) {load}",
            f"      {held} review/quarantine/rejected records stay held and are NOT loaded",
            "   4) test qualification, reconciliation and evidence package (Core /v1/tests, /v1/reconciliations, /v1/evidence)",
        ]
    if name == "get_migration_evidence":
        return [f"Read execution/reconciliation/evidence for {args.get('execution_id')} (read-only)"]
    return [f"{name}({json.dumps(args)[:200]})"]


# ---------------------------------------------------------------------------
# Executors
# ---------------------------------------------------------------------------

def _compact(obj: Any, depth: int = 0, max_list: int = 8, max_str: int = 300) -> Any:
    """Trim large API payloads before handing them back to Gemini."""
    if depth > 4:
        return "..."
    if isinstance(obj, dict):
        return {k: _compact(v, depth + 1, max_list, max_str) for k, v in list(obj.items())[:40]}
    if isinstance(obj, list):
        items = [_compact(v, depth + 1, max_list, max_str) for v in obj[:max_list]]
        if len(obj) > max_list:
            items.append(f"... {len(obj) - max_list} more")
        return items
    if isinstance(obj, str) and len(obj) > max_str:
        return obj[:max_str] + "..."
    return obj


def _create_source(args: dict[str, Any], session: Any) -> dict[str, Any]:
    payload = _connection_payload("source", args, session)
    payload["password"] = session.secrets.get("source", "")
    rec = _expect("source", "POST", "/v1/sources", payload)
    session.source_id = rec.get("id")
    return {"status": "CONNECTED", "source_id": session.source_id, "source": rec}


def _create_target(args: dict[str, Any], session: Any) -> dict[str, Any]:
    payload = _connection_payload("target", args, session)
    payload["password"] = session.secrets.get("target", "")
    rec = _expect("target", "POST", "/v1/targets", payload)
    if str(rec.get("environment", "")).upper() != "DEV":
        raise ToolError(f"Target API registered environment {rec.get('environment')}; only DEV is permitted.")
    session.target_id = rec.get("id")
    return {"status": "CONNECTED", "target_id": session.target_id, "target": rec}


def _stem(name: str) -> str:
    base = re.split(r"[\\/]", str(name))[-1]
    return re.sub(r"^target[_-]", "", re.sub(r"\.[^.]+$", "", base), flags=re.I).lower()


def _discover(args: dict[str, Any], session: Any) -> dict[str, Any]:
    sid = args.get("source_id") or session.source_id
    tid = args.get("target_id") or session.target_id
    target_schema = str(args.get("target_schema") or session.plan["target"].get("schema") or "public")
    tables = [str(t).strip() for t in (args.get("tables") or session.plan["source"].get("tables") or []) if str(t).strip()]

    objects = _expect("target", "GET", f"/v1/targets/{quote(tid)}/objects")
    objects = [o for o in objects if o.get("type") in ("table", "view") and str(o.get("schema")) == target_schema]
    if not objects:
        raise ToolError(f"DEV target {tid} has no tables in schema '{target_schema}'. Create the target tables first.")
    entities = []
    for o in objects:
        s = _expect("target", "GET", f"/v1/targets/{quote(tid)}/structure?schema={quote(o['schema'])}&object={quote(o['name'])}")
        entities.append({"schema": o["schema"], "name": o["name"], "stem": _stem(o["name"]), "columns": s.get("columns") or []})
    session.target_entities = entities

    migration_id = f"DEV-DOCFLOW-{time.strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:4].upper()}"
    body = {
        "migration_id": migration_id,
        "source_id": sid,
        "target_schema": {
            "type": session.plan["target"]["type"],
            "name": session.plan.get("project") or "",
            "database": session.plan["target"]["database"],
            "schema": target_schema,
            "entities": entities,
        },
        "business_rules": session.rule_strings(),
    }
    if tables:
        body["source_entity_allowlist"] = tables
    d = _expect("core", "POST", "/v1/discovery/jobs", body)
    session.migration_id = d.get("migration_id") or migration_id
    session.validation = None
    findings = d.get("quality_findings") or []
    by_severity: dict[str, int] = {}
    for f in findings:
        sev = str(f.get("severity", "UNKNOWN")).upper()
        by_severity[sev] = by_severity.get(sev, 0) + 1
    return {
        "status": d.get("status"),
        "migration_id": session.migration_id,
        "mode": d.get("mode"),
        "summary": d.get("summary"),
        "target_entities": [e["name"] for e in entities],
        "mapping_count": len(d.get("suggested_mappings") or []),
        "transformation_count": len(d.get("transformation_plan") or []),
        "quality_findings_by_severity": by_severity,
        "sample_quality_findings": _compact(findings, max_list=6),
        "production_action_executed": d.get("production_action_executed", False),
    }


def _validate(args: dict[str, Any], session: Any) -> dict[str, Any]:
    v = _expect("core", "POST", "/v1/validations/resolve-governed", {"migration_id": args["migration_id"]})
    session.validation = v
    return _compact(v, max_list=10)


def _table_for_entity(entity: str, mappings: list[dict[str, Any]], target_entities: list[dict[str, Any]]) -> str:
    """Same resolution as Migrate.tsx tableNameFromEntity (TARGET_MAPPING_001)."""
    logical = _stem(entity)
    mapped = sorted({
        str(m.get("target", "")).split(".")[0]
        for m in mappings
        if str(m.get("source", "")).strip() and _stem(str(m["source"]).split(".")[0]) == logical and m.get("target")
    } - {""})
    if len(mapped) == 1:
        return mapped[0]
    if len(mapped) > 1:
        raise ToolError(f"Ambiguous target mapping for '{logical}': {', '.join(mapped)}")
    norm = lambda s: re.sub(r"[^a-z0-9]", "", s.lower())
    names = [e["name"] for e in target_entities]
    exact = [n for n in names if norm(n) == norm(logical)]
    if len(exact) == 1:
        return exact[0]
    semantic = [n for n in names if norm(n).endswith(norm(logical)) or norm(logical).endswith(norm(n))]
    if len(semantic) == 1:
        return semantic[0]
    raise ToolError(f"No unambiguous target table for source entity '{logical}'.")


def _replace_load_tables(discovery: dict[str, Any], session: Any) -> dict[str, list[dict[str, Any]]]:
    ready = (discovery.get("target_staging_plan") or {}).get("ready_records") or []
    mappings = discovery.get("suggested_mappings") or []
    columns = {e["name"]: [c["name"] for c in e["columns"]] for e in session.target_entities}
    norm = lambda s: re.sub(r"[^a-z0-9]", "", str(s).lower())
    tables: dict[str, list[dict[str, Any]]] = {}  # insertion order = discovery dependency order
    for rec in ready:
        table = _table_for_entity(str(rec.get("entity", "")), mappings, session.target_entities)
        row = next((rec[k] for k in ("transformed_record", "source_record", "record", "data", "row_data") if isinstance(rec.get(k), dict)), {})
        by_norm = {norm(c): c for c in columns.get(table, [])}
        tables.setdefault(table, []).append({by_norm[norm(k)]: v for k, v in row.items() if norm(k) in by_norm})
    return tables


def _run_migration(args: dict[str, Any], session: Any) -> dict[str, Any]:
    mid = args["migration_id"]
    tid = args.get("target_id") or session.target_id
    dry_run_only = args.get("dry_run_only") is True
    discovery = _expect("core", "GET", f"/v1/a000/discoveries/{quote(mid)}")
    staging = discovery.get("target_staging_plan") or {}
    blocked = len([
        i for i in staging.get("referential_dependencies") or []
        if i.get("entity") and i.get("field") and i.get("row") is not None and i.get("value") is not None
    ])
    blocking_findings = len([f for f in discovery.get("quality_findings") or [] if str(f.get("severity", "")).upper() == "ERROR"])
    held = {k: len(staging.get(k) or []) for k in ("review_records", "quarantine_records", "rejected_records")}
    steps: list[dict[str, Any]] = []

    approval = _expect("core", "POST", "/v1/approvals", {
        "migration_id": mid,
        "validation_snapshot": {"validation_ready": bool((session.validation or {}).get("validation_ready")), "blocking_findings": blocking_findings},
        "staging_snapshot": {"ready_records": len(staging.get("ready_records") or []), "blocked_records": blocked, **held},
        "environment": "DEV",
        "execution_mode": "DRY_RUN",
        "target_write_requested": False,
    })
    approval_id = approval["id"]
    _expect("core", "PATCH", f"/v1/approvals/{quote(approval_id)}", {
        "decision": "APPROVE",
        "decision_by": APPROVER,
        "decision_reason": f"User confirmed the governed DEV migration in KMITORA Assistant chat: \"{session.last_confirmation[:200]}\"",
    })
    session.approval_id = approval_id
    steps.append({"step": "approval", "approval_id": approval_id, "status": "APPROVED"})

    dry = _expect("core", "POST", "/v1/migrations", {
        "migration_id": mid, "approval_id": approval_id, "environment": "DEV",
        "execution_mode": "DRY_RUN", "target_write_requested": False,
    })
    execution_id = dry["execution_id"]
    steps.append({"step": "dry_run", "execution_id": execution_id, "status": dry.get("status"),
                  "input": dry.get("input_record_count"), "simulated": dry.get("simulated_record_count"),
                  "failures": dry.get("failure_count")})

    if not dry_run_only and str(dry.get("status", "")).upper() == "DRY_RUN_COMPLETED":
        tables = _replace_load_tables(discovery, session)
        load = _expect("target", "POST", f"/v1/targets/{quote(tid)}/replace-load", {
            "schema": "public",
            "tables": tables,
            "governed_execution": {
                "migration_id": mid, "approval_id": approval_id, "execution_id": execution_id,
                "environment": "DEV", "dry_run_status": "DRY_RUN_COMPLETED",
                "target_write_authorized": True, "production_action_executed": False,
                "review_records_held": held["review_records"],
                "quarantine_records_held": held["quarantine_records"],
                "rejected_records_held": held["rejected_records"],
            },
        })
        steps.append({"step": "dev_replace_load", "load_order": list(tables), "counts": load.get("counts"), "total_loaded": load.get("total_loaded")})
        post = _expect("core", "POST", "/v1/post-load-executions", {
            "dry_run_execution_id": execution_id, "migration_id": mid, "approval_id": approval_id,
            "target_id": tid, "environment": "DEV",
            "write_results": load.get("results") or [], "target_counts": load.get("counts") or {},
            "total_loaded": int(load.get("total_loaded") or 0),
            "review_records_held": held["review_records"],
            "quarantine_records_held": held["quarantine_records"],
            "rejected_records_held": held["rejected_records"],
        })
        execution_id = post["execution_id"]
        steps.append({"step": "post_load_registration", "execution_id": execution_id, "status": post.get("status"),
                      "loaded": post.get("loaded_record_count")})
    elif not dry_run_only:
        steps.append({"step": "dev_replace_load", "status": "SKIPPED",
                      "reason": f"dry run status {dry.get('status')} is not DRY_RUN_COMPLETED"})

    test = _expect("core", "POST", "/v1/tests", {"migration_id": mid, "execution_id": execution_id, "stage": "TEST"})
    steps.append({"step": "test_qualification", "status": test.get("status"), "passed": test.get("passed_tests"),
                  "total": test.get("total_tests"), "critical_failures": test.get("critical_failures")})
    recon = _expect("core", "POST", "/v1/reconciliations", {"execution_id": execution_id})
    evidence = _expect("core", "POST", "/v1/evidence", {"reconciliation_id": recon["reconciliation_id"]})
    session.execution_id = execution_id
    session.reconciliation_id = recon["reconciliation_id"]
    session.evidence_id = evidence.get("evidence_id")
    session.migration_done = True
    steps.append({"step": "reconciliation", "reconciliation_id": session.reconciliation_id, "status": recon.get("status")})
    steps.append({"step": "evidence", "evidence_id": session.evidence_id, "status": evidence.get("status")})
    return {
        "migration_id": mid,
        "execution_id": execution_id,
        "reconciliation_id": session.reconciliation_id,
        "evidence_id": session.evidence_id,
        "held_records": held,
        "steps": steps,
        "production_action_executed": False,
        "cutover": "DISABLED",
    }


def _get_evidence(args: dict[str, Any], session: Any) -> dict[str, Any]:
    out: dict[str, Any] = {}
    eid = args.get("execution_id") or session.execution_id
    rid = args.get("reconciliation_id") or session.reconciliation_id
    vid = args.get("evidence_id") or session.evidence_id
    out["execution"] = _compact(_expect("core", "GET", f"/v1/executions/{quote(_require(eid, 'execution_id'))}"), max_list=4)
    if rid:
        out["reconciliation"] = _compact(_expect("core", "GET", f"/v1/reconciliations/{quote(rid)}"), max_list=6)
    if vid:
        out["evidence"] = _compact(_expect("core", "GET", f"/v1/evidence/{quote(vid)}"), max_list=6)
    return out


EXECUTORS = {
    "create_source_connection": _create_source,
    "create_target_connection": _create_target,
    "discover_source_schema": _discover,
    "apply_business_rules": _validate,
    "run_dev_migration": _run_migration,
    "get_migration_evidence": _get_evidence,
}


def execute_call(name: str, args: dict[str, Any], session: Any) -> dict[str, Any]:
    """Execute one tool call. Never raises: failures are reported back to Gemini as data."""
    try:
        validate_call(name, args, session)
        result = EXECUTORS[name](args, session)
        return {"ok": True, "result": _compact(result, max_list=12)}
    except ToolError as e:
        return {"ok": False, "error": str(e)}
    except Exception as e:  # unexpected backend shape etc.
        return {"ok": False, "error": f"{type(e).__name__}: {e}"}
