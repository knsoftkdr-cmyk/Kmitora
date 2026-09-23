import type { ReactNode } from "react";

type UnknownRecord = Record<string, unknown>;

export interface PredictIntelligencePanelProps {
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

export function PredictIntelligencePanel({
  runtime,
  stage = "Predict",
}: PredictIntelligencePanelProps) {
  const migrationReadiness = describeMetric(
    runtime,
    "Migration Readiness",
    ["migration readiness", "readiness score", "readiness"],
    "Measures source-to-target preparedness across rules, mappings, quality, dependencies, validation and governance.",
  );

  const businessContinuity = describeMetric(
    runtime,
    "Business Continuity",
    ["business continuity", "continuity score", "continuity"],
    "Highlights operational continuity exposure before a proposed migration or transformation proceeds.",
  );

  const transformationRoi = describeMetric(
    runtime,
    "Transformation ROI",
    ["transformation roi", "roi score", "roi"],
    "Surfaces projected value, effort reduction, rework avoidance and risk-reduction signals when available.",
  );

  const risk = describeMetric(
    runtime,
    "Predictive Risk",
    ["risk score", "risk"],
    "Summarizes risk signals derived from the governed advanced-intelligence runtime.",
  );

  const confidence = describeMetric(
    runtime,
    "Confidence with Evidence",
    ["confidence score", "confidence"],
    "Confidence is presented as runtime evidence coverage rather than frontend-generated certainty.",
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
      aria-label="Predict intelligence"
      className="space-y-4 rounded-2xl border bg-background p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {stage} · Advanced Intelligence
          </div>

          <h3 className="mt-1 text-lg font-semibold">
            Transformation Predictive Intelligence
          </h3>

          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Read-only intelligence derived from the governed A000 advanced runtime.
            It informs lifecycle decisions but does not create execution, target-write,
            production or cutover authority.
          </p>
        </div>

        <div className="rounded-full border px-3 py-1 text-xs font-medium">
          {authoritySafe ? "Governed · Read Only" : "Authority Review Required"}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <MetricCard metric={migrationReadiness} />
        <MetricCard metric={businessContinuity} />
        <MetricCard metric={transformationRoi} />
        <MetricCard metric={risk} />
        <MetricCard metric={confidence} />
      </div>

      <div className="rounded-xl border bg-muted/20 p-4">
        <div className="text-sm font-semibold">
          Governance boundary
        </div>

        <ul className="mt-2 space-y-1">
          <StatusItem>
            Backend runtime remains the source of intelligence and authority.
          </StatusItem>
          <StatusItem>
            No production action or cutover control is exposed by this panel.
          </StatusItem>
          <StatusItem>
            No source or target write action is initiated by this panel.
          </StatusItem>
          <StatusItem>
            Missing intelligence is shown as unavailable rather than fabricated.
          </StatusItem>
        </ul>
      </div>
    </section>
  );
}
