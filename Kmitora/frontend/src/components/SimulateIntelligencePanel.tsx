import type { ReactNode } from "react";

type UnknownRecord = Record<string, unknown>;

export interface SimulateIntelligencePanelProps {
  runtime: unknown;
  stage?: string;
}

interface MetricView {
  label: string;
  value: string;
  detail: string;
  evidence: string;
}

function asRecord(value: unknown): UnknownRecord | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  return value as UnknownRecord;
}

function humanize(value: unknown): string {
  if (value === null || value === undefined) {
    return "Not available";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }

  if (typeof value === "string") {
    return value.trim() || "Not available";
  }

  if (Array.isArray(value)) {
    return value.length > 0 ? `${value.length} item(s)` : "None";
  }

  return "Available";
}

function findByTerms(
  value: unknown,
  terms: string[],
  depth = 0,
): unknown {
  if (depth > 6) {
    return undefined;
  }

  const record = asRecord(value);

  if (!record) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = findByTerms(item, terms, depth + 1);

        if (found !== undefined) {
          return found;
        }
      }
    }

    return undefined;
  }

  for (const [key, nested] of Object.entries(record)) {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]+/g, " ");

    if (terms.some((term) => normalized.includes(term))) {
      return nested;
    }
  }

  for (const nested of Object.values(record)) {
    const found = findByTerms(nested, terms, depth + 1);

    if (found !== undefined) {
      return found;
    }
  }

  return undefined;
}

function describeMetric(
  runtime: unknown,
  label: string,
  terms: string[],
  detail: string,
): MetricView {
  const candidate = findByTerms(runtime, terms);

  const evidenceCandidate = findByTerms(
    candidate ?? runtime,
    ["evidence", "basis", "reason", "confidence"],
  );

  return {
    label,
    value: humanize(candidate),
    detail,
    evidence: humanize(evidenceCandidate),
  };
}

function MetricCard({ metric }: { metric: MetricView }) {
  return (
    <article className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {metric.label}
      </div>

      <div className="mt-2 text-2xl font-semibold">
        {metric.value}
      </div>

      <p className="mt-2 text-sm text-muted-foreground">
        {metric.detail}
      </p>

      <div className="mt-3 rounded-lg border bg-muted/30 p-2 text-xs">
        <span className="font-medium">Evidence: </span>
        {metric.evidence}
      </div>
    </article>
  );
}

function StatusItem({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2 text-sm text-muted-foreground">
      <span aria-hidden="true">•</span>
      <span>{children}</span>
    </li>
  );
}

export function SimulateIntelligencePanel({
  runtime,
  stage = "Simulate",
}: SimulateIntelligencePanelProps) {
  const zeroSurpriseCutover = describeMetric(
    runtime,
    "Zero-Surprise Cutover",
    ["zero surprise", "cutover simulation", "cutover", "simulation"],
    "Models the proposed transition path before any real execution or cutover action is permitted.",
  );

  const digitalTwinReplay = describeMetric(
    runtime,
    "Digital Twin Replay",
    ["digital twin replay", "digital twin", "replay"],
    "Replays connected business, application, data and dependency effects using available enterprise context.",
  );

  const blastRadius = describeMetric(
    runtime,
    "Blast-Radius Analysis",
    ["blast radius", "blast", "impact radius", "dependency impact"],
    "Surfaces potentially affected systems, APIs, data flows, business processes and controls.",
  );

  const rollbackReadiness = describeMetric(
    runtime,
    "Rollback Readiness",
    ["rollback readiness", "rollback", "recovery"],
    "Indicates whether the proposed transformation has sufficient reversibility and recovery preparation.",
  );

  const scenarioConfidence = describeMetric(
    runtime,
    "Scenario Confidence",
    ["scenario confidence", "confidence", "evidence confidence"],
    "Shows evidence-backed confidence in the simulation without treating simulated outcomes as verified facts.",
  );

  const runtimeRecord = asRecord(runtime);

  const authoritative = runtimeRecord?.authoritative === true;
  const executionAuthorized = runtimeRecord?.execution_authorized === true;
  const targetWriteAuthorized = runtimeRecord?.target_write_authorized === true;
  const productionAuthorized = runtimeRecord?.production_authorized === true;
  const cutoverAuthorized = runtimeRecord?.cutover_authorized === true;

  const authoritySafe =
    !authoritative &&
    !executionAuthorized &&
    !targetWriteAuthorized &&
    !productionAuthorized &&
    !cutoverAuthorized;

  return (
    <section
      aria-label="Simulate intelligence"
      className="space-y-4 rounded-2xl border bg-background p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {stage} · Advanced Intelligence
          </div>

          <h3 className="mt-1 text-lg font-semibold">
            Governed Transformation Simulation
          </h3>

          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Read-only simulation intelligence from the governed A000 runtime.
            This panel evaluates scenarios but does not execute migrations, write
            to targets, authorize production actions or initiate cutover.
          </p>
        </div>

        <div className="rounded-full border px-3 py-1 text-xs font-medium">
          {authoritySafe ? "Simulation Only · No Authority" : "Authority Review Required"}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <MetricCard metric={zeroSurpriseCutover} />
        <MetricCard metric={digitalTwinReplay} />
        <MetricCard metric={blastRadius} />
        <MetricCard metric={rollbackReadiness} />
        <MetricCard metric={scenarioConfidence} />
      </div>

      <div className="rounded-xl border bg-muted/20 p-4">
        <div className="text-sm font-semibold">
          Simulation governance boundary
        </div>

        <ul className="mt-2 space-y-1">
          <StatusItem>
            Simulation results remain advisory until validated and explicitly governed.
          </StatusItem>
          <StatusItem>
            No target write or migration execution is initiated by this panel.
          </StatusItem>
          <StatusItem>
            Production and cutover authority remain disabled.
          </StatusItem>
          <StatusItem>
            Missing simulation evidence is shown as unavailable rather than fabricated.
          </StatusItem>
        </ul>
      </div>
    </section>
  );
}
