from __future__ import annotations
import json, re, hashlib
from pathlib import Path
from typing import Any, Dict, Iterable, List

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"


def norm(v: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (v or "").lower()).strip()


def fp(*parts: str) -> str:
    basis = "|".join(norm(p) for p in parts if p)
    return hashlib.sha256(basis.encode("utf-8")).hexdigest()


class DatabaseUniverse:
    def __init__(self) -> None:
        self.databases = json.loads((DATA / "database_universe_224.json").read_text(encoding="utf-8"))["items"]
        self.capabilities = json.loads((DATA / "universal_database_capabilities.json").read_text(encoding="utf-8"))["capabilities"]
        self._by_db = {norm(x["name"]): x for x in self.databases}
        self._cap_by_id = {x["id"]: x for x in self.capabilities}

    def database(self, name: str) -> Dict[str, Any] | None:
        n = norm(name)
        if n in self._by_db:
            return self._by_db[n]
        for key, item in self._by_db.items():
            if n and (n in key or key in n):
                return item
        return None

    def search_databases(self, query: str, limit: int = 20) -> List[Dict[str, Any]]:
        q = set(norm(query).split())
        scored=[]
        for item in self.databases:
            hay=set(norm(" ".join([item["name"], item["category"], item["distinctive_capability"]])).split())
            score=len(q & hay)
            if score:
                scored.append((score,item["name"],item))
        scored.sort(key=lambda x:(-x[0],x[1]))
        return [x[2] for x in scored[:limit]]

    def search_capabilities(self, text: str, limit: int = 30) -> List[Dict[str, Any]]:
        q=set(norm(text).split())
        scored=[]
        for item in self.capabilities:
            hay=set(norm(" ".join([item["name"], item["group"], *item.get("tags",[])])).split())
            score=len(q & hay)
            if score:
                scored.append((score,item["id"],item))
        scored.sort(key=lambda x:(-x[0],x[1]))
        return [x[2] for x in scored[:limit]]

    def summary(self) -> Dict[str, Any]:
        return {
            "database_entries": len(self.databases),
            "universal_capabilities": len(self.capabilities),
            "deduplication_model": "COMMON_CAPABILITY_ONCE_PLUS_DATABASE_OVERLAY",
        }

universe = DatabaseUniverse()
