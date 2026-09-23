from __future__ import annotations
from pathlib import Path
from typing import Any, Dict

from fastapi import APIRouter, HTTPException

from .models import PATCH_ID
from .runtime import A000CoreRuntime
from .db_ir import DatabaseIR, TableIR, ColumnIR
from .db_translate import translate
from .learning import promotion_gate

PROJECT_ROOT = Path(__file__).resolve().parents[2]
runtime = A000CoreRuntime(PROJECT_ROOT)
router = APIRouter(prefix="/api/a000/core", tags=["A000 Core Intelligence"])

@router.get("/health")
def health() -> Dict[str, Any]:
    return {
        "service":"KMITORA A000 Core Intelligence",
        "patch_id":PATCH_ID,
        "status":"HEALTHY",
        "mode":"PLAN_ONLY",
        "registered_capabilities":len(runtime.registry.capabilities),
        "execution_authority":"NONE",
        "production_writes":0,
    }

@router.get("/registry")
def registry_catalog(q: str = "") -> Dict[str, Any]:
    rows = runtime.registry.search(q, 100) if q else list(runtime.registry.capabilities.values())[:100]
    return {"count":len(rows),"items":[x.to_dict() for x in rows],"read_only":True}

@router.post("/plan")
def plan(request: Dict[str, Any]) -> Dict[str, Any]:
    try:
        return runtime.plan(request)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

@router.post("/database/translate")
def database_translate(request: Dict[str, Any]) -> Dict[str, Any]:
    try:
        tables = []
        for t in request.get("tables", []):
            cols = [ColumnIR(name=c["name"], logical_type=c["logical_type"], nullable=c.get("nullable", True)) for c in t.get("columns", [])]
            tables.append(TableIR(name=t["name"], columns=cols, primary_key=t.get("primary_key", []), foreign_keys=t.get("foreign_keys", []), indexes=t.get("indexes", [])))
        ir = DatabaseIR(source_engine=request.get("source_engine","unknown"), tables=tables)
        return translate(ir, request.get("target_engine","unknown"))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

@router.post("/learning/promotion-gate")
def learning_promotion_gate(request: Dict[str, Any]) -> Dict[str, Any]:
    return promotion_gate(request.get("candidate") or {}, request.get("regression_results") or [])
