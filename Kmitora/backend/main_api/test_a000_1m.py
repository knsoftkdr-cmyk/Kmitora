"""Deterministic tests for the integrated A000 one-million engine."""

import unittest

from a000_1m import (
    KQA_CATEGORIES,
    build_scenario,
    catalog_summary,
    kqa_category_for_serial,
    kqa_id_for_serial,
    run_batch,
    run_single,
    validate_catalog,
)


class A000OneMillionTests(unittest.TestCase):
    def test_catalog_exactly_covers_one_million(self) -> None:
        validate_catalog()
        summary = catalog_summary()
        self.assertEqual(summary["total_scenarios"], 1_000_000)

    def test_kqa_boundaries(self) -> None:
        self.assertIsNone(kqa_id_for_serial(825250))
        self.assertEqual(kqa_id_for_serial(825251), "KQA-000001")
        self.assertEqual(kqa_id_for_serial(1000000), "KQA-174750")

    def test_kqa_taxonomy_exact_count(self) -> None:
        self.assertEqual(sum(item.count for item in KQA_CATEGORIES), 174750)
        self.assertEqual(
            kqa_category_for_serial(825251).name,
            "Autonomous QA orchestration",
        )
        self.assertEqual(
            kqa_category_for_serial(1000000).name,
            "Continuous certification",
        )

    def test_safety_defaults(self) -> None:
        scenario = build_scenario(1000000)
        self.assertFalse(scenario.production_write_allowed)
        self.assertFalse(scenario.production_cutover_allowed)
        self.assertFalse(scenario.destructive_action_allowed)
        self.assertFalse(scenario.policy_bypass_allowed)

    def test_safe_reference_single_run(self) -> None:
        outcome = run_single(825251)
        self.assertEqual(outcome.status, "PASS")
        self.assertFalse(outcome.production_write_executed)
        self.assertFalse(outcome.production_cutover_executed)

    def test_reference_batch(self) -> None:
        result = run_batch(start=1, end=1000)
        self.assertEqual(result["passed"], 1000)
        self.assertEqual(result["failed"], 0)


if __name__ == "__main__":
    unittest.main()
