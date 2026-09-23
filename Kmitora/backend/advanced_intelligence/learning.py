from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class VerifiedLearningItem:
    knowledge_id: str
    tenant_id: str
    text: str
    evidence_ids: list[str]
    verified: bool
    regression_passed: bool


class VerifiedLearningVault:

    def __init__(self) -> None:
        self._items: dict[
            tuple[str, str],
            VerifiedLearningItem,
        ] = {}

    def promote(
        self,
        item: VerifiedLearningItem,
    ) -> None:

        if not item.verified:
            raise PermissionError(
                "UNVERIFIED_LEARNING_DENIED"
            )

        if not item.regression_passed:
            raise PermissionError(
                "REGRESSION_FAILED_LEARNING_DENIED"
            )

        if not item.evidence_ids:
            raise PermissionError(
                "EVIDENCE_REQUIRED"
            )

        key = (
            item.tenant_id,
            item.knowledge_id,
        )

        self._items[
            key
        ] = item

    def get(
        self,
        *,
        tenant_id: str,
        knowledge_id: str,
    ) -> VerifiedLearningItem | None:

        return self._items.get(
            (
                tenant_id,
                knowledge_id,
            )
        )

    def list_for_tenant(
        self,
        *,
        tenant_id: str,
    ) -> list[VerifiedLearningItem]:

        return [
            item
            for (
                item_tenant,
                _
            ), item
            in self._items.items()
            if item_tenant == tenant_id
        ]