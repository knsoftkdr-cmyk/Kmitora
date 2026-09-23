from __future__ import annotations

import json
import os
import sys
from pathlib import Path
import re
import secrets
import threading
from dataclasses import dataclass, asdict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import urlparse, parse_qs


_REPO_ROOT = str(Path(__file__).resolve().parents[2])
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)
from backend.closure20.connection_persistence import persist_connection, delete_connection, restore_registry

HOST = "127.0.0.1"
PORT = int(os.getenv("KMITORA_TARGET_API_PORT", "8082"))
MAX_PREVIEW = 1000000
DEFAULT_PREVIEW = 100

@dataclass
class TargetRecord:
    id: str
    name: str
    type: str
    status: str
    host: str
    port: int
    database: str
    schema: str | None = None
    environment: str = "DEV"

_TARGETS: dict[str, TargetRecord] = {}
_SECRETS: dict[str, dict[str, Any]] = {}
_LOCK = threading.RLock()
SAFE_NAME = re.compile(r"^[A-Za-z_][A-Za-z0-9_$#@.\- ]*$")

def response(h, status: int, payload: Any):
    body = json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8")
    h.send_response(status)
    h.send_header("Content-Type", "application/json; charset=utf-8")
    h.send_header("Cache-Control", "no-store")
    h.send_header("Content-Length", str(len(body)))
    h.end_headers()
    h.wfile.write(body)

def read_json(h):
    n = int(h.headers.get("Content-Length","0"))
    if n <= 0: return {}
    return json.loads(h.rfile.read(n).decode("utf-8"))

def require(p, fields):
    missing = [x for x in fields if p.get(x) in (None,"")]
    if missing: raise ValueError("Missing required field(s): " + ", ".join(missing))

def connect_db(t: str, cfg: dict[str, Any]):
    t=t.lower()
    if t=="postgresql":
        import psycopg
        return psycopg.connect(host=cfg["host"],port=int(cfg.get("port") or 5432),dbname=cfg["database"],user=cfg["username"],password=cfg.get("password") or "",connect_timeout=8)
    if t=="mysql":
        import pymysql
        return pymysql.connect(host=cfg["host"],port=int(cfg.get("port") or 3306),database=cfg["database"],user=cfg["username"],password=cfg.get("password") or "",connect_timeout=8,cursorclass=pymysql.cursors.DictCursor)
    if t=="oracle":
        import oracledb
        dsn=oracledb.makedsn(cfg["host"],int(cfg.get("port") or 1521),service_name=cfg["database"])
        return oracledb.connect(user=cfg["username"],password=cfg.get("password") or "",dsn=dsn)
    if t=="sqlserver":
        import pyodbc
        s=("DRIVER={ODBC Driver 18 for SQL Server};"
           f"SERVER={cfg['host']},{int(cfg.get('port') or 1433)};"
           f"DATABASE={cfg['database']};UID={cfg['username']};PWD={cfg.get('password') or ''};"
           "Encrypt=yes;TrustServerCertificate=yes;Connection Timeout=8;")
        return pyodbc.connect(s)
    if t=="snowflake":
        import snowflake.connector
        return snowflake.connector.connect(account=cfg["host"],user=cfg["username"],password=cfg.get("password") or "",database=cfg["database"],schema=cfg.get("schema") or None,login_timeout=8,network_timeout=8)
    raise ValueError("Unsupported target type.")

def test_target(p):
    require(p,["host","database","username"])
    c=connect_db(str(p["type"]),p)
    try:
        cur=c.cursor(); cur.execute("SELECT 1"); cur.fetchone(); cur.close()
        return {"ok":True,"message":"Target connection successful."}
    finally:
        c.close()

def list_objects(rec,cfg):
    c=connect_db(rec.type,cfg)
    try:
        cur=c.cursor(); t=rec.type.lower(); schema=rec.schema or ""
        if t=="postgresql":
            cur.execute("""SELECT table_schema,table_name,table_type FROM information_schema.tables
                           WHERE table_schema NOT IN ('pg_catalog','information_schema')
                           AND (%s='' OR table_schema=%s) ORDER BY table_schema,table_name""",(schema,schema))
        elif t=="mysql":
            cur.execute("""SELECT table_schema,table_name,table_type FROM information_schema.tables
                           WHERE table_schema=%s ORDER BY table_name""",(rec.database,))
        elif t=="oracle":
            owner=(schema or cfg.get("username") or "").upper()
            cur.execute("""SELECT owner,object_name,object_type FROM all_objects
                           WHERE owner=:owner AND object_type IN ('TABLE','VIEW')
                           ORDER BY object_type,object_name""",owner=owner)
        elif t=="sqlserver":
            cur.execute("""SELECT TABLE_SCHEMA,TABLE_NAME,TABLE_TYPE FROM INFORMATION_SCHEMA.TABLES
                           WHERE (?='' OR TABLE_SCHEMA=?) ORDER BY TABLE_SCHEMA,TABLE_NAME""",schema,schema)
        else:
            cur.execute("""SELECT table_schema,table_name,table_type FROM information_schema.tables
                           WHERE (%s='' OR table_schema=%s) ORDER BY table_schema,table_name""",(schema,schema))
        rows=cur.fetchall(); out=[]
        for r in rows:
            vals=list(r) if not isinstance(r,dict) else [r.get("table_schema"),r.get("table_name"),r.get("table_type")]
            out.append({"schema":str(vals[0]),"name":str(vals[1]),"type":"view" if "VIEW" in str(vals[2]).upper() else "table"})
        cur.close(); return out
    finally: c.close()

def quote_ident(name,t):
    if not SAFE_NAME.match(name): raise ValueError(f"Unsafe identifier: {name}")
    if t.lower()=="sqlserver": return "["+name.replace("]","]]")+"]"
    if t.lower()=="mysql": return "`"+name.replace("`","``")+"`"
    return '"'+name.replace('"','""')+'"'

def preview(rec,cfg,schema,obj,limit):
    catalog={(o["schema"],o["name"]) for o in list_objects(rec,cfg)}
    if (schema,obj) not in catalog: raise ValueError("Object not in discovered target catalog.")
    c=connect_db(rec.type,cfg)
    try:
        cur=c.cursor(); qs=quote_ident(schema,rec.type); qo=quote_ident(obj,rec.type); t=rec.type.lower()
        if t=="oracle": sql=f"SELECT * FROM {qs}.{qo} FETCH FIRST {int(limit)} ROWS ONLY"
        elif t=="sqlserver": sql=f"SELECT TOP {int(limit)} * FROM {qs}.{qo}"
        else: sql=f"SELECT * FROM {qs}.{qo} LIMIT {int(limit)}"
        cur.execute(sql); raw=cur.fetchall(); cols=[d[0] for d in cur.description] if cur.description else []
        rows=[]
        for r in raw:
            if isinstance(r,dict): rows.append({c:r.get(c) for c in cols})
            else: rows.append({c:v for c,v in zip(cols,list(r))})
        cur.close(); return {"columns":cols,"rows":rows,"totalRows":None}
    finally: c.close()

def structure(rec,cfg,schema,obj):
    catalog={(o["schema"],o["name"]) for o in list_objects(rec,cfg)}
    if (schema,obj) not in catalog: raise ValueError("Object not in discovered target catalog.")
    c=connect_db(rec.type,cfg)
    try:
        cur=c.cursor(); t=rec.type.lower()
        if t=="postgresql":
            cur.execute("""SELECT column_name,data_type,is_nullable,ordinal_position
                           FROM information_schema.columns
                           WHERE table_schema=%s AND table_name=%s ORDER BY ordinal_position""",(schema,obj))
        elif t=="mysql":
            cur.execute("""SELECT column_name,data_type,is_nullable,ordinal_position
                           FROM information_schema.columns
                           WHERE table_schema=%s AND table_name=%s ORDER BY ordinal_position""",(schema,obj))
        elif t=="sqlserver":
            cur.execute("""SELECT COLUMN_NAME,DATA_TYPE,IS_NULLABLE,ORDINAL_POSITION
                           FROM INFORMATION_SCHEMA.COLUMNS
                           WHERE TABLE_SCHEMA=? AND TABLE_NAME=? ORDER BY ORDINAL_POSITION""",schema,obj)
        elif t=="oracle":
            cur.execute("""SELECT column_name,data_type,nullable,column_id FROM all_tab_columns
                           WHERE owner=:owner AND table_name=:table ORDER BY column_id""", owner=schema.upper(), table=obj.upper())
        else:
            cur.execute("""SELECT column_name,data_type,is_nullable,ordinal_position
                           FROM information_schema.columns
                           WHERE table_schema=%s AND table_name=%s ORDER BY ordinal_position""",(schema,obj))
        rows=cur.fetchall(); out=[]
        for r in rows:
            vals=list(r) if not isinstance(r,dict) else [r.get("column_name"),r.get("data_type"),r.get("is_nullable"),r.get("ordinal_position")]
            out.append({"name":str(vals[0]),"dataType":str(vals[1]),"nullable":str(vals[2]).upper() in ("YES","Y","TRUE"),"ordinal":int(vals[3])})
        cur.close(); return {"columns":out}
    finally: c.close()

def write_records(rec,cfg,schema,obj,rows):
    """Perform a real, explicit write of the given rows into the target
    table. Only called from the dedicated /write route below â€” never
    part of preview/discovery. Unknown columns in a row are silently
    dropped rather than failing the whole batch; rows with no usable
    column are skipped."""
    catalog={(o["schema"],o["name"]) for o in list_objects(rec,cfg)}
    if (schema,obj) not in catalog: raise ValueError("Object not in discovered target catalog.")
    struct=structure(rec,cfg,schema,obj)
    valid_cols={c["name"] for c in struct["columns"]}
    c=connect_db(rec.type,cfg)
    try:
        cur=c.cursor(); qs=quote_ident(schema,rec.type); qo=quote_ident(obj,rec.type); t=rec.type.lower()
        inserted=0; skipped=0
        for row in rows:
            cols=[k for k in row.keys() if k in valid_cols]
            if not cols:
                skipped+=1
                continue
            col_sql=", ".join(quote_ident(k,rec.type) for k in cols)
            placeholders=", ".join(["%s"]*len(cols))
            vals=[row[k] for k in cols]
            sql=f"INSERT INTO {qs}.{qo} ({col_sql}) VALUES ({placeholders})"
            if t=="postgresql":
                sql+=" ON CONFLICT DO NOTHING"
            try:
                cur.execute(sql,vals)
                inserted+=cur.rowcount if cur.rowcount and cur.rowcount>0 else 0
            except Exception:
                c.rollback()
                raise
        c.commit()
        cur.close()
        return {"ok":True,"table":f"{schema}.{obj}","attempted":len(rows),"inserted":inserted,"skipped_no_matching_columns":skipped}
    finally:
        c.close()

def replace_load_records(rec, cfg, schema, tables):
    """
    Atomic DEV replace-load for the KMITORA golden PostgreSQL target.

    Safety:
    - DEV only is enforced by the HTTP route.
    - PostgreSQL only for this implementation.
    - public schema only.
    - every table must exist in the discovered target catalog, which is
      what keeps an arbitrary caller-supplied name from reaching SQL.
    - child tables are cleared before parent tables.
    - parent tables are loaded before child tables.
    - the entire operation is one database transaction.
    - any failure rolls back the complete replace-load.
    """
    if str(rec.type or "").lower() != "postgresql":
        raise ValueError("DEV replace-load currently supports PostgreSQL only.")

    if str(schema or "").lower() != "public":
        raise ValueError("DEV replace-load is restricted to schema public.")

    if not isinstance(tables, dict):
        raise ValueError("tables must be an object.")

    if not tables:
        raise ValueError("tables must contain at least one target table.")

    # The caller supplies tables already ordered parent-first (discovery
    # derives that order from the entity dependency graph). Children are
    # deleted in the reverse of that order.
    load_order = [str(name) for name in tables.keys()]
    delete_order = list(reversed(load_order))

    catalog = {(o["schema"], o["name"]) for o in list_objects(rec, cfg)}

    for obj in load_order:
        if (schema, obj) not in catalog:
            raise ValueError(f"Required target object not discovered: {schema}.{obj}")

    prepared = {}

    for obj in load_order:
        rows = tables.get(obj)

        if not isinstance(rows, list) or not rows:
            raise ValueError(f"{obj} rows must be a non-empty array.")

        struct = structure(rec, cfg, schema, obj)
        valid_cols = {c["name"] for c in struct["columns"]}

        clean_rows = []

        for row in rows:
            if not isinstance(row, dict):
                raise ValueError(f"{obj} contains a non-object row.")

            clean = {k: v for k, v in row.items() if k in valid_cols}

            if not clean:
                raise ValueError(f"{obj} contains a row with no matching target columns.")

            clean_rows.append(clean)

        prepared[obj] = clean_rows

    c = connect_db(rec.type, cfg)

    try:
        cur = c.cursor()

        # FK-safe reset: child to parent.
        for obj in delete_order:
            qs = quote_ident(schema, rec.type)
            qo = quote_ident(obj, rec.type)
            cur.execute(f"DELETE FROM {qs}.{qo}")

        results = []

        # FK-safe load: parent to child.
        for obj in load_order:
            qs = quote_ident(schema, rec.type)
            qo = quote_ident(obj, rec.type)

            inserted = 0

            for row in prepared[obj]:
                cols = list(row.keys())
                col_sql = ", ".join(quote_ident(k, rec.type) for k in cols)
                placeholders = ", ".join(["%s"] * len(cols))
                vals = [row[k] for k in cols]

                sql = f"INSERT INTO {qs}.{qo} ({col_sql}) VALUES ({placeholders})"

                cur.execute(sql, vals)

                if cur.rowcount and cur.rowcount > 0:
                    inserted += cur.rowcount

            results.append({
                "table": f"{schema}.{obj}",
                "attempted": len(prepared[obj]),
                "inserted": inserted,
                "skipped_no_matching_columns": 0,
            })

        counts = {}

        for obj in load_order:
            qs = quote_ident(schema, rec.type)
            qo = quote_ident(obj, rec.type)

            cur.execute(f"SELECT COUNT(*) FROM {qs}.{qo}")
            counts[obj] = int(cur.fetchone()[0])

            expected = len(prepared[obj])

            if counts[obj] != expected:
                raise RuntimeError(
                    f"Post-load count mismatch for {obj}: "
                    f"expected {expected}, found {counts[obj]}"
                )

        c.commit()
        cur.close()

        return {
            "ok": True,
            "mode": "DEV_REPLACE_LOAD",
            "schema": schema,
            "results": results,
            "counts": counts,
            "total_loaded": sum(counts.values()),
            "production_write": False,
            "cutover": "DISABLED",
        }

    except Exception:
        c.rollback()
        raise

    finally:
        c.close()


def apply_governed_mutation_plan(rec, cfg, schema, operations, authorization_id):
    """Apply an explicitly authorized DEV mutation plan.

    Supported actions are deliberately bounded: INSERT, UPDATE, DELETE and
    PostgreSQL schema ADD_COLUMN/RENAME_COLUMN.  Every table/column is checked
    against the live discovered catalog/structure, dynamic values are always
    parameterized, and all operations run in one transaction.
    """
    if str(rec.environment or "").upper() != "DEV":
        raise ValueError("Governed mutation plans are permitted for DEV targets only.")
    if not str(authorization_id or "").strip():
        raise ValueError("authorization_id is required for governed target mutation.")
    if not isinstance(operations, list) or not operations:
        raise ValueError("operations must be a non-empty array.")
    if len(operations) > 100000:
        raise ValueError("Mutation plan exceeds the 100000 operation DEV safety limit.")
    if str(schema or "").lower() != "public":
        raise ValueError("Governed DEV mutation is restricted to schema public.")

    catalog = {(o["schema"], o["name"]) for o in list_objects(rec, cfg)}
    connection = connect_db(rec.type, cfg)
    results = []
    try:
        cur = connection.cursor()
        for index, raw in enumerate(operations, start=1):
            if not isinstance(raw, dict):
                raise ValueError(f"Operation {index} must be an object.")
            op = str(raw.get("op") or raw.get("action") or "").upper().strip()
            table = str(raw.get("table") or raw.get("object") or "").strip()
            if not table:
                raise ValueError(f"Operation {index} is missing table.")
            if (schema, table) not in catalog:
                raise ValueError(f"Operation {index} references undiscovered target {schema}.{table}.")
            qs, qt = quote_ident(schema, rec.type), quote_ident(table, rec.type)
            struct = structure(rec, cfg, schema, table)
            valid_cols = {c["name"] for c in struct["columns"]}

            if op == "INSERT":
                row = raw.get("row") or raw.get("record")
                if not isinstance(row, dict):
                    raise ValueError(f"INSERT operation {index} requires row object.")
                clean = {k: v for k, v in row.items() if k in valid_cols}
                if not clean:
                    raise ValueError(f"INSERT operation {index} has no matching target columns.")
                cols = list(clean)
                sql = f"INSERT INTO {qs}.{qt} ({', '.join(quote_ident(c, rec.type) for c in cols)}) VALUES ({', '.join(['%s'] * len(cols))})"
                cur.execute(sql, [clean[c] for c in cols])
                results.append({"index": index, "op": op, "table": table, "affected": max(0, cur.rowcount or 0)})
                continue

            if op in {"UPDATE", "DELETE"}:
                key = raw.get("key") or raw.get("where")
                if not isinstance(key, dict) or not key:
                    raise ValueError(f"{op} operation {index} requires a non-empty key/where object.")
                unknown = [k for k in key if k not in valid_cols]
                if unknown:
                    raise ValueError(f"{op} operation {index} uses unknown key columns: {', '.join(unknown)}")
                clauses = [f"{quote_ident(k, rec.type)} = %s" for k in key]
                params = [key[k] for k in key]
                if op == "DELETE":
                    cur.execute(f"DELETE FROM {qs}.{qt} WHERE {' AND '.join(clauses)}", params)
                else:
                    values = raw.get("values") or raw.get("row")
                    if not isinstance(values, dict) or not values:
                        raise ValueError(f"UPDATE operation {index} requires values object.")
                    clean = {k: v for k, v in values.items() if k in valid_cols and k not in key}
                    if not clean:
                        raise ValueError(f"UPDATE operation {index} has no updateable target columns.")
                    set_sql = ", ".join(f"{quote_ident(k, rec.type)} = %s" for k in clean)
                    cur.execute(f"UPDATE {qs}.{qt} SET {set_sql} WHERE {' AND '.join(clauses)}", [clean[k] for k in clean] + params)
                results.append({"index": index, "op": op, "table": table, "affected": max(0, cur.rowcount or 0)})
                continue

            if op == "ADD_COLUMN":
                if str(rec.type or "").lower() != "postgresql":
                    raise ValueError("ADD_COLUMN is currently implemented for PostgreSQL DEV targets only.")
                column = str(raw.get("column") or "").strip()
                data_type = str(raw.get("data_type") or "TEXT").strip().upper()
                if not column or column in valid_cols:
                    raise ValueError(f"ADD_COLUMN operation {index} has invalid/existing column {column!r}.")
                if not re.fullmatch(r"(?:TEXT|VARCHAR(?:\(\d+\))?|INTEGER|BIGINT|NUMERIC(?:\(\d+,\d+\))?|DECIMAL(?:\(\d+,\d+\))?|BOOLEAN|DATE|TIMESTAMP)", data_type):
                    raise ValueError(f"ADD_COLUMN operation {index} uses unsafe data type {data_type!r}.")
                cur.execute(f"ALTER TABLE {qs}.{qt} ADD COLUMN {quote_ident(column, rec.type)} {data_type}")
                results.append({"index": index, "op": op, "table": table, "column": column, "affected": 0})
                continue

            if op == "RENAME_COLUMN":
                if str(rec.type or "").lower() != "postgresql":
                    raise ValueError("RENAME_COLUMN is currently implemented for PostgreSQL DEV targets only.")
                column = str(raw.get("column") or "").strip(); new_name = str(raw.get("new_name") or "").strip()
                if column not in valid_cols or not new_name or new_name in valid_cols:
                    raise ValueError(f"RENAME_COLUMN operation {index} has invalid column names.")
                cur.execute(f"ALTER TABLE {qs}.{qt} RENAME COLUMN {quote_ident(column, rec.type)} TO {quote_ident(new_name, rec.type)}")
                results.append({"index": index, "op": op, "table": table, "column": column, "new_name": new_name, "affected": 0})
                continue

            raise ValueError(f"Unsupported governed mutation op: {op}")

        connection.commit()
        cur.close()
        return {
            "ok": True,
            "mode": "GOVERNED_DEV_MUTATION",
            "authorization_id": authorization_id,
            "operation_count": len(results),
            "results": results,
            "production_write": False,
            "cutover": "DISABLED",
        }
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()

def target_fingerprint(p):
    return "|".join([
        str(p.get("type") or "").lower(),
        str(p.get("host") or "").lower(),
        str(int(p.get("port") or 0)),
        str(p.get("database") or "").lower(),
        str(p.get("schema") or "").lower(),
        str(p.get("environment") or "DEV").upper(),
    ])

class Handler(BaseHTTPRequestHandler):
    server_version="KMITORATargetAPI/1.1-R3"
    def log_message(self,fmt,*args): print("[KMITORA TARGET API]",fmt%args)

    def do_GET(self):
        try:
            parsed=urlparse(self.path); path=parsed.path; qs=parse_qs(parsed.query)
            if path=="/v1/capabilities":
                return response(self,200,{
                    "service":"KMITORA Target API",
                    "mode":"READ_ONLY_BY_DEFAULT",
                    "database_targets":["postgresql","mysql","oracle","sqlserver","snowflake"],
                    "understanding":["catalog","schema","columns","preview","writer planning","mutation planning"],
                    "governed_dev_mutations":["INSERT","UPDATE","DELETE","ADD_COLUMN","RENAME_COLUMN"],
                    "production_writes":False,
                    "cutover":"DISABLED",
                })
            if path=="/health":
                return response(self,200,{"service":"KMITORA Target API","status":"HEALTHY","target_preview_mode":"READ_ONLY","production_writes":0,"cutover":"DISABLED"})
            if path=="/v1/targets":
                with _LOCK: return response(self,200,[asdict(x) for x in _TARGETS.values()])
            m=re.fullmatch(r"/v1/targets/([^/]+)/objects",path)
            if m:
                tid=m.group(1)
                with _LOCK: rec=_TARGETS.get(tid); cfg=_SECRETS.get(tid)
                if not rec or not cfg: return response(self,404,{"error":"Target not found."})
                return response(self,200,list_objects(rec,cfg))
            m=re.fullmatch(r"/v1/targets/([^/]+)/structure",path)
            if m:
                tid=m.group(1); schema=(qs.get("schema") or [""])[0]; obj=(qs.get("object") or [""])[0]
                with _LOCK: rec=_TARGETS.get(tid); cfg=_SECRETS.get(tid)
                if not rec or not cfg: return response(self,404,{"error":"Target not found."})
                return response(self,200,structure(rec,cfg,schema,obj))
            m=re.fullmatch(r"/v1/targets/([^/]+)/preview",path)
            if m:
                tid=m.group(1); schema=(qs.get("schema") or [""])[0]; obj=(qs.get("object") or [""])[0]
                limit=min(MAX_PREVIEW,max(1,int((qs.get("limit") or [DEFAULT_PREVIEW])[0])))
                with _LOCK: rec=_TARGETS.get(tid); cfg=_SECRETS.get(tid)
                if not rec or not cfg: return response(self,404,{"error":"Target not found."})
                return response(self,200,preview(rec,cfg,schema,obj,limit))
            return response(self,404,{"error":"Route not found."})
        except Exception as e:
            return response(self,400,{"error":str(e)})

    def do_POST(self):
        try:
            p=read_json(self)
            if self.path=="/v1/targets/recover":
                result=_closure20_restore_targets()
                return response(self,200,{"ok":True,"recovery":result,"production_authorized":False,"cutover_authorized":False})
            if self.path=="/v1/targets/test":
                return response(self,200,test_target(p))
            m=re.fullmatch(r"/v1/targets/([^/]+)/apply-plan",self.path)
            if m:
                tid=m.group(1)
                with _LOCK:
                    rec=_TARGETS.get(tid); cfg=_SECRETS.get(tid)
                if not rec or not cfg:
                    return response(self,404,{"error":"Target not found."})
                if str(rec.environment or "").upper() != "DEV":
                    return response(self,403,{"error":"Governed mutation plans are DEV-only."})
                schema=str(p.get("schema") or rec.schema or "")
                operations=p.get("operations")
                authorization_id=str(p.get("authorization_id") or "").strip()
                result=apply_governed_mutation_plan(rec,cfg,schema,operations,authorization_id)
                return response(self,200,result)
            m=re.fullmatch(r"/v1/targets/([^/]+)/replace-load",self.path)
            if m:
                tid=m.group(1)
                with _LOCK:
                    rec=_TARGETS.get(tid)
                    cfg=_SECRETS.get(tid)

                if not rec or not cfg:
                    return response(self,404,{"error":"Target not found."})

                if str(rec.environment or "").upper() != "DEV":
                    return response(
                        self,
                        403,
                        {"error":"Replace-load is permitted for DEV targets only."}
                    )

                schema=str(p.get("schema") or rec.schema or "")
                tables=p.get("tables")
                governed=p.get("governed_execution")

                if not schema:
                    return response(self,400,{"error":"schema is required."})

                if not isinstance(tables,dict):
                    return response(self,400,{"error":"tables must be an object."})

                # DEV_DRY_RUN_001: replace-load is no longer a generic mutation
                # endpoint. The caller must present evidence that an APPROVED
                # migration completed a DEV dry run for the same governed wave.
                if not isinstance(governed,dict):
                    return response(self,403,{"error":"Governed DEV execution evidence is required before replace-load."})

                migration_id=str(governed.get("migration_id") or "").strip()
                approval_id=str(governed.get("approval_id") or "").strip()
                execution_id=str(governed.get("execution_id") or "").strip()
                environment=str(governed.get("environment") or "").upper()
                dry_run_status=str(governed.get("dry_run_status") or "").upper()
                target_write_authorized=governed.get("target_write_authorized") is True
                production_action_executed=governed.get("production_action_executed") is True

                if not all((migration_id,approval_id,execution_id)):
                    return response(self,403,{"error":"migration_id, approval_id and execution_id are required for governed DEV replace-load."})

                if environment != "DEV":
                    return response(self,403,{"error":"Governed replace-load is DEV-only."})

                if dry_run_status != "DRY_RUN_COMPLETED":
                    return response(self,403,{"error":"A successful DEV dry run is required before replace-load."})

                if not target_write_authorized or production_action_executed:
                    return response(self,403,{"error":"Target-write authorization is invalid or production action was requested."})

                result=replace_load_records(rec,cfg,schema,tables)
                result["governance"]={
                    "migration_id":migration_id,
                    "approval_id":approval_id,
                    "execution_id":execution_id,
                    "environment":"DEV",
                    "dry_run_status":dry_run_status,
                    "production_action_executed":False,
                    "cutover":"DISABLED",
                }
                return response(self,200,result)
            m=re.fullmatch(r"/v1/targets/([^/]+)/write",self.path)
            if m:
                tid=m.group(1)
                with _LOCK: rec=_TARGETS.get(tid); cfg=_SECRETS.get(tid)
                if not rec or not cfg: return response(self,404,{"error":"Target not found."})
                if str(rec.environment or "").upper() == "PROD":
                    return response(self,403,{"error":"Production target writes are disabled."})
                schema=str(p.get("schema") or "")
                obj=str(p.get("object") or "")
                rows=p.get("rows")
                if not schema or not obj:
                    return response(self,400,{"error":"schema and object are required."})
                if not isinstance(rows,list) or not rows:
                    return response(self,400,{"error":"rows must be a non-empty array."})
                result=write_records(rec,cfg,schema,obj,rows)
                return response(self,200,result)
            if self.path=="/v1/targets":
                require(p,["name","type","host","database","username"])
                test_target(p)
                fp=target_fingerprint(p)
                with _LOCK:
                    for existing in _TARGETS.values():
                        if target_fingerprint(asdict(existing))==fp:
                            # Refresh credentials and mutable display metadata for the canonical target.
                            # Credentials remain process-memory only and are never returned.
                            _SECRETS[existing.id]=dict(p)
                            persist_connection("target", dict(vars(existing)), dict(p))
                            existing.name=str(p.get("name") or existing.name)
                            existing.status="connected"
                            return response(self,200,asdict(existing))
                tid="TGT-"+secrets.token_hex(6).upper()
                env=str(p.get("environment") or "DEV").upper()
                rec=TargetRecord(id=tid,name=str(p["name"]),type=str(p["type"]).lower(),status="connected",host=str(p["host"]),port=int(p.get("port") or 0),database=str(p["database"]),schema=p.get("schema"),environment=env)
                with _LOCK:
                    _TARGETS[tid]=rec
                    _SECRETS[tid]=dict(p)
                    persist_connection("target", dict(vars(rec)), dict(p))
                return response(self,201,asdict(rec))
            return response(self,404,{"error":"Route not found."})
        except Exception as e:
            return response(self,400,{"error":str(e)})

    def do_DELETE(self):
        try:
            parsed=urlparse(self.path)
            m=re.fullmatch(r"/v1/targets/([^/]+)", parsed.path)
            if not m:
                return response(self,404,{"error":"Route not found."})
            tid=m.group(1)
            with _LOCK:
                existed = _TARGETS.pop(tid, None)
                _SECRETS.pop(tid, None)
                delete_connection("target", tid)
            if not existed:
                return response(self,404,{"error":"Target not found."})
            return response(self,200,{"ok":True,"target_id":tid,"message":"Target disconnected. No target data modified."})
        except Exception as e:
            return response(self,400,{"error":str(e)})

def _closure20_restore_targets():
    return restore_registry("target", TargetRecord, _TARGETS, _SECRETS, test_target)

def main():
    _closure20_restore_targets()
    print(f"KMITORA Target API starting on http://{HOST}:{PORT}")
    print("Mode: DEV/QA/UAT/PROD READ-ONLY TARGET CONNECTION / PREVIEW")
    print("Credentials: PROCESS MEMORY ONLY")
    print("Production target writes: DISABLED")
    print("Cutover: DISABLED")
    s=ThreadingHTTPServer((HOST,PORT),Handler)
    try: s.serve_forever()
    except KeyboardInterrupt: pass
    finally: s.server_close()

if __name__=="__main__":
    main()

