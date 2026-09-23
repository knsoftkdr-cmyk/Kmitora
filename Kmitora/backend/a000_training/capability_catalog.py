from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass, asdict
from pathlib import Path
from threading import RLock
from typing import Any, Dict, Iterable, List, Optional

PACKAGE_ROOT = Path(__file__).resolve().parent
STORE_PATH = PACKAGE_ROOT / "capability_catalog.json"


def _norm(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (value or "").strip().lower()).strip()


def _fingerprint(name: str, area: str, capabilities: Iterable[str]) -> str:
    body = "|".join([_norm(name), _norm(area), *sorted(_norm(x) for x in capabilities if x)])
    return hashlib.sha256(body.encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class CapabilityRecord:
    capability_id: str
    area: str
    name: str
    capabilities: List[str]
    source: str
    fingerprint: str
    mode: str = "KNOWLEDGE_ONLY"
    production_write_allowed: bool = False


class CapabilityCatalog:
    """Idempotent A000 capability registry.

    Existing equivalent records are ignored. New records are appended only when
    their canonical fingerprint is not already present.
    """

    def __init__(self, store_path: Path = STORE_PATH) -> None:
        self.store_path = store_path
        self._lock = RLock()
        self._records: List[CapabilityRecord] = []
        self._load()

    def _load(self) -> None:
        if not self.store_path.exists():
            return
        try:
            raw = json.loads(self.store_path.read_text(encoding="utf-8"))
            self._records = [CapabilityRecord(**item) for item in raw if isinstance(item, dict)]
        except Exception:
            self._records = []

    def _save(self) -> None:
        self.store_path.write_text(
            json.dumps([asdict(x) for x in self._records], indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

    def all(self) -> List[Dict[str, Any]]:
        with self._lock:
            return [asdict(x) for x in self._records]

    def fingerprints(self) -> set[str]:
        return {x.fingerprint for x in self._records}

    def ingest(self, items: Iterable[Dict[str, Any]], source: str) -> Dict[str, Any]:
        added: List[Dict[str, Any]] = []
        ignored: List[Dict[str, Any]] = []
        with self._lock:
            seen = self.fingerprints()
            for item in items:
                name = str(item.get("name") or item.get("topic") or "").strip()
                area = str(item.get("area") or "General").strip()
                capabilities = item.get("capabilities") or item.get("details") or []
                if isinstance(capabilities, str):
                    capabilities = [x.strip() for x in capabilities.split(",") if x.strip()]
                if not name:
                    continue
                fp = _fingerprint(name, area, capabilities)
                if fp in seen:
                    ignored.append({"name": name, "reason": "DUPLICATE_FINGERPRINT"})
                    continue
                cap_id = f"KCP-AUTO-{len(self._records) + 1:06d}"
                record = CapabilityRecord(
                    capability_id=cap_id,
                    area=area,
                    name=name,
                    capabilities=list(capabilities),
                    source=source,
                    fingerprint=fp,
                )
                self._records.append(record)
                seen.add(fp)
                added.append(asdict(record))
            if added:
                self._save()
        return {
            "status": "COMPLETE",
            "added_count": len(added),
            "ignored_duplicate_count": len(ignored),
            "added": added,
            "ignored": ignored,
            "production_actions": 0,
        }

    def search(self, text: str, limit: int = 25) -> List[Dict[str, Any]]:
        q = _norm(text)
        if not q:
            return []
        scored = []
        for rec in self._records:
            hay = _norm(" ".join([rec.area, rec.name, *rec.capabilities]))
            terms = [t for t in q.split() if t]
            score = sum(1 for t in terms if t in hay)
            if score:
                scored.append((score, rec))
        scored.sort(key=lambda x: (-x[0], x[1].name.lower()))
        return [asdict(r) for _, r in scored[:limit]]


capability_catalog = CapabilityCatalog()
