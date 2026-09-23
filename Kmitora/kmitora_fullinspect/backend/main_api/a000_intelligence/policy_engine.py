from __future__ import annotations
from typing import Any

class PolicyEngine:
    SAFE_ACTIONS = {"READ", "PROFILE", "SIMULATE", "PREVIEW", "COMPARE", "EXPLAIN"}

    def evaluate(self, action: str, environment: str = "DEV", destructive: bool = False) -> dict[str, Any]:
        normalized = action.upper()
        if destructive or normalized not in self.SAFE_ACTIONS:
            return {"decision": "APPROVAL_REQUIRED", "allowed": False, "reason": "State-changing or unclassified action requires explicit governance."}
        return {"decision": "ALLOW_READ_ONLY", "allowed": True, "reason": "Read-only/simulation action permitted by foundation policy."}
