export type MasterLayer = {
  start: number;
  end: number;
  name: string;
  count: number;
};

export type KqaCategory = {
  start: number;
  end: number;
  name: string;
  count: number;
  purpose: string;
};

export type MasterCatalogSummary = {
  orchestrator: string;
  total_scenarios: number;
  master_layers: MasterLayer[];
  kqa_start: number;
  kqa_count: number;
  kqa_categories: KqaCategory[];
  safety: Record<string, unknown>;
  quality_targets: Record<string, unknown>;
};

export type MasterScenario = {
  serial: number;
  scenario_id: string;
  layer: string;
  kqa_id: string | null;
  kqa_category: string | null;
  enabled: boolean;
  environment: string;
  production_write_allowed: boolean;
  production_cutover_allowed: boolean;
  destructive_action_allowed: boolean;
  policy_bypass_allowed: boolean;
  mandatory_evidence: boolean;
  mandatory_rollback_for_critical: boolean;
};

export type ScenarioOutcome = {
  serial: number;
  scenario_id: string;
  layer: string;
  kqa_id: string | null;
  kqa_category: string | null;
  status: "PASS" | "FAIL";
  deterministic_validators_passed: boolean;
  production_write_executed: boolean;
  production_cutover_executed: boolean;
  destructive_action_executed: boolean;
  policy_bypass_executed: boolean;
  approval_bypass_executed: boolean;
  tenant_or_context_leak_detected: boolean;
  rollback_evidence_complete: boolean;
  evidence_sha256: string;
  message: string;
};

type Envelope<T> = {
  payload: T;
};

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json();

  if (!response.ok) {
    const message =
      body?.payload?.message ??
      body?.message ??
      `A000 request failed: ${response.status}`;
    throw new Error(String(message));
  }

  return (body as Envelope<T>).payload;
}

export async function getMasterCatalog(): Promise<MasterCatalogSummary> {
  const response = await fetch("/api/v1/a000/master-capabilities");
  return readJson<MasterCatalogSummary>(response);
}

export async function getMasterScenario(
  serial: number,
): Promise<MasterScenario> {
  const response = await fetch(
    `/api/v1/a000/master-capabilities/${serial}`,
  );
  return readJson<MasterScenario>(response);
}

export async function runMasterScenario(
  serial: number,
): Promise<ScenarioOutcome> {
  const response = await fetch(
    "/api/v1/a000/master-capabilities/run-one",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serial }),
    },
  );
  return readJson<ScenarioOutcome>(response);
}

export async function runMasterBatch(
  start: number,
  end: number,
): Promise<Record<string, unknown>> {
  const response = await fetch(
    "/api/v1/a000/master-capabilities/run",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        start,
        end,
        persist_evidence: true,
        stop_on_failure: true,
      }),
    },
  );
  return readJson<Record<string, unknown>>(response);
}

export async function getLearningDecision(
  outcome: ScenarioOutcome,
): Promise<Record<string, unknown>> {
  const response = await fetch(
    "/api/v1/a000/master-capabilities/learn",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome }),
    },
  );
  return readJson<Record<string, unknown>>(response);
}

