from __future__ import annotations
from typing import Any, Dict
from .models import Situation

PROD_NAMES = {"PROD","PRODUCTION","LIVE"}
HIGH_RISK = {"HIGH","CRITICAL"}


def evaluate(s: Situation, requested_action: str = "PLAN") -> Dict[str, Any]:
    env = s.environment.upper()
    action = requested_action.upper()
    state_change = action in {"WRITE","EXECUTE","APPLY","MIGRATE","CUTOVER","DELETE","ALTER"}
    production = env in PROD_NAMES
    requires_approval = state_change or s.risk.upper() in HIGH_RISK
    allowed = True
    reason = "READ_ONLY_OR_PLANNING"
    if production and state_change:
        allowed = False
        reason = "PRODUCTION_STATE_CHANGE_DENIED_BY_DEFAULT"
    elif state_change:
        allowed = False
        reason = "STATE_CHANGE_REQUIRES_EXPLICIT_APPROVAL_AND_TOOL_GATE"
    return {
        "allowed": allowed,
        "reason": reason,
        "requires_approval": requires_approval,
        "environment": env,
        "requested_action": action,
        "source_write_executed": False,
        "target_write_executed": False,
        "production_action_executed": False,
        "cutover_executed": False,
    }
