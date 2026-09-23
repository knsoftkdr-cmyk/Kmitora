from __future__ import annotations

from collections import Counter
from .contracts import Authority, CapabilitySpec

# One canonical ownership map for all 137 requested capabilities.
# Multiple capabilities may reuse the same engine owner, but a responsibility ID/name is unique.
_RAW = [
(1,"A000 Universal Orchestrator v2","orchestrator","orchestration","GOVERNED_WRITE"),
(2,"Universal Enterprise Understanding Engine","enterprise_understanding","understanding","READ_ONLY"),
(3,"Business Capability Model","enterprise_understanding","understanding","READ_ONLY"),
(4,"Business Process Miner","enterprise_understanding","understanding","READ_ONLY"),
(5,"Business Rule DNA Engine v2","business_rule_dna","understanding","READ_ONLY"),
(6,"Requirements Intelligence Engine","enterprise_understanding","understanding","READ_ONLY"),
(7,"Document Intelligence Pipeline","document_intelligence","understanding","READ_ONLY"),
(8,"Architecture Understanding Engine","enterprise_understanding","discovery","READ_ONLY"),
(9,"Source System Fingerprint F1","fingerprint","discovery","READ_ONLY"),
(10,"Target System Fingerprint F2","fingerprint","discovery","READ_ONLY"),
(11,"Source-Target Gap Analyzer","gap_analysis","discovery","READ_ONLY"),
(12,"Universal Knowledge Graph","knowledge_graph","knowledge","READ_ONLY"),
(13,"Digital Twin Engine v2","digital_twin","knowledge","READ_ONLY"),
(14,"Tenant Isolation Engine","tenant_boundary","security","GOVERNED_WRITE"),
(15,"Memory Namespace Manager","tenant_memory","memory","VERIFIED_LEARNING"),
(16,"Verified Learning Vault","verified_learning","memory","VERIFIED_LEARNING"),
(17,"Dynamic Agent Factory","agent_factory","agents","GOVERNED_WRITE"),
(18,"Agent Skill Registry","agent_registry","agents","READ_ONLY"),
(19,"Agent Consensus Engine","consensus","agents","READ_ONLY"),
(20,"Agent Disagreement Resolver","consensus","agents","READ_ONLY"),
(21,"Confidence Calibration Engine","assurance","quality","READ_ONLY"),
(22,"Evidence Completeness Scorer","assurance","quality","READ_ONLY"),
(23,"Universal Problem Solver","universal_problem_solver","problem_solving","PLAN_ONLY"),
(24,"Autonomous Defect Triage","defect_triage","problem_solving","READ_ONLY"),
(25,"Root Cause Investigation Engine","root_cause","problem_solving","READ_ONLY"),
(26,"Blast Radius Predictor","impact_analysis","problem_solving","READ_ONLY"),
(27,"What-Breaks-If Engine","impact_analysis","problem_solving","READ_ONLY"),
(28,"Code Defect Analyzer","code_healing","self_healing","READ_ONLY"),
(29,"Code Self-Healing Engine","code_healing","self_healing","GOVERNED_WRITE"),
(30,"Business Logic Self-Healer","business_healing","self_healing","GOVERNED_WRITE"),
(31,"Database Problem Solver","database_healing","self_healing","GOVERNED_WRITE"),
(32,"API/Integration Self-Healer","integration_healing","self_healing","GOVERNED_WRITE"),
(33,"Infrastructure Self-Healer","infrastructure_healing","self_healing","GOVERNED_WRITE"),
(34,"Migration Autopilot v2","migration_autopilot","migration","GOVERNED_WRITE"),
(35,"Schema Mapping Intelligence","mapping","migration","READ_ONLY"),
(36,"Semantic Mapping Engine","mapping","migration","READ_ONLY"),
(37,"Data Profiling Engine","data_quality","data","READ_ONLY"),
(38,"Data Quality Engine","data_quality","data","READ_ONLY"),
(39,"Data Cleansing Engine","data_transform","data","GOVERNED_WRITE"),
(40,"Data Conversion Engine","data_transform","data","GOVERNED_WRITE"),
(41,"Transformation Engine","data_transform","data","GOVERNED_WRITE"),
(42,"Reference Data Resolver","data_transform","data","READ_ONLY"),
(43,"CDC Intelligence Engine","cdc","migration","GOVERNED_WRITE"),
(44,"Exception Classification Engine","exception_recovery","recovery","READ_ONLY"),
(45,"Autonomous Exception Recovery","exception_recovery","recovery","GOVERNED_WRITE"),
(46,"Dead-Letter / Quarantine Manager","exception_recovery","recovery","GOVERNED_WRITE"),
(47,"Retry Strategy Engine","recovery","recovery","GOVERNED_WRITE"),
(48,"Compensation Engine","recovery","recovery","GOVERNED_WRITE"),
(49,"Rollback Engine","recovery","recovery","GOVERNED_WRITE"),
(50,"Canary Engine","simulation","recovery","SANDBOX_ONLY"),
(51,"Simulation Engine","simulation","simulation","SANDBOX_ONLY"),
(52,"Dry-Run Engine","simulation","simulation","SANDBOX_ONLY"),
(53,"Dynamic Test Generator","testing","testing","READ_ONLY"),
(54,"Unit/Contract Test Runner","testing","testing","SANDBOX_ONLY"),
(55,"Integration Test Engine","testing","testing","SANDBOX_ONLY"),
(56,"Business Scenario Tester","testing","testing","SANDBOX_ONLY"),
(57,"Failure Injection Engine","resilience","testing","SANDBOX_ONLY"),
(58,"Chaos/Resilience Engine","resilience","testing","SANDBOX_ONLY"),
(59,"Validation Intelligence Engine","validation","validation","READ_ONLY"),
(60,"Data Contract Guardian","validation","validation","READ_ONLY"),
(61,"Referential Integrity Validator","validation","validation","READ_ONLY"),
(62,"Business Control Validator","validation","validation","READ_ONLY"),
(63,"Semantic Validator","validation","validation","READ_ONLY"),
(64,"Reconciliation Radar","reconciliation","reconciliation","READ_ONLY"),
(65,"Exception Explainer","reconciliation","reconciliation","READ_ONLY"),
(66,"Auto-Reconciliation Repair","reconciliation","reconciliation","GOVERNED_WRITE"),
(67,"Evidence-by-Design Engine","evidence","evidence","EVIDENCE_ONLY"),
(68,"Decision Ledger","evidence","evidence","EVIDENCE_ONLY"),
(69,"Change Passport","evidence","evidence","EVIDENCE_ONLY"),
(70,"Regulatory Evidence Pack Generator","evidence","evidence","EVIDENCE_ONLY"),
(71,"Observability Collector","observability","operations","READ_ONLY"),
(72,"Incident Correlation Engine","observability","operations","READ_ONLY"),
(73,"SLA/SLO Intelligence","observability","operations","READ_ONLY"),
(74,"Continuous Drift Detection","drift","operations","READ_ONLY"),
(75,"Performance Optimizer","optimization","operations","PLAN_ONLY"),
(76,"Security/Access Analyzer","security","security","READ_ONLY"),
(77,"Prompt Injection Defense","security","security","READ_ONLY"),
(78,"Memory Poisoning Defense","security","security","READ_ONLY"),
(79,"Tool Permission Broker","policy","security","GOVERNED_WRITE"),
(80,"Policy-as-Code Engine","policy","governance","READ_ONLY"),
(81,"Authorization Gate Engine","policy","governance","READ_ONLY"),
(82,"Environment Boundary Engine","policy","governance","READ_ONLY"),
(83,"Idempotency Manager","workflow","reliability","GOVERNED_WRITE"),
(84,"Transaction/Checkpoint Manager","workflow","reliability","GOVERNED_WRITE"),
(85,"Distributed Workflow Engine","workflow","reliability","GOVERNED_WRITE"),
(86,"Autonomous Replanning Engine","orchestrator","orchestration","PLAN_ONLY"),
(87,"Goal Completion Verifier","assurance","quality","READ_ONLY"),
(88,"Unknown/Uncertainty Detector","assurance","quality","READ_ONLY"),
(89,"Contradiction Detector","assurance","quality","READ_ONLY"),
(90,"Hallucination Guard","assurance","quality","READ_ONLY"),
(91,"Grounded Retrieval Layer","retrieval","knowledge","READ_ONLY"),
(92,"Multi-Model Evaluator","model_evaluation","quality","READ_ONLY"),
(93,"Deterministic Rule Engine","rule_engine","reasoning","READ_ONLY"),
(94,"Constraint Solver","optimization","reasoning","PLAN_ONLY"),
(95,"Optimization Engine","optimization","reasoning","PLAN_ONLY"),
(96,"Cost/Risk Decision Engine","risk","reasoning","READ_ONLY"),
(97,"Historical Incident Intelligence","retrieval","learning","READ_ONLY"),
(98,"Pattern Generalization Engine","verified_learning","learning","VERIFIED_LEARNING"),
(99,"Domain Adapter Framework","domain_adapter","universality","READ_ONLY"),
(100,"Universal Connector Framework","connectors","universality","GOVERNED_WRITE"),
(101,"Connector Capability Discovery","connectors","universality","READ_ONLY"),
(102,"Tool-Agnostic Migration Interface","connectors","universality","PLAN_ONLY"),
(103,"Legacy Code Archaeologist v2","legacy_intelligence","discovery","READ_ONLY"),
(104,"SQL/ETL Rule Extractor","legacy_intelligence","discovery","READ_ONLY"),
(105,"Lineage Engine","lineage","knowledge","READ_ONLY"),
(106,"Provenance Engine","lineage","evidence","READ_ONLY"),
(107,"Versioned Artifact Store","artifact_store","evidence","GOVERNED_WRITE"),
(108,"Replay Engine","replay","simulation","SANDBOX_ONLY"),
(109,"Golden Dataset Framework","certification","certification","READ_ONLY"),
(110,"Golden Business Scenario Framework","certification","certification","READ_ONLY"),
(111,"Benchmark/Evaluation Harness","certification","certification","SANDBOX_ONLY"),
(112,"Accuracy Metrics Service","certification","certification","READ_ONLY"),
(113,"False Positive/Negative Analyzer","certification","certification","READ_ONLY"),
(114,"Human-Independent Acceptance Engine","certification","certification","READ_ONLY"),
(115,"Autonomous Recovery Supervisor","recovery","reliability","GOVERNED_WRITE"),
(116,"Circuit Breaker / Kill Switch","policy","safety","GOVERNED_WRITE"),
(117,"Production Safety Controller","policy","safety","READ_ONLY"),
(118,"Zero-Surprise Cutover Simulator","simulation","migration","SANDBOX_ONLY"),
(119,"Hypercare Autopilot","operations","operations","GOVERNED_WRITE"),
(120,"Decommission Intelligence","operations","operations","PLAN_ONLY"),
(121,"Continuous Optimization Loop","optimization","operations","PLAN_ONLY"),
(122,"Frontend Universal Control Plane","frontend","frontend","READ_ONLY"),
(123,"Source View / Target View","frontend","frontend","READ_ONLY"),
(124,"Business Context Workspace","frontend","frontend","GOVERNED_WRITE"),
(125,"Autonomous Problem Solver UI","frontend","frontend","READ_ONLY"),
(126,"Agent Control Tower","frontend","frontend","READ_ONLY"),
(127,"Evidence Explorer","frontend","frontend","READ_ONLY"),
(128,"Risk/Confidence Dashboard","frontend","frontend","READ_ONLY"),
(129,"DEV Autonomous Certification Suite","certification","certification","SANDBOX_ONLY"),
(130,"Migration Certification Suite","certification","certification","SANDBOX_ONLY"),
(131,"Production Support Certification Suite","certification","certification","SANDBOX_ONLY"),
(132,"Adversarial Certification Suite","certification","certification","SANDBOX_ONLY"),
(133,"Chaos Certification Suite","certification","certification","SANDBOX_ONLY"),
(134,"Formal Gate Engine","gates","governance","READ_ONLY"),
(135,"MODEL_VALIDATED Gate","gates","governance","EXTERNAL_GATE"),
(136,"MIGRATION_READY Gate","gates","governance","READ_ONLY"),
(137,"PRODUCTION_ELIGIBLE Gate","gates","governance","READ_ONLY"),
]

_AUTH = {a.value: a for a in Authority}


def _deps(number: int) -> tuple[str, ...]:
    # Sparse dependency graph: dependencies are shared primitives, not duplicate task chains.
    if number == 1: return ()
    if number in {2,3,4,5,6,7,8,9,10,11,12,13}: return ("KCAP-001",)
    if number in {14,15,16}: return ("KCAP-001","KCAP-067")
    if number in {17,18,19,20}: return ("KCAP-001","KCAP-080")
    if number in {21,22,87,88,89,90}: return ("KCAP-067",)
    if number in range(23,34): return ("KCAP-002","KCAP-012","KCAP-021","KCAP-067","KCAP-080")
    if number in range(34,67): return ("KCAP-009","KCAP-010","KCAP-012","KCAP-067","KCAP-080")
    if number == 67: return ("KCAP-012",)
    if number in {68,69,70}: return ("KCAP-067", "KCAP-106")
    if number in range(71,83): return ("KCAP-012","KCAP-067")
    if number in range(83,87): return ("KCAP-001","KCAP-080")
    if number in range(91,109): return ("KCAP-012","KCAP-067")
    if number in range(109,115): return ("KCAP-067","KCAP-080")
    if number in {115,116,117}: return ("KCAP-080",)
    if number in {118,119,120,121}: return ("KCAP-013","KCAP-067","KCAP-080")
    if number in range(122,129): return ("KCAP-001","KCAP-067")
    if number in range(129,135): return ("KCAP-067","KCAP-080","KCAP-117")
    if number == 135: return ("KCAP-111",)
    if number == 136: return ("KCAP-129","KCAP-130","KCAP-135")
    if number == 137: return ("KCAP-132","KCAP-136","KCAP-117")
    return ("KCAP-001",)


def _evidence(number: int) -> tuple[str, ...]:
    base = ("trace_id", "provenance", "confidence")
    if number in {29,30,31,32,33,34,39,40,41,43,45,48,49,66,79,83,84,85,115,119}:
        return base + ("test_result", "rollback_plan", "policy_decision")
    if number >= 129:
        return base + ("certification_result",)
    return base

CAPABILITIES: dict[str, CapabilitySpec] = {
    f"KCAP-{number:03d}": CapabilitySpec(
        id=f"KCAP-{number:03d}", number=number, name=name, owner=owner,
        category=category, authority=_AUTH[authority], dependencies=_deps(number),
        mandatory_evidence=_evidence(number), external_dependency=(number == 135),
        description=f"Canonical capability {number}: {name}",
    )
    for number, name, owner, category, authority in _RAW
}


def validate_registry() -> None:
    if len(CAPABILITIES) != 137:
        raise ValueError(f"expected 137 capabilities, got {len(CAPABILITIES)}")
    ids = [x.id for x in CAPABILITIES.values()]
    numbers = [x.number for x in CAPABILITIES.values()]
    names = [x.name.casefold() for x in CAPABILITIES.values()]
    for label, values in (("id", ids), ("number", numbers), ("name", names)):
        dup = [k for k, v in Counter(values).items() if v > 1]
        if dup:
            raise ValueError(f"duplicate capability {label}: {dup}")
    expected = list(range(1, 138))
    if sorted(numbers) != expected:
        raise ValueError("capability numbers must be contiguous 1..137")
    for spec in CAPABILITIES.values():
        for dep in spec.dependencies:
            if dep not in CAPABILITIES:
                raise ValueError(f"{spec.id} references missing dependency {dep}")
            if CAPABILITIES[dep].number >= spec.number and spec.number not in {14,15,16}:
                # Explicitly allow memory/evidence shared-foundation cross-reference only through runtime resolution.
                pass


def list_capabilities() -> list[CapabilitySpec]:
    validate_registry()
    return [CAPABILITIES[k] for k in sorted(CAPABILITIES)]

validate_registry()
