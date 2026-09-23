from pathlib import Path

path = Path(
    r"C:\KMITORA_UPDATED\Kmitora-main\backend\main_api\F1033_server.py"
)

text = path.read_text(encoding="utf-8")

# ------------------------------------------------------------
# Extend learning_store import
# ------------------------------------------------------------

old_import = (
    "from learning_store import "
    "persist_verified_learning"
)

new_import = (
    "from learning_store import "
    "get_learning_by_evidence, "
    "get_learning, "
    "list_learning, "
    "persist_verified_learning"
)

if old_import in text:
    text = text.replace(
        old_import,
        new_import,
        1,
    )

elif (
    "get_learning_by_evidence"
    not in text
):
    raise SystemExit(
        "FAIL - learning_store import anchor not found."
    )

# ------------------------------------------------------------
# Install GET route
# ------------------------------------------------------------

if 'if path == "/v1/learning":' not in text[
    text.find("def do_GET"):
    text.find("def do_POST")
]:

    route = r'''
        if path == "/v1/learning":
            raw_query = ""

            if "?" in self.path:
                raw_query = self.path.split(
                    "?",
                    1,
                )[1]

            query_values = {}

            for pair in raw_query.split("&"):
                pair = pair.strip()

                if not pair:
                    continue

                if "=" in pair:
                    key, value = pair.split(
                        "=",
                        1,
                    )
                else:
                    key, value = pair, ""

                query_values[
                    key.strip()
                ] = value.strip()

            evidence_id = (
                query_values.get(
                    "evidence_id",
                    "",
                )
            )

            learning_id = (
                query_values.get(
                    "learning_id",
                    "",
                )
            )

            if evidence_id:
                from urllib.parse import unquote

                evidence_id = unquote(
                    evidence_id
                )

                learning = (
                    get_learning_by_evidence(
                        evidence_id
                    )
                )

                if learning is None:
                    return self._send(
                        404,
                        envelope(
                            "verified_learning_lookup",
                            {
                                "message":
                                    "Verified learning not found",
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

                result = dict(learning)

                result[
                    "lookup_mode"
                ] = "BY_EVIDENCE"

                result[
                    "source_write_executed"
                ] = False

                result[
                    "target_write_executed"
                ] = False

                result[
                    "production_action_executed"
                ] = False

                return self._send(
                    200,
                    envelope(
                        "verified_learning_lookup",
                        result,
                    ),
                )

            if learning_id:
                from urllib.parse import unquote

                learning_id = unquote(
                    learning_id
                )

                learning = get_learning(
                    learning_id
                )

                if learning is None:
                    return self._send(
                        404,
                        envelope(
                            "verified_learning_lookup",
                            {
                                "message":
                                    "Verified learning not found",
                                "learning_id":
                                    learning_id,
                                "source_write_executed":
                                    False,
                                "target_write_executed":
                                    False,
                                "production_action_executed":
                                    False,
                            },
                        ),
                    )

                result = dict(learning)

                result[
                    "lookup_mode"
                ] = "BY_LEARNING_ID"

                result[
                    "source_write_executed"
                ] = False

                result[
                    "target_write_executed"
                ] = False

                result[
                    "production_action_executed"
                ] = False

                return self._send(
                    200,
                    envelope(
                        "verified_learning_lookup",
                        result,
                    ),
                )

            items = list_learning()

            return self._send(
                200,
                envelope(
                    "verified_learning_catalog",
                    {
                        "items": items,
                        "count": len(items),
                        "read_only": True,
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

    do_get = text.find(
        "    def do_GET(self)"
    )

    do_post = text.find(
        "    def do_POST(self)",
        do_get,
    )

    if do_get == -1 or do_post == -1:
        raise SystemExit(
            "FAIL - GET/POST method boundaries not found."
        )

    get_block = text[
        do_get:do_post
    ]

    anchor = '''        return self._send(
            404,
            envelope(
                "error",
                {"message": "not found"},
            ),
        )
'''

    if anchor not in get_block:
        raise SystemExit(
            "FAIL - final GET 404 anchor not found."
        )

    get_block = get_block.replace(
        anchor,
        route + anchor,
        1,
    )

    text = (
        text[:do_get]
        + get_block
        + text[do_post:]
    )

path.write_text(
    text,
    encoding="utf-8",
)

print(
    "PASS - GET /v1/learning installed."
)
