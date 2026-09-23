from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class DocumentInput:
    document_id: str
    tenant_id: str
    document_type: str
    text: str
    verified_source: bool


def extract_document_controls(
    document: DocumentInput,
) -> dict[str, Any]:

    if not document.text.strip():
        return {
            "decision": "ABSTAIN",
            "reason": "EMPTY_DOCUMENT",
            "tasks": [],
            "controls": [],
        }

    text = document.text
    lowered = text.lower()

    controls: list[dict[str, str]] = []
    tasks: list[dict[str, Any]] = []

    patterns = [
        (
            "APPROVAL",
            r"\bapproval\b|\bapprove\b",
        ),
        (
            "ROLLBACK",
            r"\brollback\b|\brecovery\b",
        ),
        (
            "VALIDATION",
            r"\bvalidate\b|\bvalidation\b",
        ),
        (
            "RECONCILIATION",
            r"\breconcile\b|\breconciliation\b",
        ),
        (
            "MAPPING",
            r"\bmapping\b|\bsource.?to.?target\b",
        ),
        (
            "BUSINESS_RULE",
            r"\bbusiness rule\b|\brule\b",
        ),
        (
            "DATA_QUALITY",
            r"\bdata quality\b|\bquality rule\b",
        ),
        (
            "SECURITY",
            r"\bsecurity\b|\bleast privilege\b",
        ),
    ]

    for control_type, pattern in patterns:

        if re.search(
            pattern,
            lowered,
        ):
            controls.append({
                "control_type":
                    control_type,
                "source_document_id":
                    document.document_id,
            })

    section_lines = [
        line.strip()
        for line in text.splitlines()
        if line.strip()
    ]

    for index, line in enumerate(
        section_lines,
        start=1,
    ):

        lowered_line = line.lower()

        if any(
            token in lowered_line
            for token in (
                "shall",
                "must",
                "required",
                "validate",
                "migrate",
                "map",
                "transform",
                "reconcile",
            )
        ):
            tasks.append({
                "task_id":
                    f"DOC-TASK-{index:03d}",
                "source_document_id":
                    document.document_id,
                "statement":
                    line,
                "execution_authorized":
                    False,
                "requires_validation":
                    True,
            })

    decision = (
        "STRUCTURED"
        if document.verified_source
        else "REVIEW_REQUIRED"
    )

    return {
        "decision": decision,
        "document_id":
            document.document_id,
        "document_type":
            document.document_type,
        "controls": controls,
        "tasks": tasks,
        "source_verified":
            document.verified_source,
        "execution_authorized":
            False,
        "production_authorized":
            False,
        "cutover_authorized":
            False,
    }