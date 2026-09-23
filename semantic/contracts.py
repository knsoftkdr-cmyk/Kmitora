from __future__ import annotations
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional


@dataclass
class InferredRule:
    id: str
    kind: str
    expression: str
    business_rule: str
    confidence: float
    evidence: List[str] = field(default_factory=list)
    source_fields: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class MappingCandidate:
    source: str
    target: str
    confidence: float
    reasons: List[str] = field(default_factory=list)
    decision: str = "REVIEW"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class TransformationStep:
    id: str
    kind: str
    config: Dict[str, Any] = field(default_factory=dict)
    generated_from_rule: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

