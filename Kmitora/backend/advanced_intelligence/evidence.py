from __future__ import annotations

import hashlib
import json
from dataclasses import asdict
from typing import Any

from .contracts import EvidenceRecord


def canonical_json(value: Any) -> str:
    return json.dumps(
        value,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        default=str,
    )


def sha256_of(value: Any) -> str:
    return hashlib.sha256(
        canonical_json(value).encode("utf-8")
    ).hexdigest()


class EvidenceLedger:
    """In-memory evidence ledger for deterministic runtime composition.

    Persistence is intentionally delegated to KMITORA's existing
    evidence layer during later integration.
    """

    def __init__(self) -> None:
        self._records: list[EvidenceRecord] = []

    def record(
        self,
        *,
        trace_id: str,
        task_id: str,
        tenant_id: str,
        feature_id: str,
        event_type: str,
        input_data: Any,
        output_data: Any,
        verified: bool,
        authoritative: bool = False,
    ) -> EvidenceRecord:

        record = EvidenceRecord(
            trace_id=trace_id,
            task_id=task_id,
            tenant_id=tenant_id,
            feature_id=feature_id,
            event_type=event_type,
            input_hash=sha256_of(
                input_data
            ),
            output_hash=sha256_of(
                output_data
            ),
            verified=verified,
            authoritative=authoritative,
            payload={
                "input": input_data,
                "output": output_data,
            },
        )

        self._records.append(
            record
        )

        return record

    def list(
        self,
        *,
        tenant_id: str,
    ) -> list[dict[str, Any]]:

        return [
            asdict(record)
            for record in self._records
            if record.tenant_id == tenant_id
        ]