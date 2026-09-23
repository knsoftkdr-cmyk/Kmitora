from __future__ import annotations


FEATURE_REGISTRY: dict[str, dict[str, object]] = {
    "KAI-005": {
        "number": 5,
        "name": "Zero-Surprise Cutover Simulator",
        "engine": "simulation",
        "write_mode": "READ_ONLY",
    },
    "KAI-006": {
        "number": 6,
        "name": "Digital Twin Replay",
        "engine": "digital_twin",
        "write_mode": "READ_ONLY",
    },
    "KAI-007": {
        "number": 7,
        "name": "Evidence-by-Design",
        "engine": "evidence",
        "write_mode": "EVIDENCE_ONLY",
    },
    "KAI-008": {
        "number": 8,
        "name": "Autonomous Root-Cause Investigator",
        "engine": "causal",
        "write_mode": "READ_ONLY",
    },
    "KAI-009": {
        "number": 9,
        "name": "Self-Healing with Approval Gates",
        "engine": "remediation",
        "write_mode": "APPROVAL_REQUIRED",
    },
    "KAI-010": {
        "number": 10,
        "name": "Agent Qualification Score",
        "engine": "qualification",
        "write_mode": "READ_ONLY",
    },
    "KAI-011": {
        "number": 11,
        "name": "Specialist-on-Demand Generator",
        "engine": "specialist_runtime",
        "write_mode": "READ_ONLY",
    },
    "KAI-012": {
        "number": 12,
        "name": "Cross-Model Jury",
        "engine": "jury",
        "write_mode": "READ_ONLY",
    },
    "KAI-013": {
        "number": 13,
        "name": "Confidence with Evidence",
        "engine": "scoring",
        "write_mode": "READ_ONLY",
    },
    "KAI-014": {
        "number": 14,
        "name": "Change Risk Passport",
        "engine": "risk",
        "write_mode": "READ_ONLY",
    },
    "KAI-015": {
        "number": 15,
        "name": "Migration Readiness Score",
        "engine": "readiness",
        "write_mode": "READ_ONLY",
    },
    "KAI-016": {
        "number": 16,
        "name": "Business Continuity Score",
        "engine": "continuity",
        "write_mode": "READ_ONLY",
    },
    "KAI-017": {
        "number": 17,
        "name": "Natural-Language Enterprise Control",
        "engine": "natural_language_control",
        "write_mode": "GOVERNED",
    },
    "KAI-018": {
        "number": 18,
        "name": "Prompt-to-Migration",
        "engine": "migration_planner",
        "write_mode": "PLAN_ONLY",
    },
    "KAI-019": {
        "number": 19,
        "name": "Document-to-Execution",
        "engine": "document_intelligence",
        "write_mode": "PLAN_ONLY",
    },
    "KAI-020": {
        "number": 20,
        "name": "Architecture Drift Detector",
        "engine": "drift",
        "write_mode": "READ_ONLY",
    },
    "KAI-021": {
        "number": 21,
        "name": "Data Contract Guardian",
        "engine": "contract_guard",
        "write_mode": "READ_ONLY",
    },
    "KAI-022": {
        "number": 22,
        "name": "Legacy Logic Archaeologist",
        "engine": "legacy_intelligence",
        "write_mode": "READ_ONLY",
    },
    "KAI-023": {
        "number": 23,
        "name": "Migration Shadow Mode",
        "engine": "shadow",
        "write_mode": "READ_ONLY",
    },
    "KAI-024": {
        "number": 24,
        "name": "Tool-Agnostic Assurance Layer",
        "engine": "assurance",
        "write_mode": "READ_ONLY",
    },
    "KAI-025": {
        "number": 25,
        "name": "Live Reconciliation Radar",
        "engine": "reconciliation",
        "write_mode": "READ_ONLY",
    },
    "KAI-026": {
        "number": 26,
        "name": "Exception Explainer",
        "engine": "exception_intelligence",
        "write_mode": "READ_ONLY",
    },
    "KAI-027": {
        "number": 27,
        "name": "Regulatory Evidence Pack Generator",
        "engine": "regulatory_evidence",
        "write_mode": "EVIDENCE_ONLY",
    },
    "KAI-028": {
        "number": 28,
        "name": "Verified Learning Vault",
        "engine": "verified_learning",
        "write_mode": "VERIFIED_ONLY",
    },
    "KAI-029": {
        "number": 29,
        "name": "Enterprise Memory with Isolation",
        "engine": "tenant_memory",
        "write_mode": "VERIFIED_ONLY",
    },
    "KAI-030": {
        "number": 30,
        "name": "Transformation ROI Predictor",
        "engine": "roi",
        "write_mode": "READ_ONLY",
    },

    # Additional high-value integrated capabilities.
    "KAI-031": {
        "number": 31,
        "name": "Blast Radius Explorer",
        "engine": "digital_twin",
        "write_mode": "READ_ONLY",
    },
    "KAI-032": {
        "number": 32,
        "name": "Rollback Proof Score",
        "engine": "simulation",
        "write_mode": "READ_ONLY",
    },
    "KAI-033": {
        "number": 33,
        "name": "Failure Injection Laboratory",
        "engine": "simulation",
        "write_mode": "SANDBOX_ONLY",
    },
    "KAI-034": {
        "number": 34,
        "name": "Policy-as-Code Guardian",
        "engine": "policy",
        "write_mode": "READ_ONLY",
    },
    "KAI-035": {
        "number": 35,
        "name": "Cutover Critical-Path Optimizer",
        "engine": "optimization",
        "write_mode": "READ_ONLY",
    },
    "KAI-036": {
        "number": 36,
        "name": "SLA and Downtime Predictor",
        "engine": "continuity",
        "write_mode": "READ_ONLY",
    },
    "KAI-037": {
        "number": 37,
        "name": "Data Lineage Certifier",
        "engine": "assurance",
        "write_mode": "READ_ONLY",
    },
    "KAI-038": {
        "number": 38,
        "name": "Scenario Portfolio Optimizer",
        "engine": "optimization",
        "write_mode": "READ_ONLY",
    },
    "KAI-039": {
        "number": 39,
        "name": "Autonomous Assurance Watchtower",
        "engine": "assurance",
        "write_mode": "READ_ONLY",
    },
    "KAI-040": {
        "number": 40,
        "name": "Change Dependency Graph",
        "engine": "digital_twin",
        "write_mode": "READ_ONLY",
    },
}


def get_feature(feature_id: str) -> dict[str, object]:
    if feature_id not in FEATURE_REGISTRY:
        raise KeyError(
            f"Unknown KMITORA feature: {feature_id}"
        )

    return dict(
        FEATURE_REGISTRY[feature_id]
    )


def validate_registry() -> None:
    numbers: set[int] = set()

    for feature_id, definition in FEATURE_REGISTRY.items():
        number = int(
            definition["number"]
        )

        if number in numbers:
            raise ValueError(
                f"Duplicate feature number: {number}"
            )

        numbers.add(number)

        if not feature_id.startswith("KAI-"):
            raise ValueError(
                f"Invalid feature ID: {feature_id}"
            )