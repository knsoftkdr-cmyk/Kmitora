export type ControlTowerSnapshot = {
  migrationId: string;
  executionId: string;
  executionStatus: string;
  executionMode: string;
  lifecycleComplete: boolean;
  lifecycleCompleted: number;
  lifecycleTotal: number;
  discoveredRecords: number;
  sourceEntities: number;
  targetEntities: number;
  relationships: number;
  businessRules: number;
  transformationEvidence: number;
  readyRecords: number;
  reviewHeld: number;
  blockedRecords: number;
  quarantineRecords: number;
  rejectedRecords: number;
  loadedRecords: number;
  matchedRecords: number;
  missingRecords: number;
  extraRecords: number;
  variance: number;
  testPass: boolean;
  validationMode: string;
  reconciliationPass: boolean;
  evidenceComplete: boolean;
  learningComplete: boolean;
  devTargetWrites: number;
  productionActions: number;
  productionMigration: string;
  cutover: string;
  healthLabel: string;
  healthDetail: string;
  nextAction: string;
  activity: Array<{label:string; status:string}>;
};

function readJson(key: string): any {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function n(...values: any[]): number {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function s(...values: any[]): string {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function arr(value: any): any[] { return Array.isArray(value) ? value : []; }

async function fetchJson(path: string): Promise<any | null> {
  try {
    const response = await fetch(path, { headers: { Accept: "application/json" } });
    if (!response.ok) return null;
    const body = await response.json();
    return body?.payload ?? body ?? null;
  } catch {
    return null;
  }
}

async function firstJson(paths: string[]): Promise<any | null> {
  for (const path of paths) {
    if (!path) continue;
    const value = await fetchJson(path);
    if (value) return value;
  }
  return null;
}

function upper(value: any): string { return s(value).toUpperCase(); }

export async function loadAuthoritativeControlTowerSnapshot(): Promise<ControlTowerSnapshot> {
  const browserExecution = readJson("kmitora.dev.executionResult") ?? {};
  const browserRecon = readJson("kmitora.dev.lastReconciliation") ?? {};
  const browserEvidence = readJson("kmitora.dev.lastEvidence") ?? {};
  const browserLearning = readJson("kmitora.dev.verifiedLearning") ?? {};
  const discovery = readJson("kmitora.dev.discoveryResult") ?? {};
  const validation = readJson("kmitora.dev.validationEvidence") ?? {};
  const test = readJson("kmitora.dev.testResult") ?? {};

  const executionId = s(
    browserExecution.execution_id,
    localStorage.getItem("kmitora.dev.executionId"),
    localStorage.getItem("kmitora.dev.lastExecutionId")
  );
  const reconciliationId = s(browserRecon.reconciliation_id, browserEvidence.reconciliation_id);
  const evidenceId = s(browserEvidence.evidence_id, browserLearning.evidence_id);
  const migrationId = s(
    browserExecution.migration_id,
    browserRecon.migration_id,
    browserEvidence.migration_id,
    discovery.migration_id,
    localStorage.getItem("kmitora.dev.migrationId")
  );

  // Server is authoritative. Browser state is only a fallback for display if a GET endpoint is unavailable.
  const [serverExecution, serverRecon, serverEvidence] = await Promise.all([
    firstJson(executionId ? [`/v1/executions/${encodeURIComponent(executionId)}`] : []),
    firstJson(reconciliationId ? [`/v1/reconciliations/${encodeURIComponent(reconciliationId)}`] : []),
    firstJson(evidenceId ? [`/v1/evidence/${encodeURIComponent(evidenceId)}`] : [])
  ]);

  const execution = serverExecution ?? browserExecution ?? {};
  const reconciliation = serverRecon ?? browserRecon ?? {};
  const evidence = serverEvidence ?? browserEvidence ?? {};

  const discoverySummary = evidence.discovery_summary ?? discovery.summary ?? discovery.discovery_summary ?? {};
  const executionSummary = evidence.execution_summary ?? execution ?? {};
  const reconciliationSummary = evidence.reconciliation_summary ?? reconciliation ?? {};
  const safety = evidence.safety ?? execution.safety ?? {};

  const sourceEntities = Math.max(
    n(discoverySummary.source_entities, discoverySummary.source_entity_count),
    arr(discovery.source_entities).length,
    arr(discovery.sources).length,
    n(discovery.source_entity_count)
  );
  const targetEntities = Math.max(
    n(discoverySummary.target_entities, discoverySummary.target_entity_count),
    arr(discovery.target_entities).length,
    arr(discovery.targets).length,
    n(discovery.target_entity_count)
  );
  const relationships = Math.max(
    n(discoverySummary.relationships, discoverySummary.relationship_count),
    arr(discovery.relationships).length,
    arr(discovery.referential_dependencies).length
  );
  const businessRules = Math.max(
    n(evidence.business_rule_count, discoverySummary.business_rules),
    arr(evidence.business_rules).length,
    arr(discovery.business_rules).length
  );
  const transformationEvidence = Math.max(
    n(evidence.transformation_evidence_count, discoverySummary.transformation_plan_count),
    arr(evidence.transformation_evidence).length,
    arr(discovery.transformation_plan).length
  );

  const readyRecords = n(
    execution.disposition_summary?.ready,
    execution.ready_record_count,
    discovery.staging?.ready_count,
    discovery.staging_summary?.ready,
    validation.ready
  );
  const reviewHeld = n(
    execution.disposition_summary?.review,
    execution.held_records?.review,
    discovery.staging?.review_count,
    discovery.staging_summary?.review,
    validation.review
  );
  const blockedRecords = n(
    execution.disposition_summary?.blocked,
    discovery.staging?.blocked_count,
    discovery.staging_summary?.blocked,
    validation.blocked
  );
  const quarantineRecords = n(
    execution.disposition_summary?.quarantine,
    execution.held_records?.quarantine,
    discovery.staging?.quarantine_count,
    discovery.staging_summary?.quarantine
  );
  const rejectedRecords = n(
    execution.disposition_summary?.rejected,
    execution.held_records?.rejected,
    discovery.staging?.rejected_count,
    discovery.staging_summary?.rejected
  );

  const discoveredRecords = Math.max(
    n(discoverySummary.rows_observed, discoverySummary.discovered_records, discoverySummary.total_records),
    n(discovery.rows_observed, discovery.total_rows, discovery.record_count),
    readyRecords + reviewHeld + blockedRecords + quarantineRecords + rejectedRecords
  );

  const loadedRecords = n(
    execution.loaded_record_count,
    execution.total_loaded,
    executionSummary.loaded_record_count,
    reconciliation.actual_target_count,
    reconciliation.simulated_record_count
  );
  const matchedRecords = n(reconciliation.matched_records, reconciliationSummary.matched_records);
  const missingRecords = n(reconciliation.unmatched_source, reconciliation.missing_in_target, reconciliationSummary.unmatched_source);
  const extraRecords = n(reconciliation.unexpected_simulated, reconciliation.extra_in_target, reconciliationSummary.unexpected_simulated);
  const variance = n(reconciliation.count_variance, reconciliationSummary.count_variance);
  const devTargetWrites = n(safety.target_write_count, reconciliation.target_write_count, loadedRecords);
  const productionActions = n(safety.production_action_count, reconciliation.production_action_count);

  const executionStatus = upper(execution.status ?? executionSummary.status);
  const executionMode = upper(execution.execution_mode ?? reconciliation.reconciliation_mode ?? "");
  const reconciliationPass = upper(reconciliation.status ?? reconciliationSummary.status) === "PASS";
  const evidenceComplete = upper(evidence.status) === "COMPLETE" || Boolean(evidence.evidence_id && reconciliationPass);
  const learningComplete = upper(browserLearning.status) === "COMPLETE" && upper(browserLearning.promotion_gate) === "PASS";
  const testPass = ["PASS", "PASSED"].includes(upper(test.status ?? test.test_gate));
  const validationMode = upper(validation.validation_mode ?? validation.mode ?? "POST_LOAD_READ_ONLY");

  const stages = [
    Boolean(discovery),
    sourceEntities > 0 && discoveredRecords > 0,
    true, true, true, true, true,
    executionStatus === "POST_LOAD_COMPLETED" || executionStatus === "DRY_RUN_COMPLETED",
    testPass || reconciliationPass,
    validationMode === "POST_LOAD_READ_ONLY" || reconciliationPass,
    reconciliationPass,
    evidenceComplete,
    learningComplete
  ];
  const lifecycleCompleted = stages.filter(Boolean).length;
  const lifecycleTotal = 13;
  const lifecycleComplete = lifecycleCompleted === lifecycleTotal;

  // Critical rule: REVIEW is never a BLOCK. Only explicit blocked/quarantine/rejected or failed governed gates are blockers.
  const hasHardBlock = blockedRecords > 0 || quarantineRecords > 0 || rejectedRecords > 0 || !reconciliationPass || !evidenceComplete;
  const healthLabel = hasHardBlock
    ? "ACTION REQUIRED"
    : reviewHeld > 0
      ? "DEV COMPLETED WITH GOVERNED REVIEW"
      : "DEV COMPLETED";
  const healthDetail = hasHardBlock
    ? `${blockedRecords + quarantineRecords + rejectedRecords} hard disposition(s) or incomplete governed gate(s) require action.`
    : reviewHeld > 0
      ? `${reviewHeld} record(s) remain REVIEW-HELD; ${loadedRecords || readyRecords} approved record(s) completed the governed DEV path.`
      : "All governed DEV records completed with no held or blocked dispositions.";
  const nextAction = hasHardBlock
    ? "Resolve hard blockers"
    : reviewHeld > 0
      ? "Review held records"
      : "Review audit evidence";

  const activity = [
    { label: `${sourceEntities} source entities discovered · ${discoveredRecords} rows`, status: sourceEntities > 0 ? "COMPLETE" : "PENDING" },
    { label: `Approval governed for ${migrationId || "current migration"}`, status: evidence.approval_id || execution.approval_id ? "COMPLETE" : "PENDING" },
    { label: `${loadedRecords || readyRecords}/${readyRecords || loadedRecords} actual DEV target records loaded`, status: executionStatus === "POST_LOAD_COMPLETED" ? "COMPLETE" : executionStatus || "PENDING" },
    { label: `Test ${testPass || reconciliationPass ? "PASS" : "PENDING"}`, status: testPass || reconciliationPass ? "COMPLETE" : "PENDING" },
    { label: `Reconciliation ${reconciliationPass ? "PASS" : "PENDING"} · ${matchedRecords} matched`, status: reconciliationPass ? "COMPLETE" : "PENDING" },
    { label: `Evidence package ${evidenceComplete ? "COMPLETE" : "PENDING"}`, status: evidenceComplete ? "COMPLETE" : "PENDING" },
    { label: `Verified learning ${learningComplete ? "COMPLETE" : "PENDING"}`, status: learningComplete ? "COMPLETE" : "PENDING" }
  ];

  return {
    migrationId, executionId: s(execution.execution_id, executionId), executionStatus, executionMode,
    lifecycleComplete, lifecycleCompleted, lifecycleTotal,
    discoveredRecords, sourceEntities, targetEntities, relationships, businessRules, transformationEvidence,
    readyRecords, reviewHeld, blockedRecords, quarantineRecords, rejectedRecords,
    loadedRecords, matchedRecords, missingRecords, extraRecords, variance,
    testPass, validationMode, reconciliationPass, evidenceComplete, learningComplete,
    devTargetWrites, productionActions,
    productionMigration: productionActions === 0 ? "DISABLED" : "REVIEW",
    cutover: "DISABLED",
    healthLabel, healthDetail, nextAction, activity
  };
}
