const API_BASE = import.meta.env.VITE_API_BASE || "";

export async function postDiscovery(payload: unknown) {
  const response = await fetch(`${API_BASE}/v1/discovery/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Discovery failed: ${response.status}`);
  }

  return response.json();
}

export async function getHealth() {
  const response = await fetch(`${API_BASE}/health`);

  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status}`);
  }

  return response.json();
}

export async function validateFileConnector(
  path: string,
  pattern: string
) {
  const response = await fetch(
    `${API_BASE}/v1/connectors/file/validate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        path,
        pattern
      })
    }
  );

  const body = await response.json();

  if (!response.ok) {
    const message =
      body?.payload?.message ??
      `File connector validation failed: ${response.status}`;

    throw new Error(message);
  }

  return body;
}

/* =========================================================
   SOURCE DATA PREVIEW
   Read-only DEV preview of the connected source file
   ========================================================= */

export async function previewFileSource(
  path: string,
  pattern: string,
  limit = 10
) {
  const response = await fetch(
    `${API_BASE}/v1/connectors/file/preview`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        path,
        pattern,
        limit
      })
    }
  );

  const body = await response.json();

  if (!response.ok) {
    const message =
      body?.payload?.message ??
      `Source preview failed: ${response.status}`;

    throw new Error(message);
  }

  return body;
}
/* =========================================================
   APPROVAL REQUEST
   Creates an approval candidate only.
   Does NOT authorize or execute migration.
   ========================================================= */

export async function postApprovalRequest(payload: unknown) {
  const response = await fetch(`${API_BASE}/v1/approvals`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const body = await response.json();

  if (!response.ok) {
    const message =
      body?.payload?.message ??
      `Approval request failed: ${response.status}`;

    throw new Error(message);
  }

  return body;
}
/* =========================================================
   APPROVAL LIST
   Read-only retrieval of current approval requests.
   ========================================================= */

export async function getApprovals() {
  const response = await fetch(`${API_BASE}/v1/approvals`, {
    method: "GET"
  });

  const body = await response.json();

  if (!response.ok) {
    const message =
      body?.payload?.message ??
      `Approval retrieval failed: ${response.status}`;

    throw new Error(message);
  }

  return body;
}
/* =========================================================
   APPROVAL DECISION
   Records an authoritative approval decision only.
   Does NOT execute migration or perform target writes.
   ========================================================= */

export async function decideApproval(
  approvalId: string,
  decision: "APPROVE" | "REJECT",
  decisionBy: string,
  decisionReason: string
) {
  const response = await fetch(
    `${API_BASE}/v1/approvals/${approvalId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        decision,
        decision_by: decisionBy,
        decision_reason: decisionReason
      })
    }
  );

  const body = await response.json();

  if (!response.ok) {
    const message =
      body?.payload?.message ??
      `Approval decision failed: ${response.status}`;

    throw new Error(message);
  }

  return body;
}
/* =========================================================
   DEV DRY-RUN RECONCILIATION
   Reconciles an existing DEV dry-run execution.
   Does NOT perform target writes or production actions.
   ========================================================= */

export async function postReconciliation(
  executionId: string
) {
  const response = await fetch(
    `${API_BASE}/v1/reconciliations`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        execution_id: executionId
      })
    }
  );

  const body = await response.json();

  if (!response.ok) {
    const message =
      body?.payload?.message ??
      `Reconciliation failed: ${response.status}`;

    throw new Error(message);
  }

  return body;
}


/* =========================================================
   EVIDENCE PACKAGE
   Generates evidence from a PASS reconciliation.
   ========================================================= */

export async function postEvidence(
  reconciliationId: string
) {
  const response = await fetch(
    `${API_BASE}/v1/evidence`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        reconciliation_id: reconciliationId
      })
    }
  );

  const body = await response.json();

  if (!response.ok) {
    const message =
      body?.payload?.message ??
      `Evidence generation failed: ${response.status}`;

    throw new Error(message);
  }

  return body;
}

/* =========================================================
   DEV DRY-RUN MIGRATION
   Executes only an approved DEV dry-run.
   Target writes remain disabled.
   ========================================================= */

export async function postMigration(
  migrationId: string,
  approvalId: string
) {
  const response = await fetch(
    `${API_BASE}/v1/migrations`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        migration_id: migrationId,
        approval_id: approvalId,
        environment: "DEV",
        execution_mode: "DRY_RUN",
        target_write_requested: false
      })
    }
  );

  const body = await response.json();

  if (!response.ok) {
    const message =
      body?.payload?.message ??
      `DEV dry-run migration failed: ${response.status}`;

    throw new Error(message);
  }

  return body;
}

/* =========================================================
   A000 GOVERNED SAFE REMEDIATION
   Simulates only policy-approved safe remediation actions.
   Does NOT modify source, target, validation truth or execute migration.
   ========================================================= */

export async function resolveSafeRemediation(
  migrationId: string
) {
  const response = await fetch(
    `${API_BASE}/v1/remediations/resolve-safe`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        migration_id: migrationId,
        mode: "SAFE",
        dry_run: true
      })
    }
  );

  const body = await response.json();

  if (!response.ok) {
    const message =
      body?.payload?.message ??
      `Safe remediation failed: ${response.status}`;

    throw new Error(message);
  }

  return body;
}

/* =========================================================
   GENERIC SOURCE / TARGET FILE CONNECTOR VALIDATION
   Reuses the DEV read-only connector validation endpoint.
   Does not perform source modification or target writes.
   ========================================================= */

export async function validateFileSystemConnection(
  role: "SOURCE" | "TARGET",
  path: string,
  pattern: string
) {
  const response = await fetch(
    `${API_BASE}/v1/connectors/file/validate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        role,
        path,
        pattern,
        validation_only: true,
        target_write_requested: false
      })
    }
  );

  const body = await response.json();

  if (!response.ok) {
    const message =
      body?.payload?.message ??
      `${role} file connector validation failed: ${response.status}`;

    throw new Error(message);
  }

  return body;
}

/* =========================================================
   DEV DETERMINISTIC TEST QUALIFICATION
   Qualifies an existing DEV dry-run execution.
   Does NOT perform source writes, target writes or production actions.
   ========================================================= */

export async function postTestExecution(
  executionId: string
) {
  const response = await fetch(
    `${API_BASE}/v1/tests`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        execution_id: executionId
      })
    }
  );

  const body = await response.json();

  if (!response.ok) {
    const message =
      body?.payload?.message ??
      `Test qualification failed: ${response.status}`;

    throw new Error(message);
  }

  return body;
}


/* =========================================================
   A000 LIVE ADVANCED INTELLIGENCE
   Conversational planning and telemetry only.

   This call does not grant execution, write,
   production, or cutover authority.
   ========================================================= */

export type A000AssistantRecommendation = {
  id: string;
  priority: "HIGH" | "MEDIUM" | "LOW" | string;
  title: string;
  reason: string;
  category: string;
  navigation_key?: string | null;
  impact?: number;
  risk?: number;
  effort?: number;
  confidence?: number;
};

export type A000AssistantAction = {
  id: string;
  label: string;
  kind: string;
  navigation_key?: string | null;
  execution_mode: "NAVIGATE" | "SAFE_REMEDIATION_SIMULATION" | string;
  requires_approval: boolean;
  source_write?: boolean;
  target_write?: boolean;
  production_action?: boolean;
  reversible?: boolean;
  preview_required?: boolean;
  expected_result?: string;
};

export type A000AssistantBlocker = {
  id: string;
  severity: string;
  category: string;
  message: string;
  root_cause_hint?: string;
  navigation_key?: string | null;
};

export type A000AssistantContext = {
  migration_id?: string | null;
  stage?: string;
  status?: string;
  role?: string;
  environment?: string;
  mode?: string;
  intent?: string;
  metrics?: Record<string, number | string | null | undefined>;
  blockers?: A000AssistantBlocker[];
  authoritative_context_available?: boolean;
  readiness?: {
    score?: number;
    state?: string;
    dimensions?: Record<string, number>;
  };
  risk?: {
    score?: number;
    level?: string;
    drivers?: string[];
  };
  context_hash?: string;
};

export type A000AssistantRequestContext = {
  stage?: string;
  migrationId?: string | null;
  role?: string;
  mode?: string;
  goal?: string;
  constraints?: string[];
  watchMode?: boolean;
  changedEntities?: string[];
  includeCapabilityCatalog?: boolean;
  conversationSummary?: string;
};

export type A000LiveMessageResponse = {
  payload?: {
    reply?: string;
    voice_reply?: string;
    intent?: string;
    mode?: string;
    context?: A000AssistantContext;
    recommendations?: A000AssistantRecommendation[];
    next_actions?: A000AssistantAction[];
    suggested_questions?: string[];
    confidence?: { score?: number; label?: string; basis?: string };
    evidence?: Record<string, unknown>;
    root_cause_graph?: Record<string, unknown>;
    goal_plan?: Record<string, unknown> | null;
    constraints?: string[];
    permissions?: Record<string, boolean>;
    security?: Record<string, unknown>;
    safety?: Record<string, unknown>;
    model_route?: Record<string, unknown>;
    incremental_analysis?: Record<string, unknown>;
    cache?: Record<string, unknown>;
    observability?: Record<string, unknown>;
    capability_registry?: {
      total?: number;
      active?: number;
      layers?: Record<string, number>;
      execution_classes?: Record<string, number>;
      external_runtime_dependent?: number;
    };
    capabilities?: Array<Record<string, unknown>>;
    explainability?: Record<string, unknown>;
    watch?: Record<string, unknown>;
    audit?: Record<string, unknown>;
    verified_learning_context?: unknown;
    regression_context?: unknown;
    learning_safety?: unknown;
    shadow_runtime?: unknown;
    orchestration_runtime?: unknown;
    advanced_runtime?: unknown;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export async function postA000Message(
  message: string,
  context?: A000AssistantRequestContext,
): Promise<A000LiveMessageResponse> {
  const normalized = message.trim();
  if (!normalized) throw new Error("A000 message is required.");

  const response = await fetch(`${API_BASE}/v1/a000/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: normalized,
      stage: context?.stage ?? "",
      migration_id:
        context?.migrationId ??
        localStorage.getItem("kmitora.dev.migrationId") ??
        "",
      role: context?.role ?? localStorage.getItem("kmitora.assistant.role") ?? "ENGINEER",
      mode: context?.mode ?? localStorage.getItem("kmitora.assistant.mode") ?? "ASK",
      goal: context?.goal ?? localStorage.getItem("kmitora.assistant.goal") ?? "",
      constraints:
        context?.constraints ??
        JSON.parse(localStorage.getItem("kmitora.assistant.constraints") ?? "[]"),
      watch_mode:
        context?.watchMode ??
        localStorage.getItem("kmitora.assistant.watch") === "1",
      changed_entities: context?.changedEntities ?? [],
      include_capability_catalog: context?.includeCapabilityCatalog ?? false,
      conversation_summary: context?.conversationSummary ?? "",
    }),
  });

  const body = (await response.json()) as A000LiveMessageResponse;
  if (!response.ok) {
    const payload = body?.payload as Record<string, unknown> | undefined;
    const messageText =
      typeof payload?.message === "string"
        ? payload.message
        : `A000 request failed: ${response.status}`;
    throw new Error(messageText);
  }
  return body;
}

/* =========================================================
   UNIVERSAL BUSINESS LOGIC / TRANSFORMATION ENGINE
   Compile natural-language business rules against live source/target
   understanding. Planning/simulation only; no target write occurs here.
   ========================================================= */
export async function getUniversalTransformationStatus() {
  const response = await fetch(`${API_BASE}/v1/universal-transformations/status`);
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.payload?.message ?? `Transformation status failed: ${response.status}`);
  }
  return body;
}

export async function compileUniversalTransformations(migrationId: string) {
  const response = await fetch(`${API_BASE}/v1/universal-transformations/compile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ migration_id: migrationId }),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.payload?.message ?? `Transformation compile failed: ${response.status}`);
  }
  return body;
}

/* =========================================================
   EXECUTION CONTEXT
   Authoritative persisted DEV execution retrieval.
   Browser storage is display cache only.
   ========================================================= */

export async function getExecution(executionId: string) {
  const response = await fetch(
    `${API_BASE}/v1/executions/${encodeURIComponent(executionId)}`,
    { method: "GET" }
  );

  const text = await response.text();
  let body: any = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = {}; }

  if (!response.ok) {
    const message =
      body?.payload?.message ??
      `Execution retrieval failed: ${response.status}`;
    throw new Error(message);
  }

  return body;
}

export async function getLatestExecutionForMigration(migrationId: string) {
  const normalizedMigrationId = String(migrationId ?? "").trim();
  if (!normalizedMigrationId) return null;

  const response = await fetch(
    `${API_BASE}/v1/executions?migration_id=${encodeURIComponent(normalizedMigrationId)}`,
  );

  const body = await response.json();

  if (!response.ok) {
    const payload = body?.payload as Record<string, unknown> | undefined;
    const message =
      typeof payload?.message === "string"
        ? payload.message
        : `Execution lookup failed: ${response.status}`;
    throw new Error(message);
  }

  const collectExecutions = (value: unknown): Array<Record<string, unknown>> => {
    if (Array.isArray(value)) {
      return value.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      );
    }

    if (!value || typeof value !== "object") return [];

    const obj = value as Record<string, unknown>;
    const preferredKeys = ["executions", "items", "results", "data", "records"];

    for (const key of preferredKeys) {
      const nested = collectExecutions(obj[key]);
      if (nested.length) return nested;
    }

    const values = Object.values(obj);
    const directRecords = values.filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) &&
        typeof item === "object" &&
        !Array.isArray(item) &&
        ("execution_id" in (item as Record<string, unknown>) ||
          "status" in (item as Record<string, unknown>)),
    );

    if (directRecords.length) return directRecords;

    for (const nestedValue of values) {
      const nested = collectExecutions(nestedValue);
      if (nested.length) return nested;
    }

    return [];
  };

  const candidates = collectExecutions(body?.payload ?? body).filter(
    (item) =>
      String(item?.migration_id ?? "").trim() === normalizedMigrationId,
  );

  if (!candidates.length) return null;

  const statusRank = (status: unknown) => {
    switch (String(status ?? "").toUpperCase()) {
      case "POST_LOAD_COMPLETED":
        return 500;
      case "DRY_RUN_COMPLETED":
        return 400;
      case "DRY_RUN_COMPLETED_WITH_ERRORS":
        return 300;
      case "COMPLETED":
        return 200;
      default:
        return 100;
    }
  };

  const timeValue = (item: Record<string, unknown>) => {
    const raw =
      item.completed_at ??
      item.updated_at ??
      item.created_at ??
      item.timestamp ??
      item.executed_at ??
      "";
    const value = Date.parse(String(raw));
    return Number.isFinite(value) ? value : 0;
  };

  candidates.sort((a, b) => {
    const byStatus = statusRank(b.status) - statusRank(a.status);
    if (byStatus !== 0) return byStatus;
    return timeValue(b) - timeValue(a);
  });

  const selected = candidates[0];
  const selectedExecutionId = String(selected?.execution_id ?? selected?.id ?? "").trim();
  const selectedStatus = String(selected?.status ?? "").toUpperCase();

  // Keep the browser cache as a mirror of backend authority, never as the authority.
  if (selectedExecutionId) {
    localStorage.setItem("kmitora.dev.migrationId", normalizedMigrationId);
    localStorage.setItem("kmitora.dev.executionId", selectedExecutionId);
    localStorage.setItem("kmitora.dev.lastExecutionId", selectedExecutionId);
    localStorage.setItem("kmitora.dev.executionStatus", selectedStatus);

    window.dispatchEvent(
      new CustomEvent("kmitora:authoritative-run-context", {
        detail: {
          migration_id: normalizedMigrationId,
          execution_id: selectedExecutionId,
          status: selectedStatus,
        },
      }),
    );
  }

  return selected;
}

export async function getEvidenceById(
  evidenceId: string
) {
  const response = await fetch(
    `${API_BASE}/v1/evidence/${encodeURIComponent(evidenceId)}`
  );

  const body = await response.json();

  if (!response.ok) {
    const message =
      body?.payload?.message ??
      `Evidence lookup failed: ${response.status}`;

    throw new Error(message);
  }

  return body;
}

export async function getReconciliationById(
  reconciliationId: string
) {
  const response = await fetch(
    `${API_BASE}/v1/reconciliations/${encodeURIComponent(reconciliationId)}`
  );

  const body = await response.json();

  if (!response.ok) {
    const message =
      body?.payload?.message ??
      `Reconciliation lookup failed: ${response.status}`;

    throw new Error(message);
  }

  return body;
}
