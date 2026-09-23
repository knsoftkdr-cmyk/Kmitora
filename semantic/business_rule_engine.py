from __future__ import annotations
from typing import Any, Dict, List, Set
from .contracts import InferredRule


def collect_fields(payload: Dict[str, Any]) -> Set[str]:
    fields: Set[str] = set()

    for op in payload.get("operations", []):
        for name in op.get("inputs", []):
            fields.add(str(name).strip().lower())
        for name in op.get("outputs", []):
            fields.add(str(name).strip().lower())

    for item in payload.get("source_fields", []):
        if isinstance(item, dict):
            item = item.get("name")
        if item:
            fields.add(str(item).strip().lower())

    return {f for f in fields if f}


class BusinessRuleEngine:
    def infer(self, payload: Dict[str, Any]) -> List[InferredRule]:
        fields = collect_fields(payload)
        rules: List[InferredRule] = []

        if {"effective_from", "effective_to"}.issubset(fields):
            rules.append(InferredRule(
                id="RULE_TEMPORAL_CURRENT",
                kind="TEMPORAL",
                expression="effective_from <= processing_date AND (effective_to IS NULL OR effective_to >= processing_date)",
                business_rule="Use the record effective on the processing date.",
                confidence=0.97,
                evidence=["effective_from present", "effective_to present"],
                source_fields=["effective_from", "effective_to"],
            ))

        if "is_primary" in fields and "updated_date" in fields:
            rules.append(InferredRule(
                id="RULE_PRIMARY_RECENCY",
                kind="SURVIVORSHIP",
                expression="ORDER BY is_primary DESC, updated_date DESC",
                business_rule="Prefer the primary record, then the most recently updated record.",
                confidence=0.95,
                evidence=["is_primary present", "updated_date present"],
                source_fields=["is_primary", "updated_date"],
            ))

        for field in ("is_deleted", "deleted_flag", "delete_flag"):
            if field in fields:
                rules.append(InferredRule(
                    id="RULE_SOFT_DELETE",
                    kind="FILTER",
                    expression=f"{field} IN (0, false, 'N', 'NO')",
                    business_rule="Exclude logically deleted records.",
                    confidence=0.93,
                    evidence=[f"{field} present"],
                    source_fields=[field],
                ))
                break

        return rules

