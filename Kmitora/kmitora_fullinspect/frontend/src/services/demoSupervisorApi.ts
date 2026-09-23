export type DemoServiceStatus = {
  kind: string;
  version: string;
  timestamp: string;
  supervisor: {
    status: string;
    port: number;
    started_at: string;
  };
  backend: {
    status: "RUNNING" | "STOPPED";
    port: number;
    owned: boolean;
    pid: number | null;
    health_ok: boolean;
  };
  frontend: {
    status: "RUNNING" | "STOPPED";
    port: number;
    owned: boolean;
    pid: number | null;
  };
  demo_ready: boolean;
  mega_demo_status: string;
  report_exists: boolean;
  safety: {
    production_write_allowed: boolean;
    production_cutover_allowed: boolean;
    destructive_action_allowed: boolean;
    policy_bypass_allowed: boolean;
  };
  safety_ok: boolean;
  last_action: string;
  last_error: string | null;
};

export type PreflightCheck = {
  name: string;
  passed: boolean;
  detail: string;
};

export type DemoPreflight = {
  kind: string;
  timestamp: string;
  passed: number;
  total: number;
  failed: number;
  ready: boolean;
  checks: PreflightCheck[];
};

const SUPERVISOR = "http://127.0.0.1:8090";

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) {
    throw new Error(
      String(body?.error ?? body?.message ?? `Supervisor request failed: ${response.status}`),
    );
  }
  return body as T;
}

export async function getDemoStatus(): Promise<DemoServiceStatus> {
  return readJson(
    await fetch(`${SUPERVISOR}/v1/demo/status`, { cache: "no-store" }),
  );
}

export async function runPreflight(): Promise<DemoPreflight> {
  return readJson(
    await fetch(`${SUPERVISOR}/v1/demo/preflight`, { cache: "no-store" }),
  );
}

async function postAction(path: string): Promise<DemoServiceStatus> {
  return readJson(
    await fetch(`${SUPERVISOR}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }),
  );
}

export function startDemo(): Promise<DemoServiceStatus> {
  return postAction("/v1/demo/start");
}

export function stopDemo(): Promise<DemoServiceStatus> {
  return postAction("/v1/demo/stop");
}

export function restartDemo(): Promise<DemoServiceStatus> {
  return postAction("/v1/demo/restart");
}

export function restartBackend(): Promise<DemoServiceStatus> {
  return postAction("/v1/demo/backend/restart");
}

export function restartFrontend(): Promise<DemoServiceStatus> {
  return postAction("/v1/demo/frontend/restart");
}

export async function waitForFrontend(
  timeoutMs = 60000,
  intervalMs = 500,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch("http://127.0.0.1:5173", {
        method: "GET",
        cache: "no-store",
        mode: "no-cors",
      });
      if (response) return true;
    } catch {
      // Frontend is intentionally unavailable during restart.
    }
    await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
  }

  return false;
}

