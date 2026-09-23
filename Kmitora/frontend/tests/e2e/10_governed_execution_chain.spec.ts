import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  expect,
  test,
  type APIRequestContext,
} from "@playwright/test";

import { expectHealthy } from "./helpers/api";
import { urls } from "./helpers/env";

type Envelope<T> = {
  product: string;
  agent: string;
  version: string;
  kind: string;
  trace_id: string;
  timestamp: string;
  authoritative: boolean;
  production_action_executed: boolean;
  payload: T;
};

type Discovery = {
  migration_id: string;
  status: string;
  mode: string;
  production_action_executed: boolean;
  summary: {
    source_entity_count: number;
    target_entity_count: number;
    business_rule_count: number;
    quality_finding_count: number;
    staging_ready_count: number;
    staging_review_count: number;
    staging_quarantine_count: number;
    staging_rejected_count: number;
    staging_referential_dependency_count: number;
  };
  target_staging_plan: {
    ready_records: unknown[];
    review_records: unknown[];
    quarantine_records: unknown[];
    rejected_records: unknown[];
    referential_dependencies: Array<{
      entity?: unknown;
      field?: unknown;
      row?: unknown;
      value?: unknown;
    }>;
  };
  quality_findings: Array<{ severity?: unknown }>;
};

type Validation = {
  id: string;
  migration_id: string;
  status: string;
  validation_ready: boolean;
  counts: {
    ready_records: number;
    review_records: number;
    quarantine_records: number;
    rejected_records: number;
    blocking_findings: number;
    referential_dependencies: number;
    unresolved_referential: number;
  };
  safety: {
    source_write_executed: boolean;
    target_write_executed: boolean;
    migration_execution_started: boolean;
    production_action_executed: boolean;
  };
};

type Approval = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  approved: boolean;
  rejected: boolean;
  production_action_executed: boolean;
  target_write_executed: boolean;
  decision_by?: string | null;
  decision_reason?: string | null;
};

type Execution = {
  execution_id: string;
  migration_id: string;
  approval_id: string;
  status: string;
  execution_gate: string;
  approval_status: string;
  environment: string;
  execution_mode: string;
  input_record_count: number;
  simulated_record_count: number;
  success_count: number;
  failure_count: number;
  production_executed: boolean;
  production_action_executed: boolean;
  target_write_executed: boolean;
  record_results: Array<{
    status: string;
    target_write_executed: boolean;
    production_action_executed: boolean;
  }>;
};

type Reconciliation = {
  reconciliation_id: string;
  execution_id: string;
  migration_id: string;
  approval_id: string;
  status: string;
  input_record_count: number;
  simulated_record_count: number;
  matched_records: number;
  unmatched_source: number;
  unexpected_simulated: number;
  failed_records: number;
  count_variance: number;
  target_write_count: number;
  production_action_count: number;
  production_executed: boolean;
  production_action_executed: boolean;
  target_write_executed: boolean;
};

type EvidencePackage = {
  evidence_id: string;
  migration_id: string;
  approval_id: string;
  execution_id: string;
  reconciliation_id: string;
  status: string;
  discovery_summary: Record<string, unknown>;
  approval_summary: {
    status: string;
    approved: boolean;
    rejected: boolean;
    decision_by: string | null;
    decision_reason: string | null;
  };
  execution_summary: {
    status: string;
    execution_gate: string;
    input_record_count: number;
    simulated_record_count: number;
    success_count: number;
    failure_count: number;
  };
  reconciliation_summary: Reconciliation;
  safety: {
    production_executed: boolean;
    production_action_executed: boolean;
    target_write_executed: boolean;
    target_write_count: number;
    production_action_count: number;
  };
};

const repoRoot = path.resolve(process.cwd(), "..");
const sourcePath = path.join(
  repoRoot,
  "TEST_DATA",
  "E2E_GOLDEN",
  "source",
  "happy",
);
const targetPath = path.join(
  repoRoot,
  "TEST_DATA",
  "E2E_GOLDEN",
  "target",
  "postgresql",
  "01_setup_target.sql",
);
const businessRulesPath = path.join(
  repoRoot,
  "TEST_DATA",
  "E2E_GOLDEN",
  "requirements",
  "business_requirements.txt",
);

function blockedRecordCount(discovery: Discovery): number {
  return discovery.target_staging_plan.referential_dependencies.filter(
    (item) =>
      item.entity !== null &&
      item.entity !== undefined &&
      item.field !== null &&
      item.field !== undefined &&
      item.row !== null &&
      item.row !== undefined &&
      item.value !== null &&
      item.value !== undefined,
  ).length;
}

function blockingFindingCount(discovery: Discovery): number {
  return discovery.quality_findings.filter(
    (item) => String(item.severity ?? "").toUpperCase() === "ERROR",
  ).length;
}

async function responseJson<T>(
  response: Awaited<ReturnType<APIRequestContext["post"]>>,
): Promise<Envelope<T>> {
  return await response.json() as Envelope<T>;
}

async function discoverAndValidate(
  request: APIRequestContext,
): Promise<{
  migrationId: string;
  discovery: Discovery;
  validation: Validation;
}> {
  const migrationId = `KMITORA-E2E-${randomUUID()}`;

  const discoveryResponse = await request.post(
    `${urls.core}/v1/discovery/jobs`,
    {
      data: {
        migration_id: migrationId,
        source_path: sourcePath,
        target_path: targetPath,
        business_rules_path: businessRulesPath,
      },
    },
  );

  expect(
    discoveryResponse.ok(),
    await discoveryResponse.text(),
  ).toBeTruthy();

  const discoveryEnvelope =
    await responseJson<Discovery>(discoveryResponse);
  const discovery = discoveryEnvelope.payload;

  expect(discoveryEnvelope.kind).toBe("discovery_result");
  expect(discovery.migration_id).toBe(migrationId);
  expect(discovery.status).toBe("DISCOVERED");
  expect(discovery.mode).toBe("DISCOVERY_ONLY");
  expect(discovery.production_action_executed).toBe(false);
  expect(discovery.summary.staging_ready_count).toBeGreaterThan(0);

  const validationResponse = await request.post(
    `${urls.core}/v1/validations/resolve-governed`,
    { data: { migration_id: migrationId } },
  );

  expect(
    validationResponse.ok(),
    await validationResponse.text(),
  ).toBeTruthy();

  const validationEnvelope =
    await responseJson<Validation>(validationResponse);
  const validation = validationEnvelope.payload;

  expect(validationEnvelope.kind).toBe("governed_validation");
  expect(validation.migration_id).toBe(migrationId);
  expect(validation.status).toBe("READY");
  expect(validation.validation_ready).toBe(true);
  expect(validation.counts.blocking_findings).toBe(0);
  expect(validation.counts.review_records).toBe(0);
  expect(validation.counts.quarantine_records).toBe(0);
  expect(validation.counts.rejected_records).toBe(0);
  expect(validation.counts.unresolved_referential).toBe(0);
  expect(validation.safety.source_write_executed).toBe(false);
  expect(validation.safety.target_write_executed).toBe(false);
  expect(validation.safety.production_action_executed).toBe(false);

  return { migrationId, discovery, validation };
}

function approvalInput(
  migrationId: string,
  discovery: Discovery,
  validation: Validation,
): Record<string, unknown> {
  return {
    migration_id: migrationId,
    validation_snapshot: {
      validation_ready: validation.validation_ready,
      blocking_findings: blockingFindingCount(discovery),
    },
    staging_snapshot: {
      ready_records:
        discovery.target_staging_plan.ready_records.length,
      blocked_records: blockedRecordCount(discovery),
      review_records:
        discovery.target_staging_plan.review_records.length,
      quarantine_records:
        discovery.target_staging_plan.quarantine_records.length,
      rejected_records:
        discovery.target_staging_plan.rejected_records.length,
    },
    environment: "DEV",
    execution_mode: "DRY_RUN",
    target_write_requested: false,
  };
}

async function createApproval(
  request: APIRequestContext,
  migrationId: string,
  discovery: Discovery,
  validation: Validation,
): Promise<Approval> {
  const response = await request.post(`${urls.core}/v1/approvals`, {
    data: approvalInput(migrationId, discovery, validation),
  });

  expect(response.status()).toBe(202);

  const body = await responseJson<Approval>(response);
  expect(body.kind).toBe("approval_request");
  expect(body.payload.status).toBe("PENDING");
  expect(body.payload.approved).toBe(false);
  expect(body.payload.rejected).toBe(false);
  expect(body.payload.production_action_executed).toBe(false);
  expect(body.payload.target_write_executed).toBe(false);

  return body.payload;
}

async function decideApproval(
  request: APIRequestContext,
  approvalId: string,
  decision: "APPROVE" | "REJECT",
): Promise<Approval> {
  const response = await request.patch(
    `${urls.core}/v1/approvals/${encodeURIComponent(approvalId)}`,
    {
      data: {
        decision,
        decision_by: "KMITORA E2E Authoritative Approver",
        decision_reason:
          decision === "APPROVE"
            ? "Golden-path DEV dry-run approved."
            : "Negative governance test rejection.",
      },
    },
  );

  expect(response.ok(), await response.text()).toBeTruthy();

  const body = await responseJson<Approval>(response);
  expect(body.kind).toBe("approval_decision");
  expect(body.payload.status).toBe(
    decision === "APPROVE" ? "APPROVED" : "REJECTED",
  );
  expect(body.payload.production_action_executed).toBe(false);
  expect(body.payload.target_write_executed).toBe(false);

  return body.payload;
}

async function executeDryRun(
  request: APIRequestContext,
  migrationId: string,
  approvalId: string,
  targetWriteRequested = false,
) {
  return request.post(`${urls.core}/v1/migrations`, {
    data: {
      migration_id: migrationId,
      approval_id: approvalId,
      environment: "DEV",
      execution_mode: "DRY_RUN",
      target_write_requested: targetWriteRequested,
    },
  });
}

async function writeGovernanceEvidence(
  evidence: Record<string, unknown>,
): Promise<string> {
  const directory = path.resolve(
    process.cwd(),
    "test-results",
    "governed-chain",
  );
  await mkdir(directory, { recursive: true });

  const evidencePath = path.join(
    directory,
    "approval-execute-test-validate-reconcile-evidence.json",
  );

  await writeFile(
    evidencePath,
    `${JSON.stringify(evidence, null, 2)}\n`,
    "utf8",
  );

  return evidencePath;
}

test.describe("governed Approval to Evidence chain", () => {
  test("pending approval blocks Execute", async ({ request }) => {
    await expectHealthy(request, urls.core);

    const { migrationId, discovery, validation } =
      await discoverAndValidate(request);
    const approval = await createApproval(
      request,
      migrationId,
      discovery,
      validation,
    );

    const executionResponse = await executeDryRun(
      request,
      migrationId,
      approval.id,
    );

    expect(executionResponse.status()).toBe(403);

    const body = await responseJson<Record<string, unknown>>(
      executionResponse,
    );
    expect(body.kind).toBe("migration_gate_blocked");
    expect(body.production_action_executed).toBe(false);
  });

  test("rejected approval blocks Execute", async ({ request }) => {
    const { migrationId, discovery, validation } =
      await discoverAndValidate(request);
    const approval = await createApproval(
      request,
      migrationId,
      discovery,
      validation,
    );

    const rejected = await decideApproval(
      request,
      approval.id,
      "REJECT",
    );
    expect(rejected.approved).toBe(false);
    expect(rejected.rejected).toBe(true);

    const executionResponse = await executeDryRun(
      request,
      migrationId,
      approval.id,
    );

    expect(executionResponse.status()).toBe(403);

    const body = await responseJson<Record<string, unknown>>(
      executionResponse,
    );
    expect(body.kind).toBe("migration_gate_blocked");
    expect(body.production_action_executed).toBe(false);
  });

  test("approved request still blocks target-write execution", async ({
    request,
  }) => {
    const { migrationId, discovery, validation } =
      await discoverAndValidate(request);
    const approval = await createApproval(
      request,
      migrationId,
      discovery,
      validation,
    );

    await decideApproval(request, approval.id, "APPROVE");

    const executionResponse = await executeDryRun(
      request,
      migrationId,
      approval.id,
      true,
    );

    expect(executionResponse.status()).toBe(403);

    const body = await responseJson<Record<string, unknown>>(
      executionResponse,
    );
    expect(body.kind).toBe("migration_gate_blocked");
    expect(body.production_action_executed).toBe(false);
  });

  test("authoritative approval cannot be decided twice", async ({
    request,
  }) => {
    const { migrationId, discovery, validation } =
      await discoverAndValidate(request);
    const approval = await createApproval(
      request,
      migrationId,
      discovery,
      validation,
    );

    await decideApproval(request, approval.id, "APPROVE");

    const duplicateDecision = await request.patch(
      `${urls.core}/v1/approvals/${encodeURIComponent(approval.id)}`,
      {
        data: {
          decision: "APPROVE",
          decision_by: "KMITORA E2E Authoritative Approver",
          decision_reason: "Duplicate decision must be rejected.",
        },
      },
    );

    expect(duplicateDecision.status()).toBe(409);

    const body = await responseJson<Record<string, unknown>>(
      duplicateDecision,
    );
    expect(body.kind).toBe("approval_decision_error");
    expect(body.production_action_executed).toBe(false);
  });

  test("Evidence rejects an unknown reconciliation", async ({
    request,
  }) => {
    const response = await request.post(`${urls.core}/v1/evidence`, {
      data: { reconciliation_id: randomUUID() },
    });

    expect(response.status()).toBe(404);

    const body = await responseJson<Record<string, unknown>>(response);
    expect(body.kind).toBe("evidence_error");
    expect(body.production_action_executed).toBe(false);
  });

  test("Approval → Execute → Test → Validate → Reconcile → Evidence completes with zero writes", async ({
    request,
  }, testInfo) => {
    const startedAt = new Date().toISOString();
    const coreHealthBefore = await expectHealthy(request, urls.core);

    const { migrationId, discovery, validation } =
      await discoverAndValidate(request);

    const approval = await createApproval(
      request,
      migrationId,
      discovery,
      validation,
    );

    const approved = await decideApproval(
      request,
      approval.id,
      "APPROVE",
    );

    expect(approved.approved).toBe(true);
    expect(approved.rejected).toBe(false);
    expect(approved.decision_by).toBe(
      "KMITORA E2E Authoritative Approver",
    );

    const executionResponse = await executeDryRun(
      request,
      migrationId,
      approval.id,
    );

    expect(
      executionResponse.ok(),
      await executionResponse.text(),
    ).toBeTruthy();

    const executionEnvelope =
      await responseJson<Execution>(executionResponse);
    const execution = executionEnvelope.payload;

    expect(executionEnvelope.kind).toBe("migration_candidate");
    expect(execution.execution_gate).toBe("PASS");
    expect(execution.approval_status).toBe("APPROVED");
    expect(execution.environment).toBe("DEV");
    expect(execution.execution_mode).toBe("DRY_RUN");
    expect(execution.status).toBe("DRY_RUN_COMPLETED");
    expect(execution.input_record_count).toBeGreaterThan(0);
    expect(execution.simulated_record_count).toBe(
      execution.input_record_count,
    );
    expect(execution.success_count).toBe(
      execution.input_record_count,
    );
    expect(execution.failure_count).toBe(0);
    expect(execution.production_executed).toBe(false);
    expect(execution.production_action_executed).toBe(false);
    expect(execution.target_write_executed).toBe(false);
    expect(
      execution.record_results.every(
        (record) =>
          record.status === "SIMULATED" &&
          record.target_write_executed === false &&
          record.production_action_executed === false,
      ),
    ).toBe(true);

    const testResponse = await request.post(
      `${urls.core}/v1/tests`,
      {
        data: {
          migration_id: migrationId,
          execution_id: execution.execution_id,
          stage: "TEST",
          assertions: {
            execution_gate: "PASS",
            failure_count: 0,
            target_write_executed: false,
            production_action_executed: false,
          },
        },
      },
    );

    expect(testResponse.status()).toBe(202);

    const testEnvelope =
      await responseJson<{
        id: string;
        status: string;
        input: Record<string, unknown>;
      }>(testResponse);

    expect(testEnvelope.kind).toBe("test_candidate");
    expect(testEnvelope.payload.status).toBe("CANDIDATE");

    const postExecutionValidationResponse = await request.post(
      `${urls.core}/v1/validations/resolve-governed`,
      { data: { migration_id: migrationId } },
    );

    expect(postExecutionValidationResponse.ok()).toBeTruthy();

    const postExecutionValidationEnvelope =
      await responseJson<Validation>(
        postExecutionValidationResponse,
      );
    const postExecutionValidation =
      postExecutionValidationEnvelope.payload;

    expect(postExecutionValidation.status).toBe("READY");
    expect(postExecutionValidation.validation_ready).toBe(true);
    expect(postExecutionValidation.counts.blocking_findings).toBe(0);
    expect(
      postExecutionValidation.safety.target_write_executed,
    ).toBe(false);
    expect(
      postExecutionValidation.safety.production_action_executed,
    ).toBe(false);

    const reconciliationResponse = await request.post(
      `${urls.core}/v1/reconciliations`,
      { data: { execution_id: execution.execution_id } },
    );

    expect(
      reconciliationResponse.ok(),
      await reconciliationResponse.text(),
    ).toBeTruthy();

    const reconciliationEnvelope =
      await responseJson<Reconciliation>(
        reconciliationResponse,
      );
    const reconciliation = reconciliationEnvelope.payload;

    expect(reconciliationEnvelope.kind).toBe("reconciliation");
    expect(reconciliation.status).toBe("PASS");
    expect(reconciliation.input_record_count).toBe(
      execution.input_record_count,
    );
    expect(reconciliation.simulated_record_count).toBe(
      execution.input_record_count,
    );
    expect(reconciliation.matched_records).toBe(
      execution.input_record_count,
    );
    expect(reconciliation.failed_records).toBe(0);
    expect(reconciliation.unmatched_source).toBe(0);
    expect(reconciliation.unexpected_simulated).toBe(0);
    expect(reconciliation.count_variance).toBe(0);
    expect(reconciliation.target_write_count).toBe(0);
    expect(reconciliation.production_action_count).toBe(0);
    expect(reconciliation.target_write_executed).toBe(false);
    expect(reconciliation.production_action_executed).toBe(false);

    const evidenceResponse = await request.post(
      `${urls.core}/v1/evidence`,
      {
        data: {
          reconciliation_id: reconciliation.reconciliation_id,
        },
      },
    );

    expect(
      evidenceResponse.status(),
      await evidenceResponse.text(),
    ).toBe(202);

    const evidenceEnvelope =
      await responseJson<EvidencePackage>(evidenceResponse);
    const evidence = evidenceEnvelope.payload;

    expect(evidenceEnvelope.kind).toBe("evidence_candidate");
    expect(evidence.status).toBe("COMPLETE");
    expect(evidence.migration_id).toBe(migrationId);
    expect(evidence.approval_id).toBe(approval.id);
    expect(evidence.execution_id).toBe(execution.execution_id);
    expect(evidence.reconciliation_id).toBe(
      reconciliation.reconciliation_id,
    );
    expect(evidence.approval_summary.status).toBe("APPROVED");
    expect(evidence.approval_summary.approved).toBe(true);
    expect(evidence.approval_summary.rejected).toBe(false);
    expect(evidence.execution_summary.execution_gate).toBe("PASS");
    expect(evidence.execution_summary.failure_count).toBe(0);
    expect(evidence.reconciliation_summary.status).toBe("PASS");
    expect(evidence.safety.production_executed).toBe(false);
    expect(evidence.safety.production_action_executed).toBe(false);
    expect(evidence.safety.target_write_executed).toBe(false);
    expect(evidence.safety.target_write_count).toBe(0);
    expect(evidence.safety.production_action_count).toBe(0);

    const coreHealthAfter = await expectHealthy(request, urls.core);
    expect(coreHealthAfter.production_action_executed).toBe(false);

    const artifact = {
      evidence_type:
        "KMITORA_GOVERNED_APPROVAL_TO_EVIDENCE_CHAIN",
      version: "1.0",
      status: "PASS",
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      migration_id: migrationId,
      lifecycle: [
        "Approval",
        "Execute",
        "Test",
        "Validate",
        "Reconcile",
        "Evidence",
      ],
      discovery_summary: discovery.summary,
      validation,
      approval: approved,
      execution,
      test_stage: testEnvelope.payload,
      post_execution_validation: postExecutionValidation,
      reconciliation,
      evidence,
      safety: {
        production_action_executed: false,
        target_write_executed: false,
        production_action_count: 0,
        target_write_count: 0,
      },
    };

    const artifactPath = await writeGovernanceEvidence(artifact);

    await testInfo.attach("governed-chain-evidence", {
      path: artifactPath,
      contentType: "application/json",
    });
  });
});
