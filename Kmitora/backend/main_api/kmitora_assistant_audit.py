from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def _canonical(value: dict[str, Any]) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode("utf-8")


def _default_path() -> Path:
    configured = os.getenv("KMITORA_ASSISTANT_AUDIT_PATH", "").strip()
    if configured:
        return Path(configured)
    return Path(__file__).resolve().parent / "runtime" / "assistant_audit.jsonl"


def _last_hash(path: Path) -> str:
    if not path.exists() or path.stat().st_size == 0:
        return "GENESIS"
    try:
        last = ""
        with path.open("r", encoding="utf-8") as handle:
            for raw in handle:
                if raw.strip():
                    last = raw.strip()
        if not last:
            return "GENESIS"
        data = json.loads(last)
        return str(data.get("event_hash") or "GENESIS")
    except Exception:
        return "UNKNOWN_PREVIOUS_HASH"


def append_audit_event(event: dict[str, Any], *, path: str | None = None) -> dict[str, Any]:
    target = Path(path) if path else _default_path()
    target.parent.mkdir(parents=True, exist_ok=True)
    previous_hash = _last_hash(target)
    body = {
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "previous_hash": previous_hash,
        **event,
    }
    body["event_hash"] = hashlib.sha256(_canonical(body)).hexdigest()
    with target.open("a", encoding="utf-8", newline="\n") as handle:
        handle.write(json.dumps(body, sort_keys=True, ensure_ascii=True) + "\n")
    return body


def verify_audit_chain(*, path: str | None = None) -> dict[str, Any]:
    target = Path(path) if path else _default_path()
    if not target.exists():
        return {"valid": True, "events": 0, "path": str(target)}
    previous = "GENESIS"
    count = 0
    with target.open("r", encoding="utf-8") as handle:
        for line_no, raw in enumerate(handle, start=1):
            if not raw.strip():
                continue
            item = json.loads(raw)
            claimed = item.pop("event_hash", None)
            if item.get("previous_hash") != previous:
                return {"valid": False, "events": count, "line": line_no, "reason": "previous_hash_mismatch", "path": str(target)}
            computed = hashlib.sha256(_canonical(item)).hexdigest()
            if claimed != computed:
                return {"valid": False, "events": count, "line": line_no, "reason": "event_hash_mismatch", "path": str(target)}
            previous = claimed
            count += 1
    return {"valid": True, "events": count, "last_hash": previous, "path": str(target)}
