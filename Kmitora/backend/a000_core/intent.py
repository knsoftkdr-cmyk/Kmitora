from __future__ import annotations
from typing import Dict, List
from .models import Situation

INTENTS = {
    "MIGRATION": ("migrate","migration","source","target","load","cutover","reconcile"),
    "DATA_QUALITY": ("quality","duplicate","null","standardize","cleanse","survivorship"),
    "PERFORMANCE": ("slow","latency","performance","tuning","capacity","bottleneck"),
    "SECURITY": ("security","privilege","pii","secret","mask","encrypt","access"),
    "INTEGRATION": ("api","integration","event","kafka","connector","message"),
    "MODERNIZATION": ("modernize","upgrade","refactor","cloud","container","legacy"),
    "DEFECT": ("error","failure","defect","incident","broken","root cause"),
    "RESILIENCE": ("dr","failover","recovery","outage","chaos","rollback"),
    "GOVERNANCE": ("approval","policy","audit","compliance","evidence","governance"),
}


def classify(s: Situation) -> Dict[str, object]:
    text = " ".join([s.objective, s.domain, s.technology, *s.business_rules, *s.constraints]).lower()
    scores = {k: sum(int(w in text) for w in words) for k, words in INTENTS.items()}
    ordered = sorted(scores.items(), key=lambda x: (-x[1], x[0]))
    primary = ordered[0][0] if ordered and ordered[0][1] else "GENERAL_ENGINEERING"
    return {"primary_intent": primary, "scores": scores, "risk": s.risk.upper(), "environment": s.environment.upper()}
