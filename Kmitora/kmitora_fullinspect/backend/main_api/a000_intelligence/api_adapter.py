"""Integration helper for F1033_server.py.

This file intentionally does not monkey-patch or replace the current HTTP server. Import A000IntelligenceEngine
inside the existing runtime and expose only routes approved for the current environment.
"""
from __future__ import annotations
from .engine import A000IntelligenceEngine

ENGINE = A000IntelligenceEngine()

READ_ONLY_ROUTES = {
    "/v1/a000/intelligence/status": lambda payload=None: ENGINE.status(),
    "/v1/a000/discovery/plan": lambda payload=None: ENGINE.discovery.plan((payload or {}).get("layers")),
}
