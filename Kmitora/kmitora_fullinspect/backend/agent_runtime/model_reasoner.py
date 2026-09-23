from __future__ import annotations

from typing import Any

from .model_router import (
    KmitoraModelRouter,
    ModelExecutionResult,
)


class KmitoraModelReasoner:
    """
    Read-only semantic model evaluator.

    It does not execute KMITORA tools and does not grant authority.
    """

    def __init__(
        self,
        router: KmitoraModelRouter | None = None,
    ) -> None:
        self.router = (
            router
            if router is not None
            else KmitoraModelRouter()
        )

    @staticmethod
    def build_context(
        items: list[dict[str, Any]],
    ) -> str:

        blocks: list[str] = []

        for item in items:

            if not isinstance(
                item,
                dict,
            ):
                continue

            text = str(
                item.get(
                    "text",
                    "",
                )
                or ""
            ).strip()

            knowledge_id = str(
                item.get(
                    "knowledge_id",
                    "",
                )
                or ""
            )

            evidence_id = str(
                item.get(
                    "evidence_id",
                    "",
                )
                or ""
            )

            if not text:
                continue

            blocks.append(
                (
                    "knowledge_id="
                    + knowledge_id
                    + "\n"
                    + "evidence_id="
                    + evidence_id
                    + "\n"
                    + "text="
                    + text
                )
            )

        return "\n\n".join(
            blocks
        )

    def evaluate(
        self,
        *,
        prompt: str,
        items: list[dict[str, Any]],
    ) -> ModelExecutionResult:

        context = self.build_context(
            items
        )

        return self.router.execute(
            prompt=prompt,
            context=context,
            max_output_tokens=500,
        )