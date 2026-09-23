import { previewFileSource } from "./api";
import type { A000WorkflowState } from "../models/AutomationWorkflow";
import type { DataViewPayload, DataViewTable } from "../models/DataViewer";
import type { MigrationSystem } from "../models/MigrationTopology";

function normalizePreview(role: "SOURCE" | "TARGET", system: MigrationSystem, result: any): DataViewPayload {
  const payload = result?.payload ?? result ?? {};
  const sheets = Array.isArray(payload.sheets) ? payload.sheets : [];
  const tables: DataViewTable[] = sheets.map((sheet: any) => ({
    name: String(sheet.name ?? sheet.entity ?? "data"),
    fields: Array.isArray(sheet.fields) ? sheet.fields.map(String) : [],
    rows: Array.isArray(sheet.rows) ? sheet.rows : [],
    rowCount: Number(sheet.row_count ?? sheet.rows?.length ?? 0),
  }));
  return {
    role,
    systemId: system.id,
    title: `${system.name} ${role === "SOURCE" ? "Source" : "Target"} View`,
    mode: "CURRENT_DATA",
    tables,
    summary: {
      connector: system.connector,
      tableCount: tables.length,
      productionActionExecuted: false,
    },
    readOnly: true,
  };
}

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === "object" ? (value as Record<string, any>) : {};
}

export async function loadSystemDataView(args: {
  system: MigrationSystem;
  workflowState: A000WorkflowState | null;
}): Promise<DataViewPayload> {
  const { system, workflowState } = args;
  const role = system.role;

  if (system.category === "FILE" && system.path && system.pattern && /\.(xlsx|xls|csv|json|parquet)$/i.test(system.pattern)) {
    const result = await previewFileSource(system.path.trim(), system.pattern.trim(), 25);
    return normalizePreview(role, system, result);
  }

  if (role === "TARGET") {
    const discovered = workflowState?.results.find((item) => item.targetSystemId === system.id && item.status === "DISCOVERED" && item.result);
    if (discovered?.result) {
      const discovery = asObject(discovered.result);
      const staging = asObject(discovery.target_staging_plan);
      const buckets = [
        ["Ready", staging.ready_records],
        ["Review", staging.review_records],
        ["Quarantine", staging.quarantine_records],
        ["Rejected", staging.rejected_records],
      ] as const;
      const tables: DataViewTable[] = buckets
        .filter(([, rows]) => Array.isArray(rows))
        .map(([name, rows]) => {
          const list = rows as Record<string, unknown>[];
          const fields = list.length ? Object.keys(asObject(list[0])).filter((x) => !x.startsWith("_")) : [];
          return { name, fields, rows: list.slice(0, 25), rowCount: list.length };
        });
      return {
        role: "TARGET",
        systemId: system.id,
        title: `${system.name} Staged Target Preview`,
        mode: "STAGED_PREVIEW",
        tables,
        summary: {
          migrationId: discovered.migrationId,
          ready: Array.isArray(staging.ready_records) ? staging.ready_records.length : 0,
          review: Array.isArray(staging.review_records) ? staging.review_records.length : 0,
          quarantine: Array.isArray(staging.quarantine_records) ? staging.quarantine_records.length : 0,
          rejected: Array.isArray(staging.rejected_records) ? staging.rejected_records.length : 0,
          targetWriteExecuted: false,
        },
        message: "Preview is derived from KMITORA staging evidence. No target write has been executed.",
        readOnly: true,
      };
    }
  }

  return {
    role,
    systemId: system.id,
    title: `${system.name} ${role === "SOURCE" ? "Source" : "Target"} View`,
    mode: "SCHEMA_ONLY",
    tables: [],
    summary: { connector: system.connector, targetWriteExecuted: false },
    message: role === "TARGET"
      ? "Target is connected, but migrated/staged data is not available yet. Run supported discovery/transformation first."
      : "This connector is validated, but its live data preview adapter is not enabled yet.",
    readOnly: true,
  };
}

