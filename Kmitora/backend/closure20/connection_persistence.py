from __future__ import annotations

import base64
import ctypes
import ctypes.wintypes
import json
import os
import sqlite3
import threading
from pathlib import Path
from typing import Any, Callable

REPO_ROOT = Path(__file__).resolve().parents[2]
STATE_DIR = REPO_ROOT / "backend" / "main_api" / "runtime_state"
DB_PATH = STATE_DIR / "connection_registry.sqlite3"
_LOCK = threading.RLock()


class SecretProtectionError(RuntimeError):
    pass


class DATA_BLOB(ctypes.Structure):
    _fields_ = [("cbData", ctypes.wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_byte))]


def _blob(data: bytes) -> tuple[DATA_BLOB, Any]:
    buf = ctypes.create_string_buffer(data)
    return DATA_BLOB(len(data), ctypes.cast(buf, ctypes.POINTER(ctypes.c_byte))), buf


def _dpapi_protect(data: bytes) -> bytes:
    if os.name != "nt":
        raise SecretProtectionError("Windows DPAPI is required for persistent connection secrets")
    in_blob, in_buf = _blob(data)
    out_blob = DATA_BLOB()
    crypt32 = ctypes.windll.crypt32
    kernel32 = ctypes.windll.kernel32
    ok = crypt32.CryptProtectData(ctypes.byref(in_blob), "KMITORA DEV Connection", None, None, None, 0, ctypes.byref(out_blob))
    if not ok:
        raise SecretProtectionError("CryptProtectData failed")
    try:
        return ctypes.string_at(out_blob.pbData, out_blob.cbData)
    finally:
        kernel32.LocalFree(out_blob.pbData)
        del in_buf


def _dpapi_unprotect(data: bytes) -> bytes:
    if os.name != "nt":
        raise SecretProtectionError("Windows DPAPI is required for persistent connection secrets")
    in_blob, in_buf = _blob(data)
    out_blob = DATA_BLOB()
    crypt32 = ctypes.windll.crypt32
    kernel32 = ctypes.windll.kernel32
    ok = crypt32.CryptUnprotectData(ctypes.byref(in_blob), None, None, None, None, 0, ctypes.byref(out_blob))
    if not ok:
        raise SecretProtectionError("CryptUnprotectData failed")
    try:
        return ctypes.string_at(out_blob.pbData, out_blob.cbData)
    finally:
        kernel32.LocalFree(out_blob.pbData)
        del in_buf


_SENSITIVE_KEY_FRAGMENTS = (
    "password",
    "passwd",
    "secret",
    "token",
    "api_key",
    "apikey",
    "credential",
    "private_key",
)


def _contains_sensitive_value(payload: dict[str, Any]) -> bool:
    """Return True only when the connection payload actually carries a secret.

    File/folder connectors contain metadata (name/type/path) but no credential.
    Blocking those connectors on non-Windows hosts made the source API unusable
    even though there was nothing secret to encrypt.
    """
    for key, value in payload.items():
        normalized = str(key).strip().lower().replace("-", "_")
        if any(fragment in normalized for fragment in _SENSITIVE_KEY_FRAGMENTS):
            if value not in (None, "", [], {}):
                return True
    return False


def _protect_json(payload: dict[str, Any]) -> str:
    raw = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    if os.name == "nt":
        return "dpapi:" + base64.b64encode(_dpapi_protect(raw)).decode("ascii")
    # Non-secret DEV connector metadata may be persisted portably. Secret-bearing
    # payloads still fail closed unless the explicit test-only override is enabled.
    if not _contains_sensitive_value(payload):
        return "plain:" + base64.b64encode(raw).decode("ascii")
    if os.getenv("KMITORA_TEST_ALLOW_EPHEMERAL_SECRET") == "1":
        return "test:" + base64.b64encode(raw).decode("ascii")
    raise SecretProtectionError("Persistent credentials require Windows DPAPI")


def _unprotect_json(value: str) -> dict[str, Any]:
    scheme, _, encoded = value.partition(":")
    data = base64.b64decode(encoded.encode("ascii"))
    if scheme == "dpapi":
        raw = _dpapi_unprotect(data)
    elif scheme == "plain":
        raw = data
        candidate = dict(json.loads(raw.decode("utf-8")))
        if _contains_sensitive_value(candidate):
            raise SecretProtectionError("Plain connection payload unexpectedly contains a secret")
        return candidate
    elif scheme == "test" and os.getenv("KMITORA_TEST_ALLOW_EPHEMERAL_SECRET") == "1":
        raw = data
    else:
        raise SecretProtectionError("Unsupported or unsafe secret protection scheme")
    return dict(json.loads(raw.decode("utf-8")))


def _db() -> sqlite3.Connection:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS connections (
            kind TEXT NOT NULL,
            connection_id TEXT NOT NULL,
            environment TEXT NOT NULL,
            metadata_json TEXT NOT NULL,
            secret_blob TEXT NOT NULL,
            enabled INTEGER NOT NULL DEFAULT 1,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY(kind, connection_id)
        )
        """
    )
    conn.commit()
    return conn


def persist_connection(kind: str, record: dict[str, Any], secret_payload: dict[str, Any]) -> None:
    env = str(record.get("environment") or secret_payload.get("environment") or "DEV").upper()
    # Closure-20 persistence is intentionally DEV-only.
    if env != "DEV":
        return
    connection_id = str(record.get("id") or "").strip()
    if not connection_id:
        raise ValueError("connection id is required")
    metadata = dict(record)
    metadata.pop("password", None)
    metadata.pop("secret", None)
    protected = _protect_json(dict(secret_payload))
    with _LOCK, _db() as conn:
        conn.execute(
            """INSERT INTO connections(kind, connection_id, environment, metadata_json, secret_blob, enabled, updated_at)
               VALUES(?,?,?,?,?,1,CURRENT_TIMESTAMP)
               ON CONFLICT(kind, connection_id) DO UPDATE SET
                 environment=excluded.environment,
                 metadata_json=excluded.metadata_json,
                 secret_blob=excluded.secret_blob,
                 enabled=1,
                 updated_at=CURRENT_TIMESTAMP""",
            (kind, connection_id, env, json.dumps(metadata, ensure_ascii=False), protected),
        )
        conn.commit()


def delete_connection(kind: str, connection_id: str) -> None:
    with _LOCK, _db() as conn:
        conn.execute("DELETE FROM connections WHERE kind=? AND connection_id=?", (kind, connection_id))
        conn.commit()


def restore_registry(
    kind: str,
    record_factory: Callable[..., Any],
    records: dict[str, Any],
    secrets: dict[str, dict[str, Any]],
    connection_test: Callable[[dict[str, Any]], Any] | None = None,
) -> dict[str, Any]:
    restored = 0
    unhealthy = 0
    errors: list[str] = []
    with _LOCK, _db() as conn:
        rows = list(conn.execute(
            "SELECT connection_id, environment, metadata_json, secret_blob FROM connections WHERE kind=? AND enabled=1 AND environment='DEV'",
            (kind,),
        ))
    for connection_id, environment, metadata_json, secret_blob in rows:
        try:
            metadata = dict(json.loads(metadata_json))
            cfg = _unprotect_json(secret_blob)
            if str(environment).upper() != "DEV":
                continue
            healthy = True
            if connection_test is not None:
                try:
                    connection_test(cfg)
                except Exception:
                    healthy = False
            metadata["status"] = "connected" if healthy else "error"
            # Filter metadata to fields accepted by the dataclass constructor.
            accepted = getattr(record_factory, "__dataclass_fields__", {})
            kwargs = {k: v for k, v in metadata.items() if not accepted or k in accepted}
            rec = record_factory(**kwargs)
            records[connection_id] = rec
            secrets[connection_id] = cfg
            restored += 1
            if not healthy:
                unhealthy += 1
        except Exception as exc:
            errors.append(f"{connection_id}: {exc}")
    return {"kind": kind, "restored": restored, "unhealthy": unhealthy, "errors": errors}


def registry_status() -> dict[str, Any]:
    with _LOCK, _db() as conn:
        rows = list(conn.execute(
            "SELECT kind, environment, COUNT(*) FROM connections WHERE enabled=1 GROUP BY kind, environment ORDER BY kind, environment"
        ))
    return {
        "database": str(DB_PATH),
        "persistent": True,
        "secret_protection": "WINDOWS_DPAPI" if os.name == "nt" else "TEST_ONLY_OR_DISABLED",
        "counts": [{"kind": k, "environment": e, "count": int(c)} for k, e, c in rows],
        "production_persistence_enabled": False,
    }
