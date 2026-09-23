from __future__ import annotations
from datetime import datetime, timezone
from hashlib import sha256
import json
from typing import Any, Dict


def build_evidence(event_type: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    canonical = json.dumps(payload, sort_keys=True, default=str, separators=(",", ":"))
    return {
        "event_type": event_type,
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "sha256": sha256(canonical.encode("utf-8")).hexdigest(),
        "payload": payload,
    }

