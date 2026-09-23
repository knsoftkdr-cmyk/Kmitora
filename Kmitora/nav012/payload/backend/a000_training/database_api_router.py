from __future__ import annotations
from pathlib import Path
from typing import Any, Dict
from fastapi import APIRouter
from .database_universe import universe
from .database_router import route
from .dedup_registry import ExistingRegistryIndex

router = APIRouter(prefix="/api/a000/database-intelligence", tags=["A000 Database Intelligence"])

@router.get("/health")
def health() -> Dict[str, Any]:
    return {
        "service":"KMITORA A000 Universal Database Intelligence",
        "status":"HEALTHY",
        "mode":"KNOWLEDGE_AND_ROUTING_ONLY",
        **universe.summary(),
        "source_writes":0,
        "target_writes":0,
        "production_actions":0,
    }

@router.get("/catalog")
def catalog() -> Dict[str, Any]:
    return {"status":"OK", **universe.summary(), "databases":universe.databases, "capabilities":universe.capabilities}

@router.post("/route")
def route_request(request: Dict[str, Any]) -> Dict[str, Any]:
    return route(request)

@router.post("/dedup-scan")
def dedup_scan(request: Dict[str, Any]) -> Dict[str, Any]:
    root=Path(str(request.get("root") or Path(__file__).resolve().parents[3]))
    idx=ExistingRegistryIndex(root)
    return {"status":"OK","root":str(root),"summary":idx.scan(),"write_executed":False}
