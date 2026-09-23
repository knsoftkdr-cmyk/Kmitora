from __future__ import annotations
from typing import Any, Dict, Iterable, List

from .a000_orchestrator import a000_semantic
from .business_rule_engine import BusinessRuleEngine
from .semantic_mapper import SemanticMapper
from .transformation_planner import TransformationPlanner
from .conflict_detector import RuleConflictDetector
from .evidence import build_evidence


def collect_source_fields(payload: Dict[str, Any]) -> List[str]:
    values: List[str] = []

    for op in payload.get("operations", []):
        if str(op.get("type", "")).lower() in {
            "source","source analyzer","source definition","source qualifier"
        }:
            values.extend(str(v) for v in op.get("outputs", []))

    for item in payload.get("source_fields", []):
        if isinstance(item, dict):
            item = item.get("name")
        if item:
            values.append(str(item))

    return list(dict.fromkeys(values))


class A000Pipeline:
    def __init__(self) -> None:
        self.rule_engine = BusinessRuleEngine()
        self.mapper = SemanticMapper()
        self.planner = TransformationPlanner()
        self.conflicts = RuleConflictDetector()

    def analyze(self, discovery_payload: Dict[str, Any], target_fields: Iterable[str] | None = None) -> Dict[str, Any]:
        canonical = a000_semantic.analyze(discovery_payload)
        rules = self.rule_engine.infer(discovery_payload)
        source_fields = collect_source_fields(discovery_payload)
        targets = list(target_fields if target_fields is not None else discovery_payload.get("target_fields", []))
        mappings = self.mapper.generate(source_fields, targets) if targets else []
        transformations = self.planner.plan(rules, mappings)
        conflicts = self.conflicts.detect(rules)

        summary = {
            "source_fields": len(source_fields),
            "target_fields": len(targets),
            "rules": len(rules),
            "mappings": len(mappings),
            "auto_mappings": sum(1 for m in mappings if m.decision in ("AUTO_APPLY","AUTO_GENERATE_VALIDATE")),
            "review_mappings": sum(1 for m in mappings if m.decision in ("REVIEW","AMBIGUOUS")),
            "blocked_mappings": sum(1 for m in mappings if m.decision == "BLOCK"),
            "transformations": len(transformations),
            "conflicts": len(conflicts),
        }

        result = {
            "status": "BLOCKED" if any(c.get("severity") == "ERROR" for c in conflicts) else "READY",
            "mode": "PLAN_ONLY",
            "canonical": canonical,
            "business_rules": [r.to_dict() for r in rules],
            "mappings": [m.to_dict() for m in mappings],
            "transformations": [t.to_dict() for t in transformations],
            "conflicts": conflicts,
            "summary": summary,
        }

        result["evidence"] = build_evidence("A000_SEMANTIC_PLAN", {
            "flow_id": canonical.get("flow_id"),
            "summary": summary,
            "business_rules": result["business_rules"],
            "mappings": result["mappings"],
            "transformations": result["transformations"],
            "conflicts": conflicts,
        })

        return result


a000_pipeline = A000Pipeline()

