from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def _utc_stamp() -> str:
    return datetime.now(
        timezone.utc
    ).strftime(
        "%Y%m%dT%H%M%S%fZ"
    )


class ShadowEvidenceRecorder:
    """
    DEV engineering evidence recorder.

    Evidence is append-only by unique file name.
    It does not alter the authoritative KMITORA evidence store.
    """

    def __init__(
        self,
        root: str | Path,
    ) -> None:

        self.root = Path(root)

    def record(
        self,
        payload: dict[str, Any],
    ) -> Path:

        self.root.mkdir(
            parents=True,
            exist_ok=True,
        )

        trace_id = str(
            payload.get(
                "trace_id",
                "unknown",
            )
        )

        safe_trace = "".join(
            char
            if char.isalnum()
            or char in {"-", "_"}
            else "_"
            for char in trace_id
        )

        destination = (
            self.root
            / (
                f"{_utc_stamp()}_"
                f"{safe_trace}_"
                "a000_shadow.json"
            )
        )

        destination.write_text(
            json.dumps(
                payload,
                ensure_ascii=False,
                indent=2,
                default=str,
            ),
            encoding="utf-8",
        )

        return destination