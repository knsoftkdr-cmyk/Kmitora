from __future__ import annotations
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
for candidate in (ROOT / "backend", ROOT / "core", ROOT):
    if candidate.exists() and str(candidate) not in sys.path:
        sys.path.insert(0, str(candidate))

try:
    from semantic.a000_pipeline import a000_pipeline
except ImportError:
    from backend.semantic.a000_pipeline import a000_pipeline


def test_a000_semantic_pipeline():
    payload = {
        "id": "customer-address-flow",
        "name": "Customer Address",
        "operations": [{
            "id": "src",
            "type": "source",
            "outputs": [
                "cust_id",
                "address",
                "effective_from",
                "effective_to",
                "is_primary",
                "updated_date",
            ],
        }],
        "target_fields": ["customer_id", "current_address"],
    }

    result = a000_pipeline.analyze(payload)

    assert result["mode"] == "PLAN_ONLY"
    assert result["status"] in {"READY", "BLOCKED"}
    assert result["summary"]["rules"] >= 2
    assert result["summary"]["transformations"] >= 2
    assert result["evidence"]["sha256"]

