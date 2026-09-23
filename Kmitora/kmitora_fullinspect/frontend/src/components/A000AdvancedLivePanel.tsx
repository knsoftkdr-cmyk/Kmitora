import { useState } from "react";

import {
  postA000Message,
} from "../services/api";

import type {
  AdvancedRuntime,
} from "../types/advancedRuntime";

import AdvancedRuntimePanel from "./AdvancedRuntimePanel";


type A000LivePayload = {
  reply?: string;

  advanced_runtime?:
    | AdvancedRuntime
    | null;

  shadow_runtime?: unknown;
  orchestration_runtime?: unknown;

  verified_learning_context?: unknown;
  regression_context?: unknown;
  learning_safety?: unknown;

  [key: string]: unknown;
};


const DEFAULT_PROMPT =
  "Assess a safe DEV migration plan without production execution.";


type Props = {
  onAdvancedRuntime?: (runtime: AdvancedRuntime | null) => void;
};

export default function A000AdvancedLivePanel({
  onAdvancedRuntime,
}: Props) {
  const [prompt, setPrompt] =
    useState(DEFAULT_PROMPT);

  const [payload, setPayload] =
    useState<A000LivePayload | null>(
      null
    );

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);


  const submit = async () => {
    const message =
      prompt.trim();

    if (!message || loading) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response =
        await postA000Message(
          message
        );

      const nextPayload =
        (
          response?.payload ??
          response
        ) as A000LivePayload;

      setPayload(
        nextPayload
      );

      onAdvancedRuntime?.(
        nextPayload.advanced_runtime ?? null
      );
    }
    catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "A000 request failed."
      );
    }
    finally {
      setLoading(false);
    }
  };


  const advanced =
    payload?.advanced_runtime ??
    null;


  return (
    <section
      aria-label="A000 Live Enterprise Control"
      className="space-y-4"
    >
      <div className="rounded-lg border p-4">
        <div className="space-y-1">
          <div className="font-semibold">
            A000 Enterprise Control
          </div>

          <div className="text-sm opacity-70">
            Describe an enterprise migration,
            analysis, investigation or simulation objective.
            KMITORA returns planning and governance telemetry
            without granting execution authority.
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <textarea
            value={prompt}
            onChange={(event) =>
              setPrompt(
                event.target.value
              )
            }
            rows={3}
            placeholder="Describe what KMITORA should understand, analyze or simulate..."
            className="w-full rounded border p-3 text-sm"
          />

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={
                loading ||
                !prompt.trim()
              }
              onClick={submit}
              className="rounded border px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {loading
                ? "Analyzing..."
                : "Analyze with A000"}
            </button>

            <span className="text-xs opacity-60">
              Planning / simulation only
            </span>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-3 rounded border p-3 text-sm"
          >
            {error}
          </div>
        )}
      </div>

      {payload?.reply && (
        <div className="rounded-lg border p-4">
          <div className="text-sm font-medium">
            A000 Response
          </div>

          <div className="mt-2 whitespace-pre-wrap text-sm">
            {payload.reply}
          </div>
        </div>
      )}

      {payload && !advanced && (
        <div className="rounded-lg border p-4 text-sm">
          Advanced Intelligence telemetry was not returned
          for this response.
        </div>
      )}

      {advanced && (
        <AdvancedRuntimePanel
          runtime={advanced}
        />
      )}
    </section>
  );
}