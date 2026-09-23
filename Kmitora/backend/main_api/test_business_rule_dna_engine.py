import unittest

from business_rule_dna_engine import (
    compare_rule_dna,
    engine_status,
    extract_rule_dna,
)


class BusinessRuleDNATests(unittest.TestCase):

    def test_status_is_safe(self):
        result = engine_status()

        self.assertEqual(result["status"], "READY")
        self.assertTrue(result["safety"]["read_only"])
        self.assertFalse(
            result["safety"]["target_write_executed"]
        )

    def test_extracts_code_sql_and_document_rules(self):
        result = extract_rule_dna(
            {
                "artifacts": [
                    {
                        "name": "customer_service.py",
                        "type": "CODE",
                        "domain": "Customer",
                        "text": (
                            "if customer.status == 'ACTIVE': "
                            "customer.eligible = True\n"
                        ),
                    },
                    {
                        "name": "orders.sql",
                        "type": "SQL",
                        "domain": "Orders",
                        "text": (
                            "CHECK (orders.amount > 0)\n"
                            "CASE WHEN orders.amount > 1000 "
                            "THEN approval.required = true END"
                        ),
                    },
                    {
                        "name": "policy.docx",
                        "type": "DOCUMENT",
                        "domain": "Orders",
                        "text": (
                            "Orders above 1000 must receive approval."
                        ),
                    },
                ]
            }
        )

        self.assertGreaterEqual(
            result["summary"]["unique_rules"],
            4,
        )

        self.assertIn(
            "CODE",
            result["source_coverage"],
        )

        self.assertIn(
            "SQL",
            result["source_coverage"],
        )

        self.assertIn(
            "DOCUMENT",
            result["source_coverage"],
        )

    def test_duplicate_detection(self):
        result = extract_rule_dna(
            {
                "artifacts": [
                    {
                        "name": "a.py",
                        "type": "CODE",
                        "text": "if customer.age >= 18: customer.allowed = True",
                    },
                    {
                        "name": "b.py",
                        "type": "CODE",
                        "text": "if customer.age >= 18: customer.allowed = True",
                    },
                ]
            }
        )

        self.assertEqual(
            result["summary"]["unique_rules"],
            1,
        )

        self.assertEqual(
            result["summary"]["duplicate_implementations"],
            1,
        )

    def test_conflict_detection(self):
        result = extract_rule_dna(
            {
                "artifacts": [
                    {
                        "name": "policy_a.txt",
                        "type": "DOCUMENT",
                        "domain": "Credit",
                        "text": "IF customer.score > 700 THEN decision = APPROVE",
                    },
                    {
                        "name": "policy_b.txt",
                        "type": "DOCUMENT",
                        "domain": "Credit",
                        "text": "IF customer.score > 700 THEN decision = REVIEW",
                    },
                ]
            }
        )

        self.assertEqual(
            result["summary"]["conflicts"],
            1,
        )

    def test_behavioral_equivalence_pass(self):
        rule = "IF orders.amount > 1000 THEN approval.required = true"

        result = compare_rule_dna(
            {
                "source_artifacts": [
                    {
                        "name": "source_policy.txt",
                        "type": "DOCUMENT",
                        "text": rule,
                    }
                ],
                "target_artifacts": [
                    {
                        "name": "target_policy.txt",
                        "type": "DOCUMENT",
                        "text": rule,
                    }
                ],
            }
        )

        self.assertEqual(result["status"], "PASS")
        self.assertEqual(
            result["summary"]["behavioral_equivalence_percent"],
            100.0,
        )

    def test_behavior_change_detected(self):
        result = compare_rule_dna(
            {
                "source_artifacts": [
                    {
                        "name": "source.txt",
                        "type": "DOCUMENT",
                        "text": (
                            "IF orders.amount > 1000 "
                            "THEN approval.required = true"
                        ),
                    }
                ],
                "target_artifacts": [
                    {
                        "name": "target.txt",
                        "type": "DOCUMENT",
                        "text": (
                            "IF orders.amount > 1000 "
                            "THEN approval.required = false"
                        ),
                    }
                ],
            }
        )

        self.assertGreaterEqual(
            result["summary"]["behavior_changed"],
            1,
        )

        self.assertFalse(
            result["safety"]["target_write_executed"]
        )


if __name__ == "__main__":
    unittest.main()
