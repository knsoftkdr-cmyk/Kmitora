from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from backend.closure20.digital_twin import DOMAINS, evaluate_digital_twin
from backend.closure20.gate_store import GateStore
from backend.closure20.lifecycle import stage_result
from backend.closure20.security_cert import run_security_adversarial_certification
from backend.closure20.tenant_memory import MemoryScope, TenantMemoryVault


class Closure20Tests(unittest.TestCase):
    def test_digital_twin_requires_all_10_domains(self):
        full = {d: {"evidence": True} for d in DOMAINS}
        self.assertEqual(evaluate_digital_twin(full)["score"], 10)
        self.assertEqual(evaluate_digital_twin(full)["status"], "PASS")
        partial = dict(full); partial.pop("infrastructure")
        self.assertEqual(evaluate_digital_twin(partial)["status"], "PARTIAL")

    def test_execute_is_dev_only(self):
        with self.assertRaises(PermissionError):
            stage_result("EXECUTE", {"environment": "PROD"})

    def test_security_adversarial(self):
        self.assertEqual(run_security_adversarial_certification()["status"], "PASS")

    def test_production_gate_cannot_be_promoted(self):
        with self.assertRaises(PermissionError):
            GateStore().promote("PRODUCTION_ELIGIBLE", [{"verified": True}])

    def test_model_gate_requires_real_execution(self):
        store = GateStore()
        with self.assertRaises((RuntimeError, ValueError)):
            store.promote("MODEL_VALIDATED", [{"verified": True, "kind": "SIMULATED_MODEL"}])

    def test_memory_cross_tenant_denied(self):
        vault = TenantMemoryVault()
        a = MemoryScope("A", "W", "P", "DEV", "S")
        b = MemoryScope("B", "W", "P", "DEV", "S")
        with self.assertRaises(PermissionError):
            vault.list(a, requested_scope=b)


if __name__ == "__main__":
    unittest.main()
