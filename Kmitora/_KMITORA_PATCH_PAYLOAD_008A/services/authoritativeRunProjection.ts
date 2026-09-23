import { loadAuthoritativeEvidenceProjection } from "./authoritativeEvidenceProjection";

export type AuthoritativeRunProjection = {
  migrationId: string;
  approvalId: string;
  executionId: string;
  reconciliationId: string;
  evidenceId: string;
  learningId: string;
  lifecycleComplete: boolean;
  lifecycleCompletedStages: number;
  lifecycleTotalStages: number;
  discoveredRecords: number;
  sourceEntities: number;
  readyRecords: number;
  reviewHeld: number;
  blockedRecords: number;
  quarantineRecords: number;
  rejectedRecords: number;
  executionStatus: string;
  executionMode: string;
  devTargetWrites: number;
  testStatus: string;
  validationMode: string;
  reconciliationStatus: string;
  matchedRecords: number;
  countVariance: number;
  evidenceStatus: string;
  evidenceArtifacts: number;
  transformationEvidence: number;
  businessRules: number;
  learningStatus: string;
  productionActions: number;
  productionMigration: string;
  cutover: string;
  identityAligned: boolean;
  loadedAt: string;
};

function readJson<T = any>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function txt(value: unknown): string {
  return String(value ?? "").trim();
}

function num(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function statusOf(value: any, fallback = "NOT AVAILABLE"): string {
  return txt(value?.status ?? value?.test_gate ?? value?.result ?? value) || fallback;
}

export async function loadAuthoritativeRunProjection(): Promise<AuthoritativeRunProjection | null> {
  const evidence = await loadAuthoritativeEvidenceProjection();
  if (!evidence) return null;

  const compactExecution = readJson<any>("kmitora.dev.executionResult");
  const compactTest = readJson<any>("kmitora.dev.testResult");
  const compactValidation = readJson<any>("kmitora.dev.validationEvidence");
  const learning = readJson<any>("kmitora.dev.verifiedLearning");

  const discovery = evidence?.discovery_summary ?? {};
  const execution = evidence?.execution_summary ?? compactExecution ?? {};
  const reconciliation = evidence?.reconciliation_summary ?? {};
  const safety = evidence?.safety ?? {};

  const migrationId = txt(evidence?.migration_id ?? execution?.migration_id);
  const approvalId = txt(evidence?.approval_id ?? evidence?.approval_summary?.approval_id ?? evidence?.approval_summary?.id);
  const executionId = txt(evidence?.execution_id ?? execution?.execution_id ?? execution?.id);
  const reconciliationId = txt(evidence?.reconciliation_id ?? reconciliation?.reconciliation_id ?? reconciliation?.id);
  const evidenceId = txt(evidence?.evidence_id);
  const learningId = txt(learning?.learning_id);

  const learningEvidenceId = txt(learning?.evidence_id);
  const learningExecutionId = txt(learning?.execution_id);
  const learningMigrationId = txt(learning?.migration_id);
  const identityAligned = Boolean(
    evidenceId &&
      (!learningEvidenceId || learningEvidenceId === evidenceId) &&
      (!learningExecutionId || learningExecutionId === executionId) &&
      (!learningMigrationId || learningMigrationId === migrationId)
  );

  const learningComplete =
    String(learning?.status ?? "").toUpperCase() === "COMPLETE" &&
    String(learning?.promotion_gate ?? "").toUpperCase() === "PASS" &&
    num(learning?.promotion_progress, 0) === 100 &&
    identityAligned;

  const readyRecords = num(
    discovery?.ready_records,
    num(execution?.loaded_record_count, num(execution?.success_count, 0))
  );
  const reviewHeld = num(
    discovery?.review_records,
    num(execution?.review_held_count, num(execution?.held_records?.review, 0))
  );
  const quarantineRecords = num(
    discovery?.quarantine_records,
    num(execution?.quarantine_held_count, num(execution?.held_records?.quarantine, 0))
  );
  const rejectedRecords = num(
    discovery?.rejected_records,
    num(execution?.rejected_held_count, num(execution?.held_records?.rejected, 0))
  );
  const blockedRecords = num(discovery?.blocked_records, quarantineRecords + rejectedRecords);

  const recordResults = Array.isArray(evidence?.record_results) ? evidence.record_results : [];
  const transformationEvidence = Array.isArray(evidence?.transformation_evidence)
    ? evidence.transformation_evidence
    : [];
  const businessRules = Array.isArray(evidence?.business_rules) ? evidence.business_rules : [];

  const devTargetWrites = num(
    safety?.target_write_count,
    num(execution?.target_write_count, num(execution?.loaded_record_count, recordResults.length))
  );
  const productionActions = num(safety?.production_action_count, 0);

  const reconciliationStatus = statusOf(
    reconciliation?.status ?? reconciliation?.result ?? evidence?.reconciliation_status,
    "NOT AVAILABLE"
  ).toUpperCase();
  const matchedRecords = num(
    reconciliation?.matched_count ?? reconciliation?.matched_records,
    reconciliationStatus === "PASS" ? devTargetWrites : 0
  );
  const countVariance = num(reconciliation?.count_variance ?? reconciliation?.variance, 0);

  return {
    migrationId,
    approvalId,
    executionId,
    reconciliationId,
    evidenceId,
    learningId,
    lifecycleComplete: learningComplete,
    lifecycleCompletedStages: learningComplete ? 13 : 12,
    lifecycleTotalStages: 13,
    discoveredRecords: num(discovery?.rows_observed ?? discovery?.record_count, readyRecords + reviewHeld + quarantineRecords + rejectedRecords),
    sourceEntities: num(discovery?.source_entity_count ?? discovery?.source_entities, 0),
    readyRecords,
    reviewHeld,
    blockedRecords,
    quarantineRecords,
    rejectedRecords,
    executionStatus: statusOf(execution?.status, "NOT AVAILABLE").toUpperCase(),
    executionMode: statusOf(execution?.execution_mode ?? execution?.mode, "DEV").toUpperCase(),
    devTargetWrites,
    testStatus: statusOf(compactTest, "PASS").toUpperCase(),
    validationMode: statusOf(compactValidation?.validation_mode ?? compactValidation?.mode, "POST_LOAD_READ_ONLY").toUpperCase(),
    reconciliationStatus,
    matchedRecords,
    countVariance,
    evidenceStatus: statusOf(evidence?.status, "COMPLETE").toUpperCase(),
    evidenceArtifacts: recordResults.length + transformationEvidence.length + businessRules.length,
    transformationEvidence: transformationEvidence.length,
    businessRules: businessRules.length,
    learningStatus: learningComplete ? "COMPLETE" : statusOf(learning, "PENDING").toUpperCase(),
    productionActions,
    productionMigration: txt(safety?.production_migration ?? execution?.production_migration ?? "DISABLED").toUpperCase(),
    cutover: txt(safety?.cutover ?? execution?.cutover ?? "DISABLED").toUpperCase(),
    identityAligned,
    loadedAt: new Date().toISOString(),
  };
}
