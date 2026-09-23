from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Dict, List

from .adapters.base import SourceAdapter
from .dedupe import collapse_exact_semantic_duplicates
from .planner import topological_order
from .quality import validate_flow


@dataclass
class AnalysisResult:
    flow: Any
    duplicate_redirects: Dict[str, str]
    execution_order: List[str]
    optimization_hints: List[str]
    findings: List[Any]


class UniversalSemanticEngine:
    def __init__(self, adapters: List[SourceAdapter]) -> None:
        self.adapters = adapters

    def analyze(self, payload: Any) -> AnalysisResult:
        adapter = next((a for a in self.adapters if a.can_read(payload)), None)
        if adapter is None:
            raise ValueError("No adapter can understand this payload.")

        flow = adapter.discover(payload)
        flow, redirects = collapse_exact_semantic_duplicates(flow)
        findings = validate_flow(flow)
        order = topological_order(flow)

        return AnalysisResult(
            flow=flow,
            duplicate_redirects=redirects,
            execution_order=order,
            optimization_hints=[],
            findings=findings,
        )

