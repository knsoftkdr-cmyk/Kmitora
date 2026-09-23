from __future__ import annotations
from typing import Iterable, List
from .contracts import InferredRule, MappingCandidate, TransformationStep


class TransformationPlanner:
    def plan(self, rules: Iterable[InferredRule], mappings: Iterable[MappingCandidate]) -> List[TransformationStep]:
        output: List[TransformationStep] = []

        mapping = {
            "TEMPORAL": "TEMPORAL",
            "SURVIVORSHIP": "SURVIVE",
            "FILTER": "FILTER",
            "CLASSIFY": "CLASSIFY",
        }

        for rule in rules:
            output.append(TransformationStep(
                id=f"TX_{rule.id}",
                kind=mapping.get(rule.kind.upper(), rule.kind.upper()),
                config={"expression": rule.expression, "confidence": rule.confidence},
                generated_from_rule=rule.id,
            ))

        selected = [
            m for m in mappings
            if m.decision in ("AUTO_APPLY", "AUTO_GENERATE_VALIDATE")
        ]

        if selected:
            output.append(TransformationStep(
                id="TX_SEMANTIC_MAPPING",
                kind="PROJECT",
                config={"mappings": [
                    {"source": m.source, "target": m.target, "confidence": m.confidence}
                    for m in selected
                ]},
            ))

        return output

