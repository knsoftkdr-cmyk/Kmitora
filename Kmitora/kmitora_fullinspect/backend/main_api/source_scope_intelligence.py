from __future__ import annotations

"""A000/A200 governed source-scope intelligence.

This module converts explicit business requirements into deterministic,
read-only row predicates and applies them before discovery, mapping, quality
analysis, migration simulation, and downstream evidence generation.

It is deliberately conservative: unsupported or ambiguous natural-language
rules do not become executable predicates. This avoids silently broadening or
narrowing migration scope.
"""

from dataclasses import dataclass, asdict
import re
from typing import Any, Iterable


@dataclass(frozen=True)
class ScopePredicate:
    field: str
    operator: str  # EQ | NEQ
    value: str
    source_rule: str


@dataclass(frozen=True)
class CompiledSourceScope:
    mode: str  # UNSCOPED | FILTERED
    predicates: tuple[ScopePredicate, ...]

    @property
    def description(self) -> str:
        if not self.predicates:
            return "No row-level source scope compiled from business rules."
        return " AND ".join(
            f"{item.field} {'=' if item.operator == 'EQ' else '!='} {item.value}"
            for item in self.predicates
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "mode": self.mode,
            "predicates": [asdict(item) for item in self.predicates],
            "description": self.description,
            "agent": "A200",
            "orchestrator": "A000",
            "execution_mode": "READ_ONLY_SCOPE_FILTER",
        }


def _rule_text(item: Any) -> str:
    if isinstance(item, dict):
        return str(item.get("rule") or item.get("text") or "").strip()
    return str(item or "").strip()


def _strip_value(raw: str) -> str:
    value = raw.strip().strip('"\'`').strip()
    value = re.sub(r"[.;,]+$", "", value).strip()
    return value


def compile_source_scope(business_rules: Any) -> CompiledSourceScope:
    predicates: list[ScopePredicate] = []
    seen: set[tuple[str, str, str]] = set()

    if not isinstance(business_rules, Iterable) or isinstance(
        business_rules, (str, bytes, dict)
    ):
        business_rules = [] if business_rules is None else [business_rules]

    for item in business_rules:
        rule = _rule_text(item)
        if not rule:
            continue

        patterns: list[tuple[re.Pattern[str], str]] = [
            (
                re.compile(
                    r"(?:process|include|use|discover|migrate)?\s*only\s+(?:the\s+)?records?\s+where\s+"
                    r"([A-Za-z_][A-Za-z0-9_]*)\s+(?:equals|=|is)\s+(.+?)\.?$",
                    re.I,
                ),
                "EQ",
            ),
            (
                re.compile(
                    r"process\s+only\s+records?\s+where\s+([A-Za-z_][A-Za-z0-9_]*)\s+"
                    r"(?:equals|=|is)\s+(.+?)\.?$",
                    re.I,
                ),
                "EQ",
            ),
            # Excluding everything that is NOT X means the executable scope
            # is precisely field = X.
            (
                re.compile(
                    r"exclude\s+(?:every|all)?\s*records?\s+where\s+([A-Za-z_][A-Za-z0-9_]*)\s+"
                    r"(?:is\s+not|!=|does\s+not\s+equal)\s+(.+?)\.?$",
                    re.I,
                ),
                "EQ",
            ),
            (
                re.compile(
                    r"exclude\s+(?:every|all)?\s*records?\s+where\s+([A-Za-z_][A-Za-z0-9_]*)\s+"
                    r"(?:equals|=|is)\s+(.+?)\.?$",
                    re.I,
                ),
                "NEQ",
            ),
        ]

        matched = False
        for pattern, operator in patterns:
            match = pattern.search(rule)
            if not match:
                continue
            field, raw_value = match.group(1), match.group(2)
            value = _strip_value(raw_value)
            key = (field.lower(), operator, value.lower())
            if value and key not in seen:
                seen.add(key)
                predicates.append(
                    ScopePredicate(
                        field=field,
                        operator=operator,
                        value=value,
                        source_rule=rule,
                    )
                )
            matched = True
            break

        if matched:
            continue

        simple = re.match(
            r"^([A-Za-z_][A-Za-z0-9_]*)\s*(=|==|!=)\s*(.+?)\.?$",
            rule,
            re.I,
        )
        if simple:
            field, token, raw_value = simple.groups()
            operator = "NEQ" if token == "!=" else "EQ"
            value = _strip_value(raw_value)
            key = (field.lower(), operator, value.lower())
            if value and key not in seen:
                seen.add(key)
                predicates.append(
                    ScopePredicate(
                        field=field,
                        operator=operator,
                        value=value,
                        source_rule=rule,
                    )
                )

    return CompiledSourceScope(
        mode="FILTERED" if predicates else "UNSCOPED",
        predicates=tuple(predicates),
    )


def _find_field(row: dict[str, Any], field: str) -> str | None:
    wanted = field.lower()
    for key in row:
        if str(key).lower() == wanted:
            return str(key)
    return None


def row_matches_scope(row: dict[str, Any], scope: CompiledSourceScope) -> bool:
    if scope.mode == "UNSCOPED" or not scope.predicates:
        return True

    for predicate in scope.predicates:
        actual_key = _find_field(row, predicate.field)
        if actual_key is None:
            return False
        actual = str(row.get(actual_key, "") or "").strip().lower()
        expected = predicate.value.strip().lower()
        if predicate.operator == "EQ" and actual != expected:
            return False
        if predicate.operator == "NEQ" and actual == expected:
            return False
    return True


def entity_supports_scope(fields: Iterable[str], scope: CompiledSourceScope) -> bool:
    if scope.mode == "UNSCOPED":
        return True
    available = {str(field).lower() for field in fields}
    return all(predicate.field.lower() in available for predicate in scope.predicates)


def apply_scope_to_entities(
    source_entities: list[dict[str, Any]],
    business_rules: Any,
    profile_entity,
) -> tuple[list[dict[str, Any]], CompiledSourceScope, dict[str, Any]]:
    scope = compile_source_scope(business_rules)
    if scope.mode == "UNSCOPED":
        return source_entities, scope, {
            "mode": "UNSCOPED",
            "description": scope.description,
            "rows_scanned": sum(len(e.get("_rows", [])) for e in source_entities),
            "rows_matched": sum(len(e.get("_rows", [])) for e in source_entities),
            "entities": [],
        }

    unsupported = [
        str(entity.get("entity", ""))
        for entity in source_entities
        if not entity_supports_scope(entity.get("fields", []), scope)
    ]
    if unsupported:
        raise ValueError(
            "Requirement-derived source scope "
            f"({scope.description}) cannot be enforced because these in-scope "
            "entities do not expose the required field(s): "
            + ", ".join(unsupported)
        )

    filtered_entities: list[dict[str, Any]] = []
    entity_stats: list[dict[str, Any]] = []
    rows_scanned = 0
    rows_matched = 0

    for entity in source_entities:
        rows = [row for row in entity.get("_rows", []) if isinstance(row, dict)]
        matched_rows = [row for row in rows if row_matches_scope(row, scope)]
        rows_scanned += len(rows)
        rows_matched += len(matched_rows)
        fields = [str(field) for field in entity.get("fields", [])]
        profiled = profile_entity(
            str(entity.get("entity", "")),
            str(entity.get("file", entity.get("origin", ""))),
            matched_rows,
            fields,
        )
        profiled["scope"] = scope.to_dict()
        profiled["rows_scanned"] = len(rows)
        profiled["rows_matched"] = len(matched_rows)
        filtered_entities.append(profiled)
        entity_stats.append(
            {
                "entity": profiled.get("entity"),
                "rows_scanned": len(rows),
                "rows_matched": len(matched_rows),
            }
        )

    if rows_matched == 0:
        raise ValueError(
            f"Requirement-derived source scope ({scope.description}) matched zero rows"
        )

    return filtered_entities, scope, {
        "mode": "FILTERED",
        "description": scope.description,
        "rows_scanned": rows_scanned,
        "rows_matched": rows_matched,
        "entities": entity_stats,
        "predicates": [asdict(item) for item in scope.predicates],
        "agent": "A200",
        "orchestrator": "A000",
    }
