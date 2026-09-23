import type { MigrationSystem, SystemRole } from "./MigrationTopology";
import type { KnowledgeItem } from "./KnowledgeContext";

export type TwinRole = "AS_IS" | "TO_BE" | "TRANSITION" | "OPERATIONAL";

export type DigitalTwinType =
  | "ENTERPRISE"
  | "BUSINESS_PROCESS"
  | "APPLICATION"
  | "DATA"
  | "DATABASE"
  | "INTEGRATION"
  | "INFRASTRUCTURE"
  | "NETWORK"
  | "SECURITY"
  | "ENVIRONMENT"
  | "DEFECT"
  | "MIGRATION"
  | "TARGET_PREVIEW"
  | "MIGRATION_WAVE"
  | "ASSET"
  | "FACILITY"
  | "SUPPLY_CHAIN";

export type TwinStatus = "ACTIVE" | "PLANNED" | "ADAPTER_REQUIRED" | "NOT_APPLICABLE";

export type TwinQuality = {
  accuracy: number;
  completeness: number;
  timeliness: number;
  consistency: number;
  fidelity: number;
  synchronizationAccuracy: number;
  confidence: number;
};

export type TwinNode = {
  id: string;
  label: string;
  kind: string;
  sourceSystemId?: string;
  targetSystemId?: string;
  state?: string;
  metadata?: Record<string, string | number | boolean>;
};

export type TwinRelationship = {
  id: string;
  from: string;
  to: string;
  type: string;
  confidence: number;
};

export type DigitalTwin = {
  id: string;
  name: string;
  type: DigitalTwinType;
  role: TwinRole;
  status: TwinStatus;
  purpose: string;
  systems: string[];
  nodes: TwinNode[];
  relationships: TwinRelationship[];
  quality: TwinQuality;
  evidence: string[];
  lastSynchronizedAt?: string;
  readOnly: boolean;
};

export type DigitalThreadEvent = {
  id: string;
  stage:
    | "REQUIREMENT"
    | "SOURCE"
    | "RULE"
    | "MAPPING"
    | "TRANSFORMATION"
    | "VALIDATION"
    | "TARGET_PREVIEW"
    | "EXECUTION"
    | "RECONCILIATION"
    | "EVIDENCE";
  label: string;
  evidence: string[];
  status: "OBSERVED" | "INFERRED" | "PLANNED" | "PENDING";
  confidence: number;
};

export type TwinScenario = {
  id: string;
  name: string;
  type: "WHAT_IF" | "STRESS" | "FAILURE" | "CAPACITY" | "COUNTERFACTUAL" | "DIGITAL_REHEARSAL";
  description: string;
  status: "READY" | "ADAPTER_REQUIRED";
  expectedChecks: string[];
  targetWriteRequested: false;
  productionActionExecuted: false;
};

export type TwinRecommendation = {
  id: string;
  category: "KEEP" | "FIX" | "CLEANSE" | "TRANSFORM" | "REDESIGN" | "REPLACE" | "ARCHIVE" | "DECOMMISSION" | "SIMULATE";
  title: string;
  rationale: string;
  confidence: number;
  governed: boolean;
};

export type DigitalTwinInput = {
  sources: MigrationSystem[];
  targets: MigrationSystem[];
  knowledgeItems: KnowledgeItem[];
  problemPrompt?: string;
  migrationPrompt?: string;
};

export type DigitalTwinState = {
  id: string;
  generatedAt: string;
  asIsTwinId: string;
  toBeTwinId: string;
  migrationTwinId: string;
  twins: DigitalTwin[];
  digitalThread: DigitalThreadEvent[];
  scenarios: TwinScenario[];
  recommendations: TwinRecommendation[];
  intelligenceLoop: string[];
  safety: {
    readOnlyModeling: true;
    sourceWriteExecuted: false;
    targetWriteExecuted: false;
    productionActionExecuted: false;
    controlActionsGoverned: true;
  };
};

export type SystemTwinBinding = {
  systemId: string;
  role: SystemRole;
  twinId: string;
};

