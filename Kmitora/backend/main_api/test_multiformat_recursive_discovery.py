from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
for path in (str(HERE), str(REPO)):
    if path not in sys.path:
        sys.path.insert(0, path)

from F1033_server import (
    SUPPORTED_FILE_EXTENSIONS,
    _read_recursive_file_source,
    run_discovery,
)


class RecursiveMultiFormatDiscoveryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        for sub in ("csv", "xml", "txt", "json"):
            (self.root / sub).mkdir()

        (self.root / "csv" / "customer_master_part1.csv").write_text(
            "customer_id,name\nC1,Asha\nC2,Ben\n", encoding="utf-8"
        )
        (self.root / "xml" / "customer_master_part2.xml").write_text(
            "<customers><customer><customer_id>C3</customer_id><name>Chen</name></customer></customers>",
            encoding="utf-8",
        )
        (self.root / "txt" / "address_history_part1.txt").write_text(
            "address_id|customer_id|city\nA1|C1|Hyderabad\n", encoding="utf-8"
        )
        (self.root / "json" / "address_history_part2.jsonl").write_text(
            json.dumps({"address_id": "A2", "customer_id": "C2", "city": "Pune"}) + "\n",
            encoding="utf-8",
        )

    def tearDown(self):
        self.temp.cleanup()

    def test_capability_registry_contains_all_supported_file_formats(self):
        self.assertTrue({".csv", ".tsv", ".txt", ".xml", ".json", ".jsonl", ".xlsx", ".xlsm"}.issubset(SUPPORTED_FILE_EXTENSIONS))

    def test_recursive_discovery_merges_partitions_across_nested_formats(self):
        entities = _read_recursive_file_source(self.root)
        by_name = {item["entity"]: item for item in entities}

        self.assertEqual(by_name["customer_master"]["row_count"], 3)
        self.assertEqual(by_name["customer_master"]["source_format_count"], 2)
        self.assertEqual(by_name["address_history"]["row_count"], 2)
        self.assertEqual(by_name["address_history"]["source_format_count"], 2)
        self.assertTrue(any("customer_master_part1.csv" in p for p in by_name["customer_master"]["source_files"]))
        self.assertTrue(any("customer_master_part2.xml" in p for p in by_name["customer_master"]["source_files"]))


    def test_authoritative_sync_reuses_inline_saved_rules_without_rules_file(self):
        result = run_discovery({
            "migration_id": "TEST-AUTH-SYNC-001",
            "source_path": str(self.root),
            "target_schema": {
                "type": "postgresql",
                "name": "DEV Target",
                "database": "testdb",
                "schema": "public",
                "entities": [
                    {"name": "customer_master", "columns": ["customer_id", "name"]},
                    {"name": "customer_address_history", "columns": ["address_id", "customer_id", "city"]},
                ],
            },
            "business_rules": [
                "Consolidate customer records using customer_id as the business key.",
                "Correlate address records to customers using customer_id.",
            ],
            "supporting_artifacts": [
                {"name": "address_resolution_rules.json", "type": "application/json"}
            ],
            "source_entity_allowlist": ["customer_master", "address_history"],
            "expected_entity_row_counts": {
                "customer_master": 3,
                "address_history": 2,
            },
            "expected_scoped_record_count": 5,
        })
        self.assertEqual(result["summary"]["business_rule_count"], 2)
        self.assertEqual(result["summary"]["supporting_artifact_count"], 1)
        self.assertEqual(result["summary"]["source_rows_matched"], 5)
        self.assertEqual(result["supporting_artifacts"][0]["name"], "address_resolution_rules.json")

    def test_no_csv_requirement_exists(self):
        # Regression guard: a source can be valid with zero CSV files.
        (self.root / "csv" / "customer_master_part1.csv").unlink()
        entities = _read_recursive_file_source(self.root)
        self.assertIn("customer_master", {item["entity"] for item in entities})


if __name__ == "__main__":
    unittest.main()
