from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import asdict
from typing import Any
from uuid import uuid4

from .adapters import EngineAdapter
from .contracts import AutonomyContext, CapabilityResult
from .evidence import EvidenceLedger
from .gates import FormalGateEngine
from .policy import PolicyEngine
from .quality import QualityGate
from .registry import CAPABILITIES, list_capabilities


class A000AutonomyOrchestrator:
    """One non-duplicative runtime for the 137-capability program."""

    def __init__(self) -> None:
        self.policy = PolicyEngine()
        self.quality = QualityGate()
        self.adapter = EngineAdapter()
        self.evidence = EvidenceLedger()
        self.gates = FormalGateEngine()

    def catalog(self) -> list[dict[str, Any]]:
        return [asdict(spec) for spec in list_capabilities()]

    def plan(self, capability_ids: list[str]) -> list[str]:
        requested = list(dict.fromkeys(capability_ids))
        needed: set[str] = set()

        def add(cid: str) -> None:
            if cid in needed:
                return
            spec = CAPABILITIES[cid]
            for dep in spec.dependencies:
                add(dep)
            needed.add(cid)

        for cid in requested:
            if cid not in CAPABILITIES:
                raise KeyError(f"unknown capability: {cid}")
            add(cid)

        # Stable topological order by capability number.
        indegree = {cid: 0 for cid in needed}
        children: dict[str, list[str]] = defaultdict(list)
        for cid in needed:
            for dep in CAPABILITIES[cid].dependencies:
                if dep in needed:
                    indegree[cid] += 1
                    children[dep].append(cid)
        queue = deque(sorted((cid for cid, n in indegree.items() if n == 0), key=lambda x: CAPABILITIES[x].number))
        ordered: list[str] = []
        while queue:
            cid = queue.popleft()
            ordered.append(cid)
            for child in sorted(children[cid], key=lambda x: CAPABILITIES[x].number):
                indegree[child] -= 1
                if indegree[child] == 0:
                    queue.append(child)
        if len(ordered) != len(needed):
            raise RuntimeError("capability dependency cycle detected")
        return ordered

    def execute(self, capability_ids: list[str], context: dict[str, Any]) -> dict[str, Any]:
        ctx = AutonomyContext(
            tenant_id=str(context.get("tenant_id") or "DEV-TENANT"),
            workspace_id=str(context.get("workspace_id") or "default"),
            project_id=str(context.get("project_id") or "default"),
            environment=str(context.get("environment") or "DEV").upper(),
            trace_id=str(context.get("trace_id") or f"TRACE-{uuid4()}"),
            goal=str(context.get("goal") or context.get("prompt") or ""),
            payload=dict(context.get("payload") or context),
            evidence=dict(context.get("evidence") or {}),
            policy=dict(context.get("policy") or {}),
        )
        ordered = self.plan(capability_ids)
        results: dict[str, dict[str, Any]] = {}
        blocked: set[str] = set()

        for cid in ordered:
            spec = CAPABILITIES[cid]
            unmet = [dep for dep in spec.dependencies if dep in blocked]
            if unmet:
                result = CapabilityResult(cid, "BLOCKED_DEPENDENCY", 0.0, errors=[f"blocked by {', '.join(unmet)}"])
                blocked.add(cid)
            else:
                decision = self.policy.authorize_capability(spec, ctx)
                if not decision.allowed:
                    status = "HOLD_EXTERNAL_DEPENDENCY" if spec.external_dependency else "AUTHORIZATION_REQUIRED"
                    result = CapabilityResult(cid, status, 0.0, errors=[decision.reason])
                    blocked.add(cid)
                else:
                    result = self.adapter.execute(spec, ctx)
                    if result.status == "ENGINE_ERROR":
                        blocked.add(cid)
                    # Force production authority false in this DEV foundation.
                    result.production_authorized = False
                    result.cutover_authorized = False
                    if ctx.is_production and result.execution_authorized:
                        result.execution_authorized = False
                        result.errors.append("production execution stripped by safety controller")
            output = result.to_dict()
            output["policy_authority"] = spec.authority.value
            ev = self.evidence.append(
                trace_id=ctx.trace_id, tenant_id=ctx.tenant_id, capability_id=cid,
                event_type="CAPABILITY_EVALUATION", input_data=ctx.payload,
                output_data=output, verified=(output["status"] not in {"FAIL", "AUTHORIZATION_REQUIRED"}),
            )
            output["evidence_id"] = ev["evidence_id"]
            results[cid] = output

        return {
            "product": "KMITORA",
            "agent": "A000",
            "trace_id": ctx.trace_id,
            "environment": ctx.environment,
            "requested": capability_ids,
            "execution_order": ordered,
            "results": results,
            "evidence": self.evidence.all(),
            "production_authorized": False,
            "cutover_authorized": False,
        }

    def full_status(self, evidence: dict[str, Any] | None = None) -> dict[str, Any]:
        return {
            "product": "KMITORA",
            "agent": "A000",
            "capability_count": len(CAPABILITIES),
            "registry_valid": len(CAPABILITIES) == 137,
            "formal_gates": self.gates.compute(evidence or {}, production_authorized=False),
            "production_authorized": False,
            "cutover_authorized": False,
        }
