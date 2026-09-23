from __future__ import annotations

import unittest

from source_scope_intelligence import (
    apply_scope_to_entities,
    compile_source_scope,
    row_matches_scope,
)


def _profile(entity: str, origin: str, rows, fields):
    return {
        "entity": entity,
        "file": origin,
        "row_count": len(rows),
        "fields": list(fields),
        "field_profiles": {},
        "duplicate_rows": [],
        "quality_findings": [],
        "_rows": list(rows),
    }


class SourceScopeIntelligenceTests(unittest.TestCase):
    def test_compiles_scenario_scope_from_business_rules(self):
        scope = compile_source_scope([
            "Process only records where scenario_id equals SCN-MIG-006.",
            "Exclude every record where scenario_id is not SCN-MIG-006.",
        ])
        self.assertEqual(scope.mode, "FILTERED")
        self.assertEqual(len(scope.predicates), 1)
        self.assertEqual(scope.predicates[0].field, "scenario_id")
        self.assertEqual(scope.predicates[0].value, "SCN-MIG-006")

    def test_scope_matches_case_insensitively(self):
        scope = compile_source_scope([
            "Process only records where scenario_id equals SCN-MIG-006."
        ])
        self.assertTrue(row_matches_scope({"SCENARIO_ID": "scn-mig-006"}, scope))
        self.assertFalse(row_matches_scope({"scenario_id": "SCN-GT-001"}, scope))

    def test_applies_scope_before_discovery_analysis(self):
        entities = [
            _profile(
                "customers",
                "customers.csv",
                [
                    {"customer_id": "C1", "scenario_id": "SCN-MIG-006"},
                    {"customer_id": "C2", "scenario_id": "SCN-GT-001"},
                ],
                ["customer_id", "scenario_id"],
            ),
            _profile(
                "orders",
                "orders.csv",
                [
                    {"order_id": "O1", "scenario_id": "SCN-MIG-006"},
                    {"order_id": "O2", "scenario_id": "SCN-MIG-006"},
                    {"order_id": "O3", "scenario_id": "SCN-GT-001"},
                ],
                ["order_id", "scenario_id"],
            ),
        ]
        scoped, scope, evidence = apply_scope_to_entities(
            entities,
            ["Process only records where scenario_id equals SCN-MIG-006."],
            _profile,
        )
        self.assertEqual(scope.mode, "FILTERED")
        self.assertEqual(evidence["rows_scanned"], 5)
        self.assertEqual(evidence["rows_matched"], 3)
        self.assertEqual([entity["row_count"] for entity in scoped], [1, 2])
        self.assertEqual(scoped[0]["_rows"][0]["customer_id"], "C1")

    def test_blocks_scope_when_required_field_is_missing(self):
        entities = [
            _profile(
                "customers",
                "customers.csv",
                [{"customer_id": "C1"}],
                ["customer_id"],
            )
        ]
        with self.assertRaisesRegex(ValueError, "cannot be enforced"):
            apply_scope_to_entities(
                entities,
                ["Process only records where scenario_id equals SCN-MIG-006."],
                _profile,
            )


if __name__ == "__main__":
    unittest.main()
