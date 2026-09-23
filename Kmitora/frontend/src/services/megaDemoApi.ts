export type MegaDemoStatus = {
  kind: string;
  status: "IDLE" | "RUNNING" | "PASS" | "FAIL";
  started_at: string | null;
  finished_at: string | null;
  pid: number | null;
  exit_code: number | null;
  message: string;
  live_checks: MegaDemoCheck[];
  progress_completed: number;
  progress_passed: number;
  progress_failed: number;
  report_exists: boolean;
  report_path: string;
  production_action_executed: false;
  production_write_allowed: false;
  production_cutover_allowed: false;
  destructive_action_allowed: false;
  policy_bypass_allowed: false;
};

export type MegaDemoCheck = {
  name: string;
  phase: string;
  method: string;
  path: string;
  expected_status: number[];
  actual_status: number;
  passed: boolean;
  elapsed_ms: number;
  detail: string;
  response_kind?: string | null;
};

export type MegaDemoReport = {
  scenario_id: string;
  scenario_name: string;
  started_at: string;
  finished_at: string;
  total_checks: number;
  passed: number;
  failed: number;
  pass_rate: number;
  hard_safety: {
    production_write_allowed: boolean;
    production_cutover_allowed: boolean;
    destructive_action_allowed: boolean;
    policy_bypass_allowed: boolean;
  };
  artifacts: Record<string, unknown> & {
    dynamic_scenario_count?: number;
    representative_capability_executions?: number;
    migration_id?: string;
    approval_id?: string;
    execution_id?: string;
    reconciliation_id?: string;
    evidence_id?: string;
    client_context?: {
      domain?: string;
      functions?: string[];
      context_id?: string;
    };
    agent_allocation?: {
      agent_count?: number;
      agents?: Array<{
        agent_id: string;
        title: string;
        purpose: string;
      }>;
    };
    discovery_summary?: Record<string, number>;
  };
  checks: MegaDemoCheck[];
  report_sha256: string;
  source_report_path?: string;
  production_action_executed?: false;
};

type Envelope<T> = { payload: T };

async function readPayload<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) {
    throw new Error(
      String(body?.payload?.message ?? `Mega Demo request failed: ${response.status}`),
    );
  }
  return (body as Envelope<T>).payload;
}

export async function getMegaDemoStatus(): Promise<MegaDemoStatus> {
  return readPayload(
    await fetch("/api/v1/a000/mega-demo/status"),
  );
}

export async function getMegaDemoReport(): Promise<MegaDemoReport> {
  return readPayload(
    await fetch("/api/v1/a000/mega-demo/report"),
  );
}

export async function startMegaDemo(): Promise<MegaDemoStatus> {
  return readPayload(
    await fetch("/api/v1/a000/mega-demo/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }),
  );
}

