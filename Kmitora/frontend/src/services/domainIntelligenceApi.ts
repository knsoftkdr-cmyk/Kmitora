export type DomainItem = {
  id: string;
  name: string;
  kind: "INDUSTRY" | "ENTERPRISE_FUNCTION";
};

export type DomainInference = {
  industries: Array<DomainItem & { score: number; confidence: number }>;
  functions: Array<DomainItem & { score: number; confidence: number }>;
  needs_human_confirmation: boolean;
  inference_truth: string;
  production_action_executed: false;
};

export type ClientDomainContext = {
  context_id: string;
  domain: string;
  functions: string[];
  systems: string[];
  processes: string[];
  issues: string[];
  technologies: string[];
  client_extensions: Record<string, unknown>;
  learning_policy: string;
  customization: {
    configuration: boolean;
    generated_adapters: string;
    generated_code: string;
    production_change: string;
  };
  production_action_executed: false;
};

export type AgentAllocation = {
  orchestrator: "A000";
  domain: string;
  functions: string[];
  agent_count: number;
  customization_mode: string;
  agents: Array<{
    agent_id: string;
    title: string;
    domain: string;
    functions: string[];
    purpose: string;
    technologies: string[];
    issue_context: string[];
    authority: string;
    production_write_allowed: false;
    destructive_action_allowed: false;
  }>;
  production_action_executed: false;
};

export type DynamicScenarioSet = {
  scenario_count: number;
  client_context: ClientDomainContext;
  generation_truth: string;
  scenarios: Array<{
    scenario_id: string;
    serial: number;
    stage: string;
    domain: string;
    driver: string;
    expected_behavior: string;
    assigned_agent_profiles: string[];
    production_write_allowed: false;
    production_cutover_allowed: false;
    destructive_action_allowed: false;
    evidence_required: true;
  }>;
  production_action_executed: false;
};

type Envelope<T> = { payload: T };

async function readPayload<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) {
    throw new Error(
      String(body?.payload?.message ?? `Domain request failed: ${response.status}`),
    );
  }
  return (body as Envelope<T>).payload;
}

export async function getDomainCatalog(): Promise<{
  industry_count: number;
  enterprise_function_count: number;
  total_seeded_domains: number;
  extensible: boolean;
  items: DomainItem[];
}> {
  return readPayload(await fetch("/api/v1/a000/domains"));
}

export async function inferDomainContext(payload: Record<string, unknown>): Promise<DomainInference> {
  return readPayload(
    await fetch("/api/v1/a000/domains/infer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
}

export async function buildClientDomainContext(
  payload: Record<string, unknown>,
): Promise<ClientDomainContext> {
  return readPayload(
    await fetch("/api/v1/a000/domains/context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
}

export async function allocateDomainAgents(
  payload: Record<string, unknown>,
): Promise<AgentAllocation> {
  return readPayload(
    await fetch("/api/v1/a000/domains/allocate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
}

export async function synthesizeDomainScenarios(
  payload: Record<string, unknown>,
): Promise<DynamicScenarioSet> {
  return readPayload(
    await fetch("/api/v1/a000/domains/scenarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
}

