from __future__ import annotations

from a000_core.lifecycle_bridge import project_lifecycle_response


def _base(kind: str, payload: dict):
    return {
        "product": "KMITORA",
        "agent": "A000",
        "version": "0.2.0-a000",
        "kind": kind,
        "trace_id": "T-029C",
        "authoritative": False,
        "production_action_executed": False,
        "payload": payload,
    }


def check_runtime(obj: dict, stage: str, code: int) -> None:
    lr = obj["payload"]["lifecycle_runtime"]
    assert lr["patch_id"] == "A000_LIFECYCLE_UNIFIED_RUNTIME_029"
    assert lr["hardening_patch_id"] == "A000_LIFECYCLE_RUNTIME_SCHEMA_029C"
    assert lr["stage"] == stage
    assert lr["mode"] == "PLAN_ONLY"
    assert lr["response_status_code"] == code
    safety = lr["safety"]
    assert safety["execution_authority"] == "NONE"
    assert safety["source_write_executed"] is False
    assert safety["target_write_executed"] is False
    assert safety["production_action_executed"] is False
    assert safety["cutover_executed"] is False


def main() -> None:
    detect = project_lifecycle_response(path="/v1/issues", code=200, envelope_obj=_base("issues", {"items": [], "count": 0}))
    check_runtime(detect, "DETECT", 200)
    assert detect["payload"]["lifecycle_runtime"]["guarded_or_error_response"] is False

    execute_guard = project_lifecycle_response(
        path="/v1/migrations",
        code=400,
        envelope_obj=_base("migration_gate_error", {"message": "migration_id is required"}),
    )
    check_runtime(execute_guard, "EXECUTE", 400)
    assert execute_guard["payload"]["message"] == "migration_id is required"
    assert execute_guard["payload"]["lifecycle_runtime"]["guarded_or_error_response"] is True

    print("PASS A000 lifecycle runtime schema 029C deterministic qualification")


if __name__ == "__main__":
    main()
