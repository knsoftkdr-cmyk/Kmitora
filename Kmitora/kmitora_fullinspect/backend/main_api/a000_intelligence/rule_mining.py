from __future__ import annotations

import re
from typing import Any


RULE_PATTERNS = [
    # Conditional rules.
    re.compile(
        r"\b(if|when|whenever|where|provided that)\b.+"
        r"\b(then|must|should|shall|required|cannot|may not)\b",
        re.I,
    ),

    # Mandatory / restrictive language.
    re.compile(
        r"\b("
        r"must|must not|shall|shall not|should|should not|"
        r"required|mandatory|prohibited|forbidden|"
        r"not permitted|not allowed|cannot|may not|"
        r"never|only if|only when|unless|except"
        r")\b",
        re.I,
    ),

    # Validation / constraint language.
    re.compile(
        r"\b("
        r"valid|invalid|minimum|maximum|at least|at most|"
        r"greater than|less than|equal to|not equal to|"
        r"before|after|within|between"
        r")\b",
        re.I,
    ),
]


class BusinessRuleMiningEngine:
    def mine_text(
        self,
        text: str,
        source: str = "prompt",
    ) -> list[dict[str, Any]]:
        candidates: list[dict[str, Any]] = []

        statements = re.split(
            r"[\n\.;]+",
            text,
        )

        for index, raw in enumerate(
            statements,
            start=1,
        ):
            sentence = raw.strip()

            if len(sentence) < 8:
                continue

            matched_patterns = [
                pattern.pattern
                for pattern in RULE_PATTERNS
                if pattern.search(sentence)
            ]

            score = len(matched_patterns)

            if not score:
                continue

            confidence = min(
                0.99,
                0.65 + score * 0.15,
            )

            candidates.append(
                {
                    "rule_id": (
                        f"RULE-CANDIDATE-{index:04d}"
                    ),
                    "source": source,
                    "original_text": sentence,
                    "confidence": confidence,
                    "status": "PROPOSED",
                    "authoritative": False,
                    "requires_review": True,
                    "matched_pattern_count": score,
                }
            )

        return candidates
