/* KMITORA PROVE_EVIDENCE_AUTHORITATIVE_SYNC_007
 * Server-first authoritative evidence projection for Operations workspaces.
 * Browser storage is identity/bootstrap metadata only, never evidence authority.
 */

function readJson<T = any>(key: string, fallback: T | null = null): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function unwrap(body: any): any {
  return body?.payload ?? body?.data ?? body ?? null;
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function same(left: unknown, right: unknown): boolean {
  const a = text(left);
  const b = text(right);
  return Boolean(a && b && a === b);
}

function sameMigration(candidate: any, migrationId: string): boolean {
  if (!candidate || !migrationId) return false;
  const id = text(
    candidate?.migration_id ??
      candidate?.migrationId ??
      candidate?.plan_id ??
      candidate?.planId
  );
  return !id || id === migrationId;
}

async function fetchJson(url: string): Promise<any | null> {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) return null;
    return unwrap(await response.json());
  } catch {
    return null;
  }
}

function normalizeDiscoverySummary(discovery: any): any | undefined {
  if (!discovery) return undefined;
  const summary = discovery?.summary ?? discovery?.discovery_summary ?? {};
  const staging = discovery?.target_staging_plan ?? {};
  const entities = Array.isArray(discovery?.entities) ? discovery.entities : [];
  const relationships = Array.isArray(discovery?.relationships) ? discovery.relationships : [];
  const rules = Array.isArray(discovery?.business_rules) ? discovery.business_rules : [];
  const transformations = Array.isArray(discovery?.transformation_plan)
    ? discovery.transformation_plan
    : [];
  const ready = Array.isArray(staging?.ready_records) ? staging.ready_records : [];
  const review = Array.isArray(staging?.review_records) ? staging.review_records : [];
  const quarantine = Array.isArray(staging?.quarantine_records) ? staging.quarantine_records : [];
  const rejected = Array.isArray(staging?.rejected_records) ? staging.rejected_records : [];

  const rowsObserved = Number(
    summary?.rows_observed ??
      summary?.record_count ??
      discovery?.rows_observed ??
      ready.length + review.length + quarantine.length + rejected.length
  );

  return {
    ...summary,
    migration_id: discovery?.migration_id ?? discovery?.migrationId,
    rows_observed: Number.isFinite(rowsObserved) ? rowsObserved : 0,
    source_entity_count: Number(
      summary?.source_entity_count ??
        summary?.source_entities ??
        entities.filter((item: any) =>
          String(item?.side ?? item?.role ?? "SOURCE").toUpperCase().includes("SOURCE")
        ).length
    ),
    relationship_count: Number(summary?.relationship_count ?? relationships.length),
    business_rule_count: Number(summary?.business_rule_count ?? rules.length),
    transformation_plan_count: Number(
      summary?.transformation_plan_count ?? transformations.length
    ),
    ready_records: ready.length,
    review_records: review.length,
    quarantine_records: quarantine.length,
    rejected_records: rejected.length,
  };
}

export async function loadAuthoritativeEvidenceProjection(): Promise<any | null> {
  const compact = readJson<any>("kmitora.dev.lastEvidence", null);
  const evidenceId = text(compact?.evidence_id ?? compact?.evidenceId);

  let evidence: any | null = null;

  // 1. Full A000 evidence package is authoritative.
  if (evidenceId) {
    evidence = await fetchJson(`/v1/evidence/${encodeURIComponent(evidenceId)}`);
  }

  // 2. A full in-memory/browser package is a compatibility fallback only.
  if (!evidence && compact) {
    const looksFull =
      Array.isArray(compact?.record_results) ||
      Array.isArray(compact?.transformation_evidence) ||
      Array.isArray(compact?.business_rules) ||
      Boolean(compact?.discovery_summary) ||
      Boolean(compact?.safety);
    if (looksFull) evidence = compact;
  }

  if (!evidence) return null;

  const migrationId = text(
    evidence?.migration_id ?? evidence?.migrationId ?? compact?.migration_id
  );
  const executionId = text(
    evidence?.execution_id ?? evidence?.executionId ?? compact?.execution_id
  );
  const reconciliationId = text(
    evidence?.reconciliation_id ??
      evidence?.reconciliationId ??
      compact?.reconciliation_id
  );
  const approvalId = text(
    evidence?.approval_id ?? evidence?.approvalId ?? compact?.approval_id
  );

  // Identity-bound proof enrichment. These sources may fill omitted summaries,
  // but may never replace the A000 evidence identity or artifact arrays.
  const discovery = readJson<any>("kmitora.dev.discoveryResult", null);
  const approval = readJson<any>("kmitora.dev.approvalRequest", null);
  const execution = readJson<any>("kmitora.dev.executionResult", null);
  const reconciliation = readJson<any>("kmitora.dev.lastReconciliation", null);

  const discoveryAligned = sameMigration(discovery, migrationId) ? discovery : null;
  const approvalAligned =
    approval &&
    sameMigration(approval, migrationId) &&
    (!approvalId ||
      same(approval?.approval_id ?? approval?.id, approvalId) ||
      !text(approval?.approval_id ?? approval?.id))
      ? approval
      : null;
  const executionAligned =
    execution &&
    sameMigration(execution, migrationId) &&
    (!executionId ||
      same(execution?.execution_id ?? execution?.id, executionId) ||
      !text(execution?.execution_id ?? execution?.id))
      ? execution
      : null;
  const reconciliationAligned =
    reconciliation &&
    sameMigration(reconciliation, migrationId) &&
    (!reconciliationId ||
      same(reconciliation?.reconciliation_id ?? reconciliation?.id, reconciliationId) ||
      !text(reconciliation?.reconciliation_id ?? reconciliation?.id))
      ? reconciliation
      : null;

  const authoritativeSafety = evidence?.safety ?? null;
  const derivedSafety = executionAligned
    ? {
        source_write_executed: executionAligned?.source_write_executed === true,
        target_write_executed:
          executionAligned?.target_write_executed === true ||
          Number(executionAligned?.target_write_count ?? executionAligned?.loaded_record_count ?? 0) > 0,
        target_write_count: Number(
          executionAligned?.target_write_count ?? executionAligned?.loaded_record_count ?? 0
        ),
        production_action_executed:
          executionAligned?.production_action_executed === true ||
          executionAligned?.production_executed === true,
        production_action_count: Number(
          executionAligned?.production_action_count ?? 0
        ),
        production_executed: executionAligned?.production_executed === true,
        production_migration:
          executionAligned?.production_migration ?? "DISABLED",
        cutover: executionAligned?.cutover ?? "DISABLED",
      }
    : undefined;

  return {
    ...evidence,
    evidence_id: evidence?.evidence_id ?? evidenceId,
    migration_id: evidence?.migration_id ?? migrationId,
    approval_id: evidence?.approval_id ?? approvalId,
    execution_id: evidence?.execution_id ?? executionId,
    reconciliation_id: evidence?.reconciliation_id ?? reconciliationId,
    discovery_summary:
      evidence?.discovery_summary ?? normalizeDiscoverySummary(discoveryAligned),
    approval_summary: evidence?.approval_summary ?? approvalAligned ?? undefined,
    execution_summary: evidence?.execution_summary ?? executionAligned ?? undefined,
    reconciliation_summary:
      evidence?.reconciliation_summary ?? reconciliationAligned ?? undefined,
    safety: authoritativeSafety ?? derivedSafety,
    // Never manufacture audit artifacts. Full arrays must come from A000 evidence.
    record_results: Array.isArray(evidence?.record_results)
      ? evidence.record_results
      : [],
    transformation_evidence: Array.isArray(evidence?.transformation_evidence)
      ? evidence.transformation_evidence
      : [],
    business_rules: Array.isArray(evidence?.business_rules)
      ? evidence.business_rules
      : [],
    _projection: {
      source: evidenceId ? "A000_SERVER" : "FULL_PACKAGE_FALLBACK",
      identity_bound: true,
      patch: "PROVE_EVIDENCE_AUTHORITATIVE_SYNC_007",
    },
  };
}
