from __future__ import annotations

import re
from typing import Any


_RULE_PATTERNS = [
    (
        "SQL_CONDITION",
        re.compile(
            r"\bCASE\b|\bWHEN\b|\bIF\b",
            re.IGNORECASE,
        ),
    ),
    (
        "DATABASE_TRIGGER",
        re.compile(
            r"\bTRIGGER\b",
            re.IGNORECASE,
        ),
    ),
    (
        "STORED_PROCEDURE",
        re.compile(
            r"\bPROCEDURE\b|\bPROC\b",
            re.IGNORECASE,
        ),
    ),
    (
        "HARD_CODED_CONSTANT",
        re.compile(
            r"['\"][A-Z0-9_\-]{3,}['\"]"
        ),
    ),
    (
        "MANUAL_OVERRIDE",
        re.compile(
            r"override|manual|workaround",
            re.IGNORECASE,
        ),
    ),
]


def analyze_legacy_logic(
    *,
    artifact_id: str,
    artifact_type: str,
    content: str,
) -> dict[str, Any]:

    findings: list[
        dict[str, Any]
    ] = []

    lines = content.splitlines()

    for line_number, line in enumerate(
        lines,
        start=1,
    ):

        for (
            finding_type,
            pattern,
        ) in _RULE_PATTERNS:

            if pattern.search(line):

                findings.append({
                    "finding_type":
                        finding_type,
                    "line":
                        line_number,
                    "statement":
                        line.strip(),
                    "artifact_id":
                        artifact_id,
                })

    return {
        "artifact_id":
            artifact_id,
        "artifact_type":
            artifact_type,
        "finding_count":
            len(findings),
        "findings":
            findings,
        "execution_authorized":
            False,
        "rewrite_authorized":
            False,
        "production_authorized":
            False,
    }