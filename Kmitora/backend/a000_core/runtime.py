from __future__ import annotations
from pathlib import Path
from typing import Any, Dict, List
import uuid

from .models import Situation, PlanStep
from .registry import UniversalRegistry
from .seed_catalog import SEED_CAPABILITIES
from .intent import classify
from .policy import evaluate as evaluate_policy
from .dag import DAGPlanner
from .simulate import simulate
from .validators import ValidatorFramework
from .evaluate import calibrated_confidence
from .evidence import build_evidence
from .telemetry import Telemetry

class A000CoreRuntime:
    def __init__(self, project_root: Path | None = None) -> None:
        self.registry = UniversalRegistry(project_root)
        self.telemetry = Telemetry()
        self.validators = ValidatorFramework()
        self.dag = DAGPlanner()
        self.registry.discover_existing_ids()
        for cap in SEED_CAPABILITIES:
            self.registry.register(cap)
        self.registry.import_database_catalog()

    def plan(self, request: Dict[str, Any]) -> Dict[str, Any]:
        s = Situation(
            objective=str(request.get("objective") or request.get("message") or ""),
            domain=str(request.get("domain") or ""),
            technology=str(request.get("technology") or ""),
            environment=str(request.get("environment") or "DEV"),
            risk=str(request.get("risk") or "LOW"),
            business_rules=list(request.get("business_rules") or []),
            constraints=list(request.get("constraints") or []),
            evidence=list(request.get("evidence") or []),
        )
        with self.telemetry.span("a000.plan", environment=s.environment):
            intent = classify(s)
            query = " ".join([s.objective, s.domain, s.technology, intent["primary_intent"], *s.business_rules])
            caps = self.registry.search(query, limit=12)
            if not caps:
                caps = [c for c in SEED_CAPABILITIES if c.capability_id in {"KCP90002","KCP90003","KCP90007","KCP90023"}]
            steps: List[PlanStep] = []
            prev: str | None = None
            for i, cap in enumerate(caps, 1):
                sid = f"STEP-{i:03d}"
                steps.append(PlanStep(
                    step_id=sid,
                    capability_id=cap.capability_id,
                    action=cap.name,
                    depends_on=[prev] if prev else [],
                    read_only=True,
                    requires_approval=False,
                    validator_ids=["VAL-SAFETY","VAL-EVIDENCE"],
                ))
                prev = sid
            ordered = self.dag.order(steps)
            policy = evaluate_policy(s, "PLAN")
            sim = simulate(ordered, request)
            evidence = build_evidence("A000_PLAN", {
                "objective":s.objective,
                "intent":intent,
                "capabilities":[c.capability_id for c in caps],
                "steps":[x.step_id for x in ordered],
                "policy":policy,
            })
            conf = calibrated_confidence([1.0 if s.objective else 0.0, 1.0 if caps else 0.0], 1.0)
            return {
                "plan_id":f"PLAN-{uuid.uuid4()}",
                "status":"READY" if s.objective else "REVIEW",
                "mode":"PLAN_ONLY",
                "intent":intent,
                "capabilities":[c.to_dict() for c in caps],
                "steps":[x.__dict__ for x in ordered],
                "policy":policy,
                "simulation":sim,
                "confidence":conf,
                "evidence":evidence,
                "source_write_executed":False,
                "target_write_executed":False,
                "production_action_executed":False,
                "cutover_executed":False,
            }
