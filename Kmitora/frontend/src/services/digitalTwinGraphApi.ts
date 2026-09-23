import type {
  EnterpriseTwinGraph,
  TwinTemporalState,
} from "../models/EnterpriseTwinGraph";

type Envelope<T> = {
  payload: T;
};

export type TwinImpactResult = {
  sourceNodeId: string;
  impactedNodes: Array<{ nodeId: string; depth: number }>;
  highlightNodeIds: string[];
  highlightEdgeIds: string[];
  production_action_executed: false;
};

export type TwinRcaResult = {
  selectedNodeId: string;
  pathNodeIds: string[];
  pathEdgeIds: string[];
  classification: string;
  authoritativeCause: boolean;
  requiresEvidenceValidation: boolean;
  production_action_executed: false;
};

export type TwinSimulationResult = {
  scenario: string;
  sourceNodeId: string;
  temporalState: "SIMULATED";
  highlightNodeIds: string[];
  highlightEdgeIds: string[];
  simulationTruth: string;
  target_write_executed: false;
  production_action_executed: false;
  production_cutover_executed: false;
};

async function readPayload<T>(response: Response): Promise<T> {
  const body = await response.json();

  if (!response.ok) {
    throw new Error(
      String(
        body?.payload?.message ??
          `Digital Twin request failed: ${response.status}`,
      ),
    );
  }

  return (body as Envelope<T>).payload;
}

function activeMigrationId(): string {
  // Pin the twin to the migration the operator is working on, otherwise a
  // demo or batch run that finished later would be projected instead.
  try {
    const raw = localStorage.getItem("kmitora.dev.discoveryResult");
    const parsed = raw ? JSON.parse(raw) : null;
    return String(parsed?.migration_id ?? "");
  } catch {
    return "";
  }
}

export async function getDigitalTwinGraph(
  temporalState: TwinTemporalState,
): Promise<EnterpriseTwinGraph> {
  const migrationId = activeMigrationId();

  const response = await fetch(
    `/api/v1/a000/digital-twin/graph?temporal_state=${temporalState}` +
      (migrationId
        ? `&migration_id=${encodeURIComponent(migrationId)}`
        : ""),
  );
  return readPayload<EnterpriseTwinGraph>(response);
}

export async function analyzeTwinImpact(
  nodeId: string,
): Promise<TwinImpactResult> {
  const response = await fetch(
    "/api/v1/a000/digital-twin/impact",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        node_id: nodeId,
        max_depth: 4,
      }),
    },
  );
  return readPayload<TwinImpactResult>(response);
}

export async function analyzeTwinRca(
  nodeId: string,
): Promise<TwinRcaResult> {
  const response = await fetch(
    "/api/v1/a000/digital-twin/rca",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ node_id: nodeId }),
    },
  );
  return readPayload<TwinRcaResult>(response);
}

export async function simulateTwinScenario(
  nodeId: string,
  scenario: string,
): Promise<TwinSimulationResult> {
  const response = await fetch(
    "/api/v1/a000/digital-twin/simulate",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        node_id: nodeId,
        scenario,
      }),
    },
  );
  return readPayload<TwinSimulationResult>(response);
}

