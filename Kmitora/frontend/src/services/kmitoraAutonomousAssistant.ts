import type { AssistantMode, AuthorityLevel } from "../config/assistantCapabilityModel";

export type AssistantContext = {
  workspaceRoot?: string;
  environment?: string;
  domain?: string;
  application?: string;
  repository?: string;
  database?: string;
  workflow?: string;
};

export type AssistantPlanStep = {
  id: string;
  label: string;
  status: "PENDING" | "READY" | "RUNNING" | "PASS" | "REVIEW" | "BLOCKED";
  authority: AuthorityLevel;
  dependsOn: string[];
};

export type AssistantPlan = {
  taskId: string;
  mode: AssistantMode;
  objective: string;
  risk: "LOW" | "MEDIUM" | "HIGH";
  authorityRequired: AuthorityLevel;
  duplicateCheck: "REQUIRED";
  productionMutation: false;
  steps: AssistantPlanStep[];
};

const RUNTIME = "http://127.0.0.1:8083";

function localPlan(prompt: string, mode: AssistantMode): AssistantPlan {
  const lower = prompt.toLowerCase();
  const codeChange = /build|create|add|implement|fix|change|update|refactor|code|api|database|schema|ui/.test(lower);
  const schedule = /schedule|every day|daily|weekly|monthly|cron|job/.test(lower);
  const risk: AssistantPlan["risk"] = /production|prod|delete|drop|truncate|cutover/.test(lower) ? "HIGH" : codeChange ? "MEDIUM" : "LOW";
  const base: AssistantPlanStep[] = [
    { id:"s1", label:"Understand intent and acceptance criteria", status:"READY", authority:"L1", dependsOn:[] },
    { id:"s2", label:"Assemble workspace, domain and evidence context", status:"PENDING", authority:"L1", dependsOn:["s1"] },
    { id:"s3", label:"Inspect existing code, data, workflows and reusable capabilities", status:"PENDING", authority:"L1", dependsOn:["s2"] },
    { id:"s4", label:"Run duplicate and impact analysis", status:"PENDING", authority:"L2", dependsOn:["s3"] },
    { id:"s5", label:"Create dependency-aware implementation DAG", status:"PENDING", authority:"L2", dependsOn:["s4"] },
  ];
  if (codeChange) base.push(
    { id:"s6", label:"Generate minimal governed patch", status:"PENDING", authority:"L3", dependsOn:["s5"] },
    { id:"s7", label:"Build and run impacted tests", status:"PENDING", authority:"L5", dependsOn:["s6"] },
    { id:"s8", label:"Bounded repair loop if deterministic gates fail", status:"PENDING", authority:"L5", dependsOn:["s7"] },
    { id:"s9", label:"Simulate and validate expected outcome", status:"PENDING", authority:"L4", dependsOn:["s8"] }
  );
  if (schedule) base.push({ id:"s10", label:"Create reusable workflow and schedule", status:"PENDING", authority:"L3", dependsOn:[base[base.length-1].id] });
  base.push(
    { id:"s11", label:"Reconcile expected vs actual results", status:"PENDING", authority:"L4", dependsOn:[base[base.length-1].id] },
    { id:"s12", label:"Capture evidence and verified reusable knowledge", status:"PENDING", authority:"L1", dependsOn:["s11"] }
  );
  return {
    taskId:`KAT-${Date.now()}`,
    mode,
    objective:prompt.trim() || "No objective supplied",
    risk,
    authorityRequired:risk === "HIGH" ? "L6" : codeChange ? "L5" : "L2",
    duplicateCheck:"REQUIRED",
    productionMutation:false,
    steps:base,
  };
}

async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${RUNTIME}${path}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type":"application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(`KMITORA Assistant runtime ${response.status}`);
  return response.json() as Promise<T>;
}

export async function getAssistantRuntimeHealth() {
  try { return await request<{status:string;mode:string;workspace:string}>("/health"); }
  catch { return { status:"OFFLINE", mode:"FRONTEND_PLAN_ONLY", workspace:"Unavailable" }; }
}

export async function getWorkspaceContext() {
  try { return await request<Record<string, unknown>>("/v1/assistant/context"); }
  catch { return null; }
}

export async function planAssistantTask(prompt: string, mode: AssistantMode, context: AssistantContext): Promise<AssistantPlan> {
  try { return await request<AssistantPlan>("/v1/assistant/plan", { prompt, mode, context }); }
  catch { return localPlan(prompt, mode); }
}

export async function executeAssistantTask(plan: AssistantPlan, context: AssistantContext) {
  return request<{status:string;task_id:string;results:unknown[]}>("/v1/assistant/execute", { plan, context });
}

export async function scheduleAssistantTask(plan: AssistantPlan, schedule: string) {
  return request<{status:string;schedule_id:string}>("/v1/assistant/schedule", { plan, schedule });
}