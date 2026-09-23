from __future__ import annotations

from importlib import import_module
from pathlib import Path
import sys
from typing import Any, Callable

from .contracts import AutonomyContext, CapabilityResult, CapabilitySpec, EvidenceFact


def _lazy(module: str, function: str) -> Callable[..., Any] | None:
    try:
        return getattr(import_module(module), function)
    except Exception:
        # Legacy main_api modules use sibling absolute imports when launched directly.
        # Add that directory once, then retry using the leaf module name.
        main_api = str(Path(__file__).resolve().parents[1] / "main_api")
        if main_api not in sys.path:
            sys.path.insert(0, main_api)
        try:
            return getattr(import_module(module.rsplit(".", 1)[-1]), function)
        except Exception:
            return None


class EngineAdapter:
    """Maps canonical capability ownership to existing KMITORA engines.

    Unimplemented owner-specific behavior returns an evidence-aware plan, not a fake PASS.
    This prevents 137 copy/paste implementations while preserving one contract.
    """

    def execute(self, spec: CapabilitySpec, ctx: AutonomyContext) -> CapabilityResult:
        owner = spec.owner
        try:
            if owner == "universal_problem_solver":
                fn = _lazy("backend.main_api.universal_problem_solver", "solve_enterprise_problem")
                if fn:
                    output = fn({**ctx.payload, "environment": ctx.environment, "tenant_id": ctx.tenant_id})
                    return self._from_existing(spec, output)
            if owner == "root_cause":
                fn = _lazy("backend.main_api.autonomous_root_cause_investigator", "investigate")
                if fn:
                    return self._from_existing(spec, fn(ctx.payload))
            if owner == "business_rule_dna":
                fn = _lazy("backend.main_api.business_rule_dna_engine", "analyze_business_rule_dna")
                if fn:
                    return self._from_existing(spec, fn(ctx.payload))
            if owner == "impact_analysis":
                fn = _lazy("backend.main_api.what_breaks_if_engine", "analyze_impact")
                if fn:
                    return self._from_existing(spec, fn(ctx.payload))
            if owner == "migration_autopilot":
                fn = _lazy("backend.main_api.migration_autopilot_engine", "build_migration_autopilot_plan")
                if fn:
                    return self._from_existing(spec, fn(ctx.payload))
            if owner == "evidence":
                return self._plan(spec, ctx, "Evidence capability uses the shared immutable ledger.")
            if owner == "policy":
                return self._plan(spec, ctx, "Policy capability uses deterministic PolicyEngine evaluation.")
            if owner == "gates":
                return self._plan(spec, ctx, "Formal gate is computed from upstream evidence; no self-asserted PASS.")
            return self._plan(spec, ctx, f"Capability owned by shared engine family '{owner}'.")
        except Exception as exc:
            return CapabilityResult(
                capability_id=spec.id, status="ENGINE_ERROR", confidence=0.0,
                authoritative=False, execution_authorized=False,
                production_authorized=False, cutover_authorized=False,
                errors=[f"{type(exc).__name__}: {exc}"],
                metadata={"owner": owner, "failed_closed": True},
            )

    def _from_existing(self, spec: CapabilitySpec, output: Any) -> CapabilityResult:
        data = output if isinstance(output, dict) else {"value": output}
        confidence = float(data.get("confidence") or data.get("healing_confidence") or 0.8)
        if confidence > 1:
            confidence /= 100.0
        return CapabilityResult(
            capability_id=spec.id,
            status="ANALYZED",
            confidence=max(0.0, min(1.0, confidence)),
            authoritative=False,
            execution_authorized=bool(data.get("execution_authorized", False)),
            production_authorized=False,
            cutover_authorized=False,
            findings=[data],
        )

    def _plan(self, spec: CapabilitySpec, ctx: AutonomyContext, note: str) -> CapabilityResult:
        # Planned means contract exists but capability-specific proof is still required.
        facts = [
            EvidenceFact("tenant_id", ctx.tenant_id, "runtime", 1.0, True),
            EvidenceFact("environment", ctx.environment, "runtime", 1.0, True),
            EvidenceFact("owner", spec.owner, "registry", 1.0, True),
        ]
        return CapabilityResult(
            capability_id=spec.id,
            status="PLANNED_NOT_CERTIFIED",
            confidence=0.0,
            authoritative=False,
            execution_authorized=False,
            production_authorized=False,
            cutover_authorized=False,
            facts=facts,
            findings=[{"note": note, "goal": ctx.goal}],
            metadata={"requires_capability_specific_evidence": True},
        )
