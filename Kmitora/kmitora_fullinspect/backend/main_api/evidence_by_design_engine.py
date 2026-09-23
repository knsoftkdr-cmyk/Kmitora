from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from hashlib import sha256
from typing import Any
import json
import uuid


ENGINE_VERSION = "1.0.0"


EVIDENCE_TYPES = {
    "TASK",
    "KNOWLEDGE",
    "RECOMMENDATION",
    "AGENT",
    "TOOL",
    "CHANGE",
    "TEST",
    "VALIDATION",
    "SECURITY",
    "APPROVAL",
    "EXECUTION",
    "RECONCILIATION",
    "ROLLBACK",
    "MODEL",
    "POLICY",
    "DIGITAL_TWIN",
    "CUTOVER_SIMULATION",
    "MIGRATION_AUTOPILOT",
    "BUSINESS_RULE_DNA",
    "WHAT_BREAKS_IF",
}


DEFAULT_REQUIRED_EVIDENCE = {
    "MIGRATION": {
        "TASK",
        "RECOMMENDATION",
        "APPROVAL",
        "TEST",
        "VALIDATION",
        "EXECUTION",
        "RECONCILIATION",
    },
    "CUTOVER": {
        "TASK",
        "RECOMMENDATION",
        "APPROVAL",
        "VALIDATION",
        "CUTOVER_SIMULATION",
        "ROLLBACK",
    },
    "CHANGE": {
        "TASK",
        "RECOMMENDATION",
        "CHANGE",
        "TEST",
        "VALIDATION",
        "APPROVAL",
    },
    "AUDIT": {
        "TASK",
        "KNOWLEDGE",
        "TOOL",
        "TEST",
        "APPROVAL",
        "EXECUTION",
        "RECONCILIATION",
    },
}


SENSITIVE_KEYS = {
    "password",
    "secret",
    "token",
    "api_key",
    "access_key",
    "private_key",
    "credential",
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _stable_json(value: Any) -> str:
    return json.dumps(
        value,
        sort_keys=True,
        ensure_ascii=False,
        separators=(",", ":"),
        default=str,
    )


def _hash(value: Any) -> str:
    return sha256(
        _stable_json(value).encode("utf-8")
    ).hexdigest()


def _safety() -> dict[str, Any]:
    return {
        "authoritative": False,
        "read_only": True,
        "evidence_only": True,
        "source_write_executed": False,
        "target_write_executed": False,
        "production_action_executed": False,
        "cutover_executed": False,
    }


def _redact_value(value: Any) -> Any:
    if isinstance(value, dict):
        result = {}

        for key, item in value.items():
            normalized = str(key).lower()

            if normalized in SENSITIVE_KEYS:
                result[key] = "[REDACTED]"
            else:
                result[key] = _redact_value(item)

        return result

    if isinstance(value, list):
        return [
            _redact_value(item)
            for item in value
        ]

    return value


def _normalize_refs(
    values: Any
) -> list[str]:

    if values is None:
        return []

    if isinstance(values, str):
        values = [values]

    if not isinstance(values, list):
        raise ValueError(
            "reference collection must be a list"
        )

    return sorted(
        {
            str(item).strip()
            for item in values
            if str(item).strip()
        }
    )


def build_evidence_record(
    payload: dict[str, Any]
) -> dict[str, Any]:

    evidence_type = str(
        payload.get("evidence_type")
        or ""
    ).upper().strip()

    if evidence_type not in EVIDENCE_TYPES:
        raise ValueError(
            "Unsupported evidence_type: "
            + evidence_type
        )

    trace_id = str(
        payload.get("trace_id")
        or ""
    ).strip()

    if not trace_id:
        trace_id = (
            "TRACE-"
            + uuid.uuid4().hex[:16].upper()
        )

    evidence_id = str(
        payload.get("evidence_id")
        or ""
    ).strip()

    if not evidence_id:
        evidence_id = (
            "EVD-"
            + uuid.uuid4().hex[:16].upper()
        )

    parent_ids = _normalize_refs(
        payload.get("parent_evidence_ids")
    )

    source_refs = _normalize_refs(
        payload.get("source_refs")
    )

    policy_refs = _normalize_refs(
        payload.get("policy_refs")
    )

    test_refs = _normalize_refs(
        payload.get("test_refs")
    )

    raw_input = _redact_value(
        deepcopy(
            payload.get("input")
        )
    )

    raw_output = _redact_value(
        deepcopy(
            payload.get("output")
        )
    )

    metadata = _redact_value(
        deepcopy(
            payload.get("metadata")
            or {}
        )
    )

    created_at = str(
        payload.get("created_at")
        or _now()
    )

    record_material = {
        "evidence_id": evidence_id,
        "trace_id": trace_id,
        "workflow_id": str(
            payload.get("workflow_id")
            or ""
        ),
        "task_id": str(
            payload.get("task_id")
            or ""
        ),
        "agent_id": str(
            payload.get("agent_id")
            or ""
        ),
        "evidence_type": evidence_type,
        "event_name": str(
            payload.get("event_name")
            or evidence_type
        ),
        "created_at": created_at,
        "decision": str(
            payload.get("decision")
            or ""
        ),
        "decision_reason": str(
            payload.get("decision_reason")
            or ""
        ),
        "approval_id": str(
            payload.get("approval_id")
            or ""
        ),
        "source_refs": source_refs,
        "policy_refs": policy_refs,
        "test_refs": test_refs,
        "parent_evidence_ids": parent_ids,
        "input_hash_sha256": (
            _hash(raw_input)
            if raw_input is not None
            else None
        ),
        "output_hash_sha256": (
            _hash(raw_output)
            if raw_output is not None
            else None
        ),
        "metadata": metadata,
        "previous_hash": str(
            payload.get("previous_hash")
            or ""
        ),
    }

    evidence_hash = _hash(
        record_material
    )

    return {
        **record_material,
        "evidence_hash_sha256": (
            evidence_hash
        ),
        "redaction_applied": True,
        "safety": _safety(),
    }


def append_chain(
    payload: dict[str, Any]
) -> dict[str, Any]:

    raw_records = payload.get(
        "records"
    ) or []

    if not isinstance(raw_records, list):
        raise ValueError(
            "records must be a list"
        )

    chain = []
    previous_hash = ""

    for index, raw_record in enumerate(
        raw_records,
        start=1,
    ):
        if not isinstance(raw_record, dict):
            raise ValueError(
                f"record {index} must be an object"
            )

        item = deepcopy(raw_record)

        item["previous_hash"] = (
            previous_hash
        )

        record = build_evidence_record(
            item
        )

        chain.append(record)

        previous_hash = record[
            "evidence_hash_sha256"
        ]

    chain_hash = _hash(
        [
            item[
                "evidence_hash_sha256"
            ]
            for item in chain
        ]
    )

    return {
        "ledger_id": (
            "EVDLEDGER-"
            + uuid.uuid4().hex[:12].upper()
        ),
        "status": "CHAIN_BUILT",
        "record_count": len(chain),
        "records": chain,
        "head_hash_sha256": (
            previous_hash
            if chain
            else ""
        ),
        "ledger_hash_sha256": chain_hash,
        "safety": _safety(),
    }


def verify_chain(
    payload: dict[str, Any]
) -> dict[str, Any]:

    records = payload.get(
        "records"
    ) or []

    if not isinstance(records, list):
        raise ValueError(
            "records must be a list"
        )

    expected_previous = ""
    failures = []

    for index, record in enumerate(
        records,
        start=1,
    ):
        if not isinstance(record, dict):
            failures.append(
                {
                    "sequence": index,
                    "reason": "INVALID_RECORD",
                }
            )
            continue

        provided_hash = str(
            record.get(
                "evidence_hash_sha256"
            )
            or ""
        )

        actual_previous = str(
            record.get("previous_hash")
            or ""
        )

        material = {
            key: deepcopy(value)
            for key, value
            in record.items()
            if key not in {
                "evidence_hash_sha256",
                "redaction_applied",
                "safety",
            }
        }

        recalculated = _hash(
            material
        )

        if actual_previous != expected_previous:
            failures.append(
                {
                    "sequence": index,
                    "evidence_id": record.get(
                        "evidence_id"
                    ),
                    "reason": (
                        "PREVIOUS_HASH_MISMATCH"
                    ),
                }
            )

        if provided_hash != recalculated:
            failures.append(
                {
                    "sequence": index,
                    "evidence_id": record.get(
                        "evidence_id"
                    ),
                    "reason": (
                        "EVIDENCE_HASH_MISMATCH"
                    ),
                }
            )

        expected_previous = (
            provided_hash
        )

    return {
        "verification_id": (
            "EVDVERIFY-"
            + uuid.uuid4().hex[:12].upper()
        ),
        "status": (
            "VERIFIED"
            if not failures
            else "TAMPER_DETECTED"
        ),
        "record_count": len(records),
        "failure_count": len(failures),
        "failures": failures,
        "chain_intact": not failures,
        "safety": _safety(),
    }


def trace_evidence(
    payload: dict[str, Any]
) -> dict[str, Any]:

    records = payload.get(
        "records"
    ) or []

    trace_id = str(
        payload.get("trace_id")
        or ""
    ).strip()

    if not isinstance(records, list):
        raise ValueError(
            "records must be a list"
        )

    matched = [
        deepcopy(record)
        for record in records
        if str(
            record.get("trace_id")
            or ""
        ) == trace_id
    ]

    matched.sort(
        key=lambda item: str(
            item.get("created_at")
            or ""
        )
    )

    type_counts = {}

    for record in matched:
        key = str(
            record.get("evidence_type")
            or "UNKNOWN"
        )

        type_counts[key] = (
            type_counts.get(key, 0)
            + 1
        )

    return {
        "trace_id": trace_id,
        "status": (
            "TRACE_FOUND"
            if matched
            else "TRACE_NOT_FOUND"
        ),
        "record_count": len(matched),
        "evidence_type_counts": (
            type_counts
        ),
        "timeline": matched,
        "safety": _safety(),
    }


def completeness(
    payload: dict[str, Any]
) -> dict[str, Any]:

    records = payload.get(
        "records"
    ) or []

    workflow_type = str(
        payload.get("workflow_type")
        or "MIGRATION"
    ).upper()

    if not isinstance(records, list):
        raise ValueError(
            "records must be a list"
        )

    required = set(
        payload.get(
            "required_evidence_types"
        )
        or DEFAULT_REQUIRED_EVIDENCE.get(
            workflow_type,
            set(),
        )
    )

    required = {
        str(item).upper()
        for item in required
    }

    present = {
        str(
            record.get("evidence_type")
            or ""
        ).upper()
        for record in records
        if isinstance(record, dict)
    }

    matched = sorted(
        required & present
    )

    missing = sorted(
        required - present
    )

    score = (
        round(
            len(matched)
            / len(required)
            * 100,
            2,
        )
        if required
        else 100.0
    )

    return {
        "completeness_id": (
            "EVDCOMP-"
            + uuid.uuid4().hex[:12].upper()
        ),
        "workflow_type": (
            workflow_type
        ),
        "score_percent": score,
        "required_types": sorted(
            required
        ),
        "present_types": sorted(
            present
        ),
        "matched_types": matched,
        "missing_types": missing,
        "complete": not missing,
        "status": (
            "COMPLETE"
            if not missing
            else "EVIDENCE_GAPS"
        ),
        "safety": _safety(),
    }


def policy_map(
    payload: dict[str, Any]
) -> dict[str, Any]:

    records = payload.get(
        "records"
    ) or []

    policies = payload.get(
        "policies"
    ) or []

    if not isinstance(records, list):
        raise ValueError(
            "records must be a list"
        )

    if not isinstance(policies, list):
        raise ValueError(
            "policies must be a list"
        )

    mappings = []

    for policy in policies:
        if not isinstance(policy, dict):
            continue

        policy_id = str(
            policy.get("policy_id")
            or ""
        ).strip()

        required_types = {
            str(item).upper()
            for item in (
                policy.get(
                    "required_evidence_types"
                )
                or []
            )
        }

        matching_records = [
            record
            for record in records
            if str(
                record.get(
                    "evidence_type"
                )
                or ""
            ).upper() in required_types
        ]

        covered_types = {
            str(
                record.get(
                    "evidence_type"
                )
                or ""
            ).upper()
            for record in matching_records
        }

        missing_types = sorted(
            required_types
            - covered_types
        )

        mappings.append(
            {
                "policy_id": policy_id,
                "policy_name": str(
                    policy.get(
                        "name"
                    )
                    or policy_id
                ),
                "required_evidence_types": (
                    sorted(required_types)
                ),
                "evidence_ids": sorted(
                    {
                        str(
                            record.get(
                                "evidence_id"
                            )
                            or ""
                        )
                        for record
                        in matching_records
                        if record.get(
                            "evidence_id"
                        )
                    }
                ),
                "missing_evidence_types": (
                    missing_types
                ),
                "status": (
                    "SATISFIED"
                    if not missing_types
                    else "EVIDENCE_REQUIRED"
                ),
            }
        )

    return {
        "policy_map_id": (
            "EVDPOLICY-"
            + uuid.uuid4().hex[:12].upper()
        ),
        "policy_count": len(mappings),
        "mappings": mappings,
        "all_policies_satisfied": all(
            item["status"] == "SATISFIED"
            for item in mappings
        ),
        "safety": _safety(),
    }


def replay_evidence(
    payload: dict[str, Any]
) -> dict[str, Any]:

    records = payload.get(
        "records"
    ) or []

    if not isinstance(records, list):
        raise ValueError(
            "records must be a list"
        )

    ordered = sorted(
        [
            deepcopy(record)
            for record in records
            if isinstance(record, dict)
        ],
        key=lambda item: (
            str(item.get("created_at") or ""),
            str(item.get("evidence_id") or ""),
        ),
    )

    timeline = []

    for index, record in enumerate(
        ordered,
        start=1,
    ):
        timeline.append(
            {
                "sequence": index,
                "evidence_id": record.get(
                    "evidence_id"
                ),
                "trace_id": record.get(
                    "trace_id"
                ),
                "event_time": record.get(
                    "created_at"
                ),
                "evidence_type": record.get(
                    "evidence_type"
                ),
                "event_name": record.get(
                    "event_name"
                ),
                "decision": record.get(
                    "decision"
                ),
                "decision_reason": (
                    record.get(
                        "decision_reason"
                    )
                ),
                "agent_id": record.get(
                    "agent_id"
                ),
                "approval_id": record.get(
                    "approval_id"
                ),
                "evidence_hash_sha256": (
                    record.get(
                        "evidence_hash_sha256"
                    )
                ),
            }
        )

    return {
        "replay_id": (
            "EVDREPLAY-"
            + uuid.uuid4().hex[:12].upper()
        ),
        "status": "REPLAY_READY",
        "event_count": len(
            timeline
        ),
        "timeline": timeline,
        "safety": _safety(),
    }


def build_package(
    payload: dict[str, Any]
) -> dict[str, Any]:

    records = payload.get(
        "records"
    ) or []

    if not isinstance(records, list):
        raise ValueError(
            "records must be a list"
        )

    verification = verify_chain(
        {
            "records": records
        }
    )

    complete = completeness(
        {
            "records": records,
            "workflow_type": (
                payload.get(
                    "workflow_type"
                )
                or "MIGRATION"
            ),
            "required_evidence_types": (
                payload.get(
                    "required_evidence_types"
                )
            ),
        }
    )

    evidence_ids = [
        str(
            record.get(
                "evidence_id"
            )
            or ""
        )
        for record in records
        if isinstance(record, dict)
    ]

    manifest_material = {
        "workflow_type": (
            complete["workflow_type"]
        ),
        "evidence_ids": (
            evidence_ids
        ),
        "record_hashes": [
            record.get(
                "evidence_hash_sha256"
            )
            for record in records
            if isinstance(record, dict)
        ],
        "chain_intact": (
            verification[
                "chain_intact"
            ]
        ),
        "completeness_score": (
            complete[
                "score_percent"
            ]
        ),
    }

    package_hash = _hash(
        manifest_material
    )

    return {
        "package_id": (
            "EVDPKG-"
            + uuid.uuid4().hex[:12].upper()
        ),
        "generated_at": _now(),
        "status": (
            "AUDIT_READY"
            if (
                verification["chain_intact"]
                and complete["complete"]
            )
            else "REVIEW_REQUIRED"
        ),
        "record_count": len(records),
        "verification": verification,
        "completeness": complete,
        "manifest": {
            **manifest_material,
            "package_hash_sha256": (
                package_hash
            ),
        },
        "safety": _safety(),
    }


def engine_status() -> dict[str, Any]:
    return {
        "engine": (
            "KMITORA Evidence-by-Design"
        ),
        "version": ENGINE_VERSION,
        "status": "READY",
        "authority": "EVIDENCE_ONLY",
        "capabilities": [
            "evidence_record_generation",
            "tamper_evident_hash_chain",
            "chain_verification",
            "trace_reconstruction",
            "evidence_completeness_score",
            "missing_evidence_detection",
            "policy_to_evidence_mapping",
            "evidence_replay",
            "audit_package_manifest",
            "input_output_hashing",
            "evidence_provenance",
            "parent_evidence_lineage",
            "approval_traceability",
            "agent_traceability",
            "tool_traceability",
            "test_traceability",
            "execution_traceability",
            "reconciliation_traceability",
            "rollback_traceability",
            "model_traceability",
            "sensitive_field_redaction",
            "business_rule_dna_binding",
            "what_breaks_if_binding",
            "migration_autopilot_binding",
            "cutover_simulator_binding",
            "digital_twin_replay_binding",
        ],
        "supported_evidence_types": sorted(
            EVIDENCE_TYPES
        ),
        "safety": _safety(),
    }
