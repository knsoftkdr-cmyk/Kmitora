from pathlib import Path

path = Path(
    r"C:\KMITORA_UPDATED\Kmitora-main\backend\main_api\F1033_server.py"
)

text = path.read_text(encoding="utf-8")

old = '''            if evidence is None:
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
'''

new = '''            if evidence is None:
                evidence_path = (
                    Path(__file__).resolve().parent
                    / "runtime"
                    / "evidence"
                    / f"{evidence_id}.json"
                )

                if evidence_path.exists():
                    try:
                        recovered = json.loads(
                            evidence_path.read_text(
                                encoding="utf-8-sig"
                            )
                        )

                        if (
                            isinstance(recovered, dict)
                            and str(
                                recovered.get(
                                    "evidence_id",
                                    "",
                                )
                            ).strip()
                            == evidence_id
                        ):
                            evidence = recovered

                            with _lock:
                                evidence_store = (
                                    _runtime_state.setdefault(
                                        "evidence_packages",
                                        {},
                                    )
                                )

                                evidence_store[
                                    evidence_id
                                ] = dict(evidence)

                                _runtime_state[
                                    "last_evidence_id"
                                ] = evidence_id
                    except (
                        OSError,
                        ValueError,
                        json.JSONDecodeError,
                    ):
                        evidence = None

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
'''

if old not in text:
    raise SystemExit(
        "FAIL - exact learning evidence lookup block was not found."
    )

text = text.replace(old, new, 1)

path.write_text(
    text,
    encoding="utf-8",
)

print(
    "PASS - durable evidence recovery added to /v1/learning."
)
