import unittest

from zero_surprise_cutover_simulator import (
    engine_status,
    go_no_go,
    inject_failure,
    plan_cutover,
    rollback_rehearsal,
    simulate_cutover,
    stress_test,
)


class ZeroSurpriseCutoverTests(unittest.TestCase):

    def payload(self):
        return {
            "business_rule_status": "PASS",
            "impact_status": "PASS",
            "autopilot_status": "PLANNED",
            "reconciliation_plan_status": "READY",
            "capacity_available_percent": 100,
            "estimated_rpo_minutes": 5,
            "policy": {
                "approved_window_minutes": 120,
                "max_p90_minutes": 100,
                "max_worst_case_minutes": 120,
                "max_rto_minutes": 60,
                "max_rpo_minutes": 15,
                "min_cutover_confidence": 80,
                "min_capacity_headroom_percent": 15,
            },
            "steps": [
                {
                    "id": "FREEZE",
                    "name": "Freeze source writes",
                    "expected_minutes": 5,
                    "worst_case_minutes": 8,
                    "risk_score": 30,
                    "write_step": False,
                    "approval_required": True,
                    "approval_present": True,
                },
                {
                    "id": "FINAL_SYNC",
                    "name": "Final CDC sync",
                    "expected_minutes": 10,
                    "worst_case_minutes": 15,
                    "risk_score": 45,
                    "write_step": True,
                    "rollback_available": True,
                    "rollback_minutes": 5,
                },
                {
                    "id": "ACTIVATE",
                    "name": "Activate target endpoints",
                    "expected_minutes": 8,
                    "worst_case_minutes": 12,
                    "risk_score": 65,
                    "write_step": True,
                    "rollback_available": True,
                    "rollback_minutes": 8,
                    "approval_required": True,
                    "approval_present": True,
                },
                {
                    "id": "RECON",
                    "name": "Reconcile target",
                    "expected_minutes": 12,
                    "worst_case_minutes": 18,
                    "risk_score": 50,
                    "write_step": False,
                    "reconciliation_required": True,
                },
            ],
            "dependencies": [
                {"before": "FREEZE", "after": "FINAL_SYNC"},
                {"before": "FINAL_SYNC", "after": "ACTIVATE"},
                {"before": "ACTIVATE", "after": "RECON"},
            ],
        }

    def test_status_safe(self):
        result = engine_status()
        self.assertEqual(result["status"], "READY")
        self.assertEqual(
            result["authority"],
            "SIMULATION_ONLY",
        )
        self.assertFalse(
            result["safety"]["direct_target_write_path"]
        )

    def test_plan(self):
        result = plan_cutover(self.payload())

        self.assertEqual(
            result["status"],
            "CUTOVER_SIMULATION_READY",
        )
        self.assertEqual(
            result["summary"]["step_count"],
            4,
        )
        self.assertGreater(
            result["summary"]["cutover_confidence"],
            0,
        )
        self.assertFalse(
            result["safety"]["cutover_executed"]
        )

    def test_simulation(self):
        result = simulate_cutover(self.payload())

        self.assertEqual(
            result["status"],
            "SIMULATION_PASS",
        )
        self.assertEqual(
            len(result["scenarios"]),
            4,
        )

    def test_failure_injection(self):
        result = inject_failure(
            {
                "failure_type": "BUSINESS_RULE_DRIFT",
                "baseline_minutes": 20,
            }
        )

        self.assertTrue(result["rollback_required"])

    def test_rollback_rehearsal(self):
        result = rollback_rehearsal(
            self.payload()
        )

        self.assertEqual(
            result["status"],
            "ROLLBACK_REHEARSAL_READY",
        )

    def test_go_no_go(self):
        result = go_no_go(self.payload())

        self.assertEqual(
            result["decision"],
            "GO_RECOMMENDATION",
        )

        self.assertFalse(
            result["actual_cutover_authorized"]
        )

    def test_dependency_cycle_blocks(self):
        payload = self.payload()

        payload["dependencies"].append(
            {
                "before": "RECON",
                "after": "FREEZE",
            }
        )

        result = plan_cutover(payload)

        self.assertEqual(
            result["status"],
            "CUTOVER_SIMULATION_BLOCKED",
        )

        self.assertIn(
            "DEPENDENCY_CYCLE",
            result["blockers"],
        )


if __name__ == "__main__":
    unittest.main()
