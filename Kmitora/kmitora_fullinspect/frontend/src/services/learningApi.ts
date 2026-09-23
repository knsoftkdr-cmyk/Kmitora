export type VerifiedLearningResponse = {
  learning_id: string;
  created_at: string;
  status: "COMPLETE";
  promotion_gate: "PASS";
  promotion_progress: number;
  storage_mode?: string;
  durable?: boolean;
  evidence_id: string;
  evidence_sha256?: string;
  migration_id: string;
  approval_id: string;
  execution_id: string;
  reconciliation_id: string;
  verified_outcomes: Array<{
    id: string;
    category: string;
    subject: string;
    status: "VERIFIED";
    provenance: string;
  }>;
  regression_protection: {
    enabled: boolean;
    execution_success_required: boolean;
    reconciliation_pass_required: boolean;
    zero_target_write_required: boolean;
    zero_production_action_required: boolean;
  };
  provenance: Record<string, unknown>;
  safety: {
    source_write_executed: boolean;
    target_write_executed: boolean;
    production_action_executed: boolean;
    production_executed: boolean;
    target_write_count?: number;
    production_action_count?: number;
  };
  idempotent_replay?: boolean;
};

export async function postVerifiedLearning(
  evidenceId: string,
): Promise<VerifiedLearningResponse> {
  const response = await fetch(
    "/api/v1/learning",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        evidence_id: evidenceId,
      }),
    },
  );

  const body = await response.json();

  if (!response.ok) {
    throw new Error(
      body?.payload?.message ??
        `Verified learning failed: ${response.status}`,
    );
  }

  return body.payload as VerifiedLearningResponse;
}

export async function getVerifiedLearningByEvidence(
  evidenceId: string,
): Promise<VerifiedLearningResponse | null> {
  const response = await fetch(
    `/api/v1/learning?evidence_id=${encodeURIComponent(evidenceId)}`,
    {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
    },
  );

  if (response.status === 404) {
    return null;
  }

  const body = await response.json();

  if (!response.ok) {
    throw new Error(
      body?.payload?.message ??
        `Verified learning lookup failed: ${response.status}`,
    );
  }

  return body.payload as VerifiedLearningResponse;
}
