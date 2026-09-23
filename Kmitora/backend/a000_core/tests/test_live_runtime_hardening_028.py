from __future__ import annotations
from pathlib import Path
import sys

BACKEND = Path(__file__).resolve().parents[2]
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from a000_core.live_bridge import run_live_unified_runtime


def check(condition: bool, label: str) -> None:
    if not condition:
        raise AssertionError(label)
    print(f"PASS  {label}")


def grounded_reply(value: bool, count: int):
    return {
        "reply": "base",
        "shadow_runtime": {
            "comparison": {
                "shadow_grounded": value,
                "retrieved_count": count,
            }
        },
    }

normal = run_live_unified_runtime(
    message="Plan a PostgreSQL to SQL Server customer migration preserving address history and parent before child. No production writes.",
    request={
        "environment": "DEV",
        "risk": "HIGH",
        "business_rules": [
            "customer_id must remain unique",
            "preserve address history",
            "parent before child",
            "no production writes",
        ],
        "source_engine": "postgresql",
        "target_engine": "sqlserver",
        "tables": [
            {
                "name": "customer_master",
                "columns": [
                    {"name": "customer_id", "logical_type": "INTEGER", "nullable": False},
                    {"name": "name", "logical_type": "STRING"},
                ],
                "primary_key": ["customer_id"],
            }
        ],
    },
    current_reply=grounded_reply(True, 3),
    learning_context={"context_count": 2, "read_only": True},
)
check(normal["patch_id"] == "A000_LIVE_UNIFIED_RUNTIME_027", "027 remains authoritative live bridge")
check(normal["normal_message_path_integrated"] is True, "normal message path remains integrated")
check(normal["safety"]["source_write_executed"] is False, "source writes remain zero")
check(normal["safety"]["target_write_executed"] is False, "target writes remain zero")
check(normal["safety"]["production_action_executed"] is False, "production actions remain zero")
check(normal["safety"]["cutover_executed"] is False, "cutover remains zero")
check(normal["deduplication"]["duplicate_creation_executed"] is False, "duplicate creation remains disabled")
check(normal["database_translation"]["status"] == "PLAN_ONLY", "database translation remains plan-only")

unsupported = run_live_unified_runtime(
    message="quantum banana telescope migration unicorn",
    request={"environment": "DEV"},
    current_reply=grounded_reply(False, 0),
    learning_context={"context_count": 0, "read_only": True},
)
check(unsupported["grounding_guard"]["available"] is True, "shadow grounding guard detected")
check(unsupported["grounding_guard"]["grounded"] is False, "unsupported request is not grounded")
check(unsupported["decision"] == "ABSTAIN_REVIEW", "unsupported request abstains")
check(unsupported["status"] == "REVIEW", "unsupported request routes to review")
check(unsupported["confidence"]["abstain"] is True, "unsupported request confidence abstains")
check(unsupported["safety"]["production_action_executed"] is False, "unsupported request cannot execute production")

print("A000_LIVE_RUNTIME_HARDENING_028 deterministic checks passed.")
