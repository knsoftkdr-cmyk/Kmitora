from __future__ import annotations
from typing import Any, Dict

from .base import SourceAdapter
from ..model import OperationKind, SemanticFlow, SemanticOperation
from ..registry import build_default_registry


class GenericMetadataAdapter(SourceAdapter):
    def __init__(self) -> None:
        self.registry = build_default_registry()

    def can_read(self, payload: Any) -> bool:
        return isinstance(payload, dict) and "operations" in payload

    def discover(self, payload: Dict[str, Any]) -> SemanticFlow:
        flow = SemanticFlow(
            id=str(payload.get("id", "flow")),
            name=str(payload.get("name", "Unnamed Flow")),
            metadata=dict(payload.get("metadata", {})),
        )

        for raw in payload.get("operations", []):
            raw_type = str(raw.get("type", "expression"))
            kind = self.registry.resolve(raw_type) or OperationKind.EXPRESSION
            flow.add_operation(SemanticOperation(
                id=str(raw["id"]),
                kind=kind,
                name=str(raw.get("name", raw["id"])),
                inputs=list(raw.get("inputs", [])),
                outputs=list(raw.get("outputs", [])),
                config=dict(raw.get("config", {})),
                expression=raw.get("expression"),
                business_rule=raw.get("business_rule"),
                source_vendor=raw.get("source_vendor"),
                source_object_type=raw_type,
                lineage=[tuple(x) for x in raw.get("lineage", [])],
                tags=list(raw.get("tags", [])),
            ))

        for edge in payload.get("edges", []):
            flow.add_edge(str(edge[0]), str(edge[1]))

        return flow

