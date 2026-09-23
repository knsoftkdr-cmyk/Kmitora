from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from difflib import SequenceMatcher
from hashlib import sha256
from typing import Any
import json
import re
import uuid


ENGINE_VERSION = "1.0.0"

SOURCE_CONFIDENCE = {
    "CODE": 94,
    "SQL": 96,
    "STORED_PROCEDURE": 96,
    "DATABASE": 95,
    "API": 90,
    "WORKFLOW": 90,
    "SPREADSHEET": 86,
    "DOCUMENT": 80,
    "CONFIG": 85,
    "UNKNOWN": 65,
}

CRITICAL_WORDS = {
    "payment",
    "balance",
    "ledger",
    "approval",
    "authorization",
    "security",
    "compliance",
    "eligibility",
    "limit",
    "fraud",
    "tax",
    "price",
    "settlement",
    "customer",
    "order",
}

CONDITION_WORDS = (
    "if ",
    "elif ",
    "when ",
    "unless ",
    "where ",
    "having ",
    "check ",
    "must ",
    "shall ",
    "required ",
    "only if ",
    "case ",
)

RULE_TYPES = {
    "VALIDATION",
    "CALCULATION",
    "DERIVATION",
    "ELIGIBILITY",
    "ROUTING",
    "APPROVAL",
    "SECURITY",
    "COMPLIANCE",
    "TRANSFORMATION",
    "DEFAULT",
    "EXCEPTION",
    "STATE_TRANSITION",
    "DATA_QUALITY",
    "REFERENTIAL",
    "GENERIC",
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _clean(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def _canonical(value: Any) -> str:
    text = _clean(value).lower()
    text = text.replace("==", "=")
    text = text.replace("&&", " and ")
    text = text.replace("||", " or ")
    text = re.sub(r"\s*([=<>!]+)\s*", r" \1 ", text)
    return re.sub(r"\s+", " ", text).strip()


def _hash(value: Any) -> str:
    if not isinstance(value, str):
        value = json.dumps(
            value,
            sort_keys=True,
            ensure_ascii=False,
            default=str,
        )
    return sha256(value.encode("utf-8")).hexdigest()


def _rule_id(fingerprint: str) -> str:
    return "BRDNA-" + fingerprint[:14].upper()


def _source_type(value: Any) -> str:
    text = _clean(value).upper().replace(" ", "_")
    aliases = {
        "PYTHON": "CODE",
        "JAVA": "CODE",
        "JAVASCRIPT": "CODE",
        "TYPESCRIPT": "CODE",
        "PLSQL": "STORED_PROCEDURE",
        "TSQL": "STORED_PROCEDURE",
        "PL_SQL": "STORED_PROCEDURE",
        "T_SQL": "STORED_PROCEDURE",
        "XLSX": "SPREADSHEET",
        "EXCEL": "SPREADSHEET",
        "DOC": "DOCUMENT",
        "DOCX": "DOCUMENT",
        "PDF": "DOCUMENT",
        "OPENAPI": "API",
        "SWAGGER": "API",
        "BPMN": "WORKFLOW",
    }
    return aliases.get(text, text if text else "UNKNOWN")


def _criticality(text: str) -> int:
    lower = text.lower()
    score = 50
    hits = sum(1 for word in CRITICAL_WORDS if word in lower)
    score += min(40, hits * 8)

    if any(
        x in lower
        for x in (
            "deny",
            "block",
            "reject",
            "mandatory",
            "must",
            "shall",
            "foreign key",
            "not null",
        )
    ):
        score += 10

    return min(100, score)


def _infer_rule_type(text: str) -> str:
    value = text.lower()

    if any(x in value for x in ("approve", "approval", "authorize")):
        return "APPROVAL"

    if any(x in value for x in ("role", "permission", "security", "access")):
        return "SECURITY"

    if any(x in value for x in ("eligible", "eligibility", "qualify")):
        return "ELIGIBILITY"

    if any(x in value for x in ("route", "assign", "queue", "escalate")):
        return "ROUTING"

    if any(x in value for x in ("foreign key", "parent", "reference")):
        return "REFERENTIAL"

    if any(x in value for x in ("trim", "lowercase", "uppercase", "normalize", "map ")):
        return "TRANSFORMATION"

    if any(x in value for x in ("calculate", "total", "amount", "price", "sum(", "formula")):
        return "CALCULATION"

    if any(x in value for x in ("default", "coalesce", "fallback")):
        return "DEFAULT"

    if any(x in value for x in ("exception", "raise ", "error", "reject", "deny")):
        return "EXCEPTION"

    if any(x in value for x in ("status", "transition", "state")):
        return "STATE_TRANSITION"

    if any(x in value for x in ("null", "duplicate", "valid", "quality", "format")):
        return "DATA_QUALITY"

    if any(x in value for x in ("must ", "shall ", "check ", "assert ")):
        return "VALIDATION"

    return "GENERIC"


def _identifiers(text: str) -> list[str]:
    items = re.findall(
        r"\b[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)+\b",
        text,
    )
    return sorted(set(items))


def _simple_identifiers(text: str) -> list[str]:
    items = re.findall(
        r"\b[A-Za-z_][A-Za-z0-9_]{2,}\b",
        text,
    )

    stop = {
        "and", "or", "not", "null", "true", "false", "then",
        "else", "when", "case", "end", "where", "select",
        "from", "return", "raise", "must", "shall", "required",
        "with", "that", "this", "into", "only", "value",
    }

    return sorted(
        {
            x
            for x in items
            if x.lower() not in stop
        }
    )[:30]


def _split_condition_action(expression: str) -> tuple[str, str]:
    raw = _clean(expression)

    match = re.search(
        r"(?i)\bif\s+(.+?)\s+then\s+(.+)$",
        raw,
    )

    if match:
        return _clean(match.group(1)), _clean(match.group(2))

    match = re.search(
        r"(?i)\bwhen\s+(.+?)\s+then\s+(.+)$",
        raw,
    )

    if match:
        return _clean(match.group(1)), _clean(match.group(2))

    if raw.lower().startswith("if ") and ":" in raw:
        left, right = raw.split(":", 1)
        return _clean(left[3:]), _clean(right)

    if raw.lower().startswith("elif ") and ":" in raw:
        left, right = raw.split(":", 1)
        return _clean(left[5:]), _clean(right)

    if "=>" in raw:
        left, right = raw.split("=>", 1)
        return _clean(left), _clean(right)

    if "->" in raw:
        left, right = raw.split("->", 1)
        return _clean(left), _clean(right)

    return raw, ""


def _looks_like_rule(line: str, source_type: str) -> bool:
    lower = line.strip().lower()

    if not lower or lower.startswith(("#", "//", "--")):
        return False

    if source_type in {"CODE", "SQL", "STORED_PROCEDURE", "DATABASE"}:
        markers = (
            "if ",
            "elif ",
            "case ",
            "when ",
            "where ",
            "having ",
            "check ",
            "assert ",
            "raise ",
            "trigger ",
            "constraint ",
        )
        return any(marker in lower for marker in markers)

    if source_type == "API":
        markers = (
            "required",
            "minimum",
            "maximum",
            "enum",
            "pattern",
            "if ",
            "when ",
            "status",
            "permission",
        )
        return any(marker in lower for marker in markers)

    if source_type == "WORKFLOW":
        markers = (
            "if ",
            "when ",
            "unless ",
            "approve",
            "reject",
            "route",
            "escalate",
            "transition",
        )
        return any(marker in lower for marker in markers)

    if source_type == "SPREADSHEET":
        return (
            lower.startswith("=")
            or "if(" in lower
            or "vlookup(" in lower
            or "xlookup(" in lower
            or any(word in lower for word in CONDITION_WORDS)
        )

    return any(word in lower for word in CONDITION_WORDS)


def _extract_action_output(action: str) -> list[str]:
    if not action:
        return []

    match = re.match(
        r"\s*([A-Za-z_][A-Za-z0-9_.]*)\s*=",
        action,
    )

    if match:
        return [match.group(1)]

    return []


def _make_rule(
    artifact: dict[str, Any],
    source_type: str,
    line_no: int,
    expression: str,
) -> dict[str, Any]:

    condition, action = _split_condition_action(expression)

    condition_norm = _canonical(condition)
    action_norm = _canonical(action)

    artifact_name = _clean(
        artifact.get("name")
        or artifact.get("artifact")
        or artifact.get("path")
        or "unnamed-artifact"
    )

    domain = _clean(
        artifact.get("domain")
        or artifact.get("business_domain")
        or "UNCLASSIFIED"
    )

    supplied_inputs = artifact.get("inputs") or []
    supplied_outputs = artifact.get("outputs") or []
    supplied_dependencies = artifact.get("dependencies") or []

    identifiers = _identifiers(expression)

    inputs = sorted(
        set(
            [str(x) for x in supplied_inputs]
            + identifiers
            + _simple_identifiers(condition)[:12]
        )
    )

    outputs = sorted(
        set(
            [str(x) for x in supplied_outputs]
            + _extract_action_output(action)
        )
    )

    dependencies = sorted(
        set(
            [str(x) for x in supplied_dependencies]
            + identifiers
        )
    )

    rule_type = _infer_rule_type(expression)

    fingerprint_material = {
        "domain": domain.lower(),
        "rule_type": rule_type,
        "condition": condition_norm,
        "action": action_norm,
    }

    fingerprint = _hash(fingerprint_material)

    evidence_id = (
        f"{source_type}:{artifact_name}:{line_no}"
    )

    confidence = SOURCE_CONFIDENCE.get(
        source_type,
        SOURCE_CONFIDENCE["UNKNOWN"],
    )

    explicit = any(
        token in expression.lower()
        for token in (
            "if ",
            "when ",
            "check ",
            "assert ",
            "must ",
            "shall ",
            "required",
        )
    )

    if not explicit:
        confidence = max(55, confidence - 10)

    obsolete = bool(
        artifact.get("obsolete")
        or artifact.get("deprecated")
        or artifact.get("reachable") is False
        or any(
            word in expression.lower()
            for word in (
                "deprecated",
                "obsolete",
                "dead rule",
                "dead_code",
                "unused rule",
            )
        )
    )

    return {
        "rule_id": _rule_id(fingerprint),
        "rule_name": _clean(
            artifact.get("rule_name")
            or f"{rule_type} rule from {artifact_name}"
        ),
        "rule_type": rule_type,
        "business_domain": domain,
        "source_type": source_type,
        "source_artifact": artifact_name,
        "source_location": f"line:{line_no}",
        "source_expression": _clean(expression),
        "normalized_condition": condition_norm,
        "normalized_action": action_norm,
        "inputs": inputs,
        "outputs": outputs,
        "dependencies": dependencies,
        "exceptions": [],
        "precedence": int(artifact.get("precedence", 100)),
        "confidence": confidence,
        "criticality": _criticality(expression),
        "explicit_or_inferred": "EXPLICIT" if explicit else "INFERRED",
        "source_rule_hash": _hash(_clean(expression)),
        "rule_fingerprint": fingerprint,
        "evidence_ids": [evidence_id],
        "obsolete_or_dead_candidate": obsolete,
        "status": "DISCOVERED",
    }


def _artifact_text(artifact: dict[str, Any]) -> str:
    if artifact.get("text") is not None:
        return str(artifact.get("text"))

    if artifact.get("content") is not None:
        return str(artifact.get("content"))

    rows = artifact.get("rows")

    if isinstance(rows, list):
        rendered = []

        for idx, row in enumerate(rows, start=1):
            if isinstance(row, dict):
                rendered.append(
                    f"ROW {idx}: "
                    + " | ".join(
                        f"{key}={value}"
                        for key, value in row.items()
                    )
                )
            else:
                rendered.append(f"ROW {idx}: {row}")

        return "\n".join(rendered)

    return ""


def _deduplicate(rules: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    by_fp: dict[str, dict[str, Any]] = {}
    duplicates: list[dict[str, Any]] = []

    for rule in rules:
        fp = rule["rule_fingerprint"]

        if fp not in by_fp:
            by_fp[fp] = dict(rule)
            continue

        existing = by_fp[fp]

        duplicates.append(
            {
                "rule_id": existing["rule_id"],
                "duplicate_artifact": rule["source_artifact"],
                "duplicate_location": rule["source_location"],
                "reason": "Same normalized condition and action",
            }
        )

        existing["evidence_ids"] = sorted(
            set(existing["evidence_ids"] + rule["evidence_ids"])
        )

        existing["confidence"] = max(
            existing["confidence"],
            rule["confidence"],
        )

    return list(by_fp.values()), duplicates


def _conflicts(rules: list[dict[str, Any]]) -> list[dict[str, Any]]:
    groups: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)

    for rule in rules:
        key = (
            rule["business_domain"].lower(),
            rule["normalized_condition"],
        )

        if rule["normalized_condition"]:
            groups[key].append(rule)

    out = []

    for (_, condition), items in groups.items():
        actions = {
            x["normalized_action"]
            for x in items
        }

        if len(actions) <= 1:
            continue

        out.append(
            {
                "conflict_id": "BRC-" + uuid.uuid4().hex[:10].upper(),
                "condition": condition,
                "severity": (
                    "CRITICAL"
                    if max(x["criticality"] for x in items) >= 85
                    else "HIGH"
                ),
                "rule_ids": [x["rule_id"] for x in items],
                "actions": sorted(actions),
                "artifacts": sorted(
                    {x["source_artifact"] for x in items}
                ),
                "reason": "Same normalized condition produces different actions",
            }
        )

    return out


def _dependency_graph(rules: list[dict[str, Any]]) -> dict[str, Any]:
    nodes = [
        {
            "id": rule["rule_id"],
            "label": rule["rule_name"],
            "kind": "BUSINESS_RULE",
            "criticality": rule["criticality"],
            "domain": rule["business_domain"],
        }
        for rule in rules
    ]

    edges = []
    seen = set()

    for left in rules:
        left_outputs = set(left["outputs"])

        if not left_outputs:
            continue

        for right in rules:
            if left["rule_id"] == right["rule_id"]:
                continue

            right_inputs = set(right["inputs"])

            shared = sorted(left_outputs & right_inputs)

            if not shared:
                continue

            signature = (
                left["rule_id"],
                right["rule_id"],
            )

            if signature in seen:
                continue

            seen.add(signature)

            edges.append(
                {
                    "source": left["rule_id"],
                    "target": right["rule_id"],
                    "relationship": "RULE_DEPENDS_ON",
                    "shared_symbols": shared,
                    "confidence": min(
                        left["confidence"],
                        right["confidence"],
                    ),
                }
            )

    return {
        "nodes": nodes,
        "relationships": edges,
    }


def _test_requirements(rules: list[dict[str, Any]]) -> list[str]:
    types = {rule["rule_type"] for rule in rules}

    tests = {
        "Business-rule regression",
        "Negative-path validation",
        "Boundary-value validation",
        "Source-to-target behavioral equivalence",
        "Rule provenance verification",
    }

    if "CALCULATION" in types:
        tests.add("Calculation precision and rounding")

    if "APPROVAL" in types:
        tests.add("Approval-state transition validation")

    if "SECURITY" in types:
        tests.add("Authorization and least-privilege validation")

    if "REFERENTIAL" in types:
        tests.add("Referential-integrity validation")

    if "TRANSFORMATION" in types:
        tests.add("Transformation output equivalence")

    if "STATE_TRANSITION" in types:
        tests.add("State-machine transition coverage")

    if any(rule["criticality"] >= 85 for rule in rules):
        tests.add("Critical-rule 100 percent preservation gate")

    return sorted(tests)


def extract_rule_dna(payload: dict[str, Any]) -> dict[str, Any]:
    artifacts = payload.get("artifacts") or []

    if not isinstance(artifacts, list) or not artifacts:
        raise ValueError("artifacts must be a non-empty list")

    raw_rules: list[dict[str, Any]] = []
    source_summary: dict[str, int] = defaultdict(int)

    for artifact in artifacts:
        if not isinstance(artifact, dict):
            continue

        source_type = _source_type(
            artifact.get("type")
            or artifact.get("source_type")
            or artifact.get("format")
        )

        source_summary[source_type] += 1

        text = _artifact_text(artifact)

        for line_no, line in enumerate(
            text.splitlines(),
            start=1,
        ):
            line = _clean(line)

            if _looks_like_rule(line, source_type):
                raw_rules.append(
                    _make_rule(
                        artifact,
                        source_type,
                        line_no,
                        line,
                    )
                )

        supplied_rules = artifact.get("rules") or []

        if isinstance(supplied_rules, list):
            base_line = len(text.splitlines()) + 1

            for offset, supplied in enumerate(
                supplied_rules,
                start=0,
            ):
                if isinstance(supplied, dict):
                    expression = (
                        supplied.get("expression")
                        or supplied.get("rule")
                        or supplied.get("text")
                        or ""
                    )
                else:
                    expression = supplied

                expression = _clean(expression)

                if expression:
                    raw_rules.append(
                        _make_rule(
                            {
                                **artifact,
                                "rule_name": (
                                    supplied.get("name")
                                    if isinstance(supplied, dict)
                                    else None
                                ),
                            },
                            source_type,
                            base_line + offset,
                            expression,
                        )
                    )

    rules, duplicates = _deduplicate(raw_rules)
    conflicts = _conflicts(rules)
    graph = _dependency_graph(rules)

    dead_candidates = [
        rule
        for rule in rules
        if rule["obsolete_or_dead_candidate"]
    ]

    high_criticality = [
        rule
        for rule in rules
        if rule["criticality"] >= 85
    ]

    dna_material = [
        rule["rule_fingerprint"]
        for rule in sorted(
            rules,
            key=lambda x: x["rule_fingerprint"],
        )
    ]

    dna_hash = _hash(dna_material)

    completeness_penalty = (
        len(conflicts) * 4
        + len(dead_candidates) * 2
    )

    confidence = 0

    if rules:
        confidence = round(
            sum(rule["confidence"] for rule in rules)
            / len(rules)
        )

    return {
        "dna_id": "BRDNASET-" + uuid.uuid4().hex[:12].upper(),
        "engine": "KMITORA Business Rule DNA",
        "engine_version": ENGINE_VERSION,
        "generated_at": _now(),
        "mode": "READ_ONLY_ANALYSIS",
        "label": _clean(
            payload.get("label")
            or "Business Rule DNA"
        ),
        "summary": {
            "artifacts_analyzed": len(artifacts),
            "raw_rule_candidates": len(raw_rules),
            "unique_rules": len(rules),
            "duplicate_implementations": len(duplicates),
            "conflicts": len(conflicts),
            "dead_or_obsolete_candidates": len(dead_candidates),
            "critical_rules": len(high_criticality),
            "dependency_relationships": len(
                graph["relationships"]
            ),
            "average_confidence": confidence,
            "rule_dna_confidence": max(
                0,
                min(
                    100,
                    confidence - completeness_penalty,
                ),
            ),
        },
        "source_coverage": dict(
            sorted(source_summary.items())
        ),
        "rule_dna_hash_sha256": dna_hash,
        "rules": sorted(
            rules,
            key=lambda x: (
                -x["criticality"],
                x["rule_id"],
            ),
        ),
        "duplicates": duplicates,
        "conflicts": conflicts,
        "dead_or_obsolete_candidates": dead_candidates,
        "dependency_graph": graph,
        "required_tests": _test_requirements(rules),
        "integration": {
            "knowledge_graph_ready": True,
            "digital_twin_ready": True,
            "what_breaks_if_ready": True,
            "migration_mapping_ready": True,
            "evidence_ready": True,
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


def _best_target_match(
    source_rule: dict[str, Any],
    target_rules: list[dict[str, Any]],
) -> tuple[dict[str, Any] | None, float]:

    exact = [
        rule
        for rule in target_rules
        if rule["rule_fingerprint"]
        == source_rule["rule_fingerprint"]
    ]

    if exact:
        return exact[0], 1.0

    best = None
    best_score = 0.0

    for rule in target_rules:
        condition_score = SequenceMatcher(
            None,
            source_rule["normalized_condition"],
            rule["normalized_condition"],
        ).ratio()

        action_score = SequenceMatcher(
            None,
            source_rule["normalized_action"],
            rule["normalized_action"],
        ).ratio()

        score = (
            condition_score * 0.70
            + action_score * 0.30
        )

        if score > best_score:
            best = rule
            best_score = score

    return best, best_score


def compare_rule_dna(payload: dict[str, Any]) -> dict[str, Any]:
    source_artifacts = payload.get("source_artifacts") or []
    target_artifacts = payload.get("target_artifacts") or []

    if not source_artifacts:
        raise ValueError("source_artifacts is required")

    if not target_artifacts:
        raise ValueError("target_artifacts is required")

    source = extract_rule_dna(
        {
            "label": "F1 Source Rule DNA",
            "artifacts": source_artifacts,
        }
    )

    target = extract_rule_dna(
        {
            "label": "F2 Target Rule DNA",
            "artifacts": target_artifacts,
        }
    )

    source_rules = source["rules"]
    target_rules = target["rules"]

    preserved = []
    changed = []
    missing = []
    matched_target_ids = set()

    for source_rule in source_rules:
        target_rule, score = _best_target_match(
            source_rule,
            target_rules,
        )

        if target_rule is None or score < 0.55:
            missing.append(
                {
                    "source_rule_id": source_rule["rule_id"],
                    "source_rule": source_rule,
                    "reason": "No sufficiently similar target rule found",
                    "critical": source_rule["criticality"] >= 85,
                }
            )
            continue

        matched_target_ids.add(target_rule["rule_id"])

        same_behavior = (
            source_rule["normalized_condition"]
            == target_rule["normalized_condition"]
            and source_rule["normalized_action"]
            == target_rule["normalized_action"]
        )

        comparison = {
            "source_rule_id": source_rule["rule_id"],
            "target_rule_id": target_rule["rule_id"],
            "source_expression": source_rule["source_expression"],
            "target_expression": target_rule["source_expression"],
            "similarity": round(score * 100, 2),
            "criticality": source_rule["criticality"],
        }

        if same_behavior:
            comparison["behavioral_equivalence"] = "PRESERVED"
            preserved.append(comparison)
        else:
            comparison["behavioral_equivalence"] = "CHANGED"
            comparison["condition_changed"] = (
                source_rule["normalized_condition"]
                != target_rule["normalized_condition"]
            )
            comparison["action_changed"] = (
                source_rule["normalized_action"]
                != target_rule["normalized_action"]
            )
            changed.append(comparison)

    target_only = [
        rule
        for rule in target_rules
        if rule["rule_id"] not in matched_target_ids
    ]

    total_source = len(source_rules)

    equivalent_count = len(preserved)

    equivalence_pct = (
        round(
            equivalent_count / total_source * 100,
            2,
        )
        if total_source
        else 100.0
    )

    critical_missing = [
        item
        for item in missing
        if item["critical"]
    ]

    critical_changed = [
        item
        for item in changed
        if item["criticality"] >= 85
    ]

    if critical_missing or critical_changed:
        status = "BLOCKED"
    elif missing or changed:
        status = "REVIEW_REQUIRED"
    else:
        status = "PASS"

    drift_material = {
        "source_dna": source["rule_dna_hash_sha256"],
        "target_dna": target["rule_dna_hash_sha256"],
        "preserved": len(preserved),
        "changed": len(changed),
        "missing": len(missing),
        "target_only": len(target_only),
    }

    return {
        "comparison_id": "BRDNACMP-" + uuid.uuid4().hex[:12].upper(),
        "engine": "KMITORA Business Rule DNA",
        "generated_at": _now(),
        "status": status,
        "mode": "READ_ONLY_BEHAVIORAL_COMPARISON",
        "source_dna": {
            "dna_id": source["dna_id"],
            "dna_hash": source["rule_dna_hash_sha256"],
            "rule_count": len(source_rules),
        },
        "target_dna": {
            "dna_id": target["dna_id"],
            "dna_hash": target["rule_dna_hash_sha256"],
            "rule_count": len(target_rules),
        },
        "summary": {
            "source_rules": total_source,
            "target_rules": len(target_rules),
            "behavior_preserved": len(preserved),
            "behavior_changed": len(changed),
            "missing_in_target": len(missing),
            "target_only_rules": len(target_only),
            "critical_missing": len(critical_missing),
            "critical_changed": len(critical_changed),
            "behavioral_equivalence_percent": equivalence_pct,
            "exact_dna_match": (
                source["rule_dna_hash_sha256"]
                == target["rule_dna_hash_sha256"]
            ),
        },
        "preserved": preserved,
        "changed": changed,
        "missing_in_target": missing,
        "target_only": target_only,
        "critical_missing": critical_missing,
        "critical_changed": critical_changed,
        "drift_hash_sha256": _hash(drift_material),
        "required_tests": sorted(
            set(
                source["required_tests"]
                + target["required_tests"]
            )
        ),
        "decision": {
            "migration_rule_gate": status,
            "target_write_allowed_by_this_engine": False,
            "reason": (
                "Critical rule loss/change blocks equivalence; "
                "non-critical differences require review."
            ),
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


def engine_status() -> dict[str, Any]:
    return {
        "engine": "KMITORA Business Rule DNA",
        "version": ENGINE_VERSION,
        "status": "READY",
        "capabilities": [
            "multi_source_rule_extraction",
            "code_rule_mining",
            "sql_rule_mining",
            "stored_procedure_rule_mining",
            "document_rule_mining",
            "spreadsheet_rule_mining",
            "api_contract_rule_mining",
            "workflow_rule_mining",
            "rule_normalization",
            "stable_rule_fingerprinting",
            "provenance_tracking",
            "duplicate_rule_detection",
            "conflict_detection",
            "dead_or_obsolete_rule_signals",
            "rule_dependency_graph",
            "f1_f2_rule_comparison",
            "behavioral_equivalence",
            "critical_rule_loss_gate",
            "rule_drift_detection",
            "required_test_generation",
            "evidence_hashing",
            "knowledge_graph_binding",
            "digital_twin_binding",
            "what_breaks_if_binding",
        ],
        "safety": {
            "read_only": True,
            "source_write_executed": False,
            "target_write_executed": False,
            "production_action_executed": False,
            "cutover_executed": False,
        },
    }
