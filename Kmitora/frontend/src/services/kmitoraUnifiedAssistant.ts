export type UnifiedAssistantMode =
  | "ASK"
  | "ANALYZE"
  | "BUILD"
  | "FIX"
  | "AUTOMATE"
  | "SCHEDULE"
  | "MIGRATE"
  | "TEST"
  | "OPERATE"
  | "DOCUMENT"
  | "RECONCILE";

type RuntimeHealth = {
  status?: string;
  mode?: string;
  workspace?: string;
  model_runtime?: string;
  production_mutation?: boolean;
};

type RuntimeContext = {
  root?: string;
  counts?: {
    files?: number;
    code_files?: number;
    directories?: number;
  };
  model_runtime?: string;
  production_mutation?: boolean;
};

type PlanStep = {
  id?: string;
  label?: string;
  status?: string;
  authority?: string;
  dependsOn?: string[];
};

type AssistantPlan = {
  taskId?: string;
  task_id?: string;
  mode?: string;
  objective?: string;
  risk?: string;
  authorityRequired?: string;
  authority_required?: string;
  duplicateCheck?: string;
  productionMutation?: boolean;
  production_mutation?: boolean;
  steps?: PlanStep[];
};

type UnifiedContext = {
  activePage?: string;
  environment?: string;
};

const RUNTIME = import.meta.env.VITE_ASSISTANT_API_URL || "http://127.0.0.1:8083";

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function detectExplicitMode(message: string): UnifiedAssistantMode | null {
  const q = clean(message).toLowerCase();

  if (/\b(schedule|cron|daily|weekly|monthly|recurring)\b/.test(q)) return "SCHEDULE";
  if (/\b(migrate|migration|load\s+to\s+target|source\s+to\s+target)\b/.test(q)) return "MIGRATE";
  if (/\b(fix|repair|resolve|debug|broken|error|failure|failed|defect)\b/.test(q)) return "FIX";
  if (/\b(build|create|implement|develop|generate\s+code|add\s+feature|enhance)\b/.test(q)) return "BUILD";
  if (/\b(automate|automation|workflow|job\s+automation)\b/.test(q)) return "AUTOMATE";
  if (/\b(reconcile|reconciliation|compare\s+source.*target)\b/.test(q)) return "RECONCILE";
  if (/\b(test|testing|regression|unit\s+test|integration\s+test|e2e)\b/.test(q)) return "TEST";
  if (/\b(document|documentation|runbook|release\s+notes|technical\s+document)\b/.test(q)) return "DOCUMENT";
  if (/\b(operate|restart|health\s+check|service\s+status|runtime\s+diagnostic)\b/.test(q)) return "OPERATE";
  if (/\b(analy[sz]e|inspect|review|trace|diagnose|understand)\b/.test(q)) return "ANALYZE";

  return null;
}

function asksAdvancedStatus(message: string): boolean {
  return /\b(show|open|explain|display)\b.*\b(advanced|engine|runtime|orchestration|assistant\s+details)\b/i.test(message)
    || /\badvanced\s+status\b/i.test(message);
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${RUNTIME}${path}`);
  if (!response.ok) throw new Error(`runtime ${response.status}`);
  return response.json() as Promise<T>;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${RUNTIME}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`runtime ${response.status}`);
  return response.json() as Promise<T>;
}

function authorityForMode(mode: UnifiedAssistantMode): string {
  switch (mode) {
    case "ASK": return "L0";
    case "ANALYZE":
    case "DOCUMENT": return "L1";
    case "TEST":
    case "RECONCILE": return "L2";
    case "BUILD":
    case "FIX":
    case "AUTOMATE":
    case "SCHEDULE": return "L3-L5";
    case "MIGRATE":
    case "OPERATE": return "L4-L6";
    default: return "L1";
  }
}

function formatPlan(plan: AssistantPlan, mode: UnifiedAssistantMode, health: RuntimeHealth): string {
  const taskId = clean(plan.taskId) || clean(plan.task_id) || "not assigned";
  const objective = clean(plan.objective) || "Current request";
  const risk = clean(plan.risk) || "UNKNOWN";
  const authority = clean(plan.authorityRequired) || clean(plan.authority_required) || authorityForMode(mode);
  const model = clean(health.model_runtime) || "UNKNOWN";
  const steps = Array.isArray(plan.steps) ? plan.steps : [];

  const stepText = steps.length
    ? steps
        .slice(0, 12)
        .map((step, index) => `${index + 1}) ${clean(step.label) || clean(step.id) || "Plan step"}`)
        .join(" ")
    : "No executable steps were returned.";

  return [
    `Mode: ${mode}.`,
    `Task: ${taskId}.`,
    `Objective: ${objective}.`,
    `Risk: ${risk}.`,
    `Authority: ${authority}.`,
    `KMITORA model runtime: ${model}.`,
    `Plan: ${stepText}`,
    "No production mutation has been started from this conversation. Production remains disabled.",
  ].join(" ");
}

async function advancedStatus(activePage: string): Promise<string> {
  const [health, context] = await Promise.all([
    getJson<RuntimeHealth>("/health"),
    getJson<RuntimeContext>("/v1/assistant/context"),
  ]);

  return [
    `KMITORA Assistant advanced status.`,
    `Page: ${activePage}.`,
    `Runtime: ${clean(health.status) || "UNKNOWN"} / ${clean(health.mode) || "UNKNOWN"}.`,
    `Workspace: ${clean(health.workspace) || clean(context.root) || "UNKNOWN"}.`,
    `Indexed files: ${context.counts?.files ?? 0}; code/text files: ${context.counts?.code_files ?? 0}; directories: ${context.counts?.directories ?? 0}.`,
    `Model runtime: ${clean(health.model_runtime) || clean(context.model_runtime) || "UNKNOWN"}.`,
    `Production mutation: ${health.production_mutation === true ? "ENABLED" : "DISABLED"}.`,
    "A000 remains the orchestrator; Assistant V2 services remain internal and are no longer a separate user-facing assistant.",
  ].join(" ");
}

export async function routeUnifiedAssistantRequest(
  message: string,
  context: UnifiedContext,
): Promise<string | null> {
  if (asksAdvancedStatus(message)) {
    return advancedStatus(context.activePage || "overview");
  }

  const mode = detectExplicitMode(message);
  if (!mode) return null;

  const health = await getJson<RuntimeHealth>("/health");
  const plan = await postJson<AssistantPlan>("/v1/assistant/plan", {
    prompt: message,
    mode,
    context: {
      activePage: context.activePage || "overview",
      environment: context.environment || "DEV",
    },
  });

  return formatPlan(plan, mode, health);
}
