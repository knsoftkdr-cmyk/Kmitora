// Routes chat messages into the Assistant runtime's Gemini document -> governed
// DEV migration flow (POST /v1/assistant/document-flow). A message enters the
// flow when it looks like a migration request document (or "process this
// migration request"), or when a flow session is already active, so the
// user's "yes"/"no"/feedback replies reach the pending checkpoint. All
// confirmation gating is enforced server-side in runtime/document_flow.py.

const SESSION_KEY = "kmitora.docflow.sessionId";
const FALLBACK_RUNTIME = import.meta.env.VITE_ASSISTANT_API_URL || "http://127.0.0.1:8083";

type DocumentFlowResponse = {
  handled?: boolean;
  state?: string;
  session_id?: string | null;
  reply?: string;
};

function readSession(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function writeSession(sessionId: string | null | undefined) {
  try {
    if (sessionId) localStorage.setItem(SESSION_KEY, sessionId);
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // Session continuity is best-effort; the runtime still gates every step.
  }
}

async function assistantBase(): Promise<string> {
  if (import.meta.env.VITE_ASSISTANT_API_URL) return FALLBACK_RUNTIME;
  try {
    const response = await fetch("/__kmitora_ports");
    const ports = (await response.json()) as { assistant?: number };
    if (typeof ports.assistant === "number") return `http://127.0.0.1:${ports.assistant}`;
  } catch {
    // Not served by the Vite dev server; use the default runtime port.
  }
  return FALLBACK_RUNTIME;
}

export function looksLikeMigrationRequest(message: string): boolean {
  const m = message.toUpperCase();
  const isDocument =
    m.includes("SOURCE") &&
    m.includes("TARGET") &&
    (m.includes("BUSINESS RULE") || /\bBR-\d+/.test(m)) &&
    /\b(HOST|DATABASE)\b/.test(m);
  return isDocument || /\b(process|run|execute|start|handle)\b.{0,20}\bmigration\s+request\b/i.test(message);
}

export async function routeDocumentFlow(message: string): Promise<string | null> {
  const sessionId = readSession();
  if (!sessionId && !looksLikeMigrationRequest(message)) return null;

  let body: DocumentFlowResponse;
  try {
    const response = await fetch(`${await assistantBase()}/v1/assistant/document-flow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, session_id: sessionId }),
    });
    body = (await response.json()) as DocumentFlowResponse;
  } catch {
    return "KMITORA could not reach the Assistant runtime for the migration request. Nothing was executed. Production mutation remains disabled.";
  }

  if (!body.handled) return null;
  writeSession(body.session_id);
  return String(body.reply ?? "");
}
