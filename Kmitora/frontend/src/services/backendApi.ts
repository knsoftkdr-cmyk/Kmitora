export type BackendHealth = {
  connected: boolean;
  status: string;
  endpoint: string | null;
  latencyMs: number | null;
  detail?: unknown;
};

const API_PREFIX = "/api";

async function timedFetch(path: string, init?: RequestInit) {
  const started = performance.now();
  const response = await fetch(`${API_PREFIX}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const latencyMs = Math.round(performance.now() - started);
  return { response, latencyMs };
}

async function parseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

export async function checkBackendHealth(): Promise<BackendHealth> {
  const candidates = ["/health", "/healthz", "/ping"];

  for (const endpoint of candidates) {
    try {
      const { response, latencyMs } = await timedFetch(endpoint, { method: "GET" });
      if (response.ok) {
        return {
          connected: true,
          status: "CONNECTED",
          endpoint,
          latencyMs,
          detail: await parseBody(response),
        };
      }
    } catch {
      // Try the next known read-only health endpoint.
    }
  }

  return {
    connected: false,
    status: "DISCONNECTED",
    endpoint: null,
    latencyMs: null,
  };
}

export async function apiGet<T = unknown>(path: string): Promise<T> {
  const { response } = await timedFetch(path, { method: "GET" });
  if (!response.ok) {
    throw new Error(`KMITORA backend GET ${path} failed: HTTP ${response.status}`);
  }
  return (await parseBody(response)) as T;
}

export async function apiPostDryRun<T = unknown>(
  path: string,
  body: unknown,
): Promise<T> {
  const { response } = await timedFetch(path, {
    method: "POST",
    body: JSON.stringify({
      ...((body && typeof body === "object") ? body : { value: body }),
      dry_run: true,
      execution_authorized: false,
      production_migration_enabled: false,
      cutover_enabled: false,
      target_production_writes: 0,
      production_actions: 0,
    }),
  });

  if (!response.ok) {
    throw new Error(`KMITORA backend dry-run POST ${path} failed: HTTP ${response.status}`);
  }
  return (await parseBody(response)) as T;
}

