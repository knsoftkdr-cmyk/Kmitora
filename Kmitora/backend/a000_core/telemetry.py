from __future__ import annotations
import time
from contextlib import contextmanager
from typing import Any, Dict, List

class Telemetry:
    def __init__(self) -> None:
        self.events: List[Dict[str, Any]] = []

    def emit(self, name: str, **data: Any) -> None:
        self.events.append({"name":name,"ts":time.time(),**data})

    @contextmanager
    def span(self, name: str, **data: Any):
        start = time.time(); self.emit(name+".start", **data)
        try:
            yield
            self.emit(name+".end", duration_ms=round((time.time()-start)*1000,3), status="PASS")
        except Exception as exc:
            self.emit(name+".end", duration_ms=round((time.time()-start)*1000,3), status="FAIL", error=str(exc))
            raise
