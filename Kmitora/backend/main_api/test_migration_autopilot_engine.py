import unittest

from migration_autopilot_engine import (
    classify_failure,
    engine_status,
    plan_autopilot,
    simulate_autopilot,
)


class MigrationAutopilotTests(unittest.TestCase):

    def payload(self):
        return {
            "environment": "DEV",
            "assets": [
                {
                    "id": "CUSTOMERS",
                    "kind": "MASTER",
                    "record_count": 5,
                    "risk_score": 30,
                    "criticality": 70,
                    "rollback_available": True,
                    "validation_status": "PASS",
                    "business_rule_gate": "PASS",
                },
                {
                    "id": "ORDERS",
                    "kind": "CHILD",
                    "record_count": 6,
                    "risk_score": 45,
                    "criticality": 80,
                    "rollback_available": True,
                    "validation_status": "PASS",
                    "business_rule_gate": "PASS",
                },
                {
                    "id": "ORDER_ITEMS",
                    "kind": "TRANSACTION",
                    "record_count": 8,
                    "risk_score": 55,
                    "criticality": 85,
                    "rollback_available": True,
                    "validation_status": "PASS",
                    "business_rule_gate": "PASS",
                },
            ],
            "dependencies": [
                {
                    "parent": "CUSTOMERS",
                    "child": "ORDERS",
                    "type": "FK",
                    "hard": True,
                },
                {
                    "parent": "ORDERS",
                    "child": "ORDER_ITEMS",
                    "type": "FK",
                    "hard": True,
                },
            ],
        }

    def test_status_safe(self):
        result = engine_status()

        self.assertEqual(result["status"], "READY")
        self.assertTrue(result["safety"]["read_only"])
        self.assertFalse(
            result["safety"]["direct_target_write_path"]
        )

    def test_dependency_waves(self):
        result = plan_autopilot(self.payload())

        self.assertEqual(result["status"], "PLANNED")
        self.assertEqual(result["summary"]["wave_count"], 3)
        self.assertEqual(
            result["waves"][0]["asset_ids"],
            ["CUSTOMERS"],
        )
        self.assertEqual(
            result["waves"][1]["asset_ids"],
            ["ORDERS"],
        )
        self.assertEqual(
            result["waves"][2]["asset_ids"],
            ["ORDER_ITEMS"],
        )

    def test_cycle_blocks_plan(self):
        payload = self.payload()

        payload["dependencies"].append(
            {
                "parent": "ORDER_ITEMS",
                "child": "CUSTOMERS",
                "type": "INVALID_CYCLE",
            }
        )

        result = plan_autopilot(payload)

        self.assertEqual(result["status"], "BLOCKED")
        self.assertGreater(
            result["summary"]["cycle_count"],
            0,
        )

    def test_non_retryable_failure(self):
        result = classify_failure(
            {
                "failure_type": "REFERENTIAL_INTEGRITY"
            }
        )

        self.assertFalse(result["retryable"])
        self.assertEqual(
            result["recommended_action"],
            "ROLLBACK_REQUIRED",
        )

    def test_retryable_failure(self):
        result = classify_failure(
            {
                "failure_type": "TIMEOUT"
            }
        )

        self.assertTrue(result["retryable"])
        self.assertEqual(
            result["recommended_action"],
            "BOUNDED_RETRY",
        )

    def test_dry_run_never_writes(self):
        result = simulate_autopilot(self.payload())

        self.assertEqual(
            result["status"],
            "DRY_RUN_READY",
        )

        self.assertFalse(
            result["safety"]["target_write_executed"]
        )


if __name__ == "__main__":
    unittest.main()
