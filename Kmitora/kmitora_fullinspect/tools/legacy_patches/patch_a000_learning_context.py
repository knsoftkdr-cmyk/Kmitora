from pathlib import Path
import re

path = Path(
    r"C:\KMITORA_UPDATED\Kmitora-main\backend\main_api\F1033_server.py"
)

text = path.read_text(
    encoding="utf-8"
)

do_post = text.find(
    "    def do_POST(self)"
)

if do_post == -1:
    raise SystemExit(
        "FAIL - do_POST not found."
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

start = post_block.find(
    '        if path == "/v1/a000/messages":'
)

if start == -1:
    raise SystemExit(
        "FAIL - /v1/a000/messages route not found."
    )

next_route = post_block.find(
    "\n        if path == ",
    start + 10,
)

if next_route == -1:
    raise SystemExit(
        "FAIL - could not locate next POST route."
    )

old_block = post_block[
    start:next_route
]

new_block = r'''        if path == "/v1/a000/messages":
            message = str(
                data.get(
                    "message",
                    "",
                )
            ).strip()

            base_reply = agent_reply(
                message
            )

            try:
                learning_context = (
                    get_a000_learning_context(
                        message,
                        6,
                    )
                )
            except Exception as exc:
                learning_context = {
                    "query":
                        message,
                    "retrieval_mode":
                        "DETERMINISTIC_LEXICAL",
                    "context_items":
                        [],
                    "context_count":
                        0,
                    "regression_guards":
                        [],
                    "regression_count":
                        0,
                    "read_only":
                        True,
                    "retrieval_error":
                        str(exc),
                    "model_training_executed":
                        False,
                    "automatic_model_update":
                        False,
                    "source_write_executed":
                        False,
                    "target_write_executed":
                        False,
                    "production_action_executed":
                        False,
                }

            if isinstance(
                base_reply,
                dict,
            ):
                reply = dict(
                    base_reply
                )
            else:
                reply = {
                    "reply":
                        str(base_reply)
                }

            context_items = (
                learning_context.get(
                    "context_items",
                    [],
                )
            )

            regression_guards = (
                learning_context.get(
                    "regression_guards",
                    [],
                )
            )

            reply[
                "verified_learning_context"
            ] = {
                "used":
                    len(context_items) > 0,
                "retrieval_mode":
                    learning_context.get(
                        "retrieval_mode",
                        "DETERMINISTIC_LEXICAL",
                    ),
                "context_count":
                    len(context_items),
                "items":
                    context_items,
                "provenance_required":
                    True,
            }

            reply[
                "regression_context"
            ] = {
                "active":
                    len(
                        regression_guards
                    ) > 0,
                "guard_count":
                    len(
                        regression_guards
                    ),
                "guards":
                    regression_guards,
                "veto_on_failure":
                    True,
            }

            reply[
                "learning_safety"
            ] = {
                "read_only":
                    True,
                "model_training_executed":
                    False,
                "automatic_model_update":
                    False,
                "source_write_executed":
                    False,
                "target_write_executed":
                    False,
                "production_action_executed":
                    False,
            }

            reply[
                "reasoning_context"
            ] = {
                "base_agent":
                    "A000",
                "verified_knowledge_available":
                    len(context_items) > 0,
                "regression_guards_available":
                    len(
                        regression_guards
                    ) > 0,
                "knowledge_may_inform_response":
                    True,
                "automatic_execution":
                    False,
            }

            with _lock:
                _runtime_state[
                    "last_learning_context"
                ] = {
                    "query":
                        message,
                    "context_count":
                        len(context_items),
                    "regression_count":
                        len(
                            regression_guards
                        ),
                    "retrieval_mode":
                        learning_context.get(
                            "retrieval_mode",
                            "DETERMINISTIC_LEXICAL",
                        ),
                    "read_only":
                        True,
                }

                _runtime_state[
                    "last_agent_action"
                ] = (
                    "A000 response prepared "
                    "with verified learning context"
                )

            return self._send(
                200,
                envelope(
                    "a000_message",
                    reply,
                ),
            )
'''

post_block = (
    post_block[:start]
    + new_block
    + post_block[next_route:]
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
    "PASS - A000 message path now retrieves verified learning context."
)
