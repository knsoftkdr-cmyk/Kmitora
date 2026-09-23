from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Any
from ..model import SemanticFlow


class SourceAdapter(ABC):
    @abstractmethod
    def can_read(self, payload: Any) -> bool:
        raise NotImplementedError

    @abstractmethod
    def discover(self, payload: Any) -> SemanticFlow:
        raise NotImplementedError

