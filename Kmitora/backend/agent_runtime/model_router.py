from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
import json
import os
import time
from typing import Any
from urllib import error, request


@dataclass(frozen=True)
class ModelExecutionResult:
    status: str
    provider: str
    model_id: str
    model_route: str
    model_version: str
    inference_executed: bool
    response_id: str
    output_text: str
    latency_ms: int
    prompt_hash: str
    context_hash: str
    error_type: str = ""
    error_message: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "model_provider": self.provider,
            "model_id": self.model_id,
            "model_route": self.model_route,
            "model_version": self.model_version,
            "inference_executed": self.inference_executed,
            "response_id": self.response_id,
            "output_text": self.output_text,
            "latency_ms": self.latency_ms,
            "prompt_hash": self.prompt_hash,
            "context_hash": self.context_hash,
            "error_type": self.error_type,
            "error_message": self.error_message,
        }


class KmitoraModelRouter:
    """
    Provider-neutral, read-only model evaluation router.

    #4H restrictions:
    - no source writes;
    - no target writes;
    - no production actions;
    - no cutover;
    - no approval authority;
    - model output is advisory/evaluation evidence only.
    """

    def __init__(self) -> None:
        self.provider = (
            os.getenv(
                "KMITORA_MODEL_PROVIDER",
                "OPENAI",
            )
            .strip()
            .upper()
        )

        self.route = (
            os.getenv(
                "KMITORA_MODEL_ROUTE",
                "BALANCED",
            )
            .strip()
            .upper()
        )

        self.model_id = (
            os.getenv(
                "KMITORA_MODEL_ID",
                os.getenv(
                    "OPENAI_MODEL",
                    "",
                ),
            )
            .strip()
        )

    @staticmethod
    def _hash(value: str) -> str:
        return sha256(
            value.encode("utf-8")
        ).hexdigest()

    @staticmethod
    def _extract_openai_text(
        payload: dict[str, Any],
    ) -> str:
        output_text = payload.get(
            "output_text"
        )

        if isinstance(
            output_text,
            str,
        ) and output_text.strip():
            return output_text.strip()

        texts: list[str] = []

        for output_item in payload.get(
            "output",
            [],
        ) or []:

            if not isinstance(
                output_item,
                dict,
            ):
                continue

            for content_item in output_item.get(
                "content",
                [],
            ) or []:

                if not isinstance(
                    content_item,
                    dict,
                ):
                    continue

                text = content_item.get(
                    "text"
                )

                if isinstance(
                    text,
                    str,
                ) and text.strip():
                    texts.append(
                        text.strip()
                    )

        return "\n".join(
            texts
        ).strip()

    def _not_configured(
        self,
        prompt: str,
        context: str,
        reason: str,
    ) -> ModelExecutionResult:

        return ModelExecutionResult(
            status="NOT_CONFIGURED",
            provider=self.provider,
            model_id=self.model_id,
            model_route=self.route,
            model_version="",
            inference_executed=False,
            response_id="",
            output_text="",
            latency_ms=0,
            prompt_hash=self._hash(prompt),
            context_hash=self._hash(context),
            error_type="MODEL_PROVIDER_NOT_CONFIGURED",
            error_message=reason,
        )

    def execute(
        self,
        *,
        prompt: str,
        context: str = "",
        max_output_tokens: int = 500,
    ) -> ModelExecutionResult:

        if self.provider != "OPENAI":
            return self._not_configured(
                prompt,
                context,
                (
                    "Provider is not currently implemented "
                    "for #4H.4."
                ),
            )

        api_key = os.getenv(
            "OPENAI_API_KEY",
            "",
        ).strip()

        if not api_key:
            return self._not_configured(
                prompt,
                context,
                "OPENAI_API_KEY is not configured.",
            )

        if not self.model_id:
            return self._not_configured(
                prompt,
                context,
                (
                    "KMITORA_MODEL_ID or OPENAI_MODEL "
                    "is not configured."
                ),
            )

        system_instruction = (
            "You are the read-only KMITORA model-evaluation reasoner. "
            "Use only the supplied verified context. "
            "Do not invent evidence. "
            "Do not authorize source writes, target writes, "
            "production actions, approvals, or cutover. "
            "If the supplied evidence is insufficient, answer "
            "INSUFFICIENT_EVIDENCE."
        )

        combined_input = (
            system_instruction
            + "\n\nVERIFIED CONTEXT:\n"
            + context
            + "\n\nTASK:\n"
            + prompt
        )

        body = {
            "model": self.model_id,
            "input": combined_input,
            "max_output_tokens": max_output_tokens,
        }

        encoded = json.dumps(
            body
        ).encode("utf-8")

        req = request.Request(
            "https://api.openai.com/v1/responses",
            data=encoded,
            method="POST",
            headers={
                "Authorization": (
                    "Bearer "
                    + api_key
                ),
                "Content-Type": "application/json",
            },
        )

        started = time.perf_counter()

        try:

            with request.urlopen(
                req,
                timeout=60,
            ) as response:

                raw = response.read()

            latency_ms = int(
                (
                    time.perf_counter()
                    - started
                )
                * 1000
            )

            payload = json.loads(
                raw.decode("utf-8")
            )

            actual_model = str(
                payload.get(
                    "model",
                    self.model_id,
                )
                or self.model_id
            )

            response_id = str(
                payload.get(
                    "id",
                    "",
                )
                or ""
            )

            output_text = (
                self._extract_openai_text(
                    payload
                )
            )

            return ModelExecutionResult(
                status="COMPLETED",
                provider="OPENAI",
                model_id=actual_model,
                model_route=self.route,
                model_version=actual_model,
                inference_executed=True,
                response_id=response_id,
                output_text=output_text,
                latency_ms=latency_ms,
                prompt_hash=self._hash(prompt),
                context_hash=self._hash(context),
            )

        except error.HTTPError as exc:

            latency_ms = int(
                (
                    time.perf_counter()
                    - started
                )
                * 1000
            )

            return ModelExecutionResult(
                status="ERROR",
                provider="OPENAI",
                model_id=self.model_id,
                model_route=self.route,
                model_version="",
                inference_executed=False,
                response_id="",
                output_text="",
                latency_ms=latency_ms,
                prompt_hash=self._hash(prompt),
                context_hash=self._hash(context),
                error_type="HTTP_ERROR",
                error_message=str(
                    exc.code
                ),
            )

        except Exception as exc:

            latency_ms = int(
                (
                    time.perf_counter()
                    - started
                )
                * 1000
            )

            return ModelExecutionResult(
                status="ERROR",
                provider="OPENAI",
                model_id=self.model_id,
                model_route=self.route,
                model_version="",
                inference_executed=False,
                response_id="",
                output_text="",
                latency_ms=latency_ms,
                prompt_hash=self._hash(prompt),
                context_hash=self._hash(context),
                error_type=type(exc).__name__,
                error_message=str(exc),
            )