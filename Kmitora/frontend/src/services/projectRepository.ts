export type KmitoraProjectSnapshot = {
  projectId: string;
  projectName: string;
  topologyType: string;
  sources: unknown[];
  targets: unknown[];
  knowledgeItems?: unknown[];
  businessPrompt?: string;
  migrationPrompt?: string;
  workflowState?: unknown | null;
  currentStage?: string;
  updatedAt: string;
};

const API_BASE = "";

async function readJson(response: Response) {
  const text = await response.text();
  if (!text.trim()) throw new Error(`Empty response (${response.status})`);
  const body = JSON.parse(text);
  if (!response.ok) throw new Error(body?.payload?.message ?? `Repository request failed (${response.status})`);
  return body;
}

export async function saveProject(snapshot: KmitoraProjectSnapshot) {
  return readJson(await fetch(`${API_BASE}/v1/projects/save`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(snapshot) }));
}
export async function loadProject(projectId: string) {
  return readJson(await fetch(`${API_BASE}/v1/projects/load`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId }) }));
}
export async function listProjects() {
  return readJson(await fetch(`${API_BASE}/v1/projects`, { method: "GET" }));
}
export async function browseServerPath(path: string) {
  return readJson(await fetch(`${API_BASE}/v1/filesystem/list`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path }) }));
}

