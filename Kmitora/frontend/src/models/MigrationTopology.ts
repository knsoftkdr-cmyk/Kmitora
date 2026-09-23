export type SystemRole = "SOURCE" | "TARGET";

export type TopologyType =
  | "ONE_TO_ONE"
  | "ONE_TO_MANY"
  | "MANY_TO_ONE"
  | "MANY_TO_MANY";

export type ConnectorCategory =
  | "DATABASE"
  | "FILE"
  | "DATA_WAREHOUSE"
  | "BIG_DATA"
  | "CLOUD_STORAGE"
  | "API"
  | "APPLICATION"
  | "SAAS"
  | "MAINFRAME"
  | "MESSAGING"
  | "ETL_INTEGRATION"
  | "CUSTOM";

export type ConnectionStatus =
  | "NOT_CONFIGURED"
  | "CONFIGURED"
  | "TESTING"
  | "VALIDATED"
  | "FAILED";

export type MigrationSystem = {
  id: string;
  role: SystemRole;
  name: string;
  category: ConnectorCategory;
  connector: string;
  host?: string;
  port?: string;
  service?: string;
  path?: string;
  pattern?: string;
  username?: string;
  secretRef?: string;
  status: ConnectionStatus;
  message?: string;
  metadataAccessible: boolean;
  authenticationValidated: boolean;
  readPermissionValidated: boolean;
  writePermissionValidated: boolean;
  targetWriteRequested: false;
  targetWriteExecuted: false;
  productionActionExecuted: false;
  validatedAt?: string;
};

export type TopologyRelationship = {
  id: string;
  sourceSystemId: string;
  targetSystemId: string;
  confidence?: number;
  discoveredBy: "USER" | "A000" | "METADATA" | "BUSINESS_RULE" | "LINEAGE";
  status: "PROPOSED" | "VALIDATED" | "REVIEW_REQUIRED";
};

export type ConnectionReadiness = {
  sourceCount: number;
  validatedSourceCount: number;
  targetCount: number;
  validatedTargetCount: number;
  allSourcesValidated: boolean;
  allTargetsValidated: boolean;
  topologyValidated: boolean;
  overallReady: boolean;
  workflowEligible: boolean;
  targetWriteRequested: false;
  targetWriteExecuted: false;
  productionActionExecuted: false;
};

export type MigrationTopology = {
  topologyId: string;
  topologyType: TopologyType;
  sources: MigrationSystem[];
  targets: MigrationSystem[];
  relationships: TopologyRelationship[];
  readiness: ConnectionReadiness;
  createdAt: string;
  updatedAt: string;
};

