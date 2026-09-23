export type TargetType =
  | "postgresql"
  | "oracle"
  | "sqlserver"
  | "mysql"
  | "snowflake"
  | "mariadb"
  | "db2"
  | "teradata"
  | "sybase"
  | "informix"
  | "access"
  | "other";

export interface TargetConnectionDraft {
  name: string;
  type: TargetType;
  host: string;
  port: number;
  database: string;
  schema?: string;
  username: string;
  password: string;
  environment?: "DEV" | "QA" | "UAT" | "PROD";
}

export interface TargetConnection {
  id: string;
  name: string;
  type: TargetType;
  status: "connected" | "disconnected" | "error";
  host?: string;
  port?: number;
  database?: string;
  schema?: string;
  environment?: "DEV" | "QA" | "UAT" | "PROD";
}

export interface TargetObject {
  schema: string;
  name: string;
  type: "table" | "view";
}

export interface TargetColumn {
  name: string;
  dataType: string;
  nullable: boolean;
  ordinal: number;
}

export interface TargetPreview {
  columns: string[];
  rows: Record<string, unknown>[];
  totalRows?: number | null;
}

export interface TargetConnectAdapter {
  testTarget: (draft: TargetConnectionDraft) => Promise<{ ok: boolean; message?: string }>;
  createTarget: (draft: TargetConnectionDraft) => Promise<TargetConnection>;
  listTargets: () => Promise<TargetConnection[]>;
  listObjects: (targetId: string) => Promise<TargetObject[]>;
  getStructure: (targetId: string, schema: string, objectName: string) => Promise<{ columns: TargetColumn[] }>;
  previewObject: (
    targetId: string,
    schema: string,
    objectName: string,
    limit: number
  ) => Promise<TargetPreview>;
  deleteTarget: (targetId: string) => Promise<{ ok: boolean }>;
}


