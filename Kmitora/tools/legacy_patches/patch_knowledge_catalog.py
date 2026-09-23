from pathlib import Path

path = Path(
    r"C:\KMITORA_UPDATED\Kmitora-main\backend\main_api\F1033_server.py"
)

text = path.read_text(
    encoding="utf-8"
)

knowledge_import = (
    "from knowledge_store import "
    "get_a000_learning_context, "
    "index_verified_learning, "
    "list_knowledge, "
    "list_regressions\n"
)

if knowledge_import not in text:
    marker = "from learning_store import "

    pos = text.find(marker)

    if pos == -1:
        raise SystemExit(
            "FAIL - learning_store import not found."
        )

    end = text.find(
        "\n",
        pos,
    )

    text = (
        text[:end + 1]
        + knowledge_import
        + text[end + 1:]
    )


do_get = text.find(
    "    def do_GET(self)"
)

do_post = text.find(
    "    def do_POST(self)",
    do_get,
)

if do_get == -1 or do_post == -1:
    raise SystemExit(
        "FAIL - GET/POST boundaries not found."
    )

get_block = text[
    do_get:do_post
]

if (
    'if path == "/v1/knowledge":'
    not in get_block
):

    routes = r'''
        if path == "/v1/knowledge":
            items = list_knowledge()

            return self._send(
                200,
                envelope(
                    "reusable_knowledge_catalog",
                    {
                        "items": items,
                        "count": len(items),
                        "read_only": True,
                        "automatic_execution": False,
                        "source_write_executed": False,
                        "target_write_executed": False,
                        "production_action_executed": False,
                    },
                ),
            )

        if path == "/v1/regressions":
            items = list_regressions()

            return self._send(
                200,
                envelope(
                    "regression_catalog",
                    {
                        "items": items,
                        "count": len(items),
                        "read_only": True,
                        "automatic_execution": False,
                        "source_write_executed": False,
                        "target_write_executed": False,
                        "production_action_executed": False,
                    },
                ),
            )

        if path == "/v1/a000/learning-context":
            raw_query = ""

            if "?" in self.path:
                raw_query = self.path.split(
                    "?",
                    1,
                )[1]

            from urllib.parse import parse_qs

            params = parse_qs(
                raw_query
            )

            query = (
                params.get(
                    "q",
                    [""],
                )[0]
            )

            limit_raw = (
                params.get(
                    "limit",
                    ["20"],
                )[0]
            )

            try:
                limit = int(
                    limit_raw
                )
            except ValueError:
                limit = 20

            context = (
                get_a000_learning_context(
                    query,
                    limit,
                )
            )

            return self._send(
                200,
                envelope(
                    "a000_learning_context",
                    context,
                ),
            )

'''

    final_404 = '''        return self._send(
            404,
            envelope(
                "error",
                {"message": "not found"},
            ),
        )
'''

    if final_404 not in get_block:
        raise SystemExit(
            "FAIL - GET final 404 anchor not found."
        )

    get_block = (
        get_block.replace(
            final_404,
            routes + final_404,
            1,
        )
    )

    text = (
        text[:do_get]
        + get_block
        + text[do_post:]
    )


do_post = text.find(
    "    def do_POST(self)"
)

post_end = text.find(
    "    def do_PATCH(self)",
    do_post,
)

if post_end == -1:
    post_end = len(text)

post_block = text[
    do_post:post_end
]

if (
    '"/v1/learning/index": "learning_index"'
    not in post_block
):
    anchor = (
        '            "/v1/learning": '
        '"verified_learning",\n'
    )

    if anchor not in post_block:
        raise SystemExit(
            "FAIL - POST allowed map learning anchor not found."
        )

    post_block = (
        post_block.replace(
            anchor,
            anchor
            + '            "/v1/learning/index": '
              '"learning_index",\n',
            1,
        )
    )


if (
    'if path == "/v1/learning/index":'
    not in post_block
):

    learning_anchor = (
        '        if path == "/v1/learning":'
    )

    pos = post_block.find(
        learning_anchor
    )

    if pos == -1:
        raise SystemExit(
            "FAIL - POST /v1/learning anchor not found."
        )

    index_route = r'''
        if path == "/v1/learning/index":
            learning_id = str(
                data.get(
                    "learning_id",
                    "",
                )
            ).strip()

            if not learning_id:
                return self._send(
                    400,
                    envelope(
                        "learning_index_error",
                        {
                            "message":
                                "learning_id is required",
                            "source_write_executed":
                                False,
                            "target_write_executed":
                                False,
                            "production_action_executed":
                                False,
                        },
                    ),
                )

            learning = get_learning(
                learning_id
            )

            if learning is None:
                return self._send(
                    404,
                    envelope(
                        "learning_index_error",
                        {
                            "message":
                                "Durable learning package not found",
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

            try:
                result = (
                    index_verified_learning(
                        learning
                    )
                )
            except ValueError as exc:
                return self._send(
                    409,
                    envelope(
                        "learning_index_error",
                        {
                            "message": str(exc),
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

            with _lock:
                _runtime_state[
                    "last_learning_index"
                ] = dict(result)

                _runtime_state[
                    "last_agent_action"
                ] = (
                    "Verified learning indexed "
                    "into reusable knowledge: "
                    f"{learning_id}"
                )

            return self._send(
                200,
                envelope(
                    "learning_index",
                    result,
                ),
            )

'''

    post_block = (
        post_block[:pos]
        + index_route
        + post_block[pos:]
    )

text = (
    text[:do_post]
    + post_block
    + text[post_end:]
)

path.write_text(
    text,
    encoding="utf-8",
)

print(
    "PASS - Knowledge, regression and A000 retrieval routes installed."
)
