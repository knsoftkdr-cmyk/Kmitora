from __future__ import annotations
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional

PATCH_ID = "KMITORA_A000_E2E_INTELLIGENCE_013_026"

@dataclass(frozen=True)
class Capability:
    capability_id: str
    name: str
    category: str
    description: str
    aliases: tuple[str, ...] = ()
    tags: tuple[str, ...] = ()
    risk: str = "LOW"
    execution_authority: str = "NONE"

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["aliases"] = list(self.aliases)
        d["tags"] = list(self.tags)
        return d

@dataclass
class Situation:
    objective: str
    domain: str = ""
    technology: str = ""
    environment: str = "DEV"
    risk: str = "LOW"
    business_rules: List[str] = field(default_factory=list)
    constraints: List[str] = field(default_factory=list)
    evidence: List[Dict[str, Any]] = field(default_factory=list)

@dataclass
class PlanStep:
    step_id: str
    capability_id: str
    action: str
    depends_on: List[str] = field(default_factory=list)
    read_only: bool = True
    requires_approval: bool = False
    validator_ids: List[str] = field(default_factory=list)

@dataclass
class Decision:
    decision_id: str
    status: str
    reason: str
    evidence_ids: List[str] = field(default_factory=list)
    confidence: float = 0.0
    source_write_executed: bool = False
    target_write_executed: bool = False
    production_action_executed: bool = False
    cutover_executed: bool = False
