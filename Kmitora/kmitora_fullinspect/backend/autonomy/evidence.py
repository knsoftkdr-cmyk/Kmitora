from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
from typing import Any


def stable_hash(value: Any) -> str:
    data = json.dumps(value, sort_keys=True, default=str, separators=(",", ":"))
    return hashlib.sha256(data.encode("utf-8")).hexdigest()


class EvidenceLedger:
    def __init__(self) -> None:
        self._events: list[dict[str, Any]] = []

    def append(self, *, trace_id: str, tenant_id: str, capability_id: str, event_type: str,
               input_data: Any, output_data: Any, verified: bool) -> dict[str, Any]:
        event = {
            "evidence_id": f"EVD-{len(self._events)+1:08d}",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "trace_id": trace_id,
            "tenant_id": tenant_id,
            "capability_id": capability_id,
            "event_type": event_type,
            "input_hash": stable_hash(input_data),
            "output_hash": stable_hash(output_data),
            "verified": bool(verified),
        }
        self._events.append(event)
        return dict(event)

    def all(self) -> list[dict[str, Any]]:
        return [dict(x) for x in self._events]
