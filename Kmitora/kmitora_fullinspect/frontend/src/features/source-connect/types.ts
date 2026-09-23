export type SourceType =
  | "postgresql"
  | "oracle"
  | "sqlserver"
  | "mysql"
  | "snowflake"
  | "file";

export interface SourceConnectionDraft {
  name: string;
  type: SourceType;
  host?: string;
  port?: number;
  database?: string;
  schema?: string;
  username?: string;
  password?: string;
  filePath?: string;
}

export interface SourceConnection {
  port?: number | null;
  filePath?: string | null;
  id: string;
  name: string;
  type: SourceType;
  status: "connected" | "disconnected" | "error";
  host?: string;
  database?: string;
  schema?: string;
}

export interface SourceObject {
  schema: string;
  name: string;
  type: "table" | "view";
  rowCount?: number;
}

export interface SourcePreview {
  columns: string[];
  rows: Record<string, unknown>[];
  totalRows?: number;
}

export interface SourceConnectAdapter {
  createSource: (draft: SourceConnectionDraft) => Promise<SourceConnection>;
  testSource: (draft: SourceConnectionDraft) => Promise<{ ok: boolean; message?: string }>;
  listSources: () => Promise<SourceConnection[]>;
  listObjects: (sourceId: string) => Promise<SourceObject[]>;
  previewObject: (
    sourceId: string,
    schema: string,
    objectName: string,
    limit: number
  ) => Promise<SourcePreview>;
}

