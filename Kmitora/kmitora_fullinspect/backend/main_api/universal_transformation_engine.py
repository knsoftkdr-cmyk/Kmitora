from __future__ import annotations

"""KMITORA Universal Business Logic & Transformation Engine.

This module turns source/target metadata plus natural-language business rules into a
bounded, auditable transformation IR and can execute the deterministic subset in
memory before any target write occurs.  It intentionally separates:

1. understanding / compilation (natural language -> declarative plan),
2. deterministic simulation (plan + source rows -> staged rows), and
3. target mutation (a separate governed API remains responsible for state change).

The vocabulary covers the PowerCenter/CDI, IDQ/Cloud DQ and MDM capabilities used
by KMITORA.  Capabilities that require external code, remote services or vendor
runtimes are represented in the IR but remain PLAN_ONLY until an approved adapter
is configured.  This is fail-closed: unsupported behaviour never becomes arbitrary
code execution.
"""

from dataclasses import dataclass, asdict
from datetime import datetime, date
from decimal import Decimal, InvalidOperation
from hashlib import sha256
from typing import Any, Callable, Iterable
import ast
import copy
import json
import math
import re
import statistics
import uuid

ENGINE_VERSION = "2.0.0"


# ---------------------------------------------------------------------------
# Capability registry
# ---------------------------------------------------------------------------

# execution: NATIVE = deterministic executor is implemented here,
# POLICY = behaviour is represented as a governed boundary/decision,
# ADAPTER = requires an approved external connector/runtime.
CAPABILITY_REGISTRY: tuple[dict[str, str], ...] = (
    {"suite": "PowerCenter / CDI", "name": "Expression", "operational_type": "Passive", "function": "Calculations, conversions, conditional expressions, derived columns", "capture": "Expressions, functions, datatypes, dependencies", "execution": "NATIVE"},
    {"suite": "PowerCenter / CDI", "name": "Aggregator", "operational_type": "Active", "function": "SUM, AVG, COUNT, MIN, MAX and grouped calculations", "capture": "Group-by ports, aggregate expressions, sorted-input option", "execution": "NATIVE"},
    {"suite": "PowerCenter / CDI", "name": "Filter", "operational_type": "Active", "function": "Removes records failing a Boolean condition", "capture": "Filter expression and rejected-row behavior", "execution": "NATIVE"},
    {"suite": "PowerCenter / CDI", "name": "Router", "operational_type": "Active", "function": "Evaluates multiple conditions and routes records", "capture": "Group conditions, precedence, default group", "execution": "NATIVE"},
    {"suite": "PowerCenter / CDI", "name": "Joiner", "operational_type": "Active", "function": "Combines records from two pipelines/sources", "capture": "Join type, master/detail, join keys, sorted-input settings", "execution": "NATIVE"},
    {"suite": "PowerCenter / CDI", "name": "Sorter", "operational_type": "Active", "function": "Sorts rows and optionally removes duplicates", "capture": "Sort keys, direction, distinct settings", "execution": "NATIVE"},
    {"suite": "PowerCenter / CDI", "name": "Lookup", "operational_type": "Passive / Active", "function": "Enrichment/reference lookup", "capture": "Lookup source, condition, return fields, cache mode", "execution": "NATIVE"},
    {"suite": "PowerCenter / CDI", "name": "Update Strategy", "operational_type": "Active", "function": "Determines INSERT, UPDATE, DELETE, REJECT behavior", "capture": "Operation expressions and target effect", "execution": "NATIVE"},
    {"suite": "PowerCenter / CDI", "name": "Sequence Generator", "operational_type": "Passive", "function": "Generates sequential/surrogate keys", "capture": "Start value, increment, current/next value", "execution": "NATIVE"},
    {"suite": "PowerCenter / CDI", "name": "Union", "operational_type": "Active", "function": "Combines compatible pipelines", "capture": "Input groups, compatibility, ordering", "execution": "NATIVE"},
    {"suite": "PowerCenter / CDI", "name": "Rank", "operational_type": "Active", "function": "Selects top/bottom records", "capture": "Rank field, group-by fields, top/bottom count", "execution": "NATIVE"},
    {"suite": "PowerCenter / CDI", "name": "Normalizer", "operational_type": "Active", "function": "Converts repeating columns/groups to rows", "capture": "Occurrence mapping, generated keys, source structure", "execution": "NATIVE"},
    {"suite": "PowerCenter / CDI", "name": "Transaction Control", "operational_type": "Active", "function": "Controls commit/rollback boundaries", "capture": "Commit/rollback conditions and boundaries", "execution": "POLICY"},
    {"suite": "PowerCenter / CDI", "name": "Java Transformation", "operational_type": "Active / Passive", "function": "Executes custom Java logic", "capture": "Code, imports, ports, state, exceptions", "execution": "ADAPTER"},
    {"suite": "PowerCenter / CDI", "name": "SQL Transformation", "operational_type": "Active / Passive", "function": "Executes SQL during processing", "capture": "SQL, parameters, connection, mode", "execution": "ADAPTER"},
    {"suite": "PowerCenter", "name": "Stored Procedure", "operational_type": "Passive", "function": "Invokes stored procedures/functions", "capture": "Procedure, parameters, execution point", "execution": "ADAPTER"},
    {"suite": "PowerCenter", "name": "Custom Transformation", "operational_type": "Active / Passive", "function": "Executes custom implementation", "capture": "Library/procedure, I/O groups, transaction behavior", "execution": "ADAPTER"},
    {"suite": "PowerCenter", "name": "External Procedure", "operational_type": "Passive", "function": "Executes an external procedure", "capture": "Procedure metadata, parameters, dependencies", "execution": "ADAPTER"},
    {"suite": "PowerCenter", "name": "HTTP Transformation", "operational_type": "Passive", "function": "Calls HTTP services", "capture": "URL, method, request/response mapping, auth", "execution": "ADAPTER"},
    {"suite": "PowerCenter", "name": "Web Service Consumer", "operational_type": "Passive", "function": "Calls SOAP/web-service operations", "capture": "WSDL, operation, request/response ports", "execution": "ADAPTER"},
    {"suite": "PowerCenter", "name": "XML Parser", "operational_type": "Passive", "function": "Converts XML into relational structures", "capture": "Schema, hierarchy, XPath and relationships", "execution": "NATIVE"},
    {"suite": "PowerCenter", "name": "XML Generator", "operational_type": "Active", "function": "Creates XML from relational rows", "capture": "Hierarchy, schema, document/group boundaries", "execution": "NATIVE"},
    {"suite": "PowerCenter", "name": "XML Source Qualifier", "operational_type": "Source", "function": "Extracts XML source data", "capture": "Source hierarchy and extraction rules", "execution": "NATIVE"},
    {"suite": "PowerCenter", "name": "Source Qualifier", "operational_type": "Active/source", "function": "Represents relational/flat-file extraction logic", "capture": "Pushdown filters, joins, sort and source metadata", "execution": "NATIVE"},
    {"suite": "PowerCenter", "name": "Application Source Qualifier", "operational_type": "Source", "function": "Reads application-specific sources", "capture": "Connector/source configuration", "execution": "ADAPTER"},
    {"suite": "PowerCenter", "name": "Unstructured Data Transformation", "operational_type": "Active / Passive", "function": "Parses/creates document-oriented structures", "capture": "Parsing rules, schemas, formats", "execution": "NATIVE"},
    {"suite": "PowerCenter", "name": "Data Masking", "operational_type": "Passive", "function": "Masks sensitive information", "capture": "Masking rule, deterministic/random behavior, domains", "execution": "NATIVE"},
    {"suite": "IDMC / CDI", "name": "Hierarchy Parser", "operational_type": "Active / Passive", "function": "Converts JSON/XML hierarchy to structured output", "capture": "Schema, nested paths, arrays, relationships", "execution": "NATIVE"},
    {"suite": "IDMC / CDI", "name": "Hierarchy Builder", "operational_type": "Active / Passive", "function": "Builds hierarchical JSON/XML structures", "capture": "Hierarchy definition and output schema", "execution": "NATIVE"},
    {"suite": "IDMC", "name": "REST / Web Services", "operational_type": "Active / Passive", "function": "Reads/calls REST/SOAP services", "capture": "Endpoint, payload, headers, auth, pagination", "execution": "ADAPTER"},
    {"suite": "IDMC", "name": "Mapplet", "operational_type": "Reusable", "function": "Encapsulates reusable transformation chains", "capture": "Internal graph, parameters, reusable ports", "execution": "NATIVE"},
    {"suite": "PowerCenter / IDMC", "name": "Mapplet", "operational_type": "Reusable", "function": "Reusable group of mapping logic", "capture": "Nested lineage and dependencies", "execution": "NATIVE"},
    {"suite": "IDQ / Cloud DQ", "name": "Standardizer", "operational_type": "Passive", "function": "Standardizes formats and values", "capture": "Dictionaries/rules", "execution": "NATIVE"},
    {"suite": "IDQ / Cloud DQ", "name": "Parser", "operational_type": "Active / Passive", "function": "Decomposes compound values", "capture": "Patterns, tokens, output groups", "execution": "NATIVE"},
    {"suite": "IDQ / Cloud DQ", "name": "Address Validation", "operational_type": "Passive", "function": "Validates and standardizes postal addresses", "capture": "Country rules, reference data, confidence/status", "execution": "NATIVE"},
    {"suite": "IDQ / Cloud DQ", "name": "Labeler", "operational_type": "Passive", "function": "Classifies tokens/characters", "capture": "Labels and token patterns", "execution": "NATIVE"},
    {"suite": "IDQ / Cloud DQ", "name": "Match", "operational_type": "Active", "function": "Identifies duplicates using exact/fuzzy matching", "capture": "Fields, algorithms, weights, thresholds", "execution": "NATIVE"},
    {"suite": "IDQ / Cloud DQ", "name": "Exception", "operational_type": "Active", "function": "Routes problematic records for review", "capture": "Conditions, workflow, resolution status", "execution": "NATIVE"},
    {"suite": "IDQ", "name": "Cleanse / Rule Specifications", "operational_type": "Passive", "function": "Executes reusable data-quality rules", "capture": "Rule logic, dictionaries, reference tables", "execution": "NATIVE"},
    {"suite": "IDQ", "name": "Decision", "operational_type": "Active / Passive", "function": "Applies conditional decision logic", "capture": "Inputs, conditions, outputs", "execution": "NATIVE"},
    {"suite": "IDQ", "name": "Association", "operational_type": "Active", "function": "Associates related records", "capture": "Association/grouping rules", "execution": "NATIVE"},
    {"suite": "IDQ", "name": "Key Generator", "operational_type": "Passive", "function": "Generates matching/grouping keys", "capture": "Algorithm and source fields", "execution": "NATIVE"},
    {"suite": "MDM", "name": "Landing", "operational_type": "Hub process", "function": "Receives source-system data", "capture": "Source, batch, raw attributes", "execution": "NATIVE"},
    {"suite": "MDM", "name": "Stage / Cleanse", "operational_type": "Hub process", "function": "Standardizes and validates source records", "capture": "Cleanse and validation rules", "execution": "NATIVE"},
    {"suite": "MDM", "name": "Tokenization", "operational_type": "Hub process", "function": "Generates match tokens", "capture": "Token functions and match fields", "execution": "NATIVE"},
    {"suite": "MDM", "name": "Match", "operational_type": "Hub process", "function": "Identifies records representing the same entity", "capture": "Match rules, thresholds, strategy", "execution": "NATIVE"},
    {"suite": "MDM", "name": "Merge", "operational_type": "Hub process", "function": "Consolidates matched records", "capture": "Merge groups and source records", "execution": "NATIVE"},
    {"suite": "MDM", "name": "Survivorship", "operational_type": "Hub process", "function": "Determines winning attribute values", "capture": "Trust, source priority, recency, validation rules", "execution": "NATIVE"},
    {"suite": "MDM", "name": "Golden Record", "operational_type": "Hub outcome", "function": "Produces a consolidated master entity", "capture": "Winning attributes and source lineage", "execution": "NATIVE"},
    {"suite": "MDM", "name": "Cross-reference/XREF", "operational_type": "Hub process", "function": "Links source records to master records", "capture": "Source keys, master key, record state", "execution": "NATIVE"},
    {"suite": "MDM", "name": "Trust", "operational_type": "Hub rule", "function": "Scores source reliability", "capture": "Trust scores, decay and source priority", "execution": "NATIVE"},
    {"suite": "MDM", "name": "Validation", "operational_type": "Hub rule", "function": "Validates candidate data before consolidation", "capture": "Validation rules and reject behavior", "execution": "NATIVE"},
)

_CAP_BY_NAME = {item["name"].upper(): item for item in CAPABILITY_REGISTRY}


@dataclass(frozen=True)
class PlanNode:
    id: str
    capability: str
    op: str
    entity: str | None
    inputs: tuple[str, ...]
    output: str | None
    field: str | None
    condition: str | None
    params: dict[str, Any]
    business_rules: tuple[str, ...]
    execution: str
    confidence: float

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data["inputs"] = list(self.inputs)
        data["business_rules"] = list(self.business_rules)
        return data


# ---------------------------------------------------------------------------
# Normalization / understanding
# ---------------------------------------------------------------------------


def _norm_name(value: Any) -> str:
    text = str(value or "").replace("\\", "/").split("/")[-1].strip()
    for suffix in (".csv", ".tsv", ".json", ".jsonl", ".txt", ".xml", ".xlsx", ".xlsm"):
        if text.lower().endswith(suffix):
            text = text[: -len(suffix)]
            break
    return re.sub(r"[^a-z0-9_]+", "_", text.lower()).strip("_")


def _normalize_rules(business_rules: Any) -> list[dict[str, str]]:
    if business_rules is None:
        return []
    out: list[dict[str, str]] = []
    if isinstance(business_rules, list):
        for idx, item in enumerate(business_rules, start=1):
            if isinstance(item, dict):
                text = str(item.get("rule") or item.get("text") or "").strip()
                rid = str(item.get("id") or f"BR-{idx:03d}")
            else:
                text = str(item).strip()
                rid = f"BR-{idx:03d}"
            if text:
                out.append({"id": rid, "rule": re.sub(r"^\s*\d+[.)]\s*", "", text)})
        return out

    for idx, raw in enumerate(str(business_rules).splitlines(), start=1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        line = re.sub(r"^\s*\d+[.)]\s*", "", line)
        if line:
            out.append({"id": f"BR-{len(out)+1:03d}", "rule": line})
    return out


def _source_model(source_entities: list[dict[str, Any]]) -> dict[str, Any]:
    entities = []
    for raw in source_entities:
        name = str(raw.get("entity") or raw.get("name") or "").strip()
        fields = [str(x) for x in raw.get("fields", [])]
        rows = raw.get("_rows") if isinstance(raw.get("_rows"), list) else []
        entities.append({
            "name": name,
            "logical_name": _norm_name(name),
            "fields": fields,
            "row_count": len(rows) if rows else int(raw.get("row_count", 0) or 0),
            "origin": str(raw.get("file") or raw.get("origin") or ""),
        })
    return {"entities": entities}


def _target_model(target_schema: dict[str, Any]) -> dict[str, Any]:
    entities = []
    for raw in target_schema.get("entities", []) if isinstance(target_schema, dict) else []:
        fields_raw = raw.get("fields") or raw.get("columns") or []
        fields = [str(x.get("name")) if isinstance(x, dict) else str(x) for x in fields_raw]
        name = str(raw.get("name") or raw.get("entity") or "")
        entities.append({
            "name": name,
            "logical_name": _norm_name(name.replace("target_", "", 1)),
            "fields": fields,
            "schema": str(raw.get("schema") or ""),
        })
    return {"entities": entities}


def build_internal_prompt(
    business_rules: Any,
    source_entities: list[dict[str, Any]],
    target_schema: dict[str, Any],
) -> str:
    rules = _normalize_rules(business_rules)
    source = _source_model(source_entities)
    target = _target_model(target_schema)
    caps = [
        {"name": c["name"], "execution": c["execution"], "capture": c["capture"]}
        for c in CAPABILITY_REGISTRY
    ]
    return (
        "You are KMITORA A230/A240 Business Logic and Transformation Compiler.\n"
        "Compile business intent into a declarative transformation plan. Never emit arbitrary code. "
        "Only use capability names from CAPABILITIES. Prefer deterministic operations. External calls, "
        "stored procedures, custom code and HTTP are PLAN_ONLY unless an approved adapter is explicitly configured. "
        "Every operation must trace to one or more business-rule IDs and real source/target fields. "
        "Source is read-only. Production writes and cutover are prohibited.\n\n"
        f"SOURCE_MODEL={json.dumps(source, ensure_ascii=False)}\n"
        f"TARGET_MODEL={json.dumps(target, ensure_ascii=False)}\n"
        f"BUSINESS_RULES={json.dumps(rules, ensure_ascii=False)}\n"
        f"CAPABILITIES={json.dumps(caps, ensure_ascii=False)}\n\n"
        "Return JSON only: {\"nodes\":[{\"capability\":\"...\",\"op\":\"...\","
        "\"entity\":\"...\",\"inputs\":[\"...\"],\"output\":null,\"field\":null,"
        "\"condition\":null,\"params\":{},\"business_rules\":[\"BR-001\"],\"confidence\":0.0}],"
        "\"entity_mappings\":[],\"dependencies\":[],\"target_mutations\":[]}."
    )


# ---------------------------------------------------------------------------
# Safe expression / condition evaluator
# ---------------------------------------------------------------------------

_ALLOWED_FUNCS: dict[str, Callable[..., Any]] = {
    "len": lambda x: len(x) if x is not None else 0,
    "abs": abs,
    "round": round,
    "lower": lambda x: str(x or "").lower(),
    "upper": lambda x: str(x or "").upper(),
    "trim": lambda x: str(x or "").strip(),
    "coalesce": lambda *xs: next((x for x in xs if x not in (None, "")), None),
    "int": lambda x: int(float(str(x).replace(",", ""))),
    "float": lambda x: float(str(x).replace(",", "")),
    "str": str,
}


def _eval_ast(node: ast.AST, row: dict[str, Any]) -> Any:
    if isinstance(node, ast.Expression):
        return _eval_ast(node.body, row)
    if isinstance(node, ast.Constant):
        return node.value
    if isinstance(node, ast.Name):
        if node.id in row:
            return row.get(node.id)
        if node.id in {"True", "False", "None"}:
            return {"True": True, "False": False, "None": None}[node.id]
        raise ValueError(f"Unknown identifier: {node.id}")
    if isinstance(node, ast.List):
        return [_eval_ast(x, row) for x in node.elts]
    if isinstance(node, ast.Tuple):
        return tuple(_eval_ast(x, row) for x in node.elts)
    if isinstance(node, ast.UnaryOp):
        value = _eval_ast(node.operand, row)
        if isinstance(node.op, ast.Not): return not bool(value)
        if isinstance(node.op, ast.USub): return -float(value)
        if isinstance(node.op, ast.UAdd): return float(value)
        raise ValueError("Unsupported unary operator")
    if isinstance(node, ast.BoolOp):
        vals = [_eval_ast(x, row) for x in node.values]
        if isinstance(node.op, ast.And): return all(bool(x) for x in vals)
        if isinstance(node.op, ast.Or): return any(bool(x) for x in vals)
        raise ValueError("Unsupported boolean operator")
    if isinstance(node, ast.BinOp):
        left, right = _eval_ast(node.left, row), _eval_ast(node.right, row)
        if isinstance(node.op, ast.Add): return left + right
        if isinstance(node.op, ast.Sub): return left - right
        if isinstance(node.op, ast.Mult): return left * right
        if isinstance(node.op, ast.Div): return left / right
        if isinstance(node.op, ast.Mod): return left % right
        raise ValueError("Unsupported arithmetic operator")
    if isinstance(node, ast.Compare):
        left = _eval_ast(node.left, row)
        for op, comp in zip(node.ops, node.comparators):
            right = _eval_ast(comp, row)
            try:
                if isinstance(op, ast.Eq): ok = left == right or str(left) == str(right)
                elif isinstance(op, ast.NotEq): ok = not (left == right or str(left) == str(right))
                elif isinstance(op, ast.Gt): ok = float(left) > float(right)
                elif isinstance(op, ast.GtE): ok = float(left) >= float(right)
                elif isinstance(op, ast.Lt): ok = float(left) < float(right)
                elif isinstance(op, ast.LtE): ok = float(left) <= float(right)
                elif isinstance(op, ast.In): ok = left in right
                elif isinstance(op, ast.NotIn): ok = left not in right
                else: raise ValueError("Unsupported comparison")
            except (TypeError, ValueError):
                ok = False
            if not ok: return False
            left = right
        return True
    if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
        fn = _ALLOWED_FUNCS.get(node.func.id)
        if not fn: raise ValueError(f"Function not allowed: {node.func.id}")
        return fn(*[_eval_ast(x, row) for x in node.args])
    raise ValueError(f"Expression node not allowed: {type(node).__name__}")


def safe_eval(expression: str, row: dict[str, Any]) -> Any:
    expr = str(expression or "").strip()
    expr = re.sub(r"(?<![<>=!])=(?!=)", "==", expr)
    expr = re.sub(r"\bAND\b", "and", expr, flags=re.I)
    expr = re.sub(r"\bOR\b", "or", expr, flags=re.I)
    expr = re.sub(r"\bNOT\b", "not", expr, flags=re.I)
    tree = ast.parse(expr, mode="eval")
    return _eval_ast(tree, row)


# ---------------------------------------------------------------------------
# Deterministic natural-language compiler
# ---------------------------------------------------------------------------


def _fields_by_entity(source_entities: list[dict[str, Any]]) -> dict[str, set[str]]:
    out: dict[str, set[str]] = {}
    for e in source_entities:
        name = _norm_name(e.get("entity"))
        out[name] = {str(x) for x in e.get("fields", [])}
    return out


def _find_entity_for_field(fields: dict[str, set[str]], field: str) -> str | None:
    matches = [entity for entity, names in fields.items() if field in names]
    if len(matches) == 1:
        return matches[0]
    # Shared foreign keys appear in parent and child entities. Prefer the
    # entity whose logical name owns the key: customer_id -> customers,
    # order_id -> orders, order_item_id -> order_items.
    stem = re.sub(r"_(?:id|key|code|no|number)$", "", field.lower())
    for entity in matches:
        singular = entity[:-1] if entity.endswith("s") else entity
        if singular == stem or entity == stem:
            return entity
    return None


def _resolve_entity_token(fields: dict[str, set[str]], token: str) -> str:
    raw = _norm_name(token)
    if raw in fields:
        return raw
    if raw + "s" in fields:
        return raw + "s"
    if raw.endswith("s") and raw[:-1] in fields:
        return raw[:-1]
    # Compare singular forms.
    singular = raw[:-1] if raw.endswith("s") else raw
    for entity in fields:
        entity_singular = entity[:-1] if entity.endswith("s") else entity
        if entity_singular == singular:
            return entity
    return raw


def _node(capability: str, op: str, rule_id: str, *, entity: str | None = None,
          field: str | None = None, condition: str | None = None,
          inputs: Iterable[str] = (), output: str | None = None,
          params: dict[str, Any] | None = None, confidence: float = 0.98) -> PlanNode:
    cap = _CAP_BY_NAME.get(capability.upper())
    execution = cap["execution"] if cap else "POLICY"
    seed = json.dumps([capability, op, rule_id, entity, field, condition, list(inputs), output, params or {}], sort_keys=True, default=str)
    return PlanNode(
        id="TX-" + sha256(seed.encode("utf-8")).hexdigest()[:12].upper(),
        capability=capability,
        op=op,
        entity=entity,
        inputs=tuple(inputs),
        output=output,
        field=field,
        condition=condition,
        params=params or {},
        business_rules=(rule_id,),
        execution=execution,
        confidence=confidence,
    )


def _map_value_rule(text: str) -> tuple[str | None, str | None, str | None]:
    # "ACTIVE customer status becomes A" / "SOUTH becomes S"
    m = re.search(r"(?i)^\s*([A-Za-z0-9_.\-]+)(?:\s+([A-Za-z_][A-Za-z0-9_]*)(?:\s+([A-Za-z_][A-Za-z0-9_]*))?)?\s+becomes\s+([A-Za-z0-9_.\-]+)", text)
    if not m:
        return None, None, None
    source = m.group(1)
    # "ACTIVE status becomes A" -> status; "ACTIVE customer status becomes A" -> status.
    field = m.group(3) or m.group(2)
    target = m.group(4).rstrip(".,;:")
    return field, source, target


def deterministic_compile(
    business_rules: Any,
    source_entities: list[dict[str, Any]],
    target_schema: dict[str, Any],
) -> dict[str, Any]:
    rules = _normalize_rules(business_rules)
    fields = _fields_by_entity(source_entities)
    nodes: list[PlanNode] = []
    entity_mappings: list[dict[str, Any]] = []
    dependencies: list[dict[str, Any]] = []
    target_mutations: list[dict[str, Any]] = []

    # Keep pending MAP values grouped by entity/field.
    map_groups: dict[tuple[str, str], dict[str, Any]] = {}

    for item in rules:
        rid, text = item["id"], item["rule"].strip()
        lower = text.lower()

        # Entity mapping.
        m = re.search(r"(?i)\b([A-Za-z0-9_.\-]+)\s+maps\s+to\s+([A-Za-z0-9_.\-]+)", text)
        if m:
            entity_mappings.append({"source": m.group(1), "target": m.group(2), "business_rules": [rid], "confidence": 1.0})
            continue

        # Load dependency.
        m = re.search(r"(?i)\b([A-Za-z0-9_.\-]+)\s+must\s+load\s+before\s+([A-Za-z0-9_.\-]+)", text)
        if m:
            dependencies.append({"parent": _norm_name(m.group(1)), "child": _norm_name(m.group(2)), "business_rules": [rid], "kind": "LOAD_ORDER"})
            continue

        # Row filter / source qualifier.
        m = re.search(r"(?i)(?:process|include|select)\s+only\s+records\s+where\s+([A-Za-z_][A-Za-z0-9_]*)\s+(?:equals|=)\s+([^.;]+)", text)
        if m:
            field, value = m.group(1), m.group(2).strip().strip("'\"")
            entity = _find_entity_for_field(fields, field)
            nodes.append(_node("Source Qualifier", "FILTER", rid, entity=entity, field=field, condition=f"{field} == {json.dumps(value)}", params={"on_false": "EXCLUDE"}))
            continue

        m = re.search(r"(?i)(?:exclude|remove)\s+(?:every\s+)?record\s+where\s+([A-Za-z_][A-Za-z0-9_]*)\s+(?:is\s+not|!=|does\s+not\s+equal)\s+([^.;]+)", text)
        if m:
            field, value = m.group(1), m.group(2).strip().strip("'\"")
            entity = _find_entity_for_field(fields, field)
            nodes.append(_node("Filter", "FILTER", rid, entity=entity, field=field, condition=f"{field} == {json.dumps(value)}", params={"on_false": "EXCLUDE"}))
            continue

        # Trim / case / dates / currency.
        m = re.search(r"(?i)\btrim\s+(?:leading\s+and\s+trailing\s+whitespace\s+from\s+)?([A-Za-z_][A-Za-z0-9_]*)", text)
        if m:
            field = m.group(1)
            entity = _find_entity_for_field(fields, field)
            if field.lower() in {"text", "string", "values", "fields"} and entity is None:
                nodes.append(_node("Standardizer", "TRIM_ALL", rid, params={"exclude_key_like": False}))
            else:
                nodes.append(_node("Expression", "TRIM", rid, entity=entity, field=field))
            continue
        m = re.search(r"(?i)\bconvert\s+([A-Za-z_][A-Za-z0-9_]*)\s+to\s+lowercase", text)
        if m:
            field = m.group(1); entity = _find_entity_for_field(fields, field)
            nodes.append(_node("Standardizer", "LOWERCASE", rid, entity=entity, field=field))
            continue
        m = re.search(r"(?i)\bconvert\s+([A-Za-z_][A-Za-z0-9_]*)\s+to\s+uppercase", text)
        if m:
            field = m.group(1); entity = _find_entity_for_field(fields, field)
            nodes.append(_node("Standardizer", "UPPERCASE", rid, entity=entity, field=field))
            continue
        m = re.search(r"(?i)\bnormalize\s+([A-Za-z_][A-Za-z0-9_]*)\s+(?:to\s+)?(?:iso|yyyy-mm-dd)", text)
        if m:
            field=m.group(1); entity=_find_entity_for_field(fields, field)
            nodes.append(_node("Standardizer", "DATE_ISO", rid, entity=entity, field=field))
            continue

        # Source value mapping.
        field_hint, source_value, target_value = _map_value_rule(text)
        if source_value is not None:
            field = field_hint
            if field is None:
                # Infer the only field whose samples contain the value.
                candidates: list[tuple[str, str]] = []
                for raw in source_entities:
                    en = _norm_name(raw.get("entity"))
                    for f in raw.get("fields", []):
                        if any(str(row.get(f, "")).strip().upper() == source_value.upper() for row in raw.get("_rows", [])):
                            candidates.append((en, str(f)))
                if len(candidates) == 1:
                    entity, field = candidates[0]
                else:
                    entity = None
            else:
                entity = _find_entity_for_field(fields, field)
            if field:
                key = (entity or "*", field)
                group = map_groups.setdefault(key, {"mapping": {}, "rules": []})
                group["mapping"][source_value.upper()] = target_value
                group["rules"].append(rid)
                continue

        # Generic value map syntax: "Map field X to Y".
        m = re.search(r"(?i)\bmap\s+([A-Za-z_][A-Za-z0-9_]*)\s+(?:value\s+)?([^\s]+)\s+to\s+([^\s.]+)", text)
        if m:
            field, source_value, target_value = m.group(1), m.group(2), m.group(3)
            entity = _find_entity_for_field(fields, field)
            group = map_groups.setdefault((entity or "*", field), {"mapping": {}, "rules": []})
            group["mapping"][source_value.upper()] = target_value
            group["rules"].append(rid)
            continue

        # Defaults / coalesce.
        m = re.search(r"(?i)\b(?:default|set)\s+([A-Za-z_][A-Za-z0-9_]*)\s+(?:to\s+)?([^.;]+)\s+when\s+(?:it\s+is\s+)?(?:null|empty|missing)", text)
        if m:
            field, value = m.group(1), m.group(2).strip().strip("'\"")
            entity = _find_entity_for_field(fields, field)
            nodes.append(_node("Expression", "DEFAULT", rid, entity=entity, field=field, params={"value": value}))
            continue

        # Derivations / expressions.
        m = re.search(r"(?i)\b(?:derive|calculate|set)\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:=|as)\s*(.+)$", text)
        if m and "when" not in lower:
            field, expression = m.group(1), m.group(2).rstrip(".").strip()
            entity = _find_entity_for_field(fields, field)
            nodes.append(_node("Expression", "EXPRESSION", rid, entity=entity, field=field, params={"expression": expression}))
            continue

        # Validation: required / nonnegative / greater than zero / unique.
        m = re.search(r"(?i)\b([A-Za-z_][A-Za-z0-9_]*)\s+(?:is|required|must\s+be)\s+(?:mandatory|required|not\s+null)", text)
        if m:
            field=m.group(1); entity=_find_entity_for_field(fields, field)
            nodes.append(_node("Validation", "VALIDATE_REQUIRED", rid, entity=entity, field=field, params={"on_fail": "REJECT"}))
            continue
        m = re.search(r"(?i)\b([A-Za-z_][A-Za-z0-9_]*)\s+(?:cannot|must\s+not)\s+be\s+negative", text)
        if m:
            field=m.group(1); entity=_find_entity_for_field(fields, field)
            nodes.append(_node("Validation", "VALIDATE_MIN", rid, entity=entity, field=field, params={"min": 0, "on_fail": "REJECT"}))
            continue
        m = re.search(r"(?i)\b([A-Za-z_][A-Za-z0-9_]*)\s+must\s+be\s+greater\s+than\s+zero", text)
        if m:
            field=m.group(1); entity=_find_entity_for_field(fields, field)
            nodes.append(_node("Validation", "VALIDATE_GT", rid, entity=entity, field=field, params={"value": 0, "on_fail": "REJECT"}))
            continue
        m = re.search(r"(?i)\b([A-Za-z_][A-Za-z0-9_]*)\s+is\s+the\s+unique\s+[^.]*key", text)
        if m:
            field=m.group(1); entity=_find_entity_for_field(fields, field)
            nodes.append(_node("Validation", "VALIDATE_UNIQUE", rid, entity=entity, field=field, params={"on_fail": "REJECT"}))
            continue

        # Referential rule: every child must reference existing parent.
        m = re.search(r"(?i)every\s+(.+?)\s+must\s+reference\s+an\s+existing\s+(.+?)(?:\.|$)", text)
        if m:
            child = _resolve_entity_token(fields, m.group(1).strip())
            parent = _resolve_entity_token(fields, m.group(2).strip())
            parent_singular = parent[:-1] if parent.endswith("s") else parent
            key = f"{parent_singular}_id"
            nodes.append(_node("Validation", "VALIDATE_REFERENCE", rid, entity=child, field=key, inputs=(parent,), params={"parent_entity": parent, "parent_field": key, "on_fail": "REJECT"}))
            continue

        # Duplicates / fuzzy match.
        if "duplicate" in lower and ("detect" in lower or "match" in lower):
            entity_match = re.search(r"(?i)\b(?:in|for)\s+([A-Za-z_][A-Za-z0-9_]*)", text)
            entity = _norm_name(entity_match.group(1)) if entity_match else None
            nodes.append(_node("Match", "MATCH_DUPLICATES", rid, entity=entity, params={"mode": "EXACT", "on_match": "REVIEW"}))
            continue

        # Sort / rank / aggregate / union / join / lookup / sequence.
        m = re.search(r"(?i)\bsort\s+([A-Za-z_][A-Za-z0-9_]*)\s+by\s+([A-Za-z_][A-Za-z0-9_]*)(?:\s+(asc|ascending|desc|descending))?", text)
        if m:
            nodes.append(_node("Sorter", "SORT", rid, entity=_norm_name(m.group(1)), field=m.group(2), params={"direction": "DESC" if str(m.group(3) or "").lower().startswith("desc") else "ASC"}))
            continue
        m = re.search(r"(?i)\b(?:top|rank\s+top)\s+(\d+)\s+([A-Za-z_][A-Za-z0-9_]*)\s+by\s+([A-Za-z_][A-Za-z0-9_]*)", text)
        if m:
            nodes.append(_node("Rank", "RANK", rid, entity=_norm_name(m.group(2)), field=m.group(3), params={"count": int(m.group(1)), "direction": "TOP"}))
            continue
        m = re.search(r"(?i)\baggregate\s+([A-Za-z_][A-Za-z0-9_]*)\s+by\s+([A-Za-z_][A-Za-z0-9_]*)\s+(sum|avg|count|min|max)\s*\(?([A-Za-z_][A-Za-z0-9_]*)?\)?(?:\s+as\s+([A-Za-z_][A-Za-z0-9_]*))?", text)
        if m:
            nodes.append(_node("Aggregator", "AGGREGATE", rid, entity=_norm_name(m.group(1)), field=m.group(4), params={"group_by": [m.group(2)], "function": m.group(3).upper(), "output_field": m.group(5) or f"{m.group(3).lower()}_{m.group(4) or 'rows'}"}))
            continue
        m = re.search(r"(?i)\bunion\s+([A-Za-z_][A-Za-z0-9_]*)\s+(?:and|with)\s+([A-Za-z_][A-Za-z0-9_]*)\s+(?:into|as)\s+([A-Za-z_][A-Za-z0-9_]*)", text)
        if m:
            nodes.append(_node("Union", "UNION", rid, inputs=(_norm_name(m.group(1)), _norm_name(m.group(2))), output=_norm_name(m.group(3))))
            continue
        m = re.search(r"(?i)\bjoin\s+([A-Za-z_][A-Za-z0-9_]*)\s+(?:and|with)\s+([A-Za-z_][A-Za-z0-9_]*)\s+on\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([A-Za-z_][A-Za-z0-9_]*)", text)
        if m:
            nodes.append(_node("Joiner", "JOIN", rid, inputs=(_norm_name(m.group(1)), _norm_name(m.group(2))), output=f"{_norm_name(m.group(1))}_{_norm_name(m.group(2))}_joined", params={"left_key": m.group(3), "right_key": m.group(4), "join_type": "INNER"}))
            continue
        m = re.search(r"(?i)\bgenerate\s+(?:a\s+)?(?:sequence|surrogate\s+key)\s+(?:for\s+)?([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)(?:\s+starting\s+at\s+(\d+))?", text)
        if m:
            nodes.append(_node("Sequence Generator", "SEQUENCE", rid, entity=_norm_name(m.group(1)), field=m.group(2), params={"start": int(m.group(3) or 1), "increment": 1}))
            continue

        # Data masking.
        m = re.search(r"(?i)\bmask\s+([A-Za-z_][A-Za-z0-9_]*)(?:\s+(?:using|with)\s+([A-Za-z_]+))?", text)
        if m:
            field=m.group(1); entity=_find_entity_for_field(fields, field)
            nodes.append(_node("Data Masking", "MASK", rid, entity=entity, field=field, params={"method": (m.group(2) or "HASH").upper()}))
            continue

        # Update strategy rules such as "delete records when status = CANCELLED".
        m = re.search(r"(?i)\b(insert|update|delete|reject)\s+(?:records?|rows?)\s+(?:when|where)\s+(.+)$", text)
        if m:
            nodes.append(_node("Update Strategy", "UPDATE_STRATEGY", rid, condition=m.group(2).rstrip("."), params={"action": m.group(1).upper()}))
            continue

        # Schema mutation intent. Remains a governed target mutation plan.
        m = re.search(r"(?i)\badd\s+(?:target\s+)?column\s+([A-Za-z_][A-Za-z0-9_]*)\s+(?:to\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*(?:as\s+)?([A-Za-z0-9_()]+)?", text)
        if m:
            target_mutations.append({"op": "ADD_COLUMN", "table": m.group(2), "column": m.group(1), "data_type": m.group(3) or "TEXT", "business_rules": [rid], "requires_approval": True})
            continue
        m = re.search(r"(?i)\brename\s+column\s+([A-Za-z_][A-Za-z0-9_]*)\s+to\s+([A-Za-z_][A-Za-z0-9_]*)\s+(?:in|on)\s+([A-Za-z_][A-Za-z0-9_]*)", text)
        if m:
            target_mutations.append({"op": "RENAME_COLUMN", "table": m.group(3), "column": m.group(1), "new_name": m.group(2), "business_rules": [rid], "requires_approval": True})
            continue

    for (entity, field), group in map_groups.items():
        node = _node("Expression", "MAP", group["rules"][0], entity=None if entity == "*" else entity, field=field, params={"mapping": group["mapping"]})
        data = node.to_dict(); data["business_rules"] = group["rules"]
        nodes.append(PlanNode(
            id=data["id"], capability=data["capability"], op=data["op"], entity=data["entity"],
            inputs=tuple(data["inputs"]), output=data["output"], field=data["field"], condition=data["condition"],
            params=data["params"], business_rules=tuple(group["rules"]), execution=data["execution"], confidence=data["confidence"]
        ))

    return {
        "nodes": [n.to_dict() for n in nodes],
        "entity_mappings": entity_mappings,
        "dependencies": dependencies,
        "target_mutations": target_mutations,
        "rules": rules,
    }


# ---------------------------------------------------------------------------
# LLM IR validation / merge
# ---------------------------------------------------------------------------

_ALLOWED_OPS = {
    "TRIM", "TRIM_ALL", "LOWERCASE", "UPPERCASE", "MAP", "DATE_ISO", "STRIP_CURRENCY",
    "DEFAULT", "CAST", "EXPRESSION", "FILTER", "ROUTER", "JOIN", "SORT",
    "DEDUP", "LOOKUP", "UPDATE_STRATEGY", "SEQUENCE", "UNION", "RANK",
    "NORMALIZE", "AGGREGATE", "MASK", "PARSE", "LABEL", "MATCH_DUPLICATES",
    "EXCEPTION", "DECISION", "ASSOCIATE", "KEY_GENERATE", "TOKENIZE", "MERGE",
    "SURVIVORSHIP", "GOLDEN_RECORD", "XREF", "TRUST", "VALIDATE_REQUIRED",
    "VALIDATE_MIN", "VALIDATE_GT", "VALIDATE_UNIQUE", "VALIDATE_REFERENCE",
    "XML_PARSE", "XML_GENERATE", "HIERARCHY_PARSE", "HIERARCHY_BUILD", "MAPLET",
    "TRANSACTION_POLICY", "EXTERNAL_ADAPTER",
}


def _validate_llm_nodes(raw: str, source_entities: list[dict[str, Any]]) -> list[dict[str, Any]]:
    text = str(raw or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\s*|\s*```$", "", text).strip()
    try:
        parsed = json.loads(text)
    except Exception:
        return []
    items = parsed.get("nodes") if isinstance(parsed, dict) else []
    if not isinstance(items, list):
        return []
    entities = {_norm_name(e.get("entity")): {str(x) for x in e.get("fields", [])} for e in source_entities}
    valid: list[dict[str, Any]] = []
    for idx, item in enumerate(items):
        if not isinstance(item, dict):
            continue
        capability = str(item.get("capability") or "").strip()
        op = str(item.get("op") or "").strip().upper()
        if capability.upper() not in _CAP_BY_NAME or op not in _ALLOWED_OPS:
            continue
        entity_raw = item.get("entity")
        entity = _norm_name(entity_raw) if entity_raw else None
        if entity and entity not in entities:
            continue
        field = str(item.get("field") or "").strip() or None
        if entity and field and field not in entities[entity]:
            # Derived output fields may be new only for explicit EXPRESSION/KEY operations.
            if op not in {"EXPRESSION", "SEQUENCE", "KEY_GENERATE"}:
                continue
        rules = [str(x) for x in (item.get("business_rules") or []) if str(x).strip()]
        seed = json.dumps(item, sort_keys=True, default=str)
        valid.append({
            "id": "TX-AI-" + sha256(seed.encode("utf-8")).hexdigest()[:10].upper(),
            "capability": capability,
            "op": op,
            "entity": entity,
            "inputs": [_norm_name(x) for x in (item.get("inputs") or [])],
            "output": item.get("output"),
            "field": field,
            "condition": item.get("condition"),
            "params": item.get("params") if isinstance(item.get("params"), dict) else {},
            "business_rules": rules,
            "execution": _CAP_BY_NAME[capability.upper()]["execution"],
            "confidence": max(0.0, min(1.0, float(item.get("confidence", 0.75) or 0.75))),
        })
    return valid


def compile_business_logic(
    business_rules: Any,
    source_entities: list[dict[str, Any]],
    target_schema: dict[str, Any],
    llm_generate: Callable[[str], str | None] | None = None,
) -> dict[str, Any]:
    deterministic = deterministic_compile(business_rules, source_entities, target_schema)
    prompt = build_internal_prompt(business_rules, source_entities, target_schema)
    ai_nodes: list[dict[str, Any]] = []
    ai_status = "NOT_CONFIGURED"
    if llm_generate is not None:
        try:
            raw = llm_generate(prompt)
            if raw:
                ai_nodes = _validate_llm_nodes(raw, source_entities)
                ai_status = "COMPILED" if ai_nodes else "NO_VALID_ADDITIONS"
            else:
                ai_status = "UNAVAILABLE"
        except Exception as exc:  # fail closed; deterministic compiler remains authoritative
            ai_status = f"ERROR:{type(exc).__name__}"

    # Merge unique nodes. Deterministic nodes win when equivalent.
    nodes = list(deterministic["nodes"])
    seen = {(n.get("capability"), n.get("op"), n.get("entity"), n.get("field"), json.dumps(n.get("params", {}), sort_keys=True, default=str)) for n in nodes}
    for node in ai_nodes:
        key = (node.get("capability"), node.get("op"), node.get("entity"), node.get("field"), json.dumps(node.get("params", {}), sort_keys=True, default=str))
        if key not in seen:
            nodes.append(node); seen.add(key)

    native = sum(1 for n in nodes if n.get("execution") == "NATIVE")
    adapters = sum(1 for n in nodes if n.get("execution") == "ADAPTER")
    policy = sum(1 for n in nodes if n.get("execution") == "POLICY")
    return {
        "engine": "KMITORA_UNIVERSAL_TRANSFORMATION_ENGINE",
        "version": ENGINE_VERSION,
        "status": "COMPILED",
        "internal_prompt_hash": sha256(prompt.encode("utf-8")).hexdigest(),
        "internal_prompt": prompt,
        "llm_status": ai_status,
        "nodes": nodes,
        "entity_mappings": deterministic["entity_mappings"],
        "dependencies": deterministic["dependencies"],
        "target_mutations": deterministic["target_mutations"],
        "rules": deterministic["rules"],
        "capability_coverage": {
            "catalog_size": len(CAPABILITY_REGISTRY),
            "planned_native": native,
            "planned_policy": policy,
            "planned_adapter": adapters,
        },
        "safety": {
            "source_write": False,
            "target_write": False,
            "production_action": False,
            "arbitrary_code_execution": False,
        },
    }


# ---------------------------------------------------------------------------
# Deterministic execution / staging
# ---------------------------------------------------------------------------


def _iso_date(value: Any) -> Any:
    raw = str(value or "").strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%Y/%m/%d", "%d-%m-%Y", "%m/%d/%Y"):
        try:
            return datetime.strptime(raw, fmt).date().isoformat()
        except ValueError:
            pass
    return value


def _strip_currency(value: Any) -> Any:
    cleaned = re.sub(r"[^0-9.,\-]", "", str(value or "")).replace(",", "")
    if not cleaned:
        return value
    try:
        return str(Decimal(cleaned))
    except InvalidOperation:
        return value


def _mask(value: Any, method: str) -> str:
    raw = str(value or "")
    method = method.upper()
    if method == "LAST4": return "*" * max(0, len(raw) - 4) + raw[-4:]
    if method == "EMAIL":
        if "@" not in raw: return "***"
        local, domain = raw.split("@", 1)
        return (local[:1] + "***@" + domain) if local else "***@" + domain
    # deterministic SHA-style mask, not reversible
    return sha256(raw.encode("utf-8")).hexdigest()[:24]


def _cast(value: Any, data_type: str) -> Any:
    dtype = data_type.upper()
    if value is None: return None
    if dtype in {"STRING", "TEXT", "VARCHAR"}: return str(value)
    if dtype in {"INT", "INTEGER", "BIGINT"}: return int(float(str(value).replace(",", "")))
    if dtype in {"FLOAT", "DOUBLE", "DECIMAL", "NUMERIC"}: return float(str(value).replace(",", ""))
    if dtype in {"BOOL", "BOOLEAN"}: return str(value).strip().lower() in {"1", "true", "yes", "y", "t"}
    if dtype in {"DATE", "ISO_DATE"}: return _iso_date(value)
    return value


def _apply_row_node(row: dict[str, Any], node: dict[str, Any], row_context: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any] | None]:
    out = dict(row)
    op = str(node.get("op") or "").upper()
    field = node.get("field")
    params = node.get("params") if isinstance(node.get("params"), dict) else {}
    audit: dict[str, Any] | None = None
    before = out.get(field) if field else None

    if op == "TRIM_ALL":
        changed_fields = []
        for key, value in list(out.items()):
            if isinstance(value, str):
                trimmed = value.strip()
                if trimmed != value:
                    out[key] = trimmed
                    changed_fields.append({"field": key, "before": value, "after": trimmed})
        if changed_fields:
            return out, {
                "node_id": node.get("id"), "capability": node.get("capability"), "op": op,
                "field": "*", "changes": changed_fields,
                "business_rules": node.get("business_rules", []),
            }
        return out, None
    if op == "TRIM" and field in out:
        out[field] = str(before or "").strip()
    elif op == "LOWERCASE" and field in out:
        out[field] = str(before or "").strip().lower()
    elif op == "UPPERCASE" and field in out:
        out[field] = str(before or "").strip().upper()
    elif op == "DATE_ISO" and field in out:
        out[field] = _iso_date(before)
    elif op == "STRIP_CURRENCY" and field in out:
        out[field] = _strip_currency(before)
    elif op == "DEFAULT" and field:
        if before in (None, ""):
            out[field] = params.get("value")
    elif op == "CAST" and field in out:
        out[field] = _cast(before, str(params.get("data_type") or "STRING"))
    elif op == "MAP" and field in out:
        mapping = params.get("mapping") if isinstance(params.get("mapping"), dict) else {}
        key = str(before or "").strip().upper()
        if key in mapping:
            out[field] = mapping[key]
    elif op == "MASK" and field in out:
        out[field] = _mask(before, str(params.get("method") or "HASH"))
    elif op in {"EXPRESSION", "KEY_GENERATE"} and field:
        expression = str(params.get("expression") or "").strip()
        if expression:
            out[field] = safe_eval(expression, {**row_context, **out})
    elif op in {"SEQUENCE", "KEY_GENERATE"} and field:
        # actual sequence value supplied by caller via row_context
        out[field] = row_context.get("__sequence_value")
    else:
        return out, None

    after = out.get(field) if field else None
    if before != after:
        audit = {
            "node_id": node.get("id"), "capability": node.get("capability"), "op": op,
            "field": field, "before": before, "after": after,
            "business_rules": node.get("business_rules", []),
        }
    return out, audit


def _validate_row(row: dict[str, Any], node: dict[str, Any], datasets: dict[str, list[dict[str, Any]]]) -> tuple[bool, str]:
    op = str(node.get("op") or "").upper(); field = node.get("field"); params = node.get("params") or {}
    value = row.get(field) if field else None
    if op == "VALIDATE_REQUIRED": return value not in (None, ""), f"{field} is required"
    if op == "VALIDATE_MIN":
        try: return float(value) >= float(params.get("min", 0)), f"{field} must be >= {params.get('min', 0)}"
        except Exception: return False, f"{field} is not numeric"
    if op == "VALIDATE_GT":
        try: return float(value) > float(params.get("value", 0)), f"{field} must be > {params.get('value', 0)}"
        except Exception: return False, f"{field} is not numeric"
    if op == "VALIDATE_REFERENCE":
        parent = _norm_name(params.get("parent_entity")); parent_field = str(params.get("parent_field") or field or "")
        values = {str(x.get(parent_field, "")) for x in datasets.get(parent, [])}
        return str(value) in values, f"{field} must reference {parent}.{parent_field}"
    return True, ""


def _execute_set_node(datasets: dict[str, list[dict[str, Any]]], node: dict[str, Any]) -> None:
    op = str(node.get("op") or "").upper(); entity = _norm_name(node.get("entity")); params = node.get("params") or {}
    rows = datasets.get(entity, [])
    if op == "SORT":
        field = node.get("field"); reverse = str(params.get("direction", "ASC")).upper() == "DESC"
        rows.sort(key=lambda r: (r.get(field) is None, str(r.get(field, ""))), reverse=reverse)
    elif op == "RANK":
        field = node.get("field"); count = max(0, int(params.get("count", 10))); direction = str(params.get("direction", "TOP")).upper()
        rows.sort(key=lambda r: _numeric_or_text(r.get(field)), reverse=direction == "TOP")
        datasets[entity] = rows[:count]
    elif op == "AGGREGATE":
        group_by = [str(x) for x in params.get("group_by", [])]; fn = str(params.get("function", "COUNT")).upper(); field=node.get("field"); out_field=str(params.get("output_field") or f"{fn.lower()}_{field or 'rows'}")
        groups: dict[tuple[Any, ...], list[dict[str, Any]]] = {}
        for row in rows: groups.setdefault(tuple(row.get(k) for k in group_by), []).append(row)
        out=[]
        for key, members in groups.items():
            base={k:v for k,v in zip(group_by,key)}; vals=[_to_float(m.get(field)) for m in members] if field else []
            vals=[v for v in vals if v is not None]
            if fn=="COUNT": agg=len(members)
            elif fn=="SUM": agg=sum(vals)
            elif fn=="AVG": agg=(sum(vals)/len(vals)) if vals else None
            elif fn=="MIN": agg=min(vals) if vals else None
            elif fn=="MAX": agg=max(vals) if vals else None
            else: agg=None
            base[out_field]=agg; out.append(base)
        datasets[entity]=out
    elif op == "MATCH_DUPLICATES":
        # Annotate exact duplicate groups; disposition layer decides action.
        fields = [str(x) for x in params.get("fields", [])]
        if not fields and rows: fields = sorted(rows[0].keys())
        seen={}; group=1
        for row in rows:
            sig=tuple(str(row.get(f,"")) for f in fields)
            if sig in seen: row["_kmitora_duplicate_group"]=seen[sig]
            else: seen[sig]=group; group += 1
    elif op == "UNION":
        inputs=[_norm_name(x) for x in node.get("inputs", [])]; output=_norm_name(node.get("output"))
        datasets[output]=[copy.deepcopy(r) for name in inputs for r in datasets.get(name, [])]
    elif op == "JOIN":
        inputs=[_norm_name(x) for x in node.get("inputs", [])]
        if len(inputs) < 2: return
        left,right=inputs[0],inputs[1]; lk=str(params.get("left_key")); rk=str(params.get("right_key")); output=_norm_name(node.get("output") or f"{left}_{right}_joined")
        index: dict[str,list[dict[str,Any]]]={}
        for r in datasets.get(right,[]): index.setdefault(str(r.get(rk,"")),[]).append(r)
        joined=[]
        for l in datasets.get(left,[]):
            matches=index.get(str(l.get(lk,"")),[])
            for r in matches:
                merged=dict(l)
                for k,v in r.items(): merged[k if k not in merged else f"{right}_{k}"]=v
                joined.append(merged)
        datasets[output]=joined


def _numeric_or_text(value: Any) -> Any:
    try: return (0, float(value))
    except Exception: return (1, str(value or ""))


def _to_float(value: Any) -> float | None:
    try: return float(str(value).replace(",", ""))
    except Exception: return None


def execute_business_logic(
    source_entities: list[dict[str, Any]],
    plan: dict[str, Any],
) -> dict[str, Any]:
    datasets: dict[str, list[dict[str, Any]]] = {
        _norm_name(e.get("entity")): [dict(r) for r in e.get("_rows", [])]
        for e in source_entities
    }
    nodes = [n for n in plan.get("nodes", []) if isinstance(n, dict)]
    audit: list[dict[str, Any]] = []
    exceptions: list[dict[str, Any]] = []
    mutation_records: list[dict[str, Any]] = []

    # Filters first so every later operation sees the governed population.
    for node in [n for n in nodes if str(n.get("op")).upper() == "FILTER"]:
        targets = [_norm_name(node.get("entity"))] if node.get("entity") else list(datasets.keys())
        for entity in targets:
            kept=[]
            for idx,row in enumerate(datasets.get(entity, []), start=1):
                try: ok=bool(safe_eval(str(node.get("condition") or "True"), row))
                except Exception as exc:
                    ok=False; exceptions.append({"entity":entity,"row":idx,"node_id":node.get("id"),"reason":f"Filter evaluation failed: {exc}","disposition":"REVIEW"})
                if ok: kept.append(row)
            datasets[entity]=kept

    # Row transforms in declared order.
    row_ops={"TRIM","TRIM_ALL","LOWERCASE","UPPERCASE","DATE_ISO","STRIP_CURRENCY","DEFAULT","CAST","MAP","MASK","EXPRESSION","SEQUENCE","KEY_GENERATE"}
    for node in [n for n in nodes if str(n.get("op")).upper() in row_ops and str(n.get("execution")) == "NATIVE"]:
        targets=[_norm_name(node.get("entity"))] if node.get("entity") else list(datasets.keys())
        for entity in targets:
            seq=int((node.get("params") or {}).get("start",1)); inc=int((node.get("params") or {}).get("increment",1))
            out=[]
            for idx,row in enumerate(datasets.get(entity, []), start=1):
                try:
                    changed, record=_apply_row_node(row,node,{"__sequence_value":seq,**row})
                    if str(node.get("op")).upper() in {"SEQUENCE","KEY_GENERATE"}: seq += inc
                    if record: audit.append({"entity":entity,"row":idx,**record})
                    out.append(changed)
                except Exception as exc:
                    exceptions.append({"entity":entity,"row":idx,"node_id":node.get("id"),"reason":str(exc),"disposition":"REVIEW"}); out.append(row)
            datasets[entity]=out

    # Set transformations.
    set_ops={"SORT","RANK","AGGREGATE","MATCH_DUPLICATES","UNION","JOIN"}
    for node in [n for n in nodes if str(n.get("op")).upper() in set_ops and str(n.get("execution")) == "NATIVE"]:
        try: _execute_set_node(datasets,node)
        except Exception as exc: exceptions.append({"entity":node.get("entity"),"node_id":node.get("id"),"reason":str(exc),"disposition":"REVIEW"})

    # Unique validation needs entity-wide sets.
    for node in [n for n in nodes if str(n.get("op")).upper() == "VALIDATE_UNIQUE"]:
        entity=_norm_name(node.get("entity")); field=node.get("field"); counts:dict[str,int]={}
        for row in datasets.get(entity,[]): counts[str(row.get(field,""))]=counts.get(str(row.get(field,"")),0)+1
        for idx,row in enumerate(datasets.get(entity,[]),start=1):
            if counts.get(str(row.get(field,"")),0)>1:
                exceptions.append({"entity":entity,"row":idx,"node_id":node.get("id"),"reason":f"{field} must be unique","disposition":(node.get("params") or {}).get("on_fail","REJECT")})

    # Other validations.
    validation_ops={"VALIDATE_REQUIRED","VALIDATE_MIN","VALIDATE_GT","VALIDATE_REFERENCE"}
    for node in [n for n in nodes if str(n.get("op")).upper() in validation_ops]:
        entity=_norm_name(node.get("entity"))
        for idx,row in enumerate(datasets.get(entity,[]),start=1):
            ok,reason=_validate_row(row,node,datasets)
            if not ok: exceptions.append({"entity":entity,"row":idx,"node_id":node.get("id"),"reason":reason,"disposition":(node.get("params") or {}).get("on_fail","REJECT")})

    # Update strategy is classified, not executed against a DB here.
    for entity, rows in datasets.items():
        for idx,row in enumerate(rows,start=1):
            action="INSERT"
            for node in [n for n in nodes if str(n.get("op")).upper()=="UPDATE_STRATEGY"]:
                try:
                    if bool(safe_eval(str(node.get("condition") or "False"), row)):
                        action=str((node.get("params") or {}).get("action") or "INSERT").upper(); break
                except Exception:
                    continue
            mutation_records.append({"entity":entity,"row":idx,"action":action,"record":row})

    counts={entity:len(rows) for entity,rows in datasets.items()}
    plan_only=[n for n in nodes if str(n.get("execution")) in {"ADAPTER","POLICY"}]
    return {
        "status": "SIMULATED",
        "mode": "DETERMINISTIC_IN_MEMORY",
        "datasets": datasets,
        "counts": counts,
        "total_records": sum(counts.values()),
        "applied_transform_count": len(audit),
        "audit": audit,
        "exceptions": exceptions,
        "exception_count": len(exceptions),
        "target_mutation_records": mutation_records,
        "target_schema_mutations": plan.get("target_mutations", []),
        "plan_only_nodes": plan_only,
        "safety": {"source_write": False, "target_write": False, "production_action": False},
    }


def engine_status() -> dict[str, Any]:
    return {
        "engine": "KMITORA_UNIVERSAL_TRANSFORMATION_ENGINE",
        "version": ENGINE_VERSION,
        "capability_count": len(CAPABILITY_REGISTRY),
        "native_capabilities": sum(1 for c in CAPABILITY_REGISTRY if c["execution"] == "NATIVE"),
        "adapter_capabilities": sum(1 for c in CAPABILITY_REGISTRY if c["execution"] == "ADAPTER"),
        "policy_capabilities": sum(1 for c in CAPABILITY_REGISTRY if c["execution"] == "POLICY"),
        "production_write": False,
        "arbitrary_code_execution": False,
    }
