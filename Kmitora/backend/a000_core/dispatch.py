from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Callable, Dict, Optional

@dataclass
class ToolSpec:
    tool_id: str
    name: str
    handler: Callable[..., Any]
    write_capability: str = "NONE"
    allowed_environments: tuple[str, ...] = ("DEV","QA","UAT")

class ToolGateway:
    def __init__(self) -> None:
        self.tools: Dict[str, ToolSpec] = {}

    def register(self, spec: ToolSpec) -> Dict[str, str]:
        if spec.tool_id in self.tools or any(t.name.lower() == spec.name.lower() for t in self.tools.values()):
            return {"status":"IGNORED_DUPLICATE","tool_id":spec.tool_id}
        self.tools[spec.tool_id] = spec
        return {"status":"REGISTERED","tool_id":spec.tool_id}

    def invoke(self, tool_id: str, *, environment: str = "DEV", approved: bool = False, **kwargs: Any) -> Dict[str, Any]:
        spec = self.tools[tool_id]
        write = spec.write_capability.upper() != "NONE"
        env = environment.upper()
        if env not in spec.allowed_environments:
            return {"status":"DENIED","reason":"ENVIRONMENT_NOT_ALLOWED","tool_id":tool_id}
        if write and not approved:
            return {"status":"DENIED","reason":"APPROVAL_REQUIRED","tool_id":tool_id}
        result = spec.handler(**kwargs)
        return {"status":"COMPLETED","tool_id":tool_id,"result":result,"write_capability":spec.write_capability}

class SkillDispatcher:
    def __init__(self) -> None:
        self.skills: Dict[str, Callable[..., Any]] = {}

    def register(self, skill_id: str, handler: Callable[..., Any]) -> str:
        if skill_id in self.skills:
            return "IGNORED_DUPLICATE"
        self.skills[skill_id] = handler
        return "REGISTERED"

    def dispatch(self, skill_id: str, **kwargs: Any) -> Any:
        return self.skills[skill_id](**kwargs)
