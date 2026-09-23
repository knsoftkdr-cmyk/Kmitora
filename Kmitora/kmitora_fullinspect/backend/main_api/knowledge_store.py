from __future__ import annotations

import datetime as dt
import hashlib
import json
import re
import threading
import uuid
from pathlib import Path
from typing import Any


_LOCK = threading.RLock()

_BASE = Path(__file__).resolve().parent

_KNOWLEDGE_DIR = _BASE / "runtime" / "knowledge"
_REGRESSION_DIR = _BASE / "runtime" / "regressions"

_KNOWLEDGE_FILE = (
    _KNOWLEDGE_DIR / "reusable_knowledge.jsonl"
)

_REGRESSION_FILE = (
    _REGRESSION_DIR / "regression_catalog.jsonl"
)


def _utc_now() -> str:
    return dt.datetime.now(
        dt.timezone.utc
    ).isoformat()


def _canonical(value: Any) -> str:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )


def _hash(value: Any) -> str:
    return hashlib.sha256(
        _canonical(value).encode("utf-8")
    ).hexdigest()


def _read_jsonl(
    path: Path,
) -> list[dict[str, Any]]:
    if not path.exists():
        return []

    rows: list[dict[str, Any]] = []

    with path.open(
        "r",
        encoding="utf-8",
    ) as handle:
        for line in handle:
            raw = line.strip()

            if not raw:
                continue

            try:
                value = json.loads(raw)
            except json.JSONDecodeError:
                continue

            if isinstance(value, dict):
                rows.append(value)

    return rows


def _append_jsonl(
    path: Path,
    rows: list[dict[str, Any]],
) -> None:
    if not rows:
        return

    path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    with path.open(
        "a",
        encoding="utf-8",
        newline="\n",
    ) as handle:
        for row in rows:
            handle.write(_canonical(row))
            handle.write("\n")

        handle.flush()


def list_knowledge() -> list[dict[str, Any]]:
    with _LOCK:
        return list(
            reversed(
                _read_jsonl(
                    _KNOWLEDGE_FILE
                )
            )
        )


def list_regressions() -> list[dict[str, Any]]:
    with _LOCK:
        return list(
            reversed(
                _read_jsonl(
                    _REGRESSION_FILE
                )
            )
        )


def _knowledge_for_learning(
    learning_id: str,
) -> list[dict[str, Any]]:
    return [
        item
        for item in _read_jsonl(
            _KNOWLEDGE_FILE
        )
        if str(
            item.get("learning_id", "")
        ).strip() == learning_id
    ]


def _regressions_for_learning(
    learning_id: str,
) -> list[dict[str, Any]]:
    return [
        item
        for item in _read_jsonl(
            _REGRESSION_FILE
        )
        if str(
            item.get("learning_id", "")
        ).strip() == learning_id
    ]


def _verify_learning(
    learning: dict[str, Any],
) -> None:
    if not isinstance(learning, dict):
        raise ValueError(
            "Learning package must be an object."
        )

    if (
        str(
            learning.get("status", "")
        ).upper()
        != "COMPLETE"
    ):
        raise ValueError(
            "Learning status must be COMPLETE."
        )

    if (
        str(
            learning.get(
                "promotion_gate",
                "",
            )
        ).upper()
        != "PASS"
    ):
        raise ValueError(
            "Learning promotion gate must be PASS."
        )

    if int(
        learning.get(
            "promotion_progress",
            0,
        )
        or 0
    ) != 100:
        raise ValueError(
            "Learning promotion must be 100%."
        )

    if learning.get("durable") is not True:
        raise ValueError(
            "Learning package must be durable."
        )

    safety = (
        learning.get("safety")
        if isinstance(
            learning.get("safety"),
            dict,
        )
        else {}
    )

    if safety.get("source_write_executed") is True:
        raise ValueError(
            "Source write safety invariant failed."
        )

    if safety.get("target_write_executed") is True:
        raise ValueError(
            "Target write safety invariant failed."
        )

    if (
        safety.get(
            "production_action_executed"
        )
        is True
    ):
        raise ValueError(
            "Production action safety invariant failed."
        )

    if safety.get("production_executed") is True:
        raise ValueError(
            "Production safety invariant failed."
        )

    if int(
        safety.get(
            "target_write_count",
            0,
        )
        or 0
    ) != 0:
        raise ValueError(
            "Target write count must be zero."
        )

    if int(
        safety.get(
            "production_action_count",
            0,
        )
        or 0
    ) != 0:
        raise ValueError(
            "Production action count must be zero."
        )


def index_verified_learning(
    learning: dict[str, Any],
) -> dict[str, Any]:
    _verify_learning(learning)

    learning_id = str(
        learning.get(
            "learning_id",
            "",
        )
    ).strip()

    evidence_id = str(
        learning.get(
            "evidence_id",
            "",
        )
    ).strip()

    if not learning_id:
        raise ValueError(
            "learning_id is required."
        )

    if not evidence_id:
        raise ValueError(
            "evidence_id is required."
        )

    with _LOCK:
        existing_knowledge = (
            _knowledge_for_learning(
                learning_id
            )
        )

        existing_regressions = (
            _regressions_for_learning(
                learning_id
            )
        )

        if (
            existing_knowledge
            or existing_regressions
        ):
            return {
                "learning_id": learning_id,
                "evidence_id": evidence_id,
                "status": "INDEXED",
                "knowledge_count":
                    len(existing_knowledge),
                "regression_count":
                    len(existing_regressions),
                "idempotent_replay": True,
                "read_only_source": True,
                "source_write_executed": False,
                "target_write_executed": False,
                "production_action_executed": False,
            }

        outcomes = (
            learning.get(
                "verified_outcomes"
            )
            if isinstance(
                learning.get(
                    "verified_outcomes"
                ),
                list,
            )
            else []
        )

        knowledge_rows: list[
            dict[str, Any]
        ] = []

        for index, outcome in enumerate(
            outcomes,
            start=1,
        ):
            if not isinstance(
                outcome,
                dict,
            ):
                continue

            if (
                str(
                    outcome.get(
                        "status",
                        "",
                    )
                ).upper()
                != "VERIFIED"
            ):
                continue

            outcome_id = str(
                outcome.get(
                    "id",
                    f"OUTCOME-{index:03d}",
                )
            )

            knowledge_uuid = uuid.uuid5(
                uuid.NAMESPACE_URL,
                (
                    "KMITORA:KNOWLEDGE:"
                    f"{learning_id}:"
                    f"{outcome_id}"
                ),
            )

            row = {
                "knowledge_id":
                    f"KKN-{knowledge_uuid}",
                "created_at":
                    _utc_now(),
                "status":
                    "VERIFIED",
                "knowledge_class":
                    str(
                        outcome.get(
                            "category",
                            "GENERAL",
                        )
                    ).upper(),
                "subject":
                    str(
                        outcome.get(
                            "subject",
                            "",
                        )
                    ),
                "source_outcome_id":
                    outcome_id,
                "learning_id":
                    learning_id,
                "evidence_id":
                    evidence_id,
                "migration_id":
                    learning.get(
                        "migration_id"
                    ),
                "provenance": {
                    "learning_id":
                        learning_id,
                    "evidence_id":
                        evidence_id,
                    "source":
                        "VERIFIED_LEARNING",
                },
                "retrieval_scope": [
                    "A000",
                    "DEV",
                    "MIGRATION",
                ],
                "confidence_basis":
                    "DETERMINISTIC_VERIFICATION",
                "automatic_execution":
                    False,
                "source_write_executed":
                    False,
                "target_write_executed":
                    False,
                "production_action_executed":
                    False,
            }

            row[
                "content_sha256"
            ] = _hash(row)

            knowledge_rows.append(row)

        guards = [
            {
                "guard_id":
                    "REG-EXECUTION-001",
                "title":
                    "Execution success regression guard",
                "condition":
                    (
                        "Verified learning requires "
                        "successful governed execution."
                    ),
                "required_state":
                    "DRY_RUN_COMPLETED",
            },
            {
                "guard_id":
                    "REG-RECONCILE-001",
                "title":
                    "Reconciliation regression guard",
                "condition":
                    (
                        "Verified learning requires "
                        "reconciliation PASS."
                    ),
                "required_state":
                    "PASS",
            },
            {
                "guard_id":
                    "REG-TARGET-WRITE-001",
                "title":
                    "Target write regression guard",
                "condition":
                    (
                        "Learning cannot be promoted "
                        "from this DEV safety path "
                        "when target writes occurred."
                    ),
                "required_state":
                    "ZERO_TARGET_WRITES",
            },
            {
                "guard_id":
                    "REG-PROD-001",
                "title":
                    "Production action regression guard",
                "condition":
                    (
                        "Production and cutover must "
                        "remain disabled for this "
                        "learning path."
                    ),
                "required_state":
                    "ZERO_PRODUCTION_ACTIONS",
            },
        ]

        regression_rows: list[
            dict[str, Any]
        ] = []

        for guard in guards:
            regression_uuid = uuid.uuid5(
                uuid.NAMESPACE_URL,
                (
                    "KMITORA:REGRESSION:"
                    f"{learning_id}:"
                    f"{guard['guard_id']}"
                ),
            )

            regression_rows.append(
                {
                    "regression_id":
                        f"KRG-{regression_uuid}",
                    "created_at":
                        _utc_now(),
                    "status":
                        "ACTIVE",
                    "guard_id":
                        guard["guard_id"],
                    "title":
                        guard["title"],
                    "condition":
                        guard["condition"],
                    "required_state":
                        guard["required_state"],
                    "learning_id":
                        learning_id,
                    "evidence_id":
                        evidence_id,
                    "automatic_execution":
                        False,
                    "veto_on_failure":
                        True,
                    "source_write_executed":
                        False,
                    "target_write_executed":
                        False,
                    "production_action_executed":
                        False,
                }
            )

        _append_jsonl(
            _KNOWLEDGE_FILE,
            knowledge_rows,
        )

        _append_jsonl(
            _REGRESSION_FILE,
            regression_rows,
        )

        return {
            "learning_id":
                learning_id,
            "evidence_id":
                evidence_id,
            "status":
                "INDEXED",
            "knowledge_count":
                len(knowledge_rows),
            "regression_count":
                len(regression_rows),
            "idempotent_replay":
                False,
            "read_only_source":
                True,
            "source_write_executed":
                False,
            "target_write_executed":
                False,
            "production_action_executed":
                False,
        }


def _tokens(value: str) -> set[str]:
    return {
        token.lower()
        for token in re.findall(
            r"[A-Za-z0-9_-]+",
            value or "",
        )
        if len(token) >= 2
    }


def get_a000_learning_context(
    query: str,
    limit: int = 20,
) -> dict[str, Any]:
    query_text = str(
        query or ""
    ).strip()

    query_tokens = _tokens(
        query_text
    )

    knowledge = list_knowledge()
    regressions = list_regressions()

    scored: list[
        tuple[int, dict[str, Any]]
    ] = []

    for item in knowledge:
        haystack = " ".join(
            [
                str(
                    item.get(
                        "knowledge_class",
                        "",
                    )
                ),
                str(
                    item.get(
                        "subject",
                        "",
                    )
                ),
                str(
                    item.get(
                        "migration_id",
                        "",
                    )
                ),
            ]
        )

        item_tokens = _tokens(
            haystack
        )

        score = len(
            query_tokens.intersection(
                item_tokens
            )
        )

        if (
            not query_tokens
            or score > 0
        ):
            result = dict(item)
            result[
                "retrieval_score"
            ] = score

            scored.append(
                (score, result)
            )

    scored.sort(
        key=lambda value: (
            value[0],
            str(
                value[1].get(
                    "created_at",
                    "",
                )
            ),
        ),
        reverse=True,
    )

    selected = [
        value[1]
        for value in scored[
            :max(
                1,
                min(
                    int(limit),
                    100,
                ),
            )
        ]
    ]

    return {
        "query":
            query_text,
        "retrieval_mode":
            "DETERMINISTIC_LEXICAL",
        "context_items":
            selected,
        "context_count":
            len(selected),
        "regression_guards":
            regressions,
        "regression_count":
            len(regressions),
        "read_only":
            True,
        "model_training_executed":
            False,
        "automatic_model_update":
            False,
        "source_write_executed":
            False,
        "target_write_executed":
            False,
        "production_action_executed":
            False,
    }
