from __future__ import annotations

import unittest

from backend.autonomy import A000AutonomyOrchestrator, CAPABILITIES, validate_registry
from backend.autonomy.gates import FormalGateEngine


class Autonomy137Tests(unittest.TestCase):
    def setUp(self) -> None:
        self.runtime = A000AutonomyOrchestrator()

    def test_registry_is_exactly_137_unique_capabilities(self):
        validate_registry()
        self.assertEqual(137, len(CAPABILITIES))
        self.assertEqual(list(range(1, 138)), sorted(x.number for x in CAPABILITIES.values()))
        self.assertEqual(137, len({x.name.casefold() for x in CAPABILITIES.values()}))

    def test_all_capabilities_have_single_canonical_owner_and_authority(self):
        for spec in CAPABILITIES.values():
            self.assertTrue(spec.owner)
            self.assertTrue(spec.category)
            self.assertIsNotNone(spec.authority)
            self.assertTrue(spec.mandatory_evidence)

    def test_full_program_has_acyclic_dependency_plan(self):
        requested = [f"KCAP-{i:03d}" for i in range(1, 138)]
        plan = self.runtime.plan(requested)
        self.assertEqual(137, len(plan))
        self.assertEqual(set(requested), set(plan))
        positions = {cid: i for i, cid in enumerate(plan)}
        for cid, spec in CAPABILITIES.items():
            for dep in spec.dependencies:
                self.assertLess(positions[dep], positions[cid], f"{dep} must precede {cid}")

    def test_production_mutation_is_not_auto_authorized(self):
        result = self.runtime.execute(
            ["KCAP-029", "KCAP-034", "KCAP-119"],
            {"tenant_id": "T1", "environment": "PRODUCTION", "goal": "repair production issue"},
        )
        self.assertFalse(result["production_authorized"])
        self.assertFalse(result["cutover_authorized"])
        for item in result["results"].values():
            self.assertFalse(item["production_authorized"])
            self.assertFalse(item["cutover_authorized"])

    def test_model_gate_blocks_migration_and_production_gates(self):
        gates = FormalGateEngine().compute({
            "CODE_VALIDATED": "PASS", "STATIC_VALIDATED": "PASS", "BUILD_VALIDATED": "PASS",
            "DEV_RUNTIME_VALIDATED": "PASS", "BROWSER_VALIDATED": "PASS", "DATA_VALIDATED": "PASS",
            "SECURITY_VALIDATED": "PASS", "TENANT_ISOLATION_VALIDATED": "PASS",
            "DIGITAL_TWIN_VALIDATED": "PASS", "MODEL_VALIDATED": "HOLD",
        })
        self.assertEqual("HOLD", gates["MODEL_VALIDATED"])
        self.assertEqual("BLOCKED_UPSTREAM", gates["MIGRATION_READY"])
        self.assertEqual("BLOCKED_UPSTREAM", gates["PRODUCTION_ELIGIBLE"])

    def test_unknown_capability_fails_closed(self):
        with self.assertRaises(KeyError):
            self.runtime.plan(["KCAP-999"])


if __name__ == "__main__":
    unittest.main()
