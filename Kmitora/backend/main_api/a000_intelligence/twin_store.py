from __future__ import annotations
from copy import deepcopy
from typing import Any

class DigitalTwinStateStore:
    def __init__(self) -> None:
        self._twins: dict[str, dict[str, Any]] = {}
        self._history: dict[str, list[dict[str, Any]]] = {}

    def upsert(self, twin_id: str, state: dict[str, Any]) -> dict[str, Any]:
        if twin_id in self._twins:
            self._history.setdefault(twin_id, []).append(deepcopy(self._twins[twin_id]))
        self._twins[twin_id] = {**deepcopy(state), "twin_id": twin_id}
        return deepcopy(self._twins[twin_id])

    def get(self, twin_id: str) -> dict[str, Any] | None:
        value = self._twins.get(twin_id)
        return deepcopy(value) if value else None

    def compare(self, left_id: str, right_id: str) -> dict[str, Any]:
        left, right = self.get(left_id) or {}, self.get(right_id) or {}
        keys = sorted(set(left) | set(right))
        differences = [{"field": key, "left": left.get(key), "right": right.get(key)} for key in keys if left.get(key) != right.get(key)]
        return {"left": left_id, "right": right_id, "differences": differences, "production_action_executed": False}
