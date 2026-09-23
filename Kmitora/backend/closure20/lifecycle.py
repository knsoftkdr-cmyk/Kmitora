from __future__ import annotations

from hashlib import sha256
from typing import Any


def _digest(value: Any) -> str:
    return sha256(repr(value).encode("utf-8")).hexdigest()


def stage_result(stage: str, payload: dict[str, Any]) -> dict[str, Any]:
    stage = stage.upper()
    allowed = {"DETECT", "EXECUTE", "TEST", "VALIDATE", "RECONCILE", "EVIDENCE", "LEARN"}
    if stage not in allowed:
        raise ValueError("unsupported lifecycle stage")
    result = {
        "stage": stage,
        "status": "PASS",
        "input_sha256": _digest(payload),
        "production_authorized": False,
        "cutover_authorized": False,
    }
    if stage == "DETECT":
        result["findings"] = list(payload.get("findings") or [])
        result["risk_count"] = len(result["findings"])
    elif stage == "EXECUTE":
        env = str(payload.get("environment") or "DEV").upper()
        if env != "DEV":
            raise PermissionError("Closure-20 execution is DEV-only")
        result["execution_mode"] = "GOVERNED_DEV"
        result["target_write_authorized"] = bool(payload.get("dev_target_write_authorized", False))
    elif stage == "TEST":
        checks = list(payload.get("checks") or [])
        result["checks"] = checks
        result["status"] = "PASS" if checks and all(bool(x.get("pass")) for x in checks) else "FAIL"
    elif stage == "VALIDATE":
        validations = list(payload.get("validations") or [])
        result["validations"] = validations
        result["status"] = "PASS" if validations and all(bool(x.get("pass")) for x in validations) else "FAIL"
    elif stage == "RECONCILE":
        rec = list(payload.get("reconciliation") or [])
        result["reconciliation"] = rec
        result["status"] = "PASS" if rec and all(bool(x.get("matched")) for x in rec) else "FAIL"
    elif stage == "EVIDENCE":
        evidence = list(payload.get("evidence") or [])
        result["evidence_count"] = len(evidence)
        result["status"] = "PASS" if evidence else "FAIL"
    elif stage == "LEARN":
        if not bool(payload.get("verified_outcome")):
            result["status"] = "HOLD"
            result["learning_promoted"] = False
        else:
            result["learning_promoted"] = True
    return result
