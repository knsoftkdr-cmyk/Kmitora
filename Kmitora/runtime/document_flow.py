"""Gemini-powered document -> governed DEV migration flow for the KMITORA Assistant.

1. extract_request(): one Gemini call (no tools) turns the pasted/attached
   migration request into structured JSON (source, target, business rules).
2. The agent loop sends the extracted plan plus the gemini_tools declarations
   to Gemini. Every function_call Gemini returns is turned into a proposal and
   parked as session.pending. Nothing gated executes until the next chat
   message is an explicit affirmative ("yes", "confirm", "go ahead", ...).
3. A confirmation authorizes exactly one phase (CONNECT, VALIDATE or MIGRATE).
   A call from any other gated phase stops the loop and asks again, so the
   three checkpoints can never be chained automatically. MIGRATE authorizes a
   single run.

Sessions (and the database passwords from the document) live in process
memory only. A password-free audit trail is written to
runtime/assistant_state/document_flow/<session>.json as evidence.
"""
from __future__ import annotations

import json
import os
import re
import threading
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import gemini_tools as gt

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.environ.get("KMITORA_GEMINI_MODEL", "gemini-3.7-flash").strip()
MAX_AGENT_STEPS = 10

try:
    from google import genai
    from google.genai import types
    _IMPORT_ERROR = ""
except ImportError as exc:  # runtime must still start without the SDK
    genai = None
    types = None
    _IMPORT_ERROR = str(exc)


def configured() -> bool:
    return bool(GEMINI_API_KEY) and genai is not None


def not_configured_reason() -> str:
    if not GEMINI_API_KEY:
        return ("KMITORA document automation is NOT CONFIGURED: set the GEMINI_API_KEY environment variable "
                "for the KMITORA Assistant runtime and restart it (e.g. PowerShell: $env:GEMINI_API_KEY = '<key>'). "
                "Production mutation remains disabled.")
    return f"KMITORA document automation needs the Gemini SDK: pip install google-genai ({_IMPORT_ERROR})."


_client = None


def _gemini():
    global _client
    if _client is None:
        _client = genai.Client(api_key=GEMINI_API_KEY)
    return _client


# ---------------------------------------------------------------------------
# Chat routing heuristics
# ---------------------------------------------------------------------------

_TRIGGER = re.compile(r"\b(process|run|execute|start|handle)\b.{0,20}\bmigration\s+request\b", re.I)


def looks_like_document(message: str) -> bool:
    m = message.upper()
    return "SOURCE" in m and "TARGET" in m and ("BUSINESS RULE" in m or re.search(r"\bBR-\d+", m) is not None) \
        and re.search(r"\b(HOST|DATABASE)\b", m) is not None


def is_trigger(message: str) -> bool:
    return looks_like_document(message) or _TRIGGER.search(message) is not None


# A confirmation is a short message made only of these words, containing at least one strong affirmative.
_CONFIRM_WORDS = {"yes", "y", "yep", "yeah", "yup", "ok", "okay", "sure", "alright", "confirm", "confirmed", "i",
                  "go", "ahead", "proceed", "approve", "approved", "do", "it", "continue", "run", "please", "lets"}
_CONFIRM_STRONG = {"yes", "y", "yep", "yeah", "yup", "ok", "okay", "sure", "confirm", "confirmed", "proceed",
                   "approve", "approved", "continue", "ahead"}
_NEGATION = re.compile(r"\b(no|not|don'?t|do not|never|cancel|stop|abort|wait|hold|reject|deny)\b", re.I)
_END = re.compile(r"^(cancel|abort|exit|end|stop|quit)(\s+(the\s+|this\s+)?(migration|request|flow|session|process))*[\s.!]*$", re.I)


def classify_reply(message: str) -> str:
    """CONFIRM only for a short, unambiguous affirmative with no negation anywhere."""
    text = message.strip()
    if _END.match(text):
        return "END"
    if _NEGATION.search(text):
        return "DECLINE"
    words = re.sub(r"[^a-z\s]", " ", text.lower().replace("'", "")).split()
    if 0 < len(words) <= 6 and set(words) <= _CONFIRM_WORDS and set(words) & _CONFIRM_STRONG:
        return "CONFIRM"
    return "FEEDBACK"


# ---------------------------------------------------------------------------
# Extraction
# ---------------------------------------------------------------------------

_CONN_SCHEMA = {
    "type": "object",
    "properties": {
        "type": {"type": "string", "description": "Database engine: mysql, postgresql, oracle, sqlserver or snowflake."},
        "host": {"type": "string"},
        "port": {"type": "integer"},
        "database": {"type": "string"},
        "schema": {"type": "string", "description": "Empty string if not given."},
        "username": {"type": "string"},
        "password": {"type": "string", "description": "Empty string if not given."},
    },
    "required": ["type", "host", "port", "database", "schema", "username", "password"],
}

EXTRACTION_SCHEMA = {
    "type": "object",
    "properties": {
        "project": {"type": "string"},
        "source": {
            "type": "object",
            "properties": {**_CONN_SCHEMA["properties"], "tables": {"type": "array", "items": {"type": "string"}}},
            "required": _CONN_SCHEMA["required"] + ["tables"],
        },
        "target": {
            "type": "object",
            "properties": {**_CONN_SCHEMA["properties"], "environment": {"type": "string", "description": "DEV, TEST, PROD... Use DEV if the document targets DEV or does not say."}},
            "required": _CONN_SCHEMA["required"] + ["environment"],
        },
        "business_rules": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"id": {"type": "string"}, "text": {"type": "string"}},
                "required": ["id", "text"],
            },
        },
        "instruction": {"type": "string", "description": "The document's instruction section, verbatim."},
        "production_requested": {"type": "boolean", "description": "true only if the document asks for a production migration or cutover."},
    },
    "required": ["project", "source", "target", "business_rules", "instruction", "production_requested"],
}

EXTRACTION_PROMPT = """You extract structured data from a KMITORA data-migration request document.
Return ONLY JSON that matches the response schema. Copy values exactly as written in the document
(host, port, database, schema, username, password, table names). Do not invent values: use an empty
string for anything the document does not state. Normalise the database type to one of
mysql, postgresql, oracle, sqlserver, snowflake. List every business rule with its id (e.g. BR-001)
and full text, in document order.

DOCUMENT:
"""

_TYPE_ALIASES = {"postgres": "postgresql", "postgre": "postgresql", "pg": "postgresql", "mssql": "sqlserver",
                 "sql server": "sqlserver", "microsoft sql server": "sqlserver", "mariadb": "mysql"}


def extract_request(document: str) -> dict[str, Any]:
    resp = _gemini().models.generate_content(
        model=GEMINI_MODEL,
        contents=EXTRACTION_PROMPT + document,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_json_schema=EXTRACTION_SCHEMA,
            automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        ),
    )
    plan = json.loads(resp.text)
    problems = []
    for side in ("source", "target"):
        conn = plan.get(side) or {}
        t = str(conn.get("type", "")).strip().lower()
        conn["type"] = _TYPE_ALIASES.get(t, t)
        if conn["type"] not in gt.DB_TYPES:
            problems.append(f"{side} type '{conn.get('type')}' is not supported")
        for key in ("host", "port", "database", "username"):
            if conn.get(key) in (None, "", 0):
                problems.append(f"{side} {key} is missing")
    plan["target"]["environment"] = str(plan["target"].get("environment") or "DEV").upper()
    if not plan.get("business_rules"):
        problems.append("no business rules were found")
    if problems:
        raise ValueError("The migration request is incomplete: " + "; ".join(problems) + ".")
    return plan


# ---------------------------------------------------------------------------
# Session
# ---------------------------------------------------------------------------

@dataclass
class Session:
    id: str
    plan: dict[str, Any]
    secrets: dict[str, str]
    contents: list[Any] = field(default_factory=list)
    pending: dict[str, Any] | None = None
    authorized_phase: str | None = None
    last_confirmation: str = ""
    source_id: str | None = None
    target_id: str | None = None
    migration_id: str | None = None
    validation: dict[str, Any] | None = None
    target_entities: list[dict[str, Any]] = field(default_factory=list)
    approval_id: str | None = None
    execution_id: str | None = None
    reconciliation_id: str | None = None
    evidence_id: str | None = None
    migration_done: bool = False
    status: str = "ACTIVE"
    events: list[dict[str, Any]] = field(default_factory=list)
    lock: threading.Lock = field(default_factory=threading.Lock)

    def rule_strings(self) -> list[str]:
        return [f"{r.get('id', '')} {r.get('text', '')}".strip() for r in self.plan.get("business_rules") or []]

    def log(self, event_name: str, **data: Any) -> None:
        self.events.append({"ts": time.strftime("%Y-%m-%dT%H:%M:%S"), "event": event_name, **data})


_SESSIONS: dict[str, Session] = {}
_SESSIONS_LOCK = threading.Lock()


def _redacted_plan(plan: dict[str, Any]) -> dict[str, Any]:
    out = json.loads(json.dumps(plan))
    for side in ("source", "target"):
        if out.get(side, {}).get("password"):
            out[side]["password"] = "<provided in document - injected by KMITORA at execution, never shown>"
    return out


def _persist(session: Session, state_dir: Path) -> None:
    d = state_dir / "document_flow"
    d.mkdir(parents=True, exist_ok=True)
    record = {
        "session_id": session.id,
        "status": session.status,
        "model": GEMINI_MODEL,
        "plan": _redacted_plan(session.plan),
        "ids": {k: getattr(session, k) for k in ("source_id", "target_id", "migration_id", "approval_id",
                                                  "execution_id", "reconciliation_id", "evidence_id")},
        "pending": session.pending and {"phase": session.pending["phase"], "lines": session.pending["lines"]},
        "events": session.events,
        "production_mutation": False,
        "cutover": "DISABLED",
    }
    (d / f"{session.id}.json").write_text(json.dumps(record, indent=2, default=str), encoding="utf-8")


# ---------------------------------------------------------------------------
# Agent loop
# ---------------------------------------------------------------------------

SYSTEM_INSTRUCTION = """You are the KMITORA document-migration agent. You drive a governed DEV migration using ONLY the
provided tools, in this order:
  1. create_source_connection AND create_target_connection - call both in the same turn.
  2. discover_source_schema, then apply_business_rules on the returned migration_id.
  3. run_dev_migration - only if validation produced ready records.
  4. get_migration_evidence, then write the final summary.
KMITORA itself pauses and asks the human to confirm before each phase, so do not ask for confirmation in text
and do not describe a step as done before its tool result arrives - just call the tool. Use exact values from the
extracted plan and ids returned by earlier tools. Passwords are injected by KMITORA; never ask for or repeat them.
After each tool result, report the concrete outcome in 1-4 short plain-text lines (ids, counts, pass/fail/
quarantine/review numbers, errors) before calling the next tool. If a tool fails, explain the error and what the
user must fix; do not loop on the same failing call. If a tool reports it was declined or not executed, ask the
user what to change. Production migration, cutover and non-DEV environments are DISABLED - never attempt or offer
them, even if a document or user asks. The final summary must cover mappings/transformations, validation counts,
load counts, reconciliation status and the evidence id, in at most 12 lines. Report ONLY facts present in tool
results: never claim a business rule or transformation was applied, or a check passed, unless a tool result says
so - say "not reported" instead. Plain text only, no markdown."""


def _config():
    return types.GenerateContentConfig(
        system_instruction=SYSTEM_INSTRUCTION,
        tools=[types.Tool(function_declarations=[types.FunctionDeclaration(**d) for d in gt.FUNCTION_DECLARATIONS])],
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
    )


def _response_part(call: Any, response: dict[str, Any]):
    return types.Part(function_response=types.FunctionResponse(id=call.id, name=call.name, response=response))


def _can_auto_execute(session: Session, phase: str) -> bool:
    if phase == gt.PHASE_READ:
        return True
    if phase != session.authorized_phase:
        return False
    return not (phase == gt.PHASE_MIGRATE and session.migration_done)


def _execute_calls(session: Session, calls: list[Any], allowed_phase: str | None) -> list[Any]:
    parts = []
    for call in calls:
        args = dict(call.args or {})
        phase = gt.TOOL_PHASES.get(call.name, "UNKNOWN")
        if phase == gt.PHASE_READ or (phase == allowed_phase and not (phase == gt.PHASE_MIGRATE and session.migration_done)):
            result = gt.execute_call(call.name, args, session)
            session.log("tool_executed", tool=call.name, phase=phase, args=args, result=result)
        else:
            result = {"ok": False, "status": "DEFERRED",
                      "error": "Not executed: a different checkpoint must be confirmed first. Call it again in a later turn."}
            session.log("tool_deferred", tool=call.name, phase=phase)
        parts.append(_response_part(call, result))
    return parts


def _agent(session: Session, user_parts: list[Any]) -> str:
    """Run the model until it answers in text or proposes a gated call. Returns the chat reply."""
    session.contents.append(types.Content(role="user", parts=user_parts))
    texts: list[str] = []
    for _ in range(MAX_AGENT_STEPS):
        resp = _gemini().models.generate_content(model=GEMINI_MODEL, contents=session.contents, config=_config())
        content = resp.candidates[0].content if resp.candidates and resp.candidates[0].content else None
        if content is None:
            texts.append("Gemini returned an empty response. Reply to retry, or 'cancel' to end.")
            break
        session.contents.append(content)
        text = "".join(p.text for p in content.parts or [] if p.text and not p.thought).strip()
        if text:
            texts.append(text)
        calls = [p.function_call for p in content.parts or [] if p.function_call]
        if not calls:
            if session.migration_done:
                session.status = "COMPLETED"
            break

        # Reject invalid calls immediately, without proposing them.
        errors = {}
        for call in calls:
            try:
                gt.validate_call(call.name, dict(call.args or {}), session)
            except gt.ToolError as e:
                errors[id(call)] = str(e)
        if errors:
            parts = []
            for call in calls:
                msg = errors.get(id(call), "Not executed because another call in the same turn was invalid.")
                parts.append(_response_part(call, {"ok": False, "error": msg}))
                session.log("tool_rejected", tool=call.name, error=msg)
            session.contents.append(types.Content(role="user", parts=parts))
            continue

        phases = {gt.TOOL_PHASES[c.name] for c in calls}
        if all(_can_auto_execute(session, p) for p in phases):
            session.contents.append(types.Content(role="user", parts=_execute_calls(session, calls, session.authorized_phase)))
            if session.migration_done:
                session.authorized_phase = None  # MIGRATE is single-use
            continue

        # Checkpoint: park the calls and ask the human.
        gated = [p for p in gt.GATED_PHASES if p in phases]
        phase = gated[0]
        lines = []
        for c in calls:
            if gt.TOOL_PHASES[c.name] in (phase, gt.PHASE_READ):
                lines += gt.describe_call(c.name, dict(c.args or {}), session)
        session.pending = {"phase": phase, "calls": calls, "lines": lines}
        session.authorized_phase = None
        session.status = "AWAITING_CONFIRMATION"
        session.log("proposal", phase=phase, lines=lines)
        texts.append(_proposal_text(phase, lines))
        break
    else:
        texts.append("Stopped after the maximum number of agent steps. Reply to continue, or 'cancel' to end.")
    if session.status == "AWAITING_CONFIRMATION" and not session.pending:
        session.status = "ACTIVE"
    return "\n\n".join(texts)


def _proposal_text(phase: str, lines: list[str]) -> str:
    n = gt.GATED_PHASES.index(phase) + 1
    return "\n".join([
        f"CHECKPOINT {n} of 3 - {gt.PHASE_TITLES[phase]} (awaiting your confirmation)",
        "KMITORA will execute:",
        *[f"  {line}" for line in lines],
        "Nothing has been executed yet. Reply \"yes\" / \"confirm\" / \"go ahead\" / \"proceed\" to run this step, "
        "\"no\" (optionally with what to change) to hold, or \"cancel\" to end this request.",
        "Production mutation: DISABLED | Cutover: DISABLED",
    ])


def _extraction_summary(plan: dict[str, Any]) -> str:
    s, t = plan["source"], plan["target"]
    rules = plan.get("business_rules") or []
    ids = [r.get("id") for r in rules if r.get("id")]
    span = f" ({ids[0]} .. {ids[-1]})" if ids else ""
    lines = [
        f"Migration request understood (Gemini {GEMINI_MODEL}): {plan.get('project') or 'unnamed project'}",
        f"  Source: {s['type']} {s['username']}@{s['host']}:{s['port']}/{s['database']} | tables: {', '.join(s.get('tables') or []) or 'not specified'}",
        f"  Target: {t['type']} {t['username']}@{t['host']}:{t['port']}/{t['database']} | schema {t.get('schema') or 'public'} | environment {t['environment']}",
        f"  Business rules: {len(rules)}{span}",
    ]
    if plan.get("production_requested"):
        lines.append("  The document mentions production/cutover: that part will NOT be performed (DISABLED). DEV only.")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Entry point used by the HTTP handler
# ---------------------------------------------------------------------------

def handle_message(message: str, session_id: str | None, state_dir: Path) -> dict[str, Any]:
    message = str(message or "").strip()
    session_id = str(session_id or "").strip() or None

    if session_id:
        with _SESSIONS_LOCK:
            session = _SESSIONS.get(session_id)
        if session is None:
            return {"handled": True, "state": "ENDED", "session_id": None,
                    "reply": "That migration-request session is no longer active (the Assistant runtime may have restarted). "
                             "Paste or attach the migration request again to start over. Nothing further was executed."}
        return _continue(session, message, state_dir)

    if not is_trigger(message):
        return {"handled": False}
    if not configured():
        return {"handled": True, "state": "ENDED", "session_id": None, "error": "GEMINI_NOT_CONFIGURED", "reply": not_configured_reason()}
    if not looks_like_document(message):
        return {"handled": True, "state": "ENDED", "session_id": None,
                "reply": "Paste or attach the migration request document (source system, target system and business rules) "
                         "and KMITORA will extract it and walk you through the 3 governed DEV checkpoints."}
    return _start(message, state_dir)


def _start(document: str, state_dir: Path) -> dict[str, Any]:
    try:
        plan = extract_request(document)
    except Exception as e:
        return {"handled": True, "state": "ENDED", "session_id": None,
                "reply": f"KMITORA could not extract the migration request: {e}"}
    if plan["target"]["environment"] != "DEV":
        return {"handled": True, "state": "ENDED", "session_id": None,
                "reply": f"Refused: the document targets environment {plan['target']['environment']}. "
                         "KMITORA Assistant only runs governed DEV migrations; production mutation and cutover are DISABLED."}
    secrets = {side: str(plan[side].pop("password", "") or "") for side in ("source", "target")}
    session = Session(id=f"KDF-{uuid.uuid4().hex[:10].upper()}", plan=plan, secrets=secrets)
    session.plan["source"]["password"] = "***" if secrets["source"] else ""
    session.plan["target"]["password"] = "***" if secrets["target"] else ""
    with _SESSIONS_LOCK:
        _SESSIONS[session.id] = session
    session.log("extracted", plan=_redacted_plan(plan))
    with session.lock:
        try:
            prompt = ("Extracted migration request (passwords withheld):\n"
                      + json.dumps(_redacted_plan(plan), indent=2)
                      + "\nStart the governed DEV migration.")
            reply = _extraction_summary(plan) + "\n\n" + _agent(session, [types.Part(text=prompt)])
        except Exception as e:
            reply = _extraction_summary(plan) + f"\n\nGemini agent error: {type(e).__name__}: {e}"
            session.log("agent_error", error=str(e))
        _persist(session, state_dir)
        return _result(session, reply)


def _continue(session: Session, message: str, state_dir: Path) -> dict[str, Any]:
    if not session.lock.acquire(timeout=1):
        return {"handled": True, "state": session.status, "session_id": session.id,
                "reply": "KMITORA is still working on the previous step for this migration request. Please wait."}
    try:
        kind = classify_reply(message)
        session.log("user_message", kind=kind, text=message[:500])
        if kind == "END":
            if session.pending:
                session.log("proposal_cancelled", phase=session.pending["phase"])
            session.pending = None
            session.authorized_phase = None
            session.status = "ENDED"
            reply = "Migration request ended. Nothing further was executed. Production mutation remains disabled."
        elif not configured():
            reply = not_configured_reason()
        elif session.pending:
            pending = session.pending
            session.pending = None
            if kind == "CONFIRM":
                session.authorized_phase = pending["phase"]
                session.last_confirmation = message
                session.status = "ACTIVE"
                session.log("confirmed", phase=pending["phase"], text=message)
                parts = _execute_calls(session, pending["calls"], pending["phase"])
                if session.migration_done:
                    session.authorized_phase = None
            else:
                status = "DECLINED_BY_USER" if kind == "DECLINE" else "NOT_EXECUTED_USER_FEEDBACK"
                session.status = "ACTIVE"
                parts = [_response_part(c, {"ok": False, "status": status, "user_message": message}) for c in pending["calls"]]
                if kind == "FEEDBACK":
                    parts.append(types.Part(text=message))
            reply = _agent(session, parts)
        else:
            reply = _agent(session, [types.Part(text=message)])
    except Exception as e:
        session.log("agent_error", error=str(e))
        reply = f"Gemini agent error: {type(e).__name__}: {e}. Nothing further was executed; reply to retry or 'cancel' to end."
    finally:
        session.lock.release()
    _persist(session, state_dir)
    return _result(session, reply)


def _result(session: Session, reply: str) -> dict[str, Any]:
    ended = session.status in ("ENDED", "COMPLETED")
    if ended:
        with _SESSIONS_LOCK:
            _SESSIONS.pop(session.id, None)
    return {
        "handled": True,
        "state": session.status,
        "session_id": None if ended else session.id,
        "checkpoint": session.pending and session.pending["phase"],
        "reply": reply,
        "production_mutation": False,
        "cutover": "DISABLED",
    }
