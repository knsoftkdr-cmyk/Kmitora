# KMITORA A000 Live Runtime Import Hardening 028A

Purpose: fix live `/v1/a000/messages` integration when `F1033_server.py` is launched directly by absolute path and the sibling `backend/a000_core` package is not on `sys.path`.

This patch replaces only the existing 027 managed block, keeps it exactly once, adds the backend root to `sys.path` locally, preserves all existing A000 reply/learning/shadow behavior, keeps PLAN_ONLY/no-write safety, and installs a schema-aware live qualifier that reports runtime errors explicitly rather than crashing on a missing PowerShell property.
