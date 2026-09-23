export type ViewerRole = "SOURCE" | "TARGET";

export type DataViewTable = {
  name: string;
  fields: string[];
  rows: Record<string, unknown>[];
  rowCount?: number;
};

export type DataViewPayload = {
  role: ViewerRole;
  systemId: string;
  title: string;
  mode: "CURRENT_DATA" | "STAGED_PREVIEW" | "MIGRATED_DATA" | "SCHEMA_ONLY";
  tables: DataViewTable[];
  summary: Record<string, string | number | boolean>;
  message?: string;
  readOnly: true;
};

