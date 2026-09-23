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

export type A000LiveMessageResponse = {
  payload?: {
    reply?: string;
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
  message: string
): Promise<A000LiveMessageResponse> {
  const normalized = message.trim();

  if (!normalized) {
    throw new Error("A000 message is required.");
  }

  const response = await fetch(
    `${API_BASE}/v1/a000/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: normalized,
      }),
    }
  );

  const body =
    (await response.json()) as A000LiveMessageResponse;

  if (!response.ok) {
    const payload =
      body?.payload as
        | Record<string, unknown>
        | undefined;

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
