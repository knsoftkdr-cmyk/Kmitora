from __future__ import annotations
from typing import Any, Dict
from fastapi import APIRouter, HTTPException
from .a000_pipeline import a000_pipeline


router = APIRouter(prefix="/api/a000", tags=["A000 Semantic Intelligence"])


@router.get("/semantic/health")
def semantic_health() -> Dict[str, Any]:
    return {
        "service": "KMITORA A000 Semantic Intelligence",
        "status": "HEALTHY",
        "mode": "PLAN_ONLY",
        "production_writes": 0,
    }


@router.post("/semantic/analyze")
def semantic_analyze(request: Dict[str, Any]) -> Dict[str, Any]:
    try:
        discovery = request.get("discovery") or request
        target_fields = request.get("target_fields")
        return a000_pipeline.analyze(discovery, target_fields=target_fields)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

