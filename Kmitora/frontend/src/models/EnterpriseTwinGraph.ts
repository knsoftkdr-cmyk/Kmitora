export type TwinLayerId =
  | "L0_ENTERPRISE"
  | "L1_SYSTEM"
  | "L2_DATA"
  | "L3_PROCESS"
  | "L4_RUNTIME"
  | "L5_INTELLIGENCE"
  | "L6_GOVERNANCE"
  | "L7_RISK"
  | "L8_SIMULATION"
  | "L9_EVIDENCE";

export type TwinTemporalState =
  | "BEFORE"
  | "CURRENT"
  | "PROPOSED"
  | "SIMULATED"
  | "AFTER";

export type TwinGraphNode = {
  id: string;
  label: string;
  layer: TwinLayerId;
  type: string;
  x: number;
  y: number;
  environment: "DEV" | "QA" | "UAT" | "PROD" | "GLOBAL";
  state: "HEALTHY" | "REVIEW" | "RISK" | "BLOCKED" | "PLANNED";
  risk: number;
  confidence: number;
  evidenceIds: string[];
  metadata: Record<string, string | number | boolean>;
};

export type TwinGraphEdgeType =
  | "CONTAINS"
  | "DEPENDS_ON"
  | "READS_FROM"
  | "WRITES_TO"
  | "CALLS"
  | "TRANSFORMS_TO"
  | "MIGRATES_TO"
  | "GOVERNED_BY"
  | "APPROVED_BY"
  | "TESTED_BY"
  | "VALIDATED_BY"
  | "RECONCILED_WITH"
  | "EVIDENCED_BY"
  | "EXECUTED_BY"
  | "CAUSED_BY"
  | "IMPACTS"
  | "PREDICTED_TO_IMPACT"
  | "ROLLS_BACK_TO"
  | "LEARNED_FROM";

export type TwinGraphEdge = {
  id: string;
  source: string;
  target: string;
  type: TwinGraphEdgeType;
  confidence: number;
  evidenceIds: string[];
};

export type EnterpriseTwinGraph = {
  generatedAt: string;
  temporalState: TwinTemporalState;
  nodes: TwinGraphNode[];
  edges: TwinGraphEdge[];
  safety: {
    readOnly: true;
    productionWriteAllowed: false;
    productionCutoverAllowed: false;
    destructiveActionAllowed: false;
    policyBypassAllowed: false;
  };
};

