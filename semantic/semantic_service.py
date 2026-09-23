from __future__ import annotations
from typing import Any
from .kmitora_semantic import UniversalSemanticEngine, GenericMetadataAdapter


class KMITORASemanticService:
    def __init__(self) -> None:
        self.engine = UniversalSemanticEngine([GenericMetadataAdapter()])

    def analyze(self, payload: Any):
        return self.engine.analyze(payload)


semantic_service = KMITORASemanticService()

