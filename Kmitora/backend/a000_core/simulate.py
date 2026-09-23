from __future__ import annotations
from typing import Any, Dict, Iterable
from .models import PlanStep


def simulate(steps: Iterable[PlanStep], context: Dict[str, Any]) -> Dict[str, Any]:
    ordered = list(steps)
    risky = [s.step_id for s in ordered if not s.read_only or s.requires_approval]
    return {
        "status":"SIMULATED",
        "step_count":len(ordered),
        "risky_steps":risky,
        "blast_radius":context.get("dependencies", []),
        "source_write_executed":False,
        "target_write_executed":False,
        "production_action_executed":False,
        "cutover_executed":False,
    }
