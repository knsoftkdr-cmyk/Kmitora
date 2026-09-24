import {
  KMITORA_ASSISTANT_SCENARIOS,
  KMITORA_SCENARIO_GROUPS,
  findScenario,
  type KmitoraScenario,
} from "../config/kmitoraAssistantScenarioCatalog";

type Check = {
  name: string;
  status: "PASS" | "FAIL" | "BLOCKED";
  evidence: string;
};

type ServiceState = {
  core: boolean;
  source: boolean;
  target: boolean;
  assistant: boolean;
  modelConfigured: boolean;
};

const CORE = import.meta.env.VITE_CORE_API_URL || "http://127.0.0.1:8090";
const SOURCE = import.meta.env.VITE_SOURCE_API_URL || "http://127.0.0.1:8081";
const TARGET = import.meta.env.VITE_TARGET_API_URL || "http://127.0.0.1:8082";
const ASSISTANT = import.meta.env.VITE_ASSISTANT_API_URL || "http://127.0.0.1:8083";

async function json(url: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`${url} -> ${response.status}`);
  return (await response.json()) as Record<string, unknown>;
}

async function health(url: string): Promise<Record<string, unknown> | null> {
  try {
    return await json(`${url}/health`);
  } catch {
    return null;
  }
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function boolFalse(value: unknown): boolean {
  return value === false || String(value).toUpperCase() === "DISABLED" || String(value).toUpperCase() === "FALSE";
}

async function serviceState(): Promise<{ state: ServiceState; checks: Check[]; context: Record<string, unknown> | null }> {
  const [core, source, target, assistant] = await Promise.all([
    health(CORE),
    health(SOURCE),
    health(TARGET),
    health(ASSISTANT),
  ]);

  let context: Record<string, unknown> | null = null;
  try {
    context = await json(`${ASSISTANT}/v1/assistant/context`);
  } catch {
    context = null;
  }

  const state: ServiceState = {
    core: Boolean(core),
    source: Boolean(source),
    target: Boolean(target),
    assistant: Boolean(assistant),
    modelConfigured: text(assistant?.model_runtime).toUpperCase() === "CONFIGURED",
  };

  const productionSafe =
    boolFalse(assistant?.production_mutation) &&
    boolFalse(target?.production_writes ?? target?.production_mutation ?? false);

  const checks: Check[] = [
    { name: "A000 core health", status: core ? "PASS" : "BLOCKED", evidence: core ? "8080 reachable" : "8080 unavailable" },
    { name: "Source API health", status: source ? "PASS" : "BLOCKED", evidence: source ? "8081 reachable" : "8081 unavailable" },
    { name: "Target API health", status: target ? "PASS" : "BLOCKED", evidence: target ? "8082 reachable" : "8082 unavailable" },
    { name: "Assistant runtime health", status: assistant ? "PASS" : "BLOCKED", evidence: assistant ? "8083 reachable" : "8083 unavailable" },
    { name: "Production mutation protection", status: productionSafe ? "PASS" : "FAIL", evidence: productionSafe ? "production mutation disabled" : "production protection could not be proven" },
  ];

  return { state, checks, context };
}

async function planScenario(scenario: KmitoraScenario): Promise<Record<string, unknown>> {
  return json(`${ASSISTANT}/v1/assistant/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: scenario.prompt,
      mode: scenario.expectedMode,
      context: {
        scenario_id: scenario.id,
        scenario_group: scenario.group,
        lifecycle: scenario.lifecycle ?? [],
        environment: "DEV",
      },
    }),
  });
}

function validatePlan(scenario: KmitoraScenario, plan: Record<string, unknown>): Check[] {
  const mode = text(plan.mode).toUpperCase();
  const objective = text(plan.objective);
  const taskId = text(plan.taskId) || text(plan.task_id);
  const steps = Array.isArray(plan.steps) ? plan.steps : [];
  const productionMutation = plan.productionMutation ?? plan.production_mutation;

  const checks: Check[] = [
    {
      name: "Expected mode",
      status: mode === scenario.expectedMode ? "PASS" : "FAIL",
      evidence: `expected=${scenario.expectedMode}, actual=${mode || "missing"}`,
    },
    {
      name: "Task identity",
      status: taskId ? "PASS" : "FAIL",
      evidence: taskId || "missing task id",
    },
    {
      name: "Objective captured",
      status: objective ? "PASS" : "FAIL",
      evidence: objective || "missing objective",
    },
    {
      name: "Dependency-aware plan",
      status: steps.length >= 5 ? "PASS" : "FAIL",
      evidence: `${steps.length} plan steps`,
    },
    {
      name: "Production mutation disabled",
      status: productionMutation === false ? "PASS" : "FAIL",
      evidence: `productionMutation=${String(productionMutation)}`,
    },
  ];

  return checks;
}

function scenarioEligibility(
  scenario: KmitoraScenario,
  state: ServiceState,
): Check[] {
  const checks: Check[] = [];

  if (!state.assistant) {
    checks.push({ name: "Assistant runtime prerequisite", status: "BLOCKED", evidence: "8083 unavailable" });
  }
  if (scenario.requiresSource && !state.source) {
    checks.push({ name: "Source prerequisite", status: "BLOCKED", evidence: "8081 unavailable" });
  }
  if (scenario.requiresTarget && !state.target) {
    checks.push({ name: "Target prerequisite", status: "BLOCKED", evidence: "8082 unavailable" });
  }
  if (scenario.requiresModel && !state.modelConfigured) {
    checks.push({ name: "Model prerequisite", status: "BLOCKED", evidence: "KMITORA model runtime not configured" });
  }

  return checks;
}

function resultStatus(checks: Check[]): "PASS" | "FAIL" | "BLOCKED" {
  if (checks.some((check) => check.status === "FAIL")) return "FAIL";
  if (checks.some((check) => check.status === "BLOCKED")) return "BLOCKED";
  return "PASS";
}

async function runOne(scenario: KmitoraScenario, base?: Awaited<ReturnType<typeof serviceState>>) {
  const env = base ?? await serviceState();
  const checks = [...env.checks, ...scenarioEligibility(scenario, env.state)];

  if (!env.state.assistant) {
    return { scenario, checks, status: resultStatus(checks) };
  }

  try {
    const plan = await planScenario(scenario);
    checks.push(...validatePlan(scenario, plan));
  } catch (error) {
    checks.push({
      name: "Assistant plan endpoint",
      status: "FAIL",
      evidence: error instanceof Error ? error.message : "unknown plan error",
    });
  }

  return { scenario, checks, status: resultStatus(checks) };
}

function formatOne(result: Awaited<ReturnType<typeof runOne>>): string {
  const failures = result.checks.filter((check) => check.status !== "PASS");
  const evidence = failures.length
    ? failures.map((check) => `${check.name}: ${check.status} (${check.evidence})`).join("; ")
    : "All deterministic contract checks passed.";

  return `${result.scenario.id} ${result.scenario.title}: ${result.status}. ${evidence}`;
}

function catalogSummary(): string {
  const byGroup = KMITORA_SCENARIO_GROUPS
    .map((group) => {
      const count = KMITORA_ASSISTANT_SCENARIOS.filter((scenario) => scenario.group === group).length;
      return `${group}=${count}`;
    })
    .join(", ");

  const critical = KMITORA_ASSISTANT_SCENARIOS.filter((scenario) => scenario.critical).length;

  return `KMITORA Assistant E2E Scenario Lab contains ${KMITORA_ASSISTANT_SCENARIOS.length} scenarios across ${KMITORA_SCENARIO_GROUPS.length} groups. Critical scenarios: ${critical}. Groups: ${byGroup}.`;
}

async function runSuite(filter: (scenario: KmitoraScenario) => boolean, label: string): Promise<string> {
  const selected = KMITORA_ASSISTANT_SCENARIOS.filter(filter);
  const env = await serviceState();
  const results: Awaited<ReturnType<typeof runOne>>[] = [];

  for (let index = 0; index < selected.length; index += 1) {
    results.push(await runOne(selected[index], env));
  }

  const pass = results.filter((result) => result.status === "PASS").length;
  const fail = results.filter((result) => result.status === "FAIL").length;
  const blocked = results.filter((result) => result.status === "BLOCKED").length;
  const failedIds = results.filter((result) => result.status !== "PASS").slice(0, 20).map((result) => `${result.scenario.id}:${result.status}`);

  return `${label}: total=${results.length}, PASS=${pass}, FAIL=${fail}, BLOCKED=${blocked}. ${failedIds.length ? `Non-pass scenarios: ${failedIds.join(", ")}.` : "All scenarios passed deterministic contract checks."} PASS means the current deterministic checks passed; it does not claim business correctness beyond the evidence tested.`;
}

export async function runScenarioCommand(message: string): Promise<string | null> {
  const q = message.trim();

  if (/\b(list|show)\b.*\b(test\s+)?scenarios?\b/i.test(q) || /\bscenario\s+catalog\b/i.test(q)) {
    return catalogSummary();
  }

  const idMatch = q.match(/\b(K(?:AS|CT|UN|DS|DT|DG|PR|RC|SM|EX|TS|VL|RE|EV|LN|AD|DB|FF|FR|GV|GP)-\d{3})\b/i);
  if (idMatch && /\b(run|test|execute|validate)\b/i.test(q)) {
    const scenario = findScenario(idMatch[1]);
    if (!scenario) return `Scenario ${idMatch[1].toUpperCase()} was not found.`;
    return formatOne(await runOne(scenario));
  }

  if (/\b(run|test)\b.*\bgolden\s+path/i.test(q)) {
    return runSuite((scenario) => scenario.group === "Golden Path", "Golden Path suite");
  }

  if (/\b(run|test)\b.*\bcritical\b.*\bscenarios?\b/i.test(q)) {
    return runSuite((scenario) => scenario.critical === true, "Critical migration suite");
  }

  if (
    /\b(run|test)\b.*\b(all|entire|complete)\b.*\b(migration|e2e|end[- ]to[- ]end)\b/i.test(q) ||
    /\btest\s+entire\s+migration\s+process\b/i.test(q)
  ) {
    return runSuite(() => true, "Complete KMITORA Assistant E2E migration suite");
  }

  if (/\b(run|test)\b.*\bgovernance\b/i.test(q)) {
    return runSuite((scenario) => scenario.group === "Governance", "Governance suite");
  }

  if (/\b(run|test)\b.*\brecovery\b/i.test(q)) {
    return runSuite((scenario) => scenario.group === "Recovery", "Recovery suite");
  }

  if (/\b(run|test)\b.*\baddress\b/i.test(q)) {
    return runSuite((scenario) => scenario.group === "Customer History", "Customer address history suite");
  }

  if (/\b(run|test)\b.*\bfile\s+format/i.test(q)) {
    return runSuite((scenario) => scenario.group === "File Formats", "File-format suite");
  }

  if (/\b(run|test)\b.*\breconcil/i.test(q)) {
    return runSuite((scenario) => scenario.group === "Reconcile", "Reconciliation suite");
  }

  return null;
}
