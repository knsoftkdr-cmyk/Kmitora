from __future__ import annotations
import json
import re
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

from .models import Capability
from .dedup import equivalent, fingerprint, normalize


class UniversalRegistry:
    """Canonical, duplicate-resistant registry for families/agents/capabilities/skills/tools.

    Existing repository IDs are discovered and treated as authoritative references. New
    capabilities are registered only when no exact ID/fingerprint/semantic equivalent exists.
    """

    ID_PATTERNS = {
        "family": re.compile(r"\bKFM\d{4}\b"),
        "agent": re.compile(r"\bKAG\d{5}\b"),
        "capability": re.compile(r"\b(?:KCP\d{5}|KDBC-\d{4})\b"),
        "skill": re.compile(r"\bKSK\d{5}\b"),
        "tool": re.compile(r"\bKTL\d{4,5}\b"),
    }

    def __init__(self, project_root: Optional[Path] = None) -> None:
        self.project_root = project_root
        self.capabilities: Dict[str, Capability] = {}
        self.by_fingerprint: Dict[str, str] = {}
        self.existing_ids: Dict[str, set[str]] = {k: set() for k in self.ID_PATTERNS}

    def discover_existing_ids(self) -> Dict[str, int]:
        if not self.project_root or not self.project_root.exists():
            return {k: 0 for k in self.existing_ids}
        for path in self.project_root.rglob("*"):
            if not path.is_file() or any(p in path.parts for p in (".git", ".venv", "node_modules", "dist", "build")):
                continue
            if path.suffix.lower() not in {".py", ".ts", ".tsx", ".json", ".md", ".txt", ".csv"}:
                continue
            try:
                text = path.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                continue
            for kind, rx in self.ID_PATTERNS.items():
                self.existing_ids[kind].update(rx.findall(text))
        return {k: len(v) for k, v in self.existing_ids.items()}

    def register(self, capability: Capability) -> Dict[str, str]:
        if capability.capability_id in self.capabilities:
            return {"status": "IGNORED_DUPLICATE", "canonical_id": capability.capability_id, "reason": "EXACT_ID"}
        fp = fingerprint(capability.name, capability.description, *capability.aliases)
        if fp in self.by_fingerprint:
            return {"status": "IGNORED_DUPLICATE", "canonical_id": self.by_fingerprint[fp], "reason": "FINGERPRINT"}
        semantic = equivalent(capability.name, ((cid, c.name) for cid, c in self.capabilities.items()))
        if semantic:
            return {"status": "IGNORED_DUPLICATE", "canonical_id": semantic, "reason": "SEMANTIC_EQUIVALENT"}
        self.capabilities[capability.capability_id] = capability
        self.by_fingerprint[fp] = capability.capability_id
        return {"status": "REGISTERED", "canonical_id": capability.capability_id, "reason": "NEW"}

    def import_database_catalog(self) -> int:
        if not self.project_root:
            return 0
        paths = [
            self.project_root / "backend" / "a000_training" / "data" / "universal_database_capabilities.json",
            self.project_root / "backend" / "a000_training" / "data" / "database_universe_224.json",
        ]
        added = 0
        for path in paths[:1]:
            if not path.exists():
                continue
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except Exception:
                continue
            rows = data if isinstance(data, list) else data.get("capabilities", [])
            for row in rows:
                cid = str(row.get("capability_id") or row.get("id") or "").strip()
                name = str(row.get("name") or row.get("capability") or "").strip()
                if not cid or not name:
                    continue
                result = self.register(Capability(
                    capability_id=cid,
                    name=name,
                    category=str(row.get("category") or "DATABASE"),
                    description=str(row.get("description") or name),
                    aliases=tuple(row.get("aliases") or []),
                    tags=tuple(row.get("tags") or ["database"]),
                ))
                added += int(result["status"] == "REGISTERED")
        return added

    def search(self, query: str, limit: int = 20) -> List[Capability]:
        q = set(normalize(query).split())
        scored: List[Tuple[int, Capability]] = []
        for cap in self.capabilities.values():
            text = normalize(" ".join((cap.name, cap.description, *cap.aliases, *cap.tags)))
            score = len(q.intersection(text.split()))
            if score:
                scored.append((score, cap))
        scored.sort(key=lambda x: (-x[0], x[1].capability_id))
        return [c for _, c in scored[:limit]]
