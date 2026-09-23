from __future__ import annotations

from typing import Any

DOMAINS = (
    "business", "process", "application", "system_platform", "data",
    "api_integration", "infrastructure", "security_governance",
    "risk_dependency_impact", "evidence_provenance_simulation",
)


def evaluate_digital_twin(evidence: dict[str, Any]) -> dict[str, Any]:
    signals = []
    for domain in DOMAINS:
        value = evidence.get(domain)
        present = value not in (None, "", [], {}, False)
        signals.append({"domain": domain, "evidenced": present})
    score = sum(1 for item in signals if item["evidenced"])
    return {
        "score": score,
        "total": len(DOMAINS),
        "status": "PASS" if score == len(DOMAINS) else "PARTIAL",
        "signals": signals,
        "missing": [item["domain"] for item in signals if not item["evidenced"]],
        "fabricated_signals": 0,
    }
