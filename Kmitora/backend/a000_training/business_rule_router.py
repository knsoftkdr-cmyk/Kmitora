from __future__ import annotations

from typing import Any, Dict, List
from .capability_catalog import capability_catalog


class BusinessRuleRouter:
    """Situation-aware, read-only A000 capability router.

    It recommends specialist capability coverage using business context and
    explicit rules. It does not perform production writes or grant authority.
    """

    def decide(self, context: Dict[str, Any]) -> Dict[str, Any]:
        business_rules: List[Dict[str, Any]] = list(context.get("business_rules") or [])
        signals = [
            str(context.get("domain") or ""),
            str(context.get("technology") or ""),
            str(context.get("objective") or ""),
            str(context.get("problem") or ""),
            " ".join(str(x) for x in context.get("tags") or []),
            " ".join(str(r.get("name") or r.get("rule") or "") for r in business_rules),
        ]
        query = " ".join(x for x in signals if x).strip()
        matched = capability_catalog.search(query, limit=50)

        risk = str(context.get("risk") or "LOW").upper()
        environment = str(context.get("environment") or "DEV").upper()
        approval_required = risk in {"HIGH", "CRITICAL"} or environment in {"PROD", "PRODUCTION"}

        return {
            "status": "ROUTED" if matched else "NO_MATCH",
            "query": query,
            "matched_capabilities": matched,
            "business_rule_count": len(business_rules),
            "environment": environment,
            "risk": risk,
            "approval_required": approval_required,
            "execution_authority": "NONE",
            "recommended_mode": "PLAN_ONLY" if approval_required else "READ_ONLY_ANALYSIS",
            "source_write_executed": False,
            "target_write_executed": False,
            "production_action_executed": False,
        }


business_rule_router = BusinessRuleRouter()
