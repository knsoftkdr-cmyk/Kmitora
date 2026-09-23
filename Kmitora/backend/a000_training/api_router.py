from __future__ import annotations

from typing import Any, Dict
from fastapi import APIRouter, HTTPException

from .business_rule_router import business_rule_router
from .capability_catalog import capability_catalog
from .oracle_advanced_seed import ORACLE_ADVANCED_TOPICS

router = APIRouter(prefix="/api/a000/training", tags=["A000 Agent Capability Learning"])


@router.get("/health")
def health() -> Dict[str, Any]:
    return {
        "service": "KMITORA A000 Agent Capability Learning",
        "status": "HEALTHY",
        "mode": "KNOWLEDGE_AND_ROUTING_ONLY",
        "catalog_count": len(capability_catalog.all()),
        "production_writes": 0,
    }


@router.get("/catalog")
def catalog() -> Dict[str, Any]:
    return {
        "status": "OK",
        "count": len(capability_catalog.all()),
        "items": capability_catalog.all(),
        "read_only": True,
        "production_actions": 0,
    }


@router.post("/ingest/oracle-advanced")
def ingest_oracle_advanced() -> Dict[str, Any]:
    return capability_catalog.ingest(ORACLE_ADVANCED_TOPICS, source="ORACLE_ADVANCED_SEED_20260920")


@router.post("/ingest")
def ingest(request: Dict[str, Any]) -> Dict[str, Any]:
    items = request.get("items") or []
    if not isinstance(items, list):
        raise HTTPException(status_code=400, detail="items must be a list")
    return capability_catalog.ingest(items, source=str(request.get("source") or "USER_OR_INTERNAL"))


@router.post("/decide")
def decide(request: Dict[str, Any]) -> Dict[str, Any]:
    return business_rule_router.decide(request)
