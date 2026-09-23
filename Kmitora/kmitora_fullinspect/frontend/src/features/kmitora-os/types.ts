export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";
export interface SystemSummary {
  id: "source" | "target";
  name: string;
  status: ConnectionStatus;
  understandingPercent?: number;
  counts?: Partial<Record<"tables"|"views"|"procedures"|"packages"|"functions"|"triggers"|"indexes"|"jobs"|"interfaces", number>>;
}
export interface RequirementDraft { prompt: string; attachments: Array<{id:string; name:string; type:string}>; }
export interface RequirementUnderstanding {
  domain?: string; scopeSummary?: string; sourceObjects?: number; targetObjects?: number;
  dependencies?: number; businessRules?: number; transformations?: number;
  referenceMappings?: number; conflicts?: number; missingInformation?: number;
  confidence?: number; bullets?: string[];
}
export interface ReadinessSummary {
  sourceReady:boolean; targetReady:boolean; requirementReady:boolean; planReady:boolean;
  dryRunReady:boolean; migrationAuthorized:boolean;
}
export interface KmitoraUiAdapter {
  connectSource?:()=>void|Promise<void>; connectTarget?:()=>void|Promise<void>;
  openSourceData?:()=>void; openTargetData?:()=>void;
  openSourceUnderstanding?:()=>void; openTargetUnderstanding?:()=>void;
  analyseRequirement?:(draft:RequirementDraft)=>void|Promise<void>;
  openRequirementReview?:()=>void; openPlan?:()=>void; runDryRun?:()=>void|Promise<void>;
  requestMigrationAuthorization?:()=>void|Promise<void>; openEngineeringView?:()=>void;
  openOperations?:()=>void; askKmitora?:(prompt:string)=>void|Promise<void>;
}

