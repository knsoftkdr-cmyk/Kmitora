from pathlib import Path

core = Path(
    r"C:\KMITORA_UPDATED\Kmitora-main\backend\main_api\F1033_server.py"
)

text = core.read_text(encoding="utf-8")

import_line = (
    "from learning_store import "
    "persist_verified_learning\n"
)

if import_line not in text:
    marker = "from typing import Any\n"

    if marker not in text:
        raise SystemExit(
            "FAIL: typing import anchor not found."
        )

    text = text.replace(
        marker,
        marker + import_line,
        1,
    )


allowed_old = (
    '            "/v1/evidence": '
    '"evidence_candidate",\n'
)

allowed_new = (
    allowed_old
    + '            "/v1/learning": '
      '"verified_learning",\n'
)

if '"/v1/learning": "verified_learning"' not in text:
    if allowed_old not in text:
        raise SystemExit(
            "FAIL: allowed-route anchor not found."
        )

    text = text.replace(
        allowed_old,
        allowed_new,
        1,
    )


learning_route = r'''
        if path == "/v1/learning":
            evidence_id = str(
                data.get("evidence_id", "")
            ).strip()

            if not evidence_id:
                return self._send(
                    400,
                    envelope(
                        "verified_learning_error",
                        {
                            "message":
                                "evidence_id is required",
                            "source_write_executed":
                                False,
                            "target_write_executed":
                                False,
                            "production_action_executed":
                                False,
                        },
                    ),
                )

            with _lock:
                evidence_store = (
                    _runtime_state.get(
                        "evidence_packages",
                        {},
                    )
                )

                evidence = evidence_store.get(
                    evidence_id
                )

            if evidence is None:
                return self._send(
                    404,
                    envelope(
                        "verified_learning_error",
                        {
                            "message":
                                "Evidence package not found",
                            "evidence_id":
                                evidence_id,
                            "source_write_executed":
                                False,
                            "target_write_executed":
                                False,
                            "production_action_executed":
                                False,
                        },
                    ),
                )

            try:
                learning = (
                    persist_verified_learning(
                        dict(evidence)
                    )
                )
            except ValueError as exc:
                return self._send(
                    409,
                    envelope(
                        "verified_learning_error",
                        {
                            "message": str(exc),
                            "evidence_id":
                                evidence_id,
                            "source_write_executed":
                                False,
                            "target_write_executed":
                                False,
                            "production_action_executed":
                                False,
                        },
                    ),
                )

            learning_id = str(
                learning.get(
                    "learning_id",
                    "",
                )
            )

            with _lock:
                learning_store = (
                    _runtime_state.setdefault(
                        "verified_learning",
                        {},
                    )
                )

                learning_store[
                    learning_id
                ] = dict(learning)

                _runtime_state[
                    "last_learning_id"
                ] = learning_id

                _runtime_state[
                    "last_agent_action"
                ] = (
                    "Verified learning persisted: "
                    f"{learning_id}"
                )

            payload = learning

'''

if 'if path == "/v1/learning":' not in text:
    anchor = (
        "            payload = evidence_package\n"
        '        if path == "/v1/approvals":'
    )

    if anchor not in text:
        raise SystemExit(
            "FAIL: evidence-to-approval route anchor "
            "not found."
        )

    replacement = (
        "            payload = evidence_package\n"
        + learning_route
        + '        if path == "/v1/approvals":'
    )

    text = text.replace(
        anchor,
        replacement,
        1,
    )


core.write_text(
    text,
    encoding="utf-8",
)

print("PASS - Core /v1/learning route patched.")
