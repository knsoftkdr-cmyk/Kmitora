export type AutonomousDefectSeverity = "P0_CRITICAL" | "P1_HIGH" | "P2_MEDIUM" | "P3_LOW";
export type AutonomousDefectStatus = "OBSERVED" | "DIAGNOSED" | "SAFE_REMEDIATION_PLANNED" | "GOVERNED_REVIEW" | "RETEST_REQUIRED" | "VERIFIED";

export type KnowledgePackActivation = {
  id: string;
  name: string;
  topicCount: number;
  status: "ACTIVE";
  purpose: string;
};

export type AutonomousRequirement = {
  id: string;
  text: string;
  source: "BUSINESS_PROMPT" | "KNOWLEDGE_ITEM" | "WORKFLOW_STATE" | "TEST_EVIDENCE" | "SAFETY_POLICY";
};

export type AutonomousDefectObservation = {
  id: string;
  title: string;
  area: string;
  severity: AutonomousDefectSeverity;
  status: AutonomousDefectStatus;
  symptom: string;
  probableRootCause: string;
  businessImpact: string;
  evidence: string[];
  assignedAgents: string[];
  knowledgePacks: string[];
  safeAutoFix: boolean;
  recommendedAction: string;
  sourceWriteRequired: false;
  targetWriteRequired: false;
  productionActionRequired: boolean;
};

export type AutonomousDefectCycle = {
  id: string;
  createdAt: string;
  mode: "DEV_SAFE_AUTONOMOUS";
  knowledgePacks: KnowledgePackActivation[];
  totalKnowledgeTopics: number;
  requirements: AutonomousRequirement[];
  defects: AutonomousDefectObservation[];
  activatedAgents: string[];
  nextActions: string[];
  safety: {
    sourceWrites: 0;
    targetProductionWrites: 0;
    productionActions: 0;
    productionMigration: "DISABLED";
    cutover: "DISABLED";
  };
};

