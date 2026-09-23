import unittest

from autonomous_root_cause_investigator import (
    build_dependency_graph,
    build_report,
    build_test_plan,
    counterfactual,
    engine_status,
    generate_hypotheses,
    investigate,
    normalize_incident,
    rank_fix_options,
    reconstruct_timeline,
    trace_dependencies,
    verify_cause,
)


class AutonomousRootCauseTests(
    unittest.TestCase
):

    def incident_payload(self):
        return {
            "incident": {
                "id": "INC-001",
                "title": (
                    "Orders failed referential validation"
                ),
                "description": (
                    "Orders reference missing customers"
                ),
                "severity": "HIGH",
                "environment": "DEV",
                "primary_asset_id": (
                    "ORDERS"
                ),
                "symptoms": [
                    "Foreign key validation failed",
                    "Customer IDs missing",
                ],
            },
            "signals": [
                {
                    "id": "SIG-001",
                    "type": (
                        "VALIDATION_FAILURE"
                    ),
                    "domain": "DATA",
                    "asset_id": "ORDERS",
                    "severity": "HIGH",
                    "confidence": 98,
                    "message": (
                        "Referential integrity failure: orphan customer IDs"
                    ),
                    "tags": [
                        "orphan",
                        "referential",
                        "foreign key",
                        "missing",
                    ],
                    "timestamp": (
                        "2026-09-13T10:00:00Z"
                    ),
                },
                {
                    "id": "SIG-002",
                    "type": (
                        "RECONCILIATION_VARIANCE"
                    ),
                    "domain": "DATA",
                    "asset_id": "CUSTOMERS",
                    "severity": "HIGH",
                    "confidence": 95,
                    "message": (
                        "Missing parent customer records detected"
                    ),
                    "tags": [
                        "missing",
                        "variance",
                    ],
                    "timestamp": (
                        "2026-09-13T10:01:00Z"
                    ),
                },
                {
                    "id": "SIG-003",
                    "type": "CHANGE_EVENT",
                    "domain": "MIGRATION",
                    "asset_id": "ORDERS",
                    "severity": "MEDIUM",
                    "confidence": 90,
                    "message": (
                        "Migration wave sequencing changed"
                    ),
                    "tags": [
                        "migration",
                        "wave",
                        "sequence",
                    ],
                    "timestamp": (
                        "2026-09-13T09:55:00Z"
                    ),
                },
            ],
            "changes": [
                {
                    "id": "CHG-001",
                    "timestamp": (
                        "2026-09-13T09:50:00Z"
                    ),
                    "asset_id": "ORDERS",
                    "domain": "MIGRATION",
                    "description": (
                        "Order load sequence modified"
                    ),
                }
            ],
        }

    def graph_payload(self):
        return {
            "assets": [
                {
                    "id": "CUSTOMERS",
                    "kind": "TABLE",
                    "domain": "DATA",
                },
                {
                    "id": "ORDERS",
                    "kind": "TABLE",
                    "domain": "DATA",
                },
                {
                    "id": "ORDER_ITEMS",
                    "kind": "TABLE",
                    "domain": "DATA",
                },
                {
                    "id": "ORDER_API",
                    "kind": "API",
                    "domain": "API",
                },
            ],
            "relationships": [
                {
                    "source": "CUSTOMERS",
                    "target": "ORDERS",
                    "type": "PARENT_OF",
                },
                {
                    "source": "ORDERS",
                    "target": "ORDER_ITEMS",
                    "type": "PARENT_OF",
                },
                {
                    "source": "ORDER_API",
                    "target": "ORDERS",
                    "type": "USES",
                },
            ],
        }

    def test_status_safe(self):
        result = engine_status()

        self.assertEqual(
            result["status"],
            "READY",
        )

        self.assertEqual(
            result["authority"],
            "INVESTIGATION_ONLY",
        )

        self.assertFalse(
            result["safety"][
                "target_write_executed"
            ]
        )

    def test_normalize_incident(self):
        result = normalize_incident(
            self.incident_payload()
        )

        self.assertEqual(
            result["status"],
            "NORMALIZED",
        )

        self.assertEqual(
            result["signal_count"],
            3,
        )

    def test_dependency_graph(self):
        result = build_dependency_graph(
            self.graph_payload()
        )

        self.assertEqual(
            result["asset_count"],
            4,
        )

        self.assertEqual(
            result[
                "relationship_count"
            ],
            3,
        )

    def test_dependency_trace(self):
        payload = self.graph_payload()

        payload[
            "start_asset_id"
        ] = "ORDERS"

        result = trace_dependencies(
            payload
        )

        impacted = {
            asset["id"]
            for asset in result[
                "impacted_assets"
            ]
        }

        self.assertIn(
            "CUSTOMERS",
            impacted,
        )

        self.assertIn(
            "ORDER_ITEMS",
            impacted,
        )

        self.assertIn(
            "ORDER_API",
            impacted,
        )

    def test_timeline(self):
        payload = (
            self.incident_payload()
        )

        result = reconstruct_timeline(
            {
                "signals": (
                    payload["signals"]
                ),
                "changes": (
                    payload["changes"]
                ),
            }
        )

        self.assertEqual(
            result["event_count"],
            4,
        )

        self.assertEqual(
            result["change_count"],
            1,
        )

    def test_hypothesis_ranking(self):
        result = generate_hypotheses(
            self.incident_payload()
        )

        self.assertGreater(
            result[
                "hypothesis_count"
            ],
            0,
        )

        top = result[
            "top_hypothesis"
        ]

        self.assertIn(
            top["domain"],
            {
                "DATA",
                "MIGRATION",
            },
        )

    def test_cause_verification(self):
        result = verify_cause(
            {
                "hypothesis": {
                    "domain": "DATA",
                    "title": (
                        "Missing parent data"
                    ),
                },
                "observations": [
                    {
                        "id": "O1",
                        "result": "SUPPORT",
                        "weight": 100,
                    },
                    {
                        "id": "O2",
                        "result": "SUPPORT",
                        "weight": 90,
                    },
                ],
            }
        )

        self.assertEqual(
            result["status"],
            "CAUSE_VERIFIED",
        )

    def test_counterfactual(self):
        result = counterfactual(
            {
                "observed_failure_score": (
                    100
                ),
                "counterfactual_failure_score": (
                    10
                ),
            }
        )

        self.assertEqual(
            result["status"],
            "STRONGLY_CAUSAL",
        )

        self.assertEqual(
            result[
                "causal_uplift_percent"
            ],
            90.0,
        )

    def test_fix_options(self):
        result = rank_fix_options(
            {
                "hypothesis": {
                    "domain": "DATA"
                }
            }
        )

        self.assertGreater(
            result["option_count"],
            0,
        )

        self.assertFalse(
            result[
                "execution_authorized"
            ]
        )

    def test_test_plan(self):
        result = build_test_plan(
            {
                "domain": "DATA"
            }
        )

        self.assertGreater(
            result["test_count"],
            8,
        )

        self.assertTrue(
            result[
                "required_before_execution"
            ]
        )

    def test_investigation(self):
        result = investigate(
            self.incident_payload()
        )

        self.assertTrue(
            result["investigation_id"]
        )

        self.assertFalse(
            result["safety"][
                "remediation_executed"
            ]
        )

        self.assertIn(
            result["next_action"],
            {
                "VERIFY_TOP_CAUSE",
                "COLLECT_MORE_EVIDENCE",
            },
        )

    def test_report(self):
        result = build_report(
            self.incident_payload()
        )

        self.assertTrue(
            result["audit_ready"]
        )

        self.assertIn(
            "executive_summary",
            result,
        )


if __name__ == "__main__":
    unittest.main()
