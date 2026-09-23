import copy
import unittest

from evidence_by_design_engine import (
    append_chain,
    build_evidence_record,
    build_package,
    completeness,
    engine_status,
    policy_map,
    replay_evidence,
    trace_evidence,
    verify_chain,
)


class EvidenceByDesignTests(unittest.TestCase):

    def base_records(self):
        return [
            {
                "evidence_type": "TASK",
                "trace_id": "TRACE-001",
                "task_id": "TASK-001",
                "agent_id": "A000",
                "event_name": "Migration requested",
                "input": {
                    "scope": "DEV",
                },
            },
            {
                "evidence_type": "RECOMMENDATION",
                "trace_id": "TRACE-001",
                "task_id": "TASK-001",
                "agent_id": "A000",
                "event_name": "Autopilot recommendation",
                "decision": "PROCEED_TO_VALIDATION",
            },
            {
                "evidence_type": "APPROVAL",
                "trace_id": "TRACE-001",
                "task_id": "TASK-001",
                "approval_id": "APR-001",
                "decision": "APPROVED",
            },
            {
                "evidence_type": "TEST",
                "trace_id": "TRACE-001",
                "task_id": "TASK-001",
                "test_refs": ["TEST-001"],
                "decision": "PASS",
            },
            {
                "evidence_type": "VALIDATION",
                "trace_id": "TRACE-001",
                "task_id": "TASK-001",
                "decision": "PASS",
            },
            {
                "evidence_type": "EXECUTION",
                "trace_id": "TRACE-001",
                "task_id": "TASK-001",
                "decision": "DRY_RUN_ONLY",
            },
            {
                "evidence_type": "RECONCILIATION",
                "trace_id": "TRACE-001",
                "task_id": "TASK-001",
                "decision": "PASS",
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
            "EVIDENCE_ONLY",
        )

        self.assertFalse(
            result["safety"][
                "target_write_executed"
            ]
        )

    def test_record_hash(self):
        result = build_evidence_record(
            {
                "evidence_type": "TOOL",
                "trace_id": "TRACE-001",
                "agent_id": "A000",
                "input": {
                    "command": "test"
                },
                "output": {
                    "status": "PASS"
                },
            }
        )

        self.assertTrue(
            result[
                "evidence_hash_sha256"
            ]
        )

        self.assertTrue(
            result[
                "input_hash_sha256"
            ]
        )

    def test_redaction(self):
        result = build_evidence_record(
            {
                "evidence_type": "TOOL",
                "input": {
                    "password": "secret-value",
                    "safe": "visible",
                },
            }
        )

        self.assertTrue(
            result[
                "redaction_applied"
            ]
        )

    def test_chain_verification(self):
        ledger = append_chain(
            {
                "records": (
                    self.base_records()
                )
            }
        )

        result = verify_chain(
            {
                "records": (
                    ledger["records"]
                )
            }
        )

        self.assertEqual(
            result["status"],
            "VERIFIED",
        )

        self.assertTrue(
            result["chain_intact"]
        )

    def test_tamper_detection(self):
        ledger = append_chain(
            {
                "records": (
                    self.base_records()
                )
            }
        )

        tampered = copy.deepcopy(
            ledger["records"]
        )

        tampered[2]["decision"] = (
            "REJECTED"
        )

        result = verify_chain(
            {
                "records": tampered
            }
        )

        self.assertEqual(
            result["status"],
            "TAMPER_DETECTED",
        )

        self.assertFalse(
            result["chain_intact"]
        )

    def test_completeness(self):
        ledger = append_chain(
            {
                "records": (
                    self.base_records()
                )
            }
        )

        result = completeness(
            {
                "records": (
                    ledger["records"]
                ),
                "workflow_type": (
                    "MIGRATION"
                ),
            }
        )

        self.assertEqual(
            result["score_percent"],
            100.0,
        )

        self.assertTrue(
            result["complete"]
        )

    def test_trace(self):
        ledger = append_chain(
            {
                "records": (
                    self.base_records()
                )
            }
        )

        result = trace_evidence(
            {
                "records": (
                    ledger["records"]
                ),
                "trace_id": "TRACE-001",
            }
        )

        self.assertEqual(
            result["status"],
            "TRACE_FOUND",
        )

        self.assertEqual(
            result["record_count"],
            7,
        )

    def test_policy_map(self):
        ledger = append_chain(
            {
                "records": (
                    self.base_records()
                )
            }
        )

        result = policy_map(
            {
                "records": (
                    ledger["records"]
                ),
                "policies": [
                    {
                        "policy_id": (
                            "POL-001"
                        ),
                        "name": (
                            "Migration approval"
                        ),
                        "required_evidence_types": [
                            "APPROVAL",
                            "VALIDATION",
                        ],
                    }
                ],
            }
        )

        self.assertTrue(
            result[
                "all_policies_satisfied"
            ]
        )

    def test_replay(self):
        ledger = append_chain(
            {
                "records": (
                    self.base_records()
                )
            }
        )

        result = replay_evidence(
            {
                "records": (
                    ledger["records"]
                )
            }
        )

        self.assertEqual(
            result["status"],
            "REPLAY_READY",
        )

        self.assertEqual(
            result["event_count"],
            7,
        )

    def test_package(self):
        ledger = append_chain(
            {
                "records": (
                    self.base_records()
                )
            }
        )

        result = build_package(
            {
                "records": (
                    ledger["records"]
                ),
                "workflow_type": (
                    "MIGRATION"
                ),
            }
        )

        self.assertEqual(
            result["status"],
            "AUDIT_READY",
        )

        self.assertTrue(
            result[
                "verification"
            ]["chain_intact"]
        )


if __name__ == "__main__":
    unittest.main()
