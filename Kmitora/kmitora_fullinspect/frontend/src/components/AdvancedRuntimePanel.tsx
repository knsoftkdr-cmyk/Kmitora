import { useMemo, useState } from "react";

import type {
  AdvancedRuntime,
} from "../types/advancedRuntime";

import {
  advancedRuntimeHasBlockers,
  advancedRuntimeIsReadOnly,
  summarizeAdvancedAuthority,
} from "../types/advancedRuntime";

interface AdvancedRuntimePanelProps {
  runtime?: AdvancedRuntime | null;
  compact?: boolean;
}

const boolText = (value?: boolean) =>
  value === true ? "YES" : "NO";

const safeText = (
  value: string | null | undefined,
  fallback = "Not available"
) => {
  const cleaned = String(value ?? "").trim();
  return cleaned.length > 0 ? cleaned : fallback;
};

export function AdvancedRuntimePanel({
  runtime,
  compact = false,
}: AdvancedRuntimePanelProps) {
  const [showDetails, setShowDetails] =
    useState(false);

  const authority = useMemo(
    () => summarizeAdvancedAuthority(runtime),
    [runtime]
  );

  const readOnly = useMemo(
    () => advancedRuntimeIsReadOnly(runtime),
    [runtime]
  );

  const hasBlockers = useMemo(
    () => advancedRuntimeHasBlockers(runtime),
    [runtime]
  );

  if (!runtime) {
    return (
      <section
        aria-label="KMITORA Advanced Intelligence"
        className="rounded-lg border p-4"
      >
        <div className="font-semibold">
          Advanced Intelligence
        </div>

        <div className="mt-1 text-sm opacity-70">
          No Advanced Intelligence telemetry is available for this response.
        </div>
      </section>
    );
  }

  const steps =
    runtime.migration_plan?.steps ?? [];

  const blockers =
    runtime.blockers ?? [];

  return (
    <section
      aria-label="KMITORA Advanced Intelligence"
      className="rounded-lg border p-4 space-y-4"
    >
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">
            Advanced Intelligence
          </h3>

          <span className="rounded border px-2 py-0.5 text-xs">
            {safeText(runtime.mode, "UNKNOWN")}
          </span>

          <span className="rounded border px-2 py-0.5 text-xs">
            {readOnly ? "READ ONLY" : "AUTHORITY PRESENT"}
          </span>
        </div>

        <p className="text-sm opacity-70">
          A000 enterprise-intelligence planning, safety and migration telemetry.
        </p>
      </header>

      <div
        className={
          compact
            ? "grid grid-cols-2 gap-3"
            : "grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        }
      >
        <Metric
          label="Route"
          value={safeText(runtime.route)}
        />

        <Metric
          label="Environment"
          value={safeText(runtime.environment)}
        />

        <Metric
          label="Agent"
          value={safeText(runtime.agent_id)}
        />

        <Metric
          label="Safety"
          value={safeText(
            runtime.safety?.decision
          )}
        />
      </div>

      {runtime.intent && (
        <div className="rounded border p-3">
          <div className="text-sm font-medium">
            Enterprise Intent
          </div>

          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <KeyValue
              label="Action"
              value={safeText(
                runtime.intent.action
              )}
            />

            <KeyValue
              label="Requested environment"
              value={safeText(
                runtime.intent
                  .requested_environment
              )}
            />

            <KeyValue
              label="Simulation required"
              value={boolText(
                runtime.intent
                  .requires_simulation
              )}
            />

            <KeyValue
              label="Approval required"
              value={boolText(
                runtime.intent
                  .requires_approval
              )}
            />
          </div>

          {runtime.intent.objective && (
            <div className="mt-3">
              <div className="text-xs opacity-60">
                Objective
              </div>

              <div className="mt-1 text-sm">
                {runtime.intent.objective}
              </div>
            </div>
          )}
        </div>
      )}

      {steps.length > 0 && (
        <div className="rounded border p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">
                Prompt-to-Migration Plan
              </div>

              <div className="text-xs opacity-60">
                {steps.length} governed stages
              </div>
            </div>

            <div className="text-xs">
              {safeText(
                runtime.migration_plan
                  ?.migration_id,
                "Plan generated"
              )}
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {steps.map(
              (step, index) => (
                <div
                  key={
                    step.step_id ??
                    `${step.stage}-${index}`
                  }
                  className="rounded border p-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs opacity-60">
                        {safeText(
                          step.step_id,
                          `STEP-${index + 1}`
                        )}
                      </div>

                      <div className="text-sm font-medium">
                        {safeText(
                          step.stage
                        )}
                      </div>
                    </div>

                    <div className="text-xs">
                      {step.write_capable
                        ? "WRITE-CAPABLE STAGE"
                        : "READ / PLAN"}
                    </div>
                  </div>

                  <div className="mt-1 text-sm opacity-80">
                    {safeText(step.name)}
                  </div>

                  {step.approval_required && (
                    <div className="mt-2 text-xs">
                      Approval required
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        </div>
      )}

      {hasBlockers && (
        <div className="rounded border p-3">
          <div className="text-sm font-medium">
            Governance Blockers
          </div>

          <ul className="mt-2 space-y-1 text-sm">
            {blockers.map(
              (blocker) => (
                <li
                  key={blocker}
                  className="break-words"
                >
                  â€¢ {blocker}
                </li>
              )
            )}
          </ul>
        </div>
      )}

      <div className="rounded border p-3">
        <div className="text-sm font-medium">
          Authority Boundary
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Authority
            label="Authoritative"
            enabled={authority.authoritative}
          />

          <Authority
            label="Execution"
            enabled={
              authority.executionAuthorized
            }
          />

          <Authority
            label="Source write"
            enabled={
              authority.sourceWriteAuthorized
            }
          />

          <Authority
            label="Target write"
            enabled={
              authority.targetWriteAuthorized
            }
          />

          <Authority
            label="Production"
            enabled={
              authority.productionAuthorized
            }
          />

          <Authority
            label="Cutover"
            enabled={
              authority.cutoverAuthorized
            }
          />
        </div>

        <div className="mt-3 text-xs opacity-70">
          This panel displays backend authority only.
          It does not grant execution permissions.
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <KeyValue
          label="Trace"
          value={safeText(runtime.trace_id)}
        />

        <KeyValue
          label="Task"
          value={safeText(runtime.task_id)}
        />

        <KeyValue
          label="Bridge"
          value={safeText(runtime.bridge)}
        />

        <KeyValue
          label="Model execution"
          value={boolText(
            runtime.model_execution
          )}
        />

        <KeyValue
          label="Tool execution"
          value={boolText(
            runtime.tool_execution
          )}
        />

        <KeyValue
          label="Reply replaced"
          value={boolText(
            runtime.reply_replaced
          )}
        />
      </div>

      <div>
        <button
          type="button"
          className="rounded border px-3 py-1.5 text-sm"
          onClick={() =>
            setShowDetails(
              (current) => !current
            )
          }
        >
          {showDetails
            ? "Hide runtime evidence"
            : "View runtime evidence"}
        </button>

        {showDetails && (
          <pre className="mt-3 max-h-96 overflow-auto rounded border p-3 text-xs">
            {JSON.stringify(
              runtime,
              null,
              2
            )}
          </pre>
        )}
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded border p-3">
      <div className="text-xs opacity-60">
        {label}
      </div>

      <div className="mt-1 break-words text-sm font-medium">
        {value}
      </div>
    </div>
  );
}

function KeyValue({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="text-xs opacity-60">
        {label}
      </div>

      <div className="mt-0.5 break-words text-sm">
        {value}
      </div>
    </div>
  );
}

function Authority({
  label,
  enabled,
}: {
  label: string;
  enabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded border px-3 py-2 text-sm">
      <span>
        {label}
      </span>

      <span className="font-medium">
        {enabled ? "AUTHORIZED" : "NONE"}
      </span>
    </div>
  );
}

export default AdvancedRuntimePanel;