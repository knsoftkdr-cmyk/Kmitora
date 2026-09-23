from __future__ import annotations
from typing import Any, Dict
from .db_ir import DatabaseIR

TYPE_MAP = {
    "STRING": {"postgresql":"text","mysql":"text","sqlserver":"nvarchar(max)","oracle":"clob"},
    "INTEGER": {"postgresql":"bigint","mysql":"bigint","sqlserver":"bigint","oracle":"number(19)"},
    "DECIMAL": {"postgresql":"numeric","mysql":"decimal(38,10)","sqlserver":"decimal(38,10)","oracle":"number"},
    "BOOLEAN": {"postgresql":"boolean","mysql":"boolean","sqlserver":"bit","oracle":"number(1)"},
    "TIMESTAMP": {"postgresql":"timestamp","mysql":"datetime(6)","sqlserver":"datetime2","oracle":"timestamp"},
    "JSON": {"postgresql":"jsonb","mysql":"json","sqlserver":"nvarchar(max)","oracle":"json"},
    "BINARY": {"postgresql":"bytea","mysql":"longblob","sqlserver":"varbinary(max)","oracle":"blob"},
}

def target_type(logical_type: str, target_engine: str) -> str:
    logical = logical_type.upper()
    engine = target_engine.lower()
    return TYPE_MAP.get(logical, {}).get(engine, logical_type)


def translate(ir: DatabaseIR, target_engine: str) -> Dict[str, Any]:
    tables = []
    for table in ir.tables:
        columns = [{"name": c.name, "logical_type": c.logical_type, "target_type": target_type(c.logical_type, target_engine), "nullable": c.nullable} for c in table.columns]
        tables.append({"name":table.name,"columns":columns,"primary_key":table.primary_key,"foreign_keys":table.foreign_keys,"indexes":table.indexes})
    return {"status":"PLAN_ONLY","source_engine":ir.source_engine,"target_engine":target_engine,"tables":tables,"production_writes":0}
