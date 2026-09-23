from __future__ import annotations

from pathlib import Path
import sys

BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from a000_core.lifecycle_bridge import STAGES, coverage_status, infer_lifecycle_stage, project_lifecycle_response

CASES = {
    "/v1/requirements": "UNDERSTAND",
    "/v1/discovery/jobs": "DISCOVER",
    "/v1/issues": "DETECT",
    "/v1/a000/root-cause": "DIAGNOSE",
    "/v1/a000/predict": "PREDICT",
    "/v1/a000/recommendations": "RECOMMEND",
    "/v1/a000/simulate": "SIMULATE",
    "/v1/migrations": "EXECUTE",
    "/v1/tests": "TEST",
    "/v1/validation": "VALIDATE",
    "/v1/reconciliation": "RECONCILE",
    "/v1/evidence": "EVIDENCE",
    "/v1/learning": "LEARN",
}


def main() -> None:
    assert len(STAGES) == 13
    assert tuple(CASES.values()) == STAGES
    for path, expected in CASES.items():
        assert infer_lifecycle_stage(path, "") == expected, (path, expected)
        base = {
            "product": "KMITORA",
            "agent": "A000",
            "kind": f"{expected.lower()}_candidate",
            "payload": {"status": "CANDIDATE"},
            "production_action_executed": False,
        }
        out = project_lifecycle_response(path=path, code=200, envelope_obj=base)
        assert out["payload"]["status"] == "CANDIDATE"
        rt = out["payload"]["lifecycle_runtime"]
        assert rt["patch_id"] == "A000_LIFECYCLE_UNIFIED_RUNTIME_029"
        assert rt["stage"] == expected
        assert rt["mode"] == "PLAN_ONLY"
        assert rt["authoritative_payload_preserved"] is True
        assert rt["deduplication"]["duplicate_creation_executed"] is False
        assert rt["safety"]["execution_authority"] == "NONE"
        assert rt["safety"]["source_write_executed"] is False
        assert rt["safety"]["target_write_executed"] is False
        assert rt["safety"]["production_action_executed"] is False
        assert rt["safety"]["cutover_executed"] is False

    # Non-lifecycle and error responses remain untouched.
    health = {"kind": "health", "payload": {"status": "UP"}}
    assert project_lifecycle_response(path="/health", code=200, envelope_obj=health) == health
    err = {"kind": "error", "payload": {"message": "bad"}}
    assert project_lifecycle_response(path="/v1/discovery/jobs", code=400, envelope_obj=err) == err

    cov = coverage_status()
    assert cov["stage_count"] == 13
    assert cov["duplicate_lifecycle_engines_created"] is False
    assert cov["production_action_executed"] is False
    print("PASS A000 lifecycle unified runtime 029 deterministic qualification")


if __name__ == "__main__":
    main()
