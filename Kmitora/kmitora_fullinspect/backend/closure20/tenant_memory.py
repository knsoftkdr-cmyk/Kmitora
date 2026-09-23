from __future__ import annotations

import json
import sqlite3
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from uuid import uuid4

REPO_ROOT = Path(__file__).resolve().parents[2]
DB_PATH = REPO_ROOT / "backend" / "main_api" / "runtime_state" / "tenant_memory.sqlite3"
_LOCK = threading.RLock()


@dataclass(frozen=True)
class MemoryScope:
    tenant_id: str
    workspace_id: str
    project_id: str
    environment: str
    session_id: str

    def normalized(self) -> "MemoryScope":
        return MemoryScope(
            self.tenant_id.strip(), self.workspace_id.strip(), self.project_id.strip(),
            self.environment.strip().upper(), self.session_id.strip(),
        )

    def validate(self) -> None:
        s = self.normalized()
        if not all([s.tenant_id, s.workspace_id, s.project_id, s.environment, s.session_id]):
            raise ValueError("complete tenant/workspace/project/environment/session scope is required")
        if s.environment not in {"DEV", "QA", "UAT", "PROD"}:
            raise ValueError("invalid environment")


def _db() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        """CREATE TABLE IF NOT EXISTS memory (
          memory_id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          workspace_id TEXT NOT NULL,
          project_id TEXT NOT NULL,
          environment TEXT NOT NULL,
          session_id TEXT NOT NULL,
          memory_class TEXT NOT NULL,
          verified INTEGER NOT NULL,
          payload_json TEXT NOT NULL,
          provenance_json TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )"""
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_memory_scope ON memory(tenant_id,workspace_id,project_id,environment,session_id)")
    conn.commit()
    return conn


class TenantMemoryVault:
    def put(self, scope: MemoryScope, memory_class: str, payload: dict[str, Any], provenance: dict[str, Any], verified: bool) -> str:
        scope.validate(); s = scope.normalized()
        if memory_class in {"ENTERPRISE", "VERIFIED_PATTERN", "DOMAIN_KNOWLEDGE"} and not verified:
            raise PermissionError("unverified memory cannot be promoted to a reusable memory class")
        memory_id = f"MEM-{uuid4()}"
        with _LOCK, _db() as conn:
            conn.execute(
                "INSERT INTO memory VALUES(?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)",
                (memory_id, s.tenant_id, s.workspace_id, s.project_id, s.environment, s.session_id,
                 memory_class, 1 if verified else 0, json.dumps(payload), json.dumps(provenance)),
            )
            conn.commit()
        return memory_id

    def list(self, scope: MemoryScope, requested_scope: MemoryScope | None = None) -> list[dict[str, Any]]:
        scope.validate(); s = scope.normalized()
        if requested_scope is not None and requested_scope.normalized() != s:
            raise PermissionError("cross-scope memory access denied")
        with _LOCK, _db() as conn:
            rows = conn.execute(
                """SELECT memory_id,memory_class,verified,payload_json,provenance_json,created_at
                   FROM memory WHERE tenant_id=? AND workspace_id=? AND project_id=? AND environment=? AND session_id=?
                   ORDER BY created_at""",
                (s.tenant_id, s.workspace_id, s.project_id, s.environment, s.session_id),
            ).fetchall()
        return [{"memory_id": r[0], "memory_class": r[1], "verified": bool(r[2]), "payload": json.loads(r[3]), "provenance": json.loads(r[4]), "created_at": r[5]} for r in rows]
