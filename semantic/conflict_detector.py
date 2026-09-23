from __future__ import annotations
from typing import Dict, Iterable, List
from .contracts import InferredRule


class RuleConflictDetector:
    def detect(self, rules: Iterable[InferredRule]) -> List[Dict[str, object]]:
        rules = list(rules)
        output = []
        seen = set()

        for rule in rules:
            if rule.id in seen:
                output.append({
                    "severity": "ERROR",
                    "code": "DUPLICATE_RULE_ID",
                    "message": f"Duplicate rule id detected: {rule.id}",
                    "rules": [rule.id],
                })
            seen.add(rule.id)

        return output

