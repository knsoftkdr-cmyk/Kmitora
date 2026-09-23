from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .contracts import Authority, AutonomyContext, CapabilitySpec


@dataclass(frozen=True)
class PolicyDecision:
    allowed: bool
    reason: str
    requires_authorization: bool = False


class PolicyEngine:
    """Deterministic safety boundary independent of model/agent reasoning."""

    FORBIDDEN_PRODUCTION_ACTIONS = {
        "DROP_DATABASE", "DROP_TABLE", "TRUNCATE", "BYPASS_GOVERNANCE",
        "DISABLE_AUDIT", "UNBOUNDED_WRITE", "CUTOVER", "DELETE_PRODUCTION_DATA",
    }

    def authorize_capability(self, spec: CapabilitySpec, ctx: AutonomyContext) -> PolicyDecision:
        if spec.authority in {Authority.READ_ONLY, Authority.PLAN_ONLY, Authority.EVIDENCE_ONLY}:
            return PolicyDecision(True, "non-mutating capability")
        if spec.authority == Authority.EXTERNAL_GATE:
            return PolicyDecision(False, "external prerequisite must be evidenced", True)
        if ctx.is_production:
            return PolicyDecision(False, "production mutations are default-deny", True)
        if spec.authority == Authority.SANDBOX_ONLY and ctx.environment.upper() not in {"DEV", "QA", "UAT", "TEST", "SANDBOX"}:
            return PolicyDecision(False, "sandbox capability outside permitted environment")
        return PolicyDecision(True, "governed non-production operation")

    def authorize_action(self, action: dict[str, Any], ctx: AutonomyContext) -> PolicyDecision:
        action_type = str(action.get("type") or "").upper()
        if action_type in self.FORBIDDEN_PRODUCTION_ACTIONS:
            return PolicyDecision(False, f"forbidden action: {action_type}")
        destructive = bool(action.get("destructive"))
        writes = bool(action.get("writes"))
        if ctx.is_production and (destructive or writes):
            return PolicyDecision(False, "production write requires separate authorization", True)
        return PolicyDecision(True, "action permitted by current boundary")
