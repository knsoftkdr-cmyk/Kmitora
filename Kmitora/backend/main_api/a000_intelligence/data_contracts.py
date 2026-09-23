from __future__ import annotations
from typing import Any

class DataContractRegistry:
    def __init__(self) -> None:
        self.contracts: dict[str, dict[str, Any]] = {}
    def register(self, contract_id: str, contract: dict[str, Any]) -> dict[str, Any]:
        normalized = {"contract_id": contract_id, "status": "DRAFT", **contract}
        self.contracts[contract_id] = normalized
        return normalized
