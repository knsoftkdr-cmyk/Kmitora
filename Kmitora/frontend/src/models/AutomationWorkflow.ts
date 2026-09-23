export type AutomationStage =
  | "CONNECT"
  | "DISCOVERY_QUEUED"
  | "DISCOVERY_RUNNING"
  | "DISCOVERY_COMPLETE"
  | "PARTIAL_AUTOMATION_WAITING_FOR_ADAPTERS"
  | "FAILED";

export type RelationshipAutomationResult = {
  relationshipId: string;
  sourceSystemId: string;
  targetSystemId: string;
  migrationId: string;
  status: "DISCOVERED" | "SKIPPED" | "FAILED";
  reason?: string;
  result?: unknown;
};

export type A000WorkflowState = {
  status: AutomationStage;
  currentStage: AutomationStage;
  topologySignature: string;
  startedAt?: string;
  updatedAt: string;
  completedAt?: string;
  totalRelationships: number;
  discoveredRelationships: number;
  skippedRelationships: number;
  failedRelationships: number;
  results: RelationshipAutomationResult[];
  targetWriteRequested: false;
  targetWriteExecuted: false;
  productionActionExecuted: false;
};

