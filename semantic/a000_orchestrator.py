from __future__ import annotations
from typing import Any, Dict
from .semantic_service import semantic_service


class A000SemanticOrchestrator:
    def analyze(self, discovery_payload: Dict[str, Any]) -> Dict[str, Any]:
        result = semantic_service.analyze(discovery_payload)

        findings = [
            {
                "severity": getattr(f, "severity", "INFO"),
                "code": getattr(f, "code", "UNKNOWN"),
                "message": getattr(f, "message", str(f)),
            }
            for f in result.findings
        ]

        return {
            "status": "READY",
            "flow_id": result.flow.id,
            "flow_name": result.flow.name,
            "operation_count": len(result.flow.operations),
            "execution_order": result.execution_order,
            "duplicate_redirects": result.duplicate_redirects,
            "optimization_hints": result.optimization_hints,
            "findings": findings,
        }


a000_semantic = A000SemanticOrchestrator()

