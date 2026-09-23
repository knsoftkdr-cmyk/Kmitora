type UnknownRecord = Record<string, unknown>;

export interface DiscoverIntelligencePanelProps {
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

export function DiscoverIntelligencePanel({
  runtime,
  stage = "Discover",
}: DiscoverIntelligencePanelProps) {
  const architectureDrift = metric(
    runtime,
    ["architecture drift", "drift", "architecture"],
  );

  const legacyLogic = metric(
    runtime,
    ["legacy logic", "legacy", "archaeologist", "business rule"],
  );

  const toolAgnostic = metric(
    runtime,
    ["tool agnostic", "tool_agnostic", "agnostic", "compatibility"],
  );

  const discovery = metric(
    runtime,
    ["system discovery", "data discovery", "dependency discovery", "dependency", "discovery"],
  );

  const digitalTwin = metric(
    runtime,
    ["digital twin", "knowledge graph", "dependency graph"],
  );

  const provenance = metric(
    runtime,
    ["provenance", "evidence", "source evidence", "evidence basis"],
  );

  const confidence = metric(
    runtime,
    ["confidence", "confidence score", "evidence confidence"],
  );

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
      aria-label="Discover intelligence"
      className="space-y-4 rounded-2xl border bg-background p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {stage} · Advanced Intelligence
          </div>

          <h3 className="mt-1 text-lg font-semibold">
            Enterprise Discovery Intelligence
          </h3>

          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Discovers architecture, legacy logic, systems, data and dependencies while
            preserving evidence and avoiding assumptions unsupported by runtime context.
          </p>
        </div>

        <div className="rounded-full border px-3 py-1 text-xs font-medium">
          {authoritySafe ? "Discovery Only - No Authority" : "Authority Review Required"}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <article className="rounded-xl border p-4">
          <div className="text-xs uppercase text-muted-foreground">Architecture Drift</div>
          <strong className="mt-2 block">{architectureDrift}</strong>
        </article>

        <article className="rounded-xl border p-4">
          <div className="text-xs uppercase text-muted-foreground">Legacy Logic Archaeologist</div>
          <strong className="mt-2 block">{legacyLogic}</strong>
        </article>

        <article className="rounded-xl border p-4">
          <div className="text-xs uppercase text-muted-foreground">Tool-Agnostic Assurance</div>
          <strong className="mt-2 block">{toolAgnostic}</strong>
        </article>

        <article className="rounded-xl border p-4">
          <div className="text-xs uppercase text-muted-foreground">System / Data / Dependency Discovery</div>
          <strong className="mt-2 block">{discovery}</strong>
        </article>

        <article className="rounded-xl border p-4">
          <div className="text-xs uppercase text-muted-foreground">Digital Twin / Knowledge Context</div>
          <strong className="mt-2 block">{digitalTwin}</strong>
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

      <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
        Discovery is evidence-driven. Missing Digital Twin or knowledge-graph signals are
        displayed as unavailable rather than inferred or fabricated.
      </div>
    </section>
  );
}
