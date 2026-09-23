type UnknownRecord = Record<string, unknown>;

export interface RecommendIntelligencePanelProps {
  runtime: unknown;
  stage?: string;
}

const GOVERNANCE_PATH = "RECOMMEND -> SIMULATE -> APPROVAL -> GOVERNED EXECUTE";

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

export function RecommendIntelligencePanel({
  runtime,
  stage = "Recommend",
}: RecommendIntelligencePanelProps) {
  const selfHealing = metric(runtime, ["self healing", "self_healing", "remediation", "repair"]);
  const recommendation = metric(runtime, ["recommendation", "recommended action", "remediation option"]);
  const riskPassport = metric(runtime, ["risk passport", "risk_passport", "change risk", "risk"]);
  const confidence = metric(runtime, ["confidence", "confidence score", "evidence confidence"]);
  const evidence = metric(runtime, ["evidence", "basis", "provenance"]);

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
    <section aria-label="Recommend intelligence" className="space-y-4 rounded-2xl border bg-background p-5">
      <div>
        <div className="text-xs uppercase text-muted-foreground">{stage} · Advanced Intelligence</div>
        <h3 className="mt-1 text-lg font-semibold">Governed Remediation Recommendations</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Governed self-healing guidance, change-risk assessment and evidence-backed recommendations.
        </p>
        <div className="mt-2 text-xs font-medium">
          {safe ? "Recommend Only - No Authority" : "Authority Review Required"}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <article className="rounded-xl border p-4"><div>Governed Self-Healing</div><strong>{selfHealing}</strong></article>
        <article className="rounded-xl border p-4"><div>Remediation Recommendation</div><strong>{recommendation}</strong></article>
        <article className="rounded-xl border p-4"><div>Change Risk Passport</div><strong>{riskPassport}</strong></article>
        <article className="rounded-xl border p-4"><div>Confidence with Evidence</div><strong>{confidence}</strong></article>
        <article className="rounded-xl border p-4"><div>Evidence Basis</div><strong>{evidence}</strong></article>
      </div>

      <div className="rounded-xl border p-4 text-sm text-muted-foreground">
        <div className="font-medium">Governance path</div>
        <div>{GOVERNANCE_PATH}</div>
        <div className="mt-2">This panel does not apply remediation directly.</div>
      </div>
    </section>
  );
}
