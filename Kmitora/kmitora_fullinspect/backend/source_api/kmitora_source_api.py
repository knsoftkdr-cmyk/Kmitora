from __future__ import annotations

import csv
import json
import os
import re
import secrets
import threading
import xml.etree.ElementTree as ET
from dataclasses import dataclass, asdict
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import sys
from pathlib import Path
from typing import Any

from openpyxl import load_workbook
from urllib.parse import urlparse, parse_qs


_REPO_ROOT = str(Path(__file__).resolve().parents[2])
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)
from backend.closure20.connection_persistence import persist_connection, delete_connection, restore_registry

HOST = "127.0.0.1"
PORT = int(os.getenv("KMITORA_SOURCE_API_PORT", "8081"))
MAX_PREVIEW = 500
DEFAULT_PREVIEW = 100

@dataclass
class SourceRecord:
    id: str
    name: str
    type: str
    status: str
    host: str | None = None
    port: int | None = None
    database: str | None = None
    schema: str | None = None
    username: str | None = None
    filePath: str | None = None

# DEV-only process-memory registry.
# Passwords are NOT returned by APIs and are NOT persisted to disk.
_SOURCES: dict[str, SourceRecord] = {}
_SECRETS: dict[str, dict[str, Any]] = {}
_LOCK = threading.RLock()

SAFE_NAME = re.compile(r"^[A-Za-z_][A-Za-z0-9_$#@.\- ]*$")

def json_response(handler: BaseHTTPRequestHandler, status: int, payload: Any) -> None:
    body = json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)

def read_json(handler: BaseHTTPRequestHandler) -> dict[str, Any]:
    length = int(handler.headers.get("Content-Length", "0"))
    if length <= 0:
        return {}
    raw = handler.rfile.read(length)
    return json.loads(raw.decode("utf-8"))

def public_source(record: SourceRecord) -> dict[str, Any]:
    data = asdict(record)
    data.pop("username", None)
    return data

def require_fields(payload: dict[str, Any], fields: list[str]) -> None:
    missing = [f for f in fields if payload.get(f) in (None, "")]
    if missing:
        raise ValueError("Missing required field(s): " + ", ".join(missing))

def connect_db(source_type: str, cfg: dict[str, Any]):
    t = source_type.lower()

    if t == "postgresql":
        try:
            import psycopg
        except ImportError as exc:
            raise RuntimeError("PostgreSQL driver missing. Install: pip install psycopg[binary]") from exc
        return psycopg.connect(
            host=cfg["host"], port=int(cfg.get("port") or 5432),
            dbname=cfg["database"], user=cfg["username"], password=cfg.get("password") or "",
            connect_timeout=8,
        )

    if t == "mysql":
        try:
            import pymysql
        except ImportError as exc:
            raise RuntimeError("MySQL driver missing. Install: pip install pymysql") from exc
        return pymysql.connect(
            host=cfg["host"], port=int(cfg.get("port") or 3306),
            database=cfg["database"], user=cfg["username"], password=cfg.get("password") or "",
            connect_timeout=8, read_timeout=8, write_timeout=8,
            cursorclass=pymysql.cursors.DictCursor,
        )

    if t == "oracle":
        try:
            import oracledb
        except ImportError as exc:
            raise RuntimeError("Oracle driver missing. Install: pip install oracledb") from exc
        dsn = oracledb.makedsn(cfg["host"], int(cfg.get("port") or 1521), service_name=cfg["database"])
        return oracledb.connect(user=cfg["username"], password=cfg.get("password") or "", dsn=dsn)

    if t == "sqlserver":
        try:
            import pyodbc
        except ImportError as exc:
            raise RuntimeError("SQL Server driver missing. Install pyodbc and Microsoft ODBC Driver 18.") from exc
        conn_str = (
            "DRIVER={ODBC Driver 18 for SQL Server};"
            f"SERVER={cfg['host']},{int(cfg.get('port') or 1433)};"
            f"DATABASE={cfg['database']};UID={cfg['username']};PWD={cfg.get('password') or ''};"
            "Encrypt=yes;TrustServerCertificate=yes;Connection Timeout=8;"
        )
        return pyodbc.connect(conn_str)

    if t == "snowflake":
        try:
            import snowflake.connector
        except ImportError as exc:
            raise RuntimeError("Snowflake driver missing. Install: pip install snowflake-connector-python") from exc
        return snowflake.connector.connect(
            account=cfg["host"], user=cfg["username"], password=cfg.get("password") or "",
            database=cfg["database"], schema=cfg.get("schema") or None,
            login_timeout=8, network_timeout=8,
        )

    raise ValueError(f"Unsupported database source type: {source_type}")

def test_connection(payload: dict[str, Any]) -> dict[str, Any]:
    t = str(payload.get("type") or "").lower()
    if t == "file":
        require_fields(payload, ["filePath"])
        p = Path(str(payload["filePath"])).expanduser()
        if not p.exists():
            raise ValueError(f"Path not found: {p}")
        return {"ok": True, "message": "File source path is accessible."}

    require_fields(payload, ["host", "database", "username"])
    conn = connect_db(t, payload)
    try:
        cur = conn.cursor()
        cur.execute("SELECT 1")
        cur.fetchone()
        cur.close()
        return {"ok": True, "message": "Database connection successful."}
    finally:
        conn.close()

def list_db_objects(record: SourceRecord, cfg: dict[str, Any]) -> list[dict[str, Any]]:
    conn = connect_db(record.type, cfg)
    try:
        cur = conn.cursor()
        t = record.type.lower()
        schema = record.schema or ""

        if t == "postgresql":
            cur.execute("""
                SELECT table_schema, table_name, table_type
                FROM information_schema.tables
                WHERE table_schema NOT IN ('pg_catalog','information_schema')
                  AND (%s = '' OR table_schema = %s)
                ORDER BY table_schema, table_name
            """, (schema, schema))
        elif t == "mysql":
            cur.execute("""
                SELECT table_schema, table_name, table_type
                FROM information_schema.tables
                WHERE table_schema = %s
                ORDER BY table_name
            """, (record.database,))
        elif t == "oracle":
            owner = (schema or cfg.get("username") or "").upper()
            cur.execute("""
                SELECT owner, object_name, object_type
                FROM all_objects
                WHERE owner = :owner AND object_type IN ('TABLE','VIEW')
                ORDER BY object_type, object_name
            """, owner=owner)
        elif t == "sqlserver":
            cur.execute("""
                SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE
                FROM INFORMATION_SCHEMA.TABLES
                WHERE (? = '' OR TABLE_SCHEMA = ?)
                ORDER BY TABLE_SCHEMA, TABLE_NAME
            """, schema, schema)
        elif t == "snowflake":
            cur.execute("""
                SELECT table_schema, table_name, table_type
                FROM information_schema.tables
                WHERE (%s = '' OR table_schema = %s)
                ORDER BY table_schema, table_name
            """, (schema, schema))
        else:
            return []

        rows = cur.fetchall()
        out = []

        def _ci(row: dict[str, Any], key: str) -> Any:
            # MySQL returns information_schema columns upper-cased, so a
            # case-sensitive lookup silently yields None and the object
            # name becomes the string "None".
            if key in row:
                return row[key]
            lowered = {str(k).lower(): v for k, v in row.items()}
            return lowered.get(key.lower())

        for row in rows:
            vals = list(row) if not isinstance(row, dict) else [
                _ci(row, "table_schema"),
                _ci(row, "table_name"),
                _ci(row, "table_type"),
            ]
            out.append({
                "schema": str(vals[0]),
                "name": str(vals[1]),
                "type": "view" if "VIEW" in str(vals[2]).upper() else "table",
            })
        cur.close()
        return out
    finally:
        conn.close()

def list_file_objects(record: SourceRecord) -> list[dict[str, Any]]:
    base = Path(record.filePath or "")
    files = [base] if base.is_file() else list(base.rglob("*"))
    root = base if base.is_dir() else base.parent
    out: list[dict[str, Any]] = []
    for f in files:
        if not f.is_file():
            continue
        ext = f.suffix.lower()
        if ext not in {".csv", ".tsv", ".json", ".jsonl", ".txt", ".xml", ".xlsx", ".xlsm"}:
            continue
        relative_name = str(f.relative_to(root))
        if ext in {".xlsx", ".xlsm"}:
            workbook = load_workbook(f, read_only=True, data_only=True)
            try:
                for sheet_name in workbook.sheetnames:
                    out.append({
                        "schema": "files",
                        "name": f"{relative_name}::{sheet_name}",
                        "type": "table",
                        "format": "excel",
                        "file": relative_name,
                        "sheet": sheet_name,
                    })
            finally:
                workbook.close()
            continue
        out.append({
            "schema": "files",
            "name": relative_name,
            "type": "table",
            "format": ext.lstrip("."),
        })
    return out

def quote_ident(name: str, source_type: str) -> str:
    if not SAFE_NAME.match(name):
        raise ValueError(f"Unsafe identifier: {name}")
    t = source_type.lower()
    if t == "sqlserver":
        return "[" + name.replace("]", "]]") + "]"
    if t == "mysql":
        return "`" + name.replace("`", "``") + "`"
    return '"' + name.replace('"', '""') + '"'

def preview_db(record: SourceRecord, cfg: dict[str, Any], schema: str, obj: str, limit: int) -> dict[str, Any]:
    # Object must be present in discovered catalog before preview.
    catalog = {(o["schema"], o["name"]) for o in list_db_objects(record, cfg)}
    if (schema, obj) not in catalog:
        raise ValueError("Requested object is not in the discovered source catalog.")

    conn = connect_db(record.type, cfg)
    try:
        cur = conn.cursor()
        qschema = quote_ident(schema, record.type)
        qobj = quote_ident(obj, record.type)
        t = record.type.lower()

        if t == "oracle":
            sql = f"SELECT * FROM {qschema}.{qobj} FETCH FIRST {int(limit)} ROWS ONLY"
        elif t == "sqlserver":
            sql = f"SELECT TOP {int(limit)} * FROM {qschema}.{qobj}"
        else:
            sql = f"SELECT * FROM {qschema}.{qobj} LIMIT {int(limit)}"

        cur.execute(sql)
        raw = cur.fetchall()
        columns = [d[0] for d in cur.description] if cur.description else []
        rows = []
        for r in raw:
            if isinstance(r, dict):
                rows.append({c: r.get(c) for c in columns})
            else:
                rows.append({c: v for c, v in zip(columns, list(r))})
        cur.close()
        return {"columns": columns, "rows": rows, "totalRows": None}
    finally:
        conn.close()

def _flatten_xml(element: ET.Element, prefix: str = "") -> dict[str, Any]:
    row: dict[str, Any] = {}
    key_prefix = f"{prefix}." if prefix else ""
    for attr, value in element.attrib.items():
        row[f"{key_prefix}@{attr}"] = value
    children = list(element)
    if not children:
        row[prefix or element.tag] = (element.text or "").strip()
        return row
    counts: dict[str, int] = {}
    for child in children:
        counts[child.tag] = counts.get(child.tag, 0) + 1
    for child in children:
        child_prefix = f"{key_prefix}{child.tag}"
        if counts[child.tag] > 1:
            # Repeated nested values remain deterministic and lossless for preview.
            existing = row.get(child_prefix)
            value = (child.text or "").strip() if not list(child) else _flatten_xml(child, child_prefix)
            if existing is None:
                row[child_prefix] = [value]
            elif isinstance(existing, list):
                existing.append(value)
        else:
            row.update(_flatten_xml(child, child_prefix))
    return row


def _preview_excel(path: Path, sheet_name: str | None, limit: int) -> dict[str, Any]:
    workbook = load_workbook(path, read_only=True, data_only=True)
    try:
        if sheet_name:
            if sheet_name not in workbook.sheetnames:
                raise ValueError(f"Excel sheet not found: {sheet_name}")
            sheet = workbook[sheet_name]
        else:
            sheet = workbook[workbook.sheetnames[0]]
        iterator = sheet.iter_rows(values_only=True)
        try:
            header_values = next(iterator)
        except StopIteration:
            return {"columns": [], "rows": [], "totalRows": 0, "sheet": sheet.title}
        columns = [
            str(value).strip() if value not in (None, "") else f"column_{index + 1}"
            for index, value in enumerate(header_values)
        ]
        # Make duplicate headings deterministic.
        seen: dict[str, int] = {}
        normalized: list[str] = []
        for column in columns:
            seen[column] = seen.get(column, 0) + 1
            normalized.append(column if seen[column] == 1 else f"{column}_{seen[column]}")
        rows: list[dict[str, Any]] = []
        for values in iterator:
            if len(rows) >= limit:
                break
            if not any(value is not None for value in values):
                continue
            padded = list(values) + [None] * max(0, len(normalized) - len(values))
            rows.append({column: padded[index] if index < len(padded) else None for index, column in enumerate(normalized)})
        return {"columns": normalized, "rows": rows, "totalRows": None, "sheet": sheet.title}
    finally:
        workbook.close()


def _preview_text(path: Path, limit: int) -> dict[str, Any]:
    sample = path.read_text(encoding="utf-8-sig", errors="replace")
    lines = sample.splitlines()
    nonempty = [line for line in lines if line.strip()]
    if not nonempty:
        return {"columns": ["line_number", "value"], "rows": [], "totalRows": 0}
    probe = "\n".join(nonempty[:20])
    try:
        dialect = csv.Sniffer().sniff(probe, delimiters=",\t|;")
        reader = csv.DictReader(nonempty, dialect=dialect)
        if reader.fieldnames and len(reader.fieldnames) > 1:
            rows = []
            for index, row in enumerate(reader):
                if index >= limit:
                    break
                rows.append(dict(row))
            return {"columns": list(reader.fieldnames), "rows": rows, "totalRows": max(0, len(nonempty) - 1)}
    except csv.Error:
        pass
    rows = [
        {"line_number": index + 1, "value": line}
        for index, line in enumerate(lines[:limit])
    ]
    return {"columns": ["line_number", "value"], "rows": rows, "totalRows": len(lines)}


def _preview_xml(path: Path, limit: int) -> dict[str, Any]:
    root = ET.parse(path).getroot()
    children = list(root)
    candidates = children if children else [root]
    rows = [_flatten_xml(element) for element in candidates[:limit]]
    columns = sorted({key for row in rows for key in row.keys()})
    return {"columns": columns, "rows": rows, "totalRows": len(candidates), "root": root.tag}


def _scope_matches(row: dict[str, Any], field: str | None, operator: str, value: str | None) -> bool:
    if not field:
        return True
    actual_key = next((key for key in row if str(key).lower() == field.lower()), None)
    if actual_key is None:
        return False
    actual = str(row.get(actual_key, "") or "").strip().lower()
    expected = str(value or "").strip().lower()
    return actual != expected if operator.upper() == "NEQ" else actual == expected


def preview_file(
    record: SourceRecord,
    object_name: str,
    limit: int,
    scope_field: str | None = None,
    scope_operator: str = "EQ",
    scope_value: str | None = None,
) -> dict[str, Any]:
    base = Path(record.filePath or "")
    root = base if base.is_dir() else base.parent
    file_name, separator, sheet_name = object_name.partition("::")
    p = (root / file_name).resolve()
    if root.resolve() not in p.parents and p != root.resolve():
        raise ValueError("Object path escapes configured source root.")
    if not p.exists() or not p.is_file():
        raise ValueError("File object not found.")

    ext = p.suffix.lower()
    rows: list[dict[str, Any]] = []

    if ext in {".csv", ".tsv"}:
        delimiter = "\t" if ext == ".tsv" else ","
        scanned = 0
        matched = 0
        with p.open("r", encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f, delimiter=delimiter)
            columns = reader.fieldnames or []
            for row in reader:
                scanned += 1
                item = dict(row)
                if not _scope_matches(item, scope_field, scope_operator, scope_value):
                    continue
                matched += 1
                if len(rows) < limit:
                    rows.append(item)
        return {
            "columns": columns,
            "rows": rows,
            "totalRows": matched if scope_field else scanned,
            "scannedRows": scanned,
            "scopeApplied": bool(scope_field),
        }

    if ext == ".jsonl":
        with p.open("r", encoding="utf-8-sig") as f:
            for line in f:
                if len(rows) >= limit:
                    break
                line = line.strip()
                if not line:
                    continue
                item = json.loads(line)
                rows.append(item if isinstance(item, dict) else {"value": item})
        columns = sorted({k for row in rows for k in row.keys()})
        return {"columns": columns, "rows": rows, "totalRows": None}

    if ext == ".json":
        data = json.loads(p.read_text(encoding="utf-8-sig"))
        seq = data if isinstance(data, list) else [data]
        for item in seq[:limit]:
            rows.append(item if isinstance(item, dict) else {"value": item})
        columns = sorted({k for row in rows for k in row.keys()})
        return {"columns": columns, "rows": rows, "totalRows": len(seq)}

    if ext in {".xlsx", ".xlsm"}:
        return _preview_excel(p, sheet_name if separator else None, limit)

    if ext == ".xml":
        return _preview_xml(p, limit)

    if ext == ".txt":
        return _preview_text(p, limit)

    raise ValueError("Unsupported file type.")

class Handler(BaseHTTPRequestHandler):
    server_version = "KMITORASourceAPI/1.0"

    def log_message(self, fmt: str, *args: Any) -> None:
        print("[KMITORA SOURCE API]", fmt % args)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "http://localhost:5173")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        try:
            parsed = urlparse(self.path)
            path = parsed.path
            qs = parse_qs(parsed.query)

            if path == "/v1/capabilities":
                return json_response(self, 200, {
                    "service": "KMITORA Source API",
                    "mode": "READ_ONLY",
                    "database_sources": ["postgresql", "mysql", "oracle", "sqlserver", "snowflake"],
                    "file_sources": ["csv", "tsv", "json", "jsonl", "txt", "xml", "xlsx", "xlsm"],
                    "understanding": ["catalog", "schema", "columns", "preview", "field profiling", "scenario/tenant scope", "relationship inference"],
                    "source_writes": False,
                    "production_actions": False,
                })

            if path == "/health":
                return json_response(self, 200, {
                    "service": "KMITORA Source API",
                    "status": "HEALTHY",
                    "production_writes": 0,
                    "source_preview_mode": "READ_ONLY",
                })

            if path == "/v1/sources":
                with _LOCK:
                    return json_response(self, 200, [public_source(r) for r in _SOURCES.values()])

            m = re.fullmatch(r"/v1/sources/([^/]+)/objects", path)
            if m:
                sid = m.group(1)
                with _LOCK:
                    record = _SOURCES.get(sid)
                    cfg = _SECRETS.get(sid)
                if not record or not cfg:
                    return json_response(self, 404, {"error": "Source not found."})
                objects = list_file_objects(record) if record.type == "file" else list_db_objects(record, cfg)
                return json_response(self, 200, objects)

            m = re.fullmatch(r"/v1/sources/([^/]+)/preview", path)
            if m:
                sid = m.group(1)
                schema = (qs.get("schema") or [""])[0]
                obj = (qs.get("object") or [""])[0]
                limit = min(MAX_PREVIEW, max(1, int((qs.get("limit") or [DEFAULT_PREVIEW])[0])))
                with _LOCK:
                    record = _SOURCES.get(sid)
                    cfg = _SECRETS.get(sid)
                if not record or not cfg:
                    return json_response(self, 404, {"error": "Source not found."})
                scope_field = (qs.get("scope_field") or [""])[0].strip() or None
                scope_operator = (qs.get("scope_operator") or ["EQ"])[0].strip().upper()
                scope_value = (qs.get("scope_value") or [""])[0]
                if scope_operator not in {"EQ", "NEQ"}:
                    raise ValueError("Unsupported scope operator.")
                result = (
                    preview_file(
                        record, obj, limit,
                        scope_field=scope_field,
                        scope_operator=scope_operator,
                        scope_value=scope_value,
                    )
                    if record.type == "file"
                    else preview_db(record, cfg, schema, obj, limit)
                )
                return json_response(self, 200, result)

            return json_response(self, 404, {"error": "Route not found."})
        except Exception as exc:
            return json_response(self, 400, {"error": str(exc)})

    def do_DELETE(self):
        try:
            parsed = urlparse(self.path)
            path = parsed.path

            m = re.fullmatch(r"/v1/sources/([^/]+)", path)

            if not m:
                return json_response(
                    self,
                    404,
                    {"error": "Route not found."}
                )

            sid = m.group(1)

            with _LOCK:
                record = _SOURCES.get(sid)

                if not record:
                    return json_response(
                        self,
                        404,
                        {
                            "error": "Source not found.",
                            "source_id": sid,
                        }
                    )

                deleted = public_source(record)

                _SOURCES.pop(sid, None)
                _SECRETS.pop(sid, None)
                delete_connection("source", sid)

            return json_response(
                self,
                200,
                {
                    "ok": True,
                    "deleted": True,
                    "source_id": sid,
                    "source": deleted,
                    "physical_source_deleted": False,
                    "message": "Source connection deleted. Physical source data was not modified.",
                }
            )

        except Exception as exc:
            return json_response(
                self,
                400,
                {"error": str(exc)}
            )
    def do_POST(self):
        try:
            parsed = urlparse(self.path)
            payload = read_json(self)

            if parsed.path == "/v1/sources/recover":
                return json_response(self, 200, {"ok": True, "recovery": _closure20_restore_sources(), "registry": registry_status(), "production_authorized": False, "cutover_authorized": False})

            if parsed.path == "/v1/sources/test":
                return json_response(self, 200, test_connection(payload))

            if parsed.path == "/v1/sources":
                require_fields(payload, ["name", "type"])
                # Validate before registering.
                test_connection(payload)
                sid = "SRC-" + secrets.token_hex(6).upper()
                rec = SourceRecord(
                    id=sid,
                    name=str(payload["name"]),
                    type=str(payload["type"]).lower(),
                    status="connected",
                    host=payload.get("host"),
                    port=int(payload["port"]) if payload.get("port") not in (None, "") else None,
                    database=payload.get("database"),
                    schema=payload.get("schema"),
                    username=payload.get("username"),
                    filePath=payload.get("filePath"),
                )
                with _LOCK:
                    _SOURCES[sid] = rec
                    _SECRETS[sid] = dict(payload)
                    persist_connection("source", dict(vars(rec)), dict(payload))
                return json_response(self, 201, public_source(rec))

            return json_response(self, 404, {"error": "Route not found."})
        except Exception as exc:
            return json_response(self, 400, {"error": str(exc)})

def _closure20_restore_sources():
    return restore_registry("source", SourceRecord, _SOURCES, _SECRETS, test_connection)

def main():
    _closure20_restore_sources()
    print(f"KMITORA Source API starting on http://{HOST}:{PORT}")
    print("Mode: DEV READ-ONLY SOURCE CONNECTION / PREVIEW")
    print("Credentials: PROCESS MEMORY ONLY")
    print("Production migration: DISABLED")
    print("Cutover: DISABLED")
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

if __name__ == "__main__":
    main()

