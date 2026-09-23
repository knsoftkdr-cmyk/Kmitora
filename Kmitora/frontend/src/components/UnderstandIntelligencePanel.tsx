type UnknownRecord = Record<string, unknown>;

export interface UnderstandIntelligencePanelProps {
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

    if (terms.some((term) => normalized.includes(term))) {
      return nested;
    }
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

export function UnderstandIntelligencePanel({
  runtime,
  stage = "Understand",
}: UnderstandIntelligencePanelProps) {
  const enterpriseControl = metric(
    runtime,
    ["natural language", "enterprise control", "intent", "intent parser"],
  );

  const documentInterpretation = metric(
    runtime,
    ["document to execution", "document_to_execution", "document", "business requirement"],
  );

  const enterpriseMemory = metric(
    runtime,
    ["enterprise memory", "memory", "verified learning", "context"],
  );

  const businessTechnicalIntent = metric(
    runtime,
    ["business intent", "technical intent", "intent", "understanding"],
  );

  const provenance = metric(
    runtime,
    ["provenance", "evidence", "source evidence", "evidence basis"],
  );

  const confidence = metric(
    runtime,
    ["confidence", "confidence score", "evidence confidence"],
  );

  const isolation = findByTerms(
    runtime,
    ["tenant isolation", "memory isolation", "tenant", "isolation"],
  );

  const isolationStatus =
    isolation === undefined
      ? "Not evidenced in current runtime"
      : humanize(isolation);

  const runtimeRecord = asRecord(runtime);

  const executionAuthorized = runtimeRecord?.execution_authorized === true;
  const targetWriteAuthorized = runtimeRecord?.target_write_authorized === true;
  const productionAuthorized = runtimeRecord?.production_authorized === true;
  const cutoverAuthorized = runtimeRecord?.cutover_authorized === true;

  const authoritySafe =
    !executionAuthorized &&
    !targetWriteAuthorized &&
    !productionAuthorized &&
    !cutoverAuthorized;

  return (
    <section
      aria-label="Understand intelligence"
      className="space-y-4 rounded-2xl border bg-background p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {stage} · Advanced Intelligence
          </div>

          <h3 className="mt-1 text-lg font-semibold">
            Enterprise Context Understanding
          </h3>

          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Interprets enterprise intent, documents, business context and technical context
            before downstream discovery or transformation decisions.
          </p>
        </div>

        <div className="rounded-full border px-3 py-1 text-xs font-medium">
          {authoritySafe ? "Understand Only - No Authority" : "Authority Review Required"}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <article className="rounded-xl border p-4">
          <div className="text-xs uppercase text-muted-foreground">Natural-Language Enterprise Control</div>
          <strong className="mt-2 block">{enterpriseControl}</strong>
        </article>

        <article className="rounded-xl border p-4">
          <div className="text-xs uppercase text-muted-foreground">Document-to-Execution Interpretation</div>
          <strong className="mt-2 block">{documentInterpretation}</strong>
        </article>

        <article className="rounded-xl border p-4">
          <div className="text-xs uppercase text-muted-foreground">Enterprise Memory</div>
          <strong className="mt-2 block">{enterpriseMemory}</strong>
        </article>

        <article className="rounded-xl border p-4">
          <div className="text-xs uppercase text-muted-foreground">Business + Technical Intent</div>
          <strong className="mt-2 block">{businessTechnicalIntent}</strong>
        </article>

        <article className="rounded-xl border p-4">
          <div className="text-xs uppercase text-muted-foreground">Evidence Provenance</div>
          <strong className="mt-2 block">{provenance}</strong>
        </article>

        <article className="rounded-xl border p-4">
          <div className="text-xs uppercase text-muted-foreground">Confidence</div>
          <strong className="mt-2 block">{confidence}</strong>
        </article>
      </div>

      <div className="rounded-xl border bg-muted/20 p-4">
        <div className="text-sm font-semibold">Memory / tenant isolation evidence</div>
        <div className="mt-1 text-sm text-muted-foreground">{isolationStatus}</div>
        <div className="mt-2 text-xs text-muted-foreground">
          Isolation is not presented as proven unless it is explicitly evidenced by the live runtime.
        </div>
      </div>
    </section>
  );
}
