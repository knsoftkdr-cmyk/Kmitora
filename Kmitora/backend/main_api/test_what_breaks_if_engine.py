import unittest

from what_breaks_if_engine import (
    analyze_what_breaks_if,
    engine_status,
)


class WhatBreaksIfEngineTests(unittest.TestCase):

    def sample(self):
        return {
            "change": {
                "asset_id": "DB_CUSTOMER",
                "type": "TYPE_CHANGE",
                "description": "Change customer key type",
            },
            "max_depth": 10,
            "nodes": [
                {
                    "id": "DB_CUSTOMER",
                    "label": "Customer DB",
                    "kind": "DATABASE",
                    "criticality": 95,
                    "metadata": {"owner": "Data"},
                },
                {
                    "id": "T_CUSTOMER",
                    "label": "customers",
                    "kind": "TABLE",
                    "criticality": 90,
                    "metadata": {"owner": "Data"},
                },
                {
                    "id": "API_ORDER",
                    "label": "Order API",
                    "kind": "API",
                    "criticality": 90,
                    "metadata": {"owner": "Apps"},
                },
                {
                    "id": "APP_ORDER",
                    "label": "Order Application",
                    "kind": "APPLICATION",
                    "criticality": 90,
                    "metadata": {"owner": "Apps"},
                },
                {
                    "id": "PROC_ORDER",
                    "label": "Order Fulfilment",
                    "kind": "BUSINESS_PROCESS",
                    "criticality": 98,
                    "metadata": {"owner": "Operations"},
                },
                {
                    "id": "REPORT_SALES",
                    "label": "Sales Report",
                    "kind": "REPORT",
                    "criticality": 70,
                    "metadata": {},
                },
            ],
            "relationships": [
                {
                    "source": "DB_CUSTOMER",
                    "target": "T_CUSTOMER",
                    "relationship": "CONTAINS",
                    "confidence": 100,
                },
                {
                    "source": "T_CUSTOMER",
                    "target": "API_ORDER",
                    "relationship": "IMPACTS",
                    "confidence": 95,
                },
                {
                    "source": "API_ORDER",
                    "target": "APP_ORDER",
                    "relationship": "CALLS",
                    "confidence": 95,
                },
                {
                    "source": "APP_ORDER",
                    "target": "PROC_ORDER",
                    "relationship": "IMPLEMENTS",
                    "confidence": 90,
                },
                {
                    "source": "PROC_ORDER",
                    "target": "REPORT_SALES",
                    "relationship": "PRODUCES",
                    "confidence": 90,
                },
            ],
        }

    def test_status_safe(self):
        status = engine_status()
        self.assertEqual(status["status"], "READY")
        self.assertTrue(status["safety"]["read_only"])
        self.assertFalse(
            status["safety"]["production_action_executed"]
        )

    def test_transitive_blast_radius(self):
        result = analyze_what_breaks_if(self.sample())

        self.assertEqual(
            result["summary"]["total_impacted_assets"],
            5,
        )

        self.assertGreater(
            result["summary"]["transitive_impacts"],
            0,
        )

        self.assertEqual(
            result["safety"]["target_write_executed"],
            False,
        )

    def test_business_impact_found(self):
        result = analyze_what_breaks_if(self.sample())

        ids = {
            item["asset_id"]
            for item in result["business_impact"]
        }

        self.assertIn("PROC_ORDER", ids)
        self.assertIn("REPORT_SALES", ids)

    def test_required_tests(self):
        result = analyze_what_breaks_if(self.sample())

        self.assertIn(
            "Schema compatibility",
            result["required_tests"],
        )

        self.assertIn(
            "API contract",
            result["required_tests"],
        )

        self.assertIn(
            "Business rule validation",
            result["required_tests"],
        )

    def test_unknown_asset_blocked(self):
        payload = self.sample()
        payload["change"]["asset_id"] = "MISSING"

        with self.assertRaises(ValueError):
            analyze_what_breaks_if(payload)


if __name__ == "__main__":
    unittest.main()
