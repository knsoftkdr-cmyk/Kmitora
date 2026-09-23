from __future__ import annotations

import hashlib
import json
import threading
import uuid
from pathlib import Path
from typing import Any
import datetime as dt


_STORE_LOCK = threading.RLock()

_BASE_DIR = Path(__file__).resolve().parent
_STORE_DIR = _BASE_DIR / "runtime" / "learning"
_STORE_FILE = _STORE_DIR / "verified_learning.jsonl"


def _utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


def _canonical_json(value: Any) -> str:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )


def _sha256(value: Any) -> str:
    return hashlib.sha256(
        _canonical_json(value).encode("utf-8")
    ).hexdigest()


def _upper(value: Any) -> str:
    return str(value or "").strip().upper()


def _read_existing() -> list[dict[str, Any]]:
    if not _STORE_FILE.exists():
        return []

    items: list[dict[str, Any]] = []

    with _STORE_FILE.open(
        "r",
        encoding="utf-8",
    ) as handle:
        for raw in handle:
            raw = raw.strip()

            if not raw:
                continue

            try:
                item = json.loads(raw)
            except json.JSONDecodeError:
                continue

            if isinstance(item, dict):
                items.append(item)

    return items


def get_learning_by_evidence(
    evidence_id: str,
) -> dict[str, Any] | None:
    wanted = str(evidence_id).strip()

    if not wanted:
        return None

    with _STORE_LOCK:
        for item in reversed(_read_existing()):
            if (
                str(item.get("evidence_id", "")).strip()
                == wanted
            ):
                return dict(item)

    return None


def get_learning(
    learning_id: str,
) -> dict[str, Any] | None:
    wanted = str(learning_id).strip()

    if not wanted:
        return None

    with _STORE_LOCK:
        for item in reversed(_read_existing()):
            if (
                str(item.get("learning_id", "")).strip()
                == wanted
            ):
                return dict(item)

    return None


def list_learning() -> list[dict[str, Any]]:
    with _STORE_LOCK:
        return list(reversed(_read_existing()))


def _validate_evidence(
    evidence: dict[str, Any],
) -> dict[str, Any]:
    if not isinstance(evidence, dict):
        raise ValueError(
            "Evidence package must be an object."
        )

    required = [
        "evidence_id",
        "migration_id",
        "approval_id",
        "execution_id",
        "reconciliation_id",
    ]

    missing = [
        key
        for key in required
        if not str(evidence.get(key, "")).strip()
    ]

    if missing:
        raise ValueError(
            "Evidence identity chain incomplete: "
            + ", ".join(missing)
        )

    evidence_status = _upper(
        evidence.get("status")
    )

    execution = (
        evidence.get("execution_summary")
        if isinstance(
            evidence.get("execution_summary"),
            dict,
        )
        else {}
    )

    reconciliation = (
        evidence.get("reconciliation_summary")
        if isinstance(
            evidence.get("reconciliation_summary"),
            dict,
        )
        else {}
    )

    safety = (
        evidence.get("safety")
        if isinstance(
            evidence.get("safety"),
            dict,
        )
        else {}
    )

    execution_status = _upper(
        execution.get("status")
    )

    reconciliation_status = _upper(
        reconciliation.get("status")
    )

    target_write_count = int(
        safety.get("target_write_count", 0) or 0
    )

    production_action_count = int(
        safety.get("production_action_count", 0)
        or 0
    )

    if evidence_status != "COMPLETE":
        raise ValueError(
            "Evidence package is not COMPLETE."
        )

    if execution_status != "DRY_RUN_COMPLETED":
        raise ValueError(
            "Execution is not DRY_RUN_COMPLETED."
        )

    if reconciliation_status != "PASS":
        raise ValueError(
            "Reconciliation is not PASS."
        )

    if target_write_count != 0:
        raise ValueError(
            "Verified learning requires zero target writes."
        )

    if production_action_count != 0:
        raise ValueError(
            "Verified learning requires zero production actions."
        )

    if safety.get("target_write_executed") is True:
        raise ValueError(
            "Target write execution prevents promotion."
        )

    if (
        safety.get("production_action_executed")
        is True
    ):
        raise ValueError(
            "Production action execution prevents promotion."
        )

    if safety.get("production_executed") is True:
        raise ValueError(
            "Production execution prevents promotion."
        )

    return {
        "evidence_status": evidence_status,
        "execution_status": execution_status,
        "reconciliation_status":
            reconciliation_status,
        "target_write_count":
            target_write_count,
        "production_action_count":
            production_action_count,
    }


def persist_verified_learning(
    evidence: dict[str, Any],
) -> dict[str, Any]:
    verification = _validate_evidence(evidence)

    evidence_id = str(
        evidence["evidence_id"]
    ).strip()

    with _STORE_LOCK:
        existing = get_learning_by_evidence(
            evidence_id
        )

        if existing is not None:
            result = dict(existing)
            result["idempotent_replay"] = True
            return result

        evidence_hash = _sha256(evidence)

        deterministic_uuid = uuid.uuid5(
            uuid.NAMESPACE_URL,
            "KMITORA:VERIFIED-LEARNING:"
            + evidence_id,
        )

        learning_id = (
            f"LEARN-{deterministic_uuid}"
        )

        record_results = (
            evidence.get("record_results")
            if isinstance(
                evidence.get("record_results"),
                list,
            )
            else []
        )

        transformations = (
            evidence.get(
                "transformation_evidence"
            )
            if isinstance(
                evidence.get(
                    "transformation_evidence"
                ),
                list,
            )
            else []
        )

        business_rules = (
            evidence.get("business_rules")
            if isinstance(
                evidence.get("business_rules"),
                list,
            )
            else []
        )

        verified_outcomes = [
            {
                "id": "KNOW-001",
                "category": "MIGRATION",
                "status": "VERIFIED",
                "subject":
                    "Governed DEV migration lifecycle "
                    "completed through evidence.",
                "provenance": evidence_id,
            },
            {
                "id": "KNOW-002",
                "category": "EXECUTION",
                "status": "VERIFIED",
                "subject":
                    f"{len(record_results)} record "
                    "execution results are evidenced.",
                "provenance": evidence_id,
            },
            {
                "id": "KNOW-003",
                "category": "TRANSFORMATION",
                "status": "VERIFIED",
                "subject":
                    f"{len(transformations)} "
                    "transformation evidence items "
                    "are linked to the run.",
                "provenance": evidence_id,
            },
            {
                "id": "KNOW-004",
                "category": "BUSINESS_RULE",
                "status": "VERIFIED",
                "subject":
                    f"{len(business_rules)} business "
                    "rules are represented in the "
                    "evidence package.",
                "provenance": evidence_id,
            },
            {
                "id": "KNOW-005",
                "category": "RECONCILIATION",
                "status": "VERIFIED",
                "subject":
                    "Reconciliation passed for the "
                    "same governed execution chain.",
                "provenance": evidence_id,
            },
            {
                "id": "KNOW-006",
                "category": "SAFETY",
                "status": "VERIFIED",
                "subject":
                    "DEV dry-run preserved zero "
                    "target writes and zero "
                    "production actions.",
                "provenance": evidence_id,
            },
        ]

        package: dict[str, Any] = {
            "learning_id": learning_id,
            "created_at": _utc_now(),
            "status": "COMPLETE",
            "promotion_gate": "PASS",
            "promotion_progress": 100,
            "storage_mode":
                "APPEND_ONLY_JSONL",
            "durable": True,

            "evidence_id": evidence_id,
            "evidence_sha256": evidence_hash,

            "migration_id": str(
                evidence["migration_id"]
            ),
            "approval_id": str(
                evidence["approval_id"]
            ),
            "execution_id": str(
                evidence["execution_id"]
            ),
            "reconciliation_id": str(
                evidence["reconciliation_id"]
            ),

            "verified_outcomes":
                verified_outcomes,

            "regression_protection": {
                "enabled": True,
                "execution_success_required":
                    True,
                "reconciliation_pass_required":
                    True,
                "zero_target_write_required":
                    True,
                "zero_production_action_required":
                    True,
            },

            "provenance": {
                "source":
                    "KMITORA_GOVERNED_DEV_EVIDENCE",
                **verification,
            },

            "knowledge_candidates": {
                "record_result_count":
                    len(record_results),
                "transformation_count":
                    len(transformations),
                "business_rule_count":
                    len(business_rules),
            },

            "safety": {
                "source_write_executed":
                    False,
                "target_write_executed":
                    False,
                "production_action_executed":
                    False,
                "production_executed":
                    False,
                "target_write_count": 0,
                "production_action_count": 0,
            },

            "idempotent_replay": False,
        }

        _STORE_DIR.mkdir(
            parents=True,
            exist_ok=True,
        )

        with _STORE_FILE.open(
            "a",
            encoding="utf-8",
            newline="\n",
        ) as handle:
            handle.write(
                _canonical_json(package)
            )
            handle.write("\n")
            handle.flush()

        return dict(package)
