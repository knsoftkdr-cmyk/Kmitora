from __future__ import annotations
from dataclasses import dataclass
from typing import List
from .model import SemanticFlow


@dataclass
class Finding:
    severity: str
    code: str
    message: str


def validate_flow(flow: SemanticFlow) -> List[Finding]:
    findings: List[Finding] = []
    known = set(flow.operations)

    for a, b in flow.edges:
        if a not in known or b not in known:
            findings.append(Finding("ERROR", "BROKEN_EDGE", f"{a} -> {b} references a missing operation."))

    return findings

