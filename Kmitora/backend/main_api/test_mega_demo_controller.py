"""Tests for the KMITORA Mega Demo controller."""

import unittest

from mega_demo_controller import report_payload, status_payload


class MegaDemoControllerTests(unittest.TestCase):
    def test_status_is_default_deny(self) -> None:
        result = status_payload()
        self.assertFalse(result["production_write_allowed"])
        self.assertFalse(result["production_cutover_allowed"])
        self.assertFalse(result["destructive_action_allowed"])
        self.assertFalse(result["policy_bypass_allowed"])
        self.assertFalse(result["production_action_executed"])

    def test_saved_reference_report_is_available(self) -> None:
        report = report_payload()
        self.assertEqual(report["total_checks"], 121)
        self.assertEqual(report["passed"], 121)
        self.assertEqual(report["failed"], 0)
        self.assertFalse(report["production_action_executed"])


if __name__ == "__main__":
    unittest.main()
