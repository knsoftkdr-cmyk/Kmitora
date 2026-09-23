export type StageStatus = "complete" | "active" | "pending" | "blocked";

export type LifecycleStage = {
  key: string;
  label: string;
  progress: number;
  status: StageStatus;
  eta?: string;
  summary?: string;
};

export type ActivityEvent = {
  time: string;
  title: string;
  detail?: string;
  severity?: "info" | "success" | "warning" | "error";
};

export type MappingRow = {
  source: string;
  target: string;
  confidence: number;
  decision: "ACCEPT" | "REVIEW" | "REJECT";
  action: "DIRECT_MAP" | "NORMALIZE" | "RELATIONSHIP_ONLY";
  rule?: string;
};

export type ValidationCard = {
  id: string;
  title: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  status: "PASSED" | "AUTO_REMEDIATED" | "REVIEW_REQUIRED" | "BLOCKED";
  summary: string;
  evidence: string;
};

