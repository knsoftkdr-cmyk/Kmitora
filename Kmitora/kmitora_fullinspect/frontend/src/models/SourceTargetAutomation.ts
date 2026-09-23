export type AutomationObjectKind = "TABLE" | "VIEW" | "FILE" | "API" | "TOPIC" | "OBJECT";
export type AutomationObjectStatus = "READY" | "REVIEW" | "BLOCKED" | "UNANALYZED";

export type SourceTargetObject = {
  id: string;
  systemId: string;
  role: "SOURCE" | "TARGET";
  module: string;
  schema: string;
  name: string;
  kind: AutomationObjectKind;
  connector: string;
  status: AutomationObjectStatus;
  selected: boolean;
  imported: boolean;
  rowEstimate?: number;
  columnEstimate?: number;
  qualityScore?: number;
  readinessScore?: number;
  suggestedReadMode?: "FULL" | "INCREMENTAL" | "CDC" | "QUERY";
  suggestedWriteMode?: "INSERT" | "UPDATE" | "UPSERT" | "APPEND" | "TRUNCATE_LOAD" | "CDC_APPLY";
  confidence?: number;
};

export type ModuleSummary = {
  name: string;
  sourceObjects: number;
  targetObjects: number;
  ready: number;
  review: number;
  blocked: number;
};

