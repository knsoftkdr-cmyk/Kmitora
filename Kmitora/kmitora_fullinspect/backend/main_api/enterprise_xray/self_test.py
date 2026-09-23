from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path

tmp = Path(tempfile.gettempdir()) / "kmitora_xray_self_test.sqlite3"

if tmp.exists():
    tmp.unlink()

os.environ["KMITORA_XRAY_DB"] = str(tmp)

from enterprise_xray.engine import (
    calculate_impact,
    get_assets,
    get_graph,
    get_status,
    get_summary,
    ingest_discovery,
)

sample = {
    "migration_id": "DEV-XRAY-SELF-TEST",
    "source": {
        "name": "CRM Source",
        "type": "CSV_FOLDER",
        "entities": [
            {
                "name": "customers",
                "fields": [
                    {"name": "customer_id", "type": "INTEGER"},
                    {"name": "email", "type": "TEXT"},
                ],
            },
            {
                "name": "orders",
                "fields": [
                    {"name": "order_id", "type": "INTEGER"},
                    {"name": "customer_id", "type": "INTEGER"},
                ],
            },
        ],
    },
    "target": {
        "name": "PostgreSQL DEV",
        "type": "POSTGRESQL",
        "entities": [
            {
                "name": "target_customers",
                "fields": [
                    {"name": "customer_id", "type": "BIGINT"},
                    {"name": "email", "type": "TEXT"},
                ],
            },
            {
                "name": "target_orders",
                "fields": [
                    {"name": "order_id", "type": "BIGINT"},
                    {"name": "customer_id", "type": "BIGINT"},
                ],
            },
        ],
    },
    "business_rules": [
        {
            "id": "BR-001",
            "description": "Orders must reference a valid customer.",
        }
    ],
    "relationships": [
        {
            "parent_entity": "customers",
            "child_entity": "orders",
            "confidence": 1.0,
        }
    ],
    "suggested_mappings": [
        {
            "source": "customers.customer_id",
            "target": "target_customers.customer_id",
            "confidence": 1.0,
            "status": "ACCEPTED",
        },
        {
            "source": "orders.order_id",
            "target": "target_orders.order_id",
            "confidence": 1.0,
            "status": "ACCEPTED",
        },
    ],
}

result = ingest_discovery(sample)

assert result["status"] == "COMPLETED"
assert result["read_only"] is True
assert result["production_action_executed"] is False
assert result["asset_count"] > 0
assert result["relationship_count"] > 0

summary = get_summary()

assert summary["scan_id"] == result["scan_id"]

assets = get_assets()

customer_asset = next(
    item
    for item in assets
    if item["name"] == "customers"
    and item["asset_type"] == "DATA_ENTITY"
)

impact = calculate_impact(
    customer_asset["asset_id"],
    max_depth=6,
)

assert impact["status"] == "ANALYZED"
assert impact["production_action_executed"] is False

graph = get_graph()

assert len(graph["nodes"]) > 0
assert len(graph["edges"]) > 0

print(
    json.dumps(
        {
            "status": "PASS",
            "xray_status": get_status(),
            "summary": summary,
            "impact": {
                "source_asset": impact[
                    "source_asset"
                ]["name"],
                "direct_impact_count": impact[
                    "direct_impact_count"
                ],
                "downstream_impact_count": impact[
                    "downstream_impact_count"
                ],
                "risk": impact["risk"],
            },
        },
        indent=2,
    )
)

if tmp.exists():
    tmp.unlink()
