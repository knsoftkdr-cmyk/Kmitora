type UnknownRecord = Record<string, unknown>;

export interface DiagnoseIntelligencePanelProps {
  runtime: unknown;
  stage?: string;
}

function asRecord(value: unknown): UnknownRecord | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as UnknownRecord;
}

function humanize(value: unknown): string {
  if (value === null || value === undefined) return "Not available";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value.trim() || "Not available";
  if (Array.isArray(value)) return value.length > 0 ? `${value.length} item(s)` : "None";
  return "Available";
}

function findByTerms(value: unknown, terms: string[], depth = 0): unknown {
  if (depth > 6) return undefined;

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findByTerms(item, terms, depth + 1);
      if (found !== undefined) return found;
    }
    return undefined;
  }

  const record = asRecord(value);
  if (!record) return undefined;

  for (const [key, nested] of Object.entries(record)) {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]+/g, " ");
    if (terms.some((term) => normalized.includes(term))) return nested;
  }

  for (const nested of Object.values(record)) {
    const found = findByTerms(nested, terms, depth + 1);
    if (found !== undefined) return found;
  }

  return undefined;
}

function metric(runtime: unknown, terms: string[]): string {
  return humanize(findByTerms(runtime, terms));
}

export function DiagnoseIntelligencePanel({
  runtime,
  stage = "Diagnose",
}: DiagnoseIntelligencePanelProps) {
  const rootCause = metric(runtime, ["root cause", "root_cause", "rca", "causal"]);
  const dependencyRca = metric(runtime, ["dependency rca", "dependency", "dependencies", "impact"]);
  const exceptionExplanation = metric(runtime, ["exception", "explanation", "reason", "diagnosis"]);
  const causalEvidence = metric(runtime, ["causal evidence", "evidence", "provenance", "basis"]);
  const confidence = metric(runtime, ["confidence", "confidence score", "evidence confidence"]);

  const runtimeRecord = asRecord(runtime);
  const executionAuthorized = runtimeRecord?.execution_authorized === true;
  const targetWriteAuthorized = runtimeRecord?.target_write_authorized === true;
  const productionAuthorized = runtimeRecord?.production_authorized === true;
  const cutoverAuthorized = runtimeRecord?.cutover_authorized === true;

  const safe =
    !executionAuthorized &&
    !targetWriteAuthorized &&
    !productionAuthorized &&
    !cutoverAuthorized;

  return (
    <section aria-label="Diagnose intelligence" className="space-y-4 rounded-2xl border bg-background p-5">
      <div>
        <div className="text-xs uppercase text-muted-foreground">{stage} · Advanced Intelligence</div>
        <h3 className="mt-1 text-lg font-semibold">Autonomous Root-Cause Diagnosis</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Root-cause, dependency and exception intelligence from governed runtime evidence.
        </p>
        <div className="mt-2 text-xs font-medium">
          {safe ? "Diagnosis Only - No Authority" : "Authority Review Required"}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <article className="rounded-xl border p-4"><div>Autonomous RCA</div><strong>{rootCause}</strong></article>
        <article className="rounded-xl border p-4"><div>Dependency RCA</div><strong>{dependencyRca}</strong></article>
        <article className="rounded-xl border p-4"><div>Exception Explainer</div><strong>{exceptionExplanation}</strong></article>
        <article className="rounded-xl border p-4"><div>Causal Evidence</div><strong>{causalEvidence}</strong></article>
        <article className="rounded-xl border p-4"><div>Confidence</div><strong>{confidence}</strong></article>
      </div>

      <div className="rounded-xl border p-4 text-sm text-muted-foreground">
        Diagnosis is advisory only. No execution, target-write, production or cutover authority is granted.
      </div>
    </section>
  );
}
