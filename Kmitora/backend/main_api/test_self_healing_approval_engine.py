import copy
import unittest

from self_healing_approval_engine import (
    assess_risk,
    build_canary_plan,
    build_execution_package,
    build_healing_report,
    build_rollback_plan,
    build_test_plan,
    calculate_healing_confidence,
    create_approval_token,
    detect_conflicts,
    determine_approval_requirement,
    engine_status,
    propose_fix,
    simulate_fix,
    verify_approval,
    verify_outcome,
)


class SelfHealingApprovalTests(
    unittest.TestCase
):

    def sample_fix(self):
        proposal = propose_fix(
            {
                "issue": {
                    "domain": "DATA",
                },
                "root_cause": {
                    "domain": "DATA",
                    "confidence": 94,
                },
                "environment": "DEV",
                "asset_scope": [
                    "CUSTOMERS",
                    "ORDERS",
                ],
                "proposed_change": {
                    "operation": (
                        "REPAIR_AND_REPLAY"
                    ),
                },
            }
        )

        return proposal["fix"]

    def test_status_safe(self):
        result = engine_status()

        self.assertEqual(
            result["status"],
            "READY",
        )

        self.assertEqual(
            result["authority"],
            "L3_PREPARE_EXECUTION",
        )

        self.assertFalse(
            result[
                "production_execution_enabled"
            ]
        )

        self.assertFalse(
            result["safety"][
                "remediation_executed"
            ]
        )

    def test_propose_fix(self):
        result = propose_fix(
            {
                "issue": {
                    "domain": "DATA",
                },
                "root_cause": {
                    "domain": "DATA",
                    "confidence": 94,
                },
                "environment": "DEV",
                "asset_scope": [
                    "ORDERS"
                ],
            }
        )

        self.assertEqual(
            result["status"],
            "FIX_PROPOSED",
        )

        self.assertFalse(
            result[
                "execution_authorized"
            ]
        )

    def test_risk_assessment(self):
        result = assess_risk(
            {
                "environment": "DEV",
                "blast_radius_score": 20,
                "root_cause_confidence": 95,
                "rollback_readiness": 100,
                "test_coverage": 100,
                "business_criticality": 30,
            }
        )

        self.assertIn(
            result["risk_level"],
            {
                "LOW",
                "MEDIUM",
            },
        )

    def test_healing_confidence(self):
        result = (
            calculate_healing_confidence(
                {
                    "root_cause_confidence": 95,
                    "fix_confidence": 92,
                    "simulation_success": 100,
                    "test_coverage": 96,
                    "rollback_readiness": 100,
                    "evidence_completeness": 100,
                }
            )
        )

        self.assertGreaterEqual(
            result[
                "healing_confidence"
            ],
            90,
        )

        self.assertTrue(
            result[
                "execution_confidence_gate_passed"
            ]
        )

    def test_conflict_detection(self):
        result = detect_conflicts(
            {
                "asset_scope": [
                    "ORDERS"
                ],
                "active_actions": [
                    {
                        "action_id": "A1",
                        "action_type": (
                            "MIGRATION"
                        ),
                        "status": "ACTIVE",
                        "asset_scope": [
                            "ORDERS"
                        ],
                    }
                ],
            }
        )

        self.assertTrue(
            result[
                "execution_blocked"
            ]
        )

    def test_simulation(self):
        fix = self.sample_fix()

        result = simulate_fix(
            {
                "fix": fix,
                "test_results": [
                    {
                        "name": "RCA",
                        "status": "PASS",
                    },
                    {
                        "name": (
                            "Digital Twin"
                        ),
                        "status": "PASS",
                    },
                ],
                "predicted_outcome": {
                    "variance": 0,
                },
            }
        )

        self.assertEqual(
            result["status"],
            "SIMULATION_PASS",
        )

        self.assertFalse(
            result[
                "real_execution_allowed"
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
                "post_execution_required"
            ]
        )

    def test_canary_plan(self):
        result = build_canary_plan(
            {
                "scope_size": 100
            }
        )

        self.assertEqual(
            len(
                result["stages"]
            ),
            4,
        )

        self.assertFalse(
            result[
                "automatic_promotion"
            ]
        )

    def test_production_block(self):
        result = (
            determine_approval_requirement(
                {
                    "environment": (
                        "PROD"
                    ),
                    "risk_level": (
                        "LOW"
                    ),
                    "healing_confidence": (
                        99
                    ),
                }
            )
        )

        self.assertEqual(
            result["status"],
            "PRODUCTION_EXECUTION_BLOCKED",
        )

        self.assertFalse(
            result[
                "execution_available"
            ]
        )

    def test_approval_binding(self):
        fix = self.sample_fix()

        approval = (
            create_approval_token(
                {
                    "fix": fix,
                    "approved_by": (
                        "TEST_APPROVER"
                    ),
                    "risk_level": (
                        "LOW"
                    ),
                    "duration_minutes": (
                        30
                    ),
                }
            )
        )

        result = verify_approval(
            {
                "approval": approval,
                "fix": fix,
            }
        )

        self.assertTrue(
            result["valid"]
        )

        self.assertEqual(
            result["status"],
            "APPROVAL_VALID",
        )

    def test_changed_fix_invalidates_approval(
        self,
    ):
        fix = self.sample_fix()

        approval = (
            create_approval_token(
                {
                    "fix": fix,
                    "approved_by": (
                        "TEST_APPROVER"
                    ),
                }
            )
        )

        changed = copy.deepcopy(
            fix
        )

        changed[
            "proposed_change"
        ]["operation"] = (
            "DIFFERENT_OPERATION"
        )

        result = verify_approval(
            {
                "approval": approval,
                "fix": changed,
            }
        )

        self.assertFalse(
            result["valid"]
        )

        self.assertIn(
            "FIX_HASH_CHANGED",
            result["reasons"],
        )

    def test_rollback_plan(self):
        result = build_rollback_plan(
            {
                "fix": self.sample_fix()
            }
        )

        self.assertTrue(
            result[
                "checkpoint_required"
            ]
        )

        self.assertTrue(
            result[
                "verification_required"
            ]
        )

    def test_execution_package_stays_disabled(
        self,
    ):
        fix = self.sample_fix()

        approval = (
            create_approval_token(
                {
                    "fix": fix,
                    "approved_by": (
                        "TEST_APPROVER"
                    ),
                }
            )
        )

        simulation = simulate_fix(
            {
                "fix": fix,
                "test_results": [
                    {
                        "status": "PASS"
                    }
                ],
            }
        )

        test_plan = build_test_plan(
            {
                "domain": "DATA"
            }
        )

        rollback = build_rollback_plan(
            {
                "fix": fix
            }
        )

        result = (
            build_execution_package(
                {
                    "fix": fix,
                    "approval": approval,
                    "simulation": (
                        simulation
                    ),
                    "test_plan": (
                        test_plan
                    ),
                    "rollback_plan": (
                        rollback
                    ),
                }
            )
        )

        self.assertEqual(
            result["status"],
            "EXECUTION_PACKAGE_READY",
        )

        self.assertFalse(
            result[
                "execution_authorized"
            ]
        )

        self.assertEqual(
            result[
                "execution_mode"
            ],
            "PACKAGE_ONLY",
        )

    def test_outcome_verification(self):
        result = verify_outcome(
            {
                "expected": {
                    "variance": 0,
                    "status": "PASS",
                },
                "actual": {
                    "variance": 0,
                    "status": "PASS",
                },
                "validations": [
                    {
                        "status": "PASS"
                    }
                ],
            }
        )

        self.assertEqual(
            result["status"],
            "HEALING_VERIFIED",
        )

        self.assertFalse(
            result[
                "rollback_required"
            ]
        )

    def test_healing_report(self):
        result = (
            build_healing_report(
                {
                    "proposal": {
                        "status": (
                            "FIX_PROPOSED"
                        )
                    },
                    "risk": {
                        "risk_level": (
                            "LOW"
                        )
                    },
                    "confidence": {
                        "healing_confidence": (
                            95
                        )
                    },
                    "simulation": {
                        "status": (
                            "SIMULATION_PASS"
                        )
                    },
                    "approval": {
                        "status": (
                            "APPROVAL_TOKEN_CREATED"
                        )
                    },
                    "execution_package": {
                        "status": (
                            "EXECUTION_PACKAGE_READY"
                        )
                    },
                }
            )
        )

        self.assertEqual(
            result["status"],
            "HEALING_PREPARED",
        )

        self.assertFalse(
            result[
                "execution_performed"
            ]
        )


if __name__ == "__main__":
    unittest.main()
