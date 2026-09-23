from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class EnterpriseMemoryRecord:
    memory_id: str
    tenant_id: str
    namespace: str
    subject: str
    payload: dict[str, Any]
    evidence_ids: list[str]
    verified: bool
    regression_passed: bool
    tags: list[str] = field(
        default_factory=list
    )


class EnterpriseMemoryVault:

    def __init__(self) -> None:

        self._records: dict[
            tuple[str, str, str],
            EnterpriseMemoryRecord,
        ] = {}

    def promote(
        self,
        record:
            EnterpriseMemoryRecord,
    ) -> None:

        if not record.verified:
            raise PermissionError(
                "UNVERIFIED_MEMORY_DENIED"
            )

        if (
            not record.regression_passed
        ):
            raise PermissionError(
                "REGRESSION_FAILED_MEMORY_DENIED"
            )

        if not record.evidence_ids:
            raise PermissionError(
                "MEMORY_EVIDENCE_REQUIRED"
            )

        key = (
            record.tenant_id,
            record.namespace,
            record.memory_id,
        )

        self._records[key] = record

    def retrieve(
        self,
        *,
        tenant_id: str,
        namespace: str,
    ) -> list[
        EnterpriseMemoryRecord
    ]:

        return [
            record
            for (
                record_tenant,
                record_namespace,
                _,
            ), record
            in self._records.items()
            if (
                record_tenant
                == tenant_id
                and
                record_namespace
                == namespace
            )
        ]

    def retrieve_subject(
        self,
        *,
        tenant_id: str,
        namespace: str,
        subject: str,
    ) -> list[
        EnterpriseMemoryRecord
    ]:

        normalized = (
            subject.strip().lower()
        )

        return [
            record
            for record in self.retrieve(
                tenant_id=tenant_id,
                namespace=namespace,
            )
            if (
                record.subject
                .strip()
                .lower()
                == normalized
            )
        ]