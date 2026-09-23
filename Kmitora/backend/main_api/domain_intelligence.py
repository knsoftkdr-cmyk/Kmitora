"""KMITORA universal domain intelligence.

This module provides deterministic domain ranking, A000 specialist allocation,
client-context synthesis and scenario generation. It is advisory/reference
intelligence and never authorizes production mutation.
"""

from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
from pathlib import Path
import re
from typing import Any

CATALOG_PATH = Path(__file__).with_name("universal_domain_catalog.json")

LIFECYCLE = (
    "Understand",
    "Discover",
    "Detect",
    "Diagnose",
    "Predict",
    "Recommend",
    "Simulate",
    "Execute",
    "Test",
    "Validate",
    "Reconcile",
    "Evidence",
    "Learn",
)

TECHNICAL_SIGNALS = {
    "database": ("Data", "Master Data Management", "Data Governance"),
    "sql": ("Data", "Quality Engineering", "Data Governance"),
    "api": ("Integration", "API Management", "Security"),
    "microservice": ("Platform Engineering", "SRE", "Integration"),
    "cloud": ("Cloud", "Infrastructure", "Security"),
    "kubernetes": ("Platform Engineering", "SRE", "Infrastructure"),
    "mainframe": ("Enterprise Architecture", "Data", "Integration"),
    "sap": ("Enterprise Architecture", "Finance", "Supply Chain"),
    "oracle": ("Data", "Enterprise Architecture", "Integration"),
    "salesforce": ("CRM", "Sales", "Integration"),
    "etl": ("Data", "Integration", "Quality Engineering"),
    "stream": ("Integration", "Data", "SRE"),
    "batch": ("Operations", "Data", "SRE"),
    "security": ("Security", "Risk", "Compliance"),
    "identity": ("Identity & Access", "Security", "Compliance"),
    "privacy": ("Privacy", "Compliance", "Data Governance"),
    "incident": ("SRE", "Service Management", "Risk"),
    "defect": ("Quality Engineering", "Testing", "Risk"),
    "error": ("Quality Engineering", "SRE", "Testing"),
    "performance": ("SRE", "Platform Engineering", "Testing"),
    "migration": ("Enterprise Architecture", "Integration", "Data"),
}

DOMAIN_KEYWORDS = {
    "Banking": ("bank", "loan", "deposit", "account", "branch", "core banking"),
    "Capital Markets": ("trading", "trade", "broker", "exchange", "securities"),
    "Insurance": ("policy", "claim", "underwriting", "premium", "insured"),
    "Payments": ("payment", "merchant", "card", "settlement", "transaction"),
    "Healthcare": ("patient", "clinical", "ehr", "hospital", "care"),
    "Pharmaceuticals": ("drug", "pharma", "formulation", "regulatory submission"),
    "Retail": ("retail", "store", "sku", "pos", "customer order"),
    "E-Commerce": ("ecommerce", "e-commerce", "cart", "checkout", "marketplace"),
    "Manufacturing": ("plant", "production line", "bom", "work order", "manufacturing"),
    "Automotive": ("vehicle", "automotive", "dealer", "vin"),
    "Energy": ("energy", "generation", "grid", "meter"),
    "Oil & Gas": ("oil", "gas", "pipeline", "refinery", "well"),
    "Utilities": ("utility", "meter", "billing", "grid", "outage"),
    "Telecommunications": ("telecom", "subscriber", "network", "billing", "cdr"),
    "Transportation": ("transport", "fleet", "route", "shipment"),
    "Airlines": ("airline", "flight", "pnr", "booking", "airport"),
    "Logistics": ("logistics", "shipment", "warehouse", "freight", "delivery"),
    "Government": ("government", "citizen", "agency", "public service"),
    "Education": ("student", "course", "campus", "learning"),
    "Real Estate": ("property", "lease", "tenant", "real estate"),
    "Construction": ("construction", "project site", "contractor", "building"),
    "Agriculture": ("farm", "crop", "agriculture", "harvest"),
    "Travel": ("travel", "booking", "reservation", "traveler"),
    "Hospitality": ("hotel", "guest", "room", "reservation"),
    "Legal": ("legal", "case", "matter", "contract", "law"),
    "Technology": ("technology", "software", "platform", "application"),
    "Software": ("software", "source code", "repository", "release"),
    "Cloud Computing": ("cloud", "aws", "azure", "gcp"),
    "SaaS": ("saas", "subscription", "tenant", "workspace"),
    "AI / ML": ("ai", "machine learning", "model", "llm", "agent"),
    "Cybersecurity": ("cyber", "security", "threat", "vulnerability", "soc"),
    "Environment": ("environment", "emission", "climate", "environmental"),
    "Sustainability": ("sustainability", "esg", "carbon", "net zero"),
}

FUNCTION_KEYWORDS = {
    "Finance": ("finance", "ledger", "invoice", "accounting", "close"),
    "Treasury": ("treasury", "cash", "liquidity"),
    "Procurement": ("procurement", "purchase order", "supplier", "vendor"),
    "Supply Chain": ("supply chain", "inventory", "warehouse", "shipment"),
    "Human Resources": ("employee", "hr", "workforce", "talent"),
    "Payroll": ("payroll", "salary", "payslip"),
    "Compliance": ("compliance", "regulatory", "control"),
    "Risk": ("risk", "exposure", "control"),
    "Sales": ("sales", "opportunity", "pipeline", "quote"),
    "Marketing": ("marketing", "campaign", "lead"),
    "Customer Service": ("customer service", "case", "contact center"),
    "CRM": ("crm", "customer relationship", "salesforce"),
    "Operations": ("operations", "workflow", "runbook"),
    "IT": ("it", "application", "system", "service"),
    "Data": ("data", "database", "schema", "table"),
    "Analytics": ("analytics", "dashboard", "report", "bi"),
    "AI": ("ai", "model", "llm", "agent"),
    "Security": ("security", "vulnerability", "threat", "soc"),
    "Privacy": ("privacy", "pii", "personal data"),
    "Integration": ("integration", "api", "interface", "message"),
    "API Management": ("api", "gateway", "endpoint"),
    "Quality Engineering": ("quality", "defect", "bug", "test"),
    "Testing": ("test", "qa", "regression", "validation"),
    "SRE": ("sre", "incident", "availability", "latency", "reliability"),
    "Cloud": ("cloud", "aws", "azure", "gcp"),
    "Data Governance": ("data governance", "lineage", "catalog", "quality"),
}


def load_catalog() -> dict[str, list[dict[str, str]]]:
    with CATALOG_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def catalog_payload() -> dict[str, Any]:
    catalog = load_catalog()
    items = [*catalog["industries"], *catalog["functions"]]
    return {
        "kind": "kmitora_universal_domain_catalog",
        "industry_count": len(catalog["industries"]),
        "enterprise_function_count": len(catalog["functions"]),
        "total_seeded_domains": len(items),
        "extensible": True,
        "items": items,
        "production_action_executed": False,
    }


def _normalize(value: str) -> str:
    return re.sub(r"\s+", " ", value.lower().strip())


def _score_keywords(text: str, keywords: tuple[str, ...]) -> int:
    score = 0
    for keyword in keywords:
        token = _normalize(keyword)
        if token in text:
            score += 4 if " " in token else 2
    return score


def infer_domains(payload: dict[str, Any]) -> dict[str, Any]:
    catalog = load_catalog()
    text_parts = [
        str(payload.get("description", "")),
        str(payload.get("industry_hint", "")),
        " ".join(map(str, payload.get("systems", []) or [])),
        " ".join(map(str, payload.get("processes", []) or [])),
        " ".join(map(str, payload.get("issues", []) or [])),
        " ".join(map(str, payload.get("technologies", []) or [])),
    ]
    text = _normalize(" ".join(text_parts))

    industry_scores: dict[str, int] = {}
    function_scores: dict[str, int] = {}

    for item in catalog["industries"]:
        name = item["name"]
        keywords = DOMAIN_KEYWORDS.get(name, (name,))
        score = _score_keywords(text, tuple(keywords))
        if score:
            industry_scores[name] = score

    for item in catalog["functions"]:
        name = item["name"]
        keywords = FUNCTION_KEYWORDS.get(name, (name,))
        score = _score_keywords(text, tuple(keywords))
        if score:
            function_scores[name] = score

    for signal, functions in TECHNICAL_SIGNALS.items():
        if signal in text:
            for function in functions:
                function_scores[function] = function_scores.get(function, 0) + 3

    industry_lookup = {item["name"]: item for item in catalog["industries"]}
    function_lookup = {item["name"]: item for item in catalog["functions"]}

    ranked_industries = sorted(
        industry_scores.items(),
        key=lambda pair: (-pair[1], pair[0]),
    )[:5]
    ranked_functions = sorted(
        function_scores.items(),
        key=lambda pair: (-pair[1], pair[0]),
    )[:12]

    def confidence(score: int) -> int:
        return min(99, 55 + score * 5)

    industries = [
        {**industry_lookup[name], "score": score, "confidence": confidence(score)}
        for name, score in ranked_industries
    ]
    functions = [
        {**function_lookup[name], "score": score, "confidence": confidence(score)}
        for name, score in ranked_functions
    ]

    return {
        "kind": "kmitora_domain_inference",
        "industries": industries,
        "functions": functions,
        "needs_human_confirmation": not bool(industries),
        "inference_truth": "DETERMINISTIC_KEYWORD_AND_CONTEXT_RANKING",
        "production_action_executed": False,
    }


def allocate_agents(payload: dict[str, Any]) -> dict[str, Any]:
    domain = str(payload.get("domain_name") or "Cross-Industry")
    functions = [str(item) for item in payload.get("functions", []) or []]
    issues = [str(item) for item in payload.get("issues", []) or []]
    technologies = [str(item) for item in payload.get("technologies", []) or []]

    roles = [
        ("A000", "Master Orchestrator", "routing, governance, evidence and lifecycle state"),
        ("KDOM", f"{domain} Business Specialist", "business semantics, policies, processes and terminology"),
        ("KPROC", "Process Intelligence Specialist", "process discovery, variants, controls and optimization"),
        ("KDATA", "Data & Schema Specialist", "models, lineage, quality, mappings and reconciliation"),
        ("KAPP", "Application & Integration Specialist", "code, APIs, dependencies and interfaces"),
        ("KDEF", "Defect & Problem Intelligence Specialist", "errors, defects, RCA, functional and technical problems"),
        ("KSEC", "Security & Compliance Specialist", "security, privacy, identity and regulatory controls"),
        ("KMIG", "Transformation & Migration Specialist", "migration design, adapters, transforms and rollback"),
        ("KSRE", "Reliability & Performance Specialist", "runtime, incidents, performance and resilience"),
        ("KQA", "Autonomous QA & Assurance Specialist", "tests, invariants, regression and certification"),
        ("KEVD", "Evidence & Governance Specialist", "approvals, provenance, validation and audit evidence"),
    ]

    agents = []
    for index, (prefix, title, purpose) in enumerate(roles, 1):
        agent_id = prefix if prefix == "A000" else f"{prefix}-{index:03d}"
        agents.append(
            {
                "agent_id": agent_id,
                "title": title,
                "domain": domain,
                "functions": functions,
                "purpose": purpose,
                "technologies": technologies,
                "issue_context": issues,
                "authority": "GOVERNED",
                "production_write_allowed": False,
                "destructive_action_allowed": False,
            }
        )

    return {
        "kind": "kmitora_dynamic_agent_allocation",
        "orchestrator": "A000",
        "domain": domain,
        "functions": functions,
        "agents": agents,
        "agent_count": len(agents),
        "customization_mode": "RUNTIME_CONTEXT_COMPOSITION",
        "production_action_executed": False,
    }


def build_client_context(payload: dict[str, Any]) -> dict[str, Any]:
    inference = infer_domains(payload)
    primary = (
        inference["industries"][0]["name"]
        if inference["industries"]
        else str(payload.get("domain_name") or "Cross-Industry")
    )
    functions = [
        item["name"] for item in inference["functions"]
    ] or [str(item) for item in payload.get("functions", []) or []]

    fingerprint_source = json.dumps(
        {
            "domain": primary,
            "functions": functions,
            "systems": payload.get("systems", []),
            "processes": payload.get("processes", []),
            "issues": payload.get("issues", []),
            "technologies": payload.get("technologies", []),
        },
        sort_keys=True,
    )
    context_id = hashlib.sha256(fingerprint_source.encode("utf-8")).hexdigest()[:16]

    return {
        "context_id": f"KCTX-{context_id.upper()}",
        "domain": primary,
        "functions": functions,
        "systems": payload.get("systems", []) or [],
        "processes": payload.get("processes", []) or [],
        "issues": payload.get("issues", []) or [],
        "technologies": payload.get("technologies", []) or [],
        "client_extensions": payload.get("client_extensions", {}) or {},
        "learning_policy": "VERIFIED_EVIDENCE_ONLY",
        "customization": {
            "configuration": True,
            "generated_adapters": "SANDBOX_AND_TEST_ONLY",
            "generated_code": "SANDBOX_AND_TEST_ONLY",
            "production_change": "EXPLICIT_APPROVAL_REQUIRED",
        },
        "production_action_executed": False,
    }


def synthesize_scenarios(payload: dict[str, Any]) -> dict[str, Any]:
    context = build_client_context(payload)
    allocation = allocate_agents(
        {
            **payload,
            "domain_name": context["domain"],
            "functions": context["functions"],
        }
    )
    issues = [str(item) for item in context["issues"]]
    systems = [str(item) for item in context["systems"]]
    functions = [str(item) for item in context["functions"]]

    drivers = issues or systems or functions or ["baseline enterprise context"]
    scenarios: list[dict[str, Any]] = []
    serial = 1
    for stage in LIFECYCLE:
        for driver in drivers[:20]:
            digest = hashlib.sha256(
                f"{context['context_id']}|{stage}|{driver}".encode("utf-8")
            ).hexdigest()[:12].upper()
            scenarios.append(
                {
                    "scenario_id": f"KDS-{digest}",
                    "serial": serial,
                    "stage": stage,
                    "domain": context["domain"],
                    "driver": driver,
                    "expected_behavior": f"{stage} {driver} using verified {context['domain']} context",
                    "assigned_agent_profiles": [
                        item["agent_id"] for item in allocation["agents"][:6]
                    ],
                    "production_write_allowed": False,
                    "production_cutover_allowed": False,
                    "destructive_action_allowed": False,
                    "evidence_required": True,
                }
            )
            serial += 1

    return {
        "kind": "kmitora_dynamic_domain_scenarios",
        "client_context": context,
        "scenario_count": len(scenarios),
        "scenarios": scenarios,
        "generation_truth": "DETERMINISTIC_CONTEXTUAL_SCENARIO_SYNTHESIS",
        "production_action_executed": False,
    }
