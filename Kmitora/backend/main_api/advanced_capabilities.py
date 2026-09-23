from __future__ import annotations

from dataclasses import dataclass, asdict
from hashlib import sha256
import json
from typing import Any


@dataclass(frozen=True)
class Capability:
    id: int
    name: str
    category: str
    description: str
    agent_id: str
    agent_role: str
    dev_status: str = "DEV_FUNCTIONAL_SIMULATION"
    execution_mode: str = "SAFE_SIMULATION"


_CAPABILITY_DATA = [
    (1, "Enterprise Digital Twin", "Enterprise Intelligence", "Construct a living digital representation of business processes, applications, APIs, databases, infrastructure, integrations, users, controls and dependencies.", "A100", "Enterprise Digital Twin Agent"),
    (2, "Autonomous Enterprise Discovery", "Enterprise Intelligence", "Discover undocumented applications, schemas, APIs, ETL, batch jobs, stored procedures, business rules, dependencies and infrastructure.", "A110", "Autonomous Discovery Agent"),
    (3, "Business Semantic Intelligence", "Enterprise Intelligence", "Infer the business meaning of enterprise entities, fields, events and controls.", "A120", "Business Semantic Agent"),
    (4, "Business-Flow Reconstruction", "Enterprise Intelligence", "Reverse-engineer business journeys from code, data, APIs, documents and event traces.", "A130", "Business Flow Agent"),
    (5, "Business Rule Mining", "Enterprise Intelligence", "Mine rules hidden in code, SQL, ETL, spreadsheets, configuration and documentation.", "A140", "Business Rule Mining Agent"),
    (6, "Enterprise Knowledge Graph", "Enterprise Intelligence", "Connect capabilities, processes, applications, APIs, tables, columns, rules, infrastructure and owners.", "A150", "Knowledge Graph Agent"),
    (7, "Temporal Knowledge Graph", "Enterprise Intelligence", "Track how enterprise schemas, applications, rules and dependencies change over time.", "A160", "Temporal Graph Agent"),
    (8, "F1/F2 Semantic Thumbprints", "Enterprise Intelligence", "Create machine-readable source and target fingerprints and compatibility assessments.", "A170", "Thumbprint Agent"),
    (9, "Intent-Based Migration", "Migration Intelligence", "Translate business intent into a governed migration plan and compile explicit row-level source scope into deterministic read-only predicates before discovery, mapping, validation and execution.", "A200", "Intent Migration Agent"),
    (10, "Autonomous Mapping Engine", "Migration Intelligence", "Generate explainable source-to-target mappings using structure, values, lineage, semantics and rules.", "A210", "Autonomous Mapping Agent"),
    (11, "Probabilistic Mapping", "Migration Intelligence", "Generate alternative mappings with confidence, evidence and risk.", "A220", "Probabilistic Mapping Agent"),
    (12, "Transformation Synthesis", "Migration Intelligence", "Generate transformation logic from source/target semantics and business requirements.", "A230", "Transformation Synthesis Agent"),
    (13, "Transformation Compiler", "Migration Intelligence", "Compile abstract transformations into SQL, Spark, Python, dbt and other target execution forms.", "A240", "Transformation Compiler Agent"),
    (14, "Cross-Technology Translation", "Migration Intelligence", "Translate ETL and integration logic across technologies while preserving behavior.", "A250", "Cross-Technology Translation Agent"),
    (15, "Autonomous Code Modernization", "Migration Intelligence", "Analyze legacy code and generate modernization plans and candidate refactors.", "A260", "Code Modernization Agent"),
    (16, "Architecture Synthesis", "Migration Intelligence", "Generate target application, data, API, integration, security and infrastructure architecture candidates.", "A270", "Architecture Synthesis Agent"),
    (17, "Migration Strategy Simulator", "Migration Intelligence", "Compare rehost, replatform, refactor, rewrite, retire, retain and replace strategies.", "A280", "Migration Strategy Agent"),
    (18, "What-If Simulation Engine", "Migration Intelligence", "Simulate downstream effects of proposed enterprise changes before execution.", "A290", "What-If Simulation Agent"),
    (19, "Migration Blast-Radius Engine", "Migration Intelligence", "Predict systems, interfaces, reports, users and processes affected by a change.", "A300", "Blast Radius Agent"),
    (20, "Autonomous Dependency Graph", "Migration Intelligence", "Discover hidden technical and business dependencies continuously.", "A310", "Dependency Graph Agent"),
    (21, "Synthetic Enterprise Test Data", "Quality & Validation", "Generate privacy-safe synthetic data that preserves relational and statistical characteristics.", "A400", "Synthetic Data Agent"),
    (22, "AI Test Generation", "Quality & Validation", "Generate unit, integration, regression, migration, reconciliation, performance and business-flow tests.", "A410", "Test Generation Agent"),
    (23, "Business Behavior Equivalence", "Quality & Validation", "Compare F1 and F2 business outcomes rather than only row counts.", "A420", "Behavior Equivalence Agent"),
    (24, "Continuous Reconciliation", "Quality & Validation", "Compare source and target continuously at record, aggregate, financial, relational and semantic levels.", "A430", "Reconciliation Agent"),
    (25, "Autonomous Root-Cause Analysis", "Quality & Validation", "Trace failures to mappings, rules, source records, transformations or dependencies.", "A440", "Root Cause Agent"),
    (26, "Self-Healing Migration Pipelines", "Quality & Validation", "Diagnose recoverable failures, apply safe remediation, retest and continue.", "A450", "Self-Healing Agent"),
    (27, "Predictive Migration Failure Engine", "Quality & Validation", "Predict migration batches at risk of failure before execution.", "A460", "Predictive Failure Agent"),
    (28, "Migration Risk Digital Twin", "Quality & Validation", "Simulate data, application, operational, regulatory, financial and cutover risks.", "A470", "Risk Digital Twin Agent"),
    (29, "Continuous CDC Intelligence", "Quality & Validation", "Detect schema drift, unusual CDC behavior, missing transactions and synchronization problems.", "A480", "CDC Intelligence Agent"),
    (30, "Zero-Downtime Migration Planner", "Quality & Validation", "Design snapshot, CDC, reconciliation, final synchronization and cutover plans.", "A490", "Zero Downtime Planning Agent"),
    (31, "Autonomous Cutover Simulation", "Quality & Validation", "Simulate cutover sequences and identify safer options.", "A500", "Cutover Simulation Agent"),
    (32, "Dynamic Go/No-Go Engine", "Quality & Validation", "Calculate readiness from technical, business, security, reconciliation and operational evidence.", "A510", "Go-No-Go Agent"),
    (33, "Automatic Rollback Intelligence", "Quality & Validation", "Identify rollback checkpoints and recovery strategies before cutover.", "A520", "Rollback Intelligence Agent"),
    (34, "Migration Control Tower", "Agentic Operations", "Provide an enterprise-wide live command center for applications, waves, risks and outcomes.", "A600", "Control Tower Agent"),
    (35, "Migration Swarm Intelligence", "Agentic Operations", "Coordinate specialist agents across discovery, mapping, transformation, testing, security and reconciliation.", "A610", "Swarm Coordinator Agent"),
    (36, "Agent Marketplace", "Agentic Operations", "Register specialized KMITORA agents for enterprise technologies and domains.", "A620", "Agent Marketplace Agent"),
    (37, "Agent Self-Evaluation", "Agentic Operations", "Require agents to critique and validate their own outputs before acceptance.", "A630", "Agent Evaluation Agent"),
    (38, "Dynamic Agent Creation", "Agentic Operations", "Create temporary specialist-agent plans when unfamiliar technology is encountered.", "A640", "Dynamic Agent Factory"),
    (39, "Agent Learning from Corrections", "Agentic Operations", "Convert approved human corrections into reusable organizational migration knowledge.", "A650", "Correction Learning Agent"),
    (40, "Migration Memory", "Agentic Operations", "Retain successful migration patterns for reuse in future projects.", "A660", "Migration Memory Agent"),
    (41, "Cross-Enterprise Pattern Learning", "Agentic Operations", "Identify reusable patterns while preserving organizational isolation.", "A670", "Pattern Learning Agent"),
    (42, "Natural-Language Control Plane", "Agentic Operations", "Operate KMITORA through conversational intent and evidence-backed responses.", "A700", "Natural Language Agent"),
    (43, "Voice Migration Control", "Agentic Operations", "Provide optional speech input and natural spoken A000 responses.", "A710", "Voice Interaction Agent"),
    (44, "Visual Architecture Reasoning", "Knowledge & Governance", "Interpret architecture diagrams and extract components, interfaces and dependencies.", "A720", "Visual Architecture Agent"),
    (45, "Document Intelligence", "Knowledge & Governance", "Connect BRDs, FRDs, architecture documents, mapping sheets, SOPs and policies to implementation.", "A730", "Document Intelligence Agent"),
    (46, "Contradiction Detection", "Knowledge & Governance", "Detect conflicts between documentation, code, data behavior and runtime evidence.", "A740", "Contradiction Detection Agent"),
    (47, "Requirement-to-Code Traceability", "Knowledge & Governance", "Trace requirement to rule, mapping, transformation, code, test, target record and evidence.", "A750", "Traceability Agent"),
    (48, "Explainable Migration Decisions", "Knowledge & Governance", "Attach why, evidence, confidence, alternatives and consequences to autonomous decisions.", "A760", "Explainability Agent"),
    (49, "Immutable Evidence Ledger", "Knowledge & Governance", "Create tamper-evident evidence records for discovery, approvals, transformations, tests and reconciliation.", "A770", "Evidence Ledger Agent"),
    (50, "Regulation-Aware Migration", "Knowledge & Governance", "Identify applicable regulatory and organizational-policy implications.", "A780", "Regulation Intelligence Agent"),
    (51, "Data Sovereignty Intelligence", "Knowledge & Governance", "Evaluate where data is permitted to move or reside.", "A790", "Data Sovereignty Agent"),
    (52, "Policy-as-Code Migration Guardrails", "Knowledge & Governance", "Enforce policy gates independently of agent recommendations.", "A800", "Policy Guardrail Agent"),
    (53, "Autonomous PII Discovery", "Knowledge & Governance", "Detect sensitive data using structure, values and context.", "A810", "PII Discovery Agent"),
    (54, "Cryptographic Data Lineage", "Knowledge & Governance", "Create tamper-evident lineage from source values through transformations to target values.", "A820", "Cryptographic Lineage Agent"),
    (55, "FinOps Migration Optimizer", "Optimization", "Estimate migration cost and recommend lower-cost execution strategies.", "A900", "FinOps Agent"),
    (56, "Carbon-Aware Migration Scheduling", "Optimization", "Generate carbon-aware scheduling recommendations for compute-intensive migration work.", "A910", "Carbon Scheduling Agent"),
    (57, "Target Capacity Prediction", "Optimization", "Forecast compute, memory, storage, IOPS and network requirements.", "A920", "Capacity Prediction Agent"),
    (58, "Performance Digital Twin", "Optimization", "Simulate target workload behavior before cutover.", "A930", "Performance Twin Agent"),
    (59, "Post-Migration Optimization", "Optimization", "Analyze target indexes, infrastructure, APIs and cost for post-migration optimization.", "A940", "Post-Migration Optimization Agent"),
    (60, "Continuous Modernization Mode", "Optimization", "Continuously identify modernization opportunities after migration.", "A950", "Continuous Modernization Agent"),
]

CAPABILITIES = [Capability(*row) for row in _CAPABILITY_DATA]
CAPABILITY_BY_ID = {item.id: item for item in CAPABILITIES}


def capabilities_payload() -> list[dict[str, Any]]:
    return [asdict(item) for item in CAPABILITIES]


def agents_payload() -> list[dict[str, Any]]:
    return [
        {
            "id": item.agent_id,
            "name": item.agent_role,
            "capability_id": item.id,
            "capability": item.name,
            "reports_to": "A000",
            "mode": "DEV_SAFE_AUTONOMY",
            "status": "READY",
        }
        for item in CAPABILITIES
    ]


def simulate_capability(capability_id: int, context: dict[str, Any] | None = None) -> dict[str, Any]:
    item = CAPABILITY_BY_ID.get(capability_id)
    if item is None:
        raise ValueError(f"unknown capability id: {capability_id}")
    context = context or {}
    steps = [
        "Understand request and scope",
        "Collect available DEV evidence",
        "Run deterministic capability analysis",
        "Generate recommendation or model",
        "Self-evaluate output",
        "Validate safety boundaries",
        "Record evidence",
    ]
    evidence_basis = json.dumps(
        {"capability": asdict(item), "context": context, "steps": steps},
        sort_keys=True,
        ensure_ascii=False,
    ).encode("utf-8")
    evidence_hash = sha256(evidence_basis).hexdigest()
    risk = ((capability_id * 17) % 37) + 5
    return {
        "capability": asdict(item),
        "agent": {
            "id": item.agent_id,
            "role": item.agent_role,
            "reports_to": "A000",
        },
        "status": "PASS",
        "mode": "DEV_SAFE_SIMULATION",
        "steps": [{"name": step, "status": "PASS"} for step in steps],
        "risk_score": risk,
        "recommendation": f"{item.name} DEV simulation completed. Review evidence before enabling any real execution connector.",
        "evidence_sha256": evidence_hash,
        "production_action_executed": False,
        "external_side_effects": False,
    }


def run_full_dev_suite(context: dict[str, Any] | None = None) -> dict[str, Any]:
    results = [simulate_capability(item.id, context) for item in CAPABILITIES]
    return {
        "suite": "KMITORA_ADVANCED_60_DEV_SUITE",
        "orchestrator": "A000",
        "result": "PASS" if all(r["status"] == "PASS" for r in results) else "FAIL",
        "total": len(results),
        "passed": sum(1 for r in results if r["status"] == "PASS"),
        "failed": sum(1 for r in results if r["status"] != "PASS"),
        "mode": "DEV_ONLY",
        "ci_cd": "DISABLED_BY_USER",
        "aws_security_work": "DISABLED_BY_USER",
        "production_action_executed": False,
        "results": results,
    }
