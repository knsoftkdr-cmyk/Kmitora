from __future__ import annotations
import uuid
from typing import Any

class DynamicAgentRuntime:
    def __init__(self) -> None:
        self.agents: dict[str, dict[str, Any]] = {}

    def create_specialist(self, purpose: str, skills: list[str], knowledge_packs: list[str]) -> dict[str, Any]:
        agent_id = f"A-DYN-{uuid.uuid4().hex[:8].upper()}"
        agent = {"agent_id": agent_id, "purpose": purpose, "skills": sorted(set(skills)), "knowledge_packs": sorted(set(knowledge_packs)), "status": "READY", "privilege": "READ_ONLY_BY_DEFAULT", "production_action_executed": False}
        self.agents[agent_id] = agent
        return agent
