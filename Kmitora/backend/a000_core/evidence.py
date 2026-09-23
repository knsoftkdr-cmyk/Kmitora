from __future__ import annotations
import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List


def build_evidence(kind: str, payload: Dict[str, Any], parents: List[str] | None = None) -> Dict[str, Any]:
    canonical = json.dumps(payload, sort_keys=True, default=str, separators=(",",":"))
    return {
        "evidence_id": f"EVD-{uuid.uuid4()}",
        "kind": kind,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "sha256": hashlib.sha256(canonical.encode("utf-8")).hexdigest(),
        "parent_evidence_ids": parents or [],
        "payload": payload,
    }
