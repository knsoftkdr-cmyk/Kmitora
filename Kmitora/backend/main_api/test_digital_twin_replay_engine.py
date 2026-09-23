import unittest

from digital_twin_replay_engine import (
    branch_scenarios,
    compare_states,
    create_snapshot,
    engine_status,
    fidelity,
    predicted_vs_actual,
    replay,
    replay_step,
)


class DigitalTwinReplayTests(unittest.TestCase):

    def base_state(self):
        return {
            "assets": [
                {
                    "id": "CUSTOMERS",
                    "kind": "TABLE",
                    "records": 5,
                },
                {
                    "id": "ORDERS",
                    "kind": "TABLE",
                    "records": 6,
                },
                {
                    "id": "ORDER_API",
                    "kind": "API",
                    "version": "v1",
                },
                {
                    "id": "APPROVAL_RULE",
                    "kind": "BUSINESS_RULE",
                    "expression": "amount > 1000 requires approval",
                },
            ],
            "relationships": [
                {
                    "id": "R1",
                    "source": "CUSTOMERS",
                    "target": "ORDERS",
                    "type": "PARENT_OF",
                }
            ],
        }

    def events(self):
        return [
            {
                "id": "E1",
                "type": "UPDATE_ASSET",
                "payload": {
                    "asset_id": "CUSTOMERS",
                    "changes": {
                        "state": "TARGET"
                    },
                },
            },
            {
                "id": "E2",
                "type": "UPDATE_ASSET",
                "payload": {
                    "asset_id": "ORDERS",
                    "changes": {
                        "state": "TARGET"
                    },
                },
            },
            {
                "id": "E3",
                "type": "UPDATE_ASSET",
                "payload": {
                    "asset_id": "ORDER_API",
                    "changes": {
                        "version": "v2"
                    },
                },
            },
        ]

    def test_status_safe(self):
        result = engine_status()

        self.assertEqual(
            result["status"],
            "READY",
        )

        self.assertEqual(
            result["authority"],
            "SIMULATION_ONLY",
        )

        self.assertFalse(
            result["safety"][
                "direct_target_write_path"
            ]
        )

    def test_snapshot(self):
        result = create_snapshot(
            {
                "state": self.base_state()
            }
        )

        self.assertEqual(
            result["asset_count"],
            4,
        )

    def test_replay(self):
        result = replay(
            {
                "initial_state": (
                    self.base_state()
                ),
                "events": self.events(),
            }
        )

        self.assertEqual(
            result["status"],
            "REPLAY_COMPLETE",
        )

        self.assertEqual(
            result["summary"][
                "checkpoint_count"
            ],
            4,
        )

        self.assertFalse(
            result["safety"][
                "target_write_executed"
            ]
        )

    def test_single_step(self):
        result = replay_step(
            {
                "state": self.base_state(),
                "event": self.events()[0],
            }
        )

        self.assertGreater(
            result["delta"]["change_count"],
            0,
        )

    def test_compare(self):
        right = self.base_state()
        right["assets"][0]["records"] = 10

        result = compare_states(
            {
                "left_state": (
                    self.base_state()
                ),
                "right_state": right,
            }
        )

        self.assertFalse(
            result["exact_match"]
        )

    def test_branching(self):
        result = branch_scenarios(
            {
                "initial_state": (
                    self.base_state()
                ),
                "branches": [
                    {
                        "name": "Full",
                        "events": self.events(),
                    },
                    {
                        "name": "API only",
                        "events": [
                            self.events()[2]
                        ],
                    },
                ],
            }
        )

        self.assertEqual(
            result["branch_count"],
            2,
        )

        self.assertEqual(
            result["unique_future_states"],
            2,
        )

    def test_fidelity_exact(self):
        state = self.base_state()

        result = fidelity(
            {
                "predicted_state": state,
                "actual_state": state,
            }
        )

        self.assertEqual(
            result[
                "overall_fidelity_percent"
            ],
            100.0,
        )

        self.assertTrue(
            result["exact_state_match"]
        )

    def test_predicted_actual_drift(self):
        actual = self.base_state()
        actual["assets"][2][
            "version"
        ] = "v3"

        result = predicted_vs_actual(
            {
                "predicted_state": (
                    self.base_state()
                ),
                "actual_state": actual,
            }
        )

        self.assertNotEqual(
            result["status"],
            "MATCH",
        )


if __name__ == "__main__":
    unittest.main()
