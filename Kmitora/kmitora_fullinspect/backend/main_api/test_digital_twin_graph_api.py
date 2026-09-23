"""Tests for live read-only Digital Twin Graph API helpers."""

import unittest

from digital_twin_graph_api import (
    build_runtime_graph,
    impact_analysis,
    rca_path,
    simulate_overlay,
)


class DigitalTwinGraphApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.runtime = {
            "last_agent_action": "A000 test",
            "issues": [{"id": "I1"}],
            "approvals": {"A1": {"status": "APPROVED"}},
            "executions": {"X1": {"status": "DRY_RUN_COMPLETED"}},
            "reconciliations": {"R1": {"status": "PASS"}},
            "evidence": {"E1": {"status": "COMPLETE"}},
            "discoveries": {
                "M1": {
                    "summary": {
                        "source_entity_count": 3,
                        "target_entity_count": 3,
                        "quality_finding_count": 1,
                    }
                }
            },
            "last_migration_id": "M1",
        }
        self.graph = build_runtime_graph(self.runtime)

    def test_graph_is_live_read_only_projection(self) -> None:
        self.assertTrue(self.graph["projection"]["liveRuntimeProjection"])
        self.assertFalse(self.graph["safety"]["productionWriteAllowed"])
        self.assertFalse(self.graph["safety"]["productionCutoverAllowed"])
        self.assertGreaterEqual(len(self.graph["nodes"]), 10)

    def test_impact_analysis(self) -> None:
        result = impact_analysis(self.graph, "data")
        self.assertIn("risk", result["highlightNodeIds"])
        self.assertFalse(result["production_action_executed"])

    def test_rca_is_not_claimed_authoritative(self) -> None:
        result = rca_path(self.graph, "risk")
        self.assertEqual(result["pathNodeIds"], ["source", "data", "risk"])
        self.assertFalse(result["authoritativeCause"])
        self.assertTrue(result["requiresEvidenceValidation"])

    def test_simulation_is_read_only(self) -> None:
        result = simulate_overlay(
            self.graph,
            "risk",
            scenario="Risk propagation",
        )
        self.assertEqual(
            result["simulationTruth"],
            "READ_ONLY_REFERENCE_PROJECTION",
        )
        self.assertFalse(result["target_write_executed"])
        self.assertFalse(result["production_action_executed"])
        self.assertFalse(result["production_cutover_executed"])


if __name__ == "__main__":
    unittest.main()
