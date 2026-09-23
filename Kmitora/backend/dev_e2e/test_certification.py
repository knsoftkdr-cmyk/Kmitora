from pathlib import Path
import json
import unittest

from backend.dev_e2e.certification import SCENARIO_ROOT, heal_dataset, _read_csv, _load_expected, _assert_exact


class UniversalDevE2ETests(unittest.TestCase):
    def setUp(self):
        self.base = SCENARIO_ROOT / "failure_storm"
        self.source = {
            entity: _read_csv(self.base / "source" / f"{entity}.csv")
            for entity in ("customers", "orders", "order_items")
        }
        self.expected = {
            entity: _load_expected(self.base / "expected" / f"{entity}.json")
            for entity in ("customers", "orders", "order_items")
        }

    def test_scenario_is_dev_only_and_governed(self):
        scenario = json.loads((self.base / "scenario.json").read_text(encoding="utf-8"))
        self.assertEqual(scenario["environment"], "DEV")
        self.assertFalse(scenario["production_authorized"])
        self.assertFalse(scenario["cutover_authorized"])
        self.assertFalse(scenario["ambiguous_repairs_allowed"])

    def test_failure_storm_heals_to_exact_expected_target(self):
        healed, repairs = heal_dataset(self.source)
        self.assertGreaterEqual(len(repairs), 10)
        _assert_exact(healed["customers"], self.expected["customers"], "customer_id", "customers")
        _assert_exact(healed["orders"], self.expected["orders"], "order_id", "orders")
        _assert_exact(healed["order_items"], self.expected["order_items"], "item_id", "order_items")

    def test_repaired_business_rules(self):
        healed, _ = heal_dataset(self.source)
        customers = healed["customers"]
        orders = healed["orders"]
        items = healed["order_items"]
        self.assertEqual(len(customers), 7)
        self.assertEqual(len(orders), 8)
        self.assertEqual(len(items), 10)
        self.assertTrue(all(row["status"] in {"ACTIVE", "INACTIVE"} for row in customers))
        self.assertTrue(all(row["status"] in {"NEW", "PAID", "SHIPPED", "CANCELLED"} for row in orders))
        self.assertTrue(all(float(row["amount"]) >= 0 for row in orders))
        self.assertTrue(all(int(row["quantity"]) > 0 for row in items))
        self.assertEqual(next(row for row in orders if row["order_id"] == "O9002")["amount"], "30.00")
        self.assertEqual(next(row for row in customers if row["customer_id"] == "C006")["email"], "fault.missingemail@example.test")

    def test_ambiguous_status_fails_closed(self):
        bad = {name: [dict(row) for row in rows] for name, rows in self.source.items()}
        bad["customers"][0]["status"] = "MAYBE"
        with self.assertRaisesRegex(ValueError, "Ambiguous customer status"):
            heal_dataset(bad)

    def test_unrecoverable_orphan_fails_closed(self):
        bad = {name: [dict(row) for row in rows] for name, rows in self.source.items()}
        bad["orders"][0]["customer_id"] = "C999"
        with self.assertRaisesRegex(ValueError, "Unresolved referential defects"):
            heal_dataset(bad)


if __name__ == "__main__":
    unittest.main()
