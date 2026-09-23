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


r = run_live_unified_runtime(
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
    current_reply={"reply": "base"},
    learning_context={"context_count": 2, "read_only": True},
)

check(r["patch_id"] == "A000_LIVE_UNIFIED_RUNTIME_027", "027 patch id")
check(r["normal_message_path_integrated"] is True, "normal message integration projection")
check(r["safety"]["production_action_executed"] is False, "zero production action")
check(r["safety"]["target_write_executed"] is False, "zero target write")
check(r["database_translation"]["status"] == "PLAN_ONLY", "database translation is plan-only")
check(r["deduplication"]["duplicate_creation_executed"] is False, "no duplicate creation")
check(r["execution_dispatch"]["status"] == "NOT_INVOKED", "no tool execution")
check(bool(r["evidence"].get("evidence_id")), "evidence generated")
check(r["learning"]["promotion_gate"] == "BLOCK", "learning blocked without regression proof")
print("A000_LIVE_UNIFIED_RUNTIME_027 bridge smoke passed.")
