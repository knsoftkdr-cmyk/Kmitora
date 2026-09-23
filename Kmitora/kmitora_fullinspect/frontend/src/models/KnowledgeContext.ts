import type { MigrationSystem } from "./MigrationTopology";

export type KnowledgeSourceType =
  | "PROMPT"
  | "BUSINESS_DOCUMENT"
  | "ARCHITECTURE_DOCUMENT"
  | "BUSINESS_RULES"
  | "PROCESS_FLOW"
  | "DATA_MODEL"
  | "MAPPING_SPEC"
  | "TRANSFORMATION_SPEC"
  | "TEST_CASE"
  | "IMAGE_OR_DIAGRAM"
  | "API_SPEC"
  | "CODE"
  | "OTHER";

export type KnowledgeItemStatus =
  | "REGISTERED"
  | "UNDERSTOOD"
  | "REVIEW_REQUIRED"
  | "BACKEND_INGESTION_REQUIRED";

export type KnowledgeItem = {
  id: string;
  sourceType: KnowledgeSourceType;
  title: string;
  text?: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
  status: KnowledgeItemStatus;
  addedAt: string;
  confidence?: number;
  extractedRuleCount?: number;
};

export type BusinessRuleCandidate = {
  id: string;
  statement: string;
  sourceItemId: string;
  confidence: number;
  status: "CANDIDATE" | "ACCEPTED" | "REVIEW_REQUIRED";
};

export type A000IntentPlan = {
  id: string;
  prompt: string;
  detectedDomain: string;
  operations: string[];
  sources: Pick<MigrationSystem, "id" | "name" | "connector">[];
  targets: Pick<MigrationSystem, "id" | "name" | "connector">[];
  ruleCandidates: BusinessRuleCandidate[];
  knowledgeItemCount: number;
  confidence: number;
  executionPolicy: "PREVIEW_FIRST_GOVERNED";
  targetWriteRequested: false;
  productionActionExecuted: false;
  createdAt: string;
};

