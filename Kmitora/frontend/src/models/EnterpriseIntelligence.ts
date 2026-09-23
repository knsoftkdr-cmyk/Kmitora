import type { MigrationSystem } from "./MigrationTopology";
import type { KnowledgeItem } from "./KnowledgeContext";

export type EnterpriseLayer =
  | "BUSINESS"
  | "APPLICATION"
  | "DATA"
  | "DATABASE"
  | "FILE"
  | "API_INTEGRATION"
  | "INFRASTRUCTURE"
  | "SERVER_OS"
  | "NETWORK"
  | "SECURITY_IAM"
  | "HARDWARE_STORAGE"
  | "CLOUD_PLATFORM"
  | "OBSERVABILITY"
  | "CODE_CONFIGURATION"
  | "OPERATIONS_SUPPORT"
  | "SOURCE_ARCHITECTURE"
  | "TARGET_ARCHITECTURE";

export type DiscoveryCoverage = {
  layer: EnterpriseLayer;
  status: "AVAILABLE" | "PLANNED" | "ADAPTER_REQUIRED" | "NOT_APPLICABLE";
  evidence: string[];
  confidence: number;
};

export type DomainMatch = {
  id: number;
  name: string;
  score: number;
  evidence: string[];
};

export type AgentCapability =
  | "DOMAIN"
  | "BUSINESS_PROCESS"
  | "APPLICATION"
  | "DATA"
  | "MAPPING"
  | "TRANSFORMATION"
  | "DATA_QUALITY"
  | "VALIDATION"
  | "DEFECT"
  | "ROOT_CAUSE"
  | "ARCHITECTURE"
  | "INFRASTRUCTURE"
  | "NETWORK"
  | "SECURITY"
  | "PERFORMANCE"
  | "MIGRATION"
  | "RECONCILIATION"
  | "EVIDENCE"
  | "OPTIMIZATION"
  | "KNOWLEDGE";

export type DynamicAgent = {
  id: string;
  name: string;
  capabilities: AgentCapability[];
  activatedBecause: string;
  inheritedKnowledge: string[];
  status: "ACTIVE" | "STANDBY" | "CREATED_FOR_TASK";
};

export type DefectPriority = "P0_CRITICAL" | "P1_HIGH" | "P2_MEDIUM" | "P3_LOW";
export type DefectDisposition = "AUTO_SAFE" | "GOVERNED" | "ADVISORY";

export type EnterpriseDefect = {
  id: string;
  title: string;
  layer: EnterpriseLayer;
  priority: DefectPriority;
  symptom: string;
  probableRootCause: string;
  businessImpact: string;
  disposition: DefectDisposition;
  confidence: number;
  evidence: string[];
  recommendedAction: string;
  sourceWriteRequired: boolean;
  targetWriteRequired: boolean;
  productionChangeRequired: boolean;
};

export type SolutionOption = {
  id: string;
  title: string;
  approach: "FIX_CURRENT" | "WORKAROUND" | "TRANSFORM_DURING_MIGRATION" | "REDESIGN_TARGET" | "RETIRE_REPLACE";
  risk: "LOW" | "MEDIUM" | "HIGH";
  speed: "FAST" | "MEDIUM" | "LONGER_TERM";
  recommended: boolean;
  rationale: string;
};

export type EnterpriseIntelligenceInput = {
  problemPrompt: string;
  sources: MigrationSystem[];
  targets: MigrationSystem[];
  knowledgeItems: KnowledgeItem[];
};

export type EnterpriseIntelligenceState = {
  id: string;
  problemPrompt: string;
  domainMatches: DomainMatch[];
  primaryDomain: string;
  coverage: DiscoveryCoverage[];
  activatedAgents: DynamicAgent[];
  defects: EnterpriseDefect[];
  solutionOptions: SolutionOption[];
  canonicalFlow: string[];
  businessUnderstandingConfidence: number;
  safety: {
    readOnlyDiscovery: true;
    sourceWriteExecuted: false;
    targetWriteExecuted: false;
    productionActionExecuted: false;
    governedChangesRequired: boolean;
  };
  createdAt: string;
};

