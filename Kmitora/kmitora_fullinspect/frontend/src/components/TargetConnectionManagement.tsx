import { useMemo, useState } from "react";
import {
  Cable,
  CheckCircle2,
  Database,
  Eye,
  LoaderCircle,
  Pencil,
  RefreshCw,
  Table2,
  Trash2,
} from "lucide-react";

type Props = {
  system: any;
  onEdit?: () => void;
  onDeleted?: () => void;
};

type RuntimeTarget = {
  id: string;
  name?: string;
  type?: string;
  status?: string;
  host?: string;
  port?: number | string;
  database?: string;
  schema?: string;
  environment?: string;
};

type TargetObject = {
  schema?: string;
  name?: string;
  type?: string;
};

type StructureColumn = {
  name?: string;
  type?: string;
  data_type?: string;
  nullable?: boolean | string;
  is_nullable?: string;
  default?: unknown;
  ordinal_position?: number;
};

function databaseName(system: any) {
  return String(
    system?.database ??
    system?.service ??
    system?.resource ??
    ""
  ).trim();
}

function schemaName(system: any) {
  return String(system?.schema ?? "public").trim() || "public";
}

function sameTarget(runtime: RuntimeTarget, system: any) {
  const runtimeHost = String(runtime.host ?? "").toLowerCase();
  const systemHost = String(system?.host ?? "").toLowerCase();

  const runtimeDb = String(runtime.database ?? "").toLowerCase();
  const systemDb = databaseName(system).toLowerCase();

  const runtimeName = String(runtime.name ?? "").toLowerCase();
  const systemName = String(system?.name ?? "").toLowerCase();

  if (runtimeHost && systemHost && runtimeHost !== systemHost) return false;
  if (runtimeDb && systemDb && runtimeDb !== systemDb) return false;

  if (runtimeDb && systemDb) return true;
  if (runtimeName && systemName && runtimeName === systemName) return true;

  return false;
}

async function readJson(response: Response) {
  const text = await response.text();

  let payload: any = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    const message =
      payload?.error ??
      payload?.message ??
      text ??
      `HTTP ${response.status}`;

    throw new Error(String(message));
  }

  return payload;
}

export default function TargetConnectionManagement({
  system,
  onEdit,
  onDeleted,
}: Props) {
  const [runtimeTarget, setRuntimeTarget] =
    useState<RuntimeTarget | null>(null);

  const [objects, setObjects] =
    useState<TargetObject[]>([]);

  const [selectedObject, setSelectedObject] =
    useState<TargetObject | null>(null);

  const [structure, setStructure] =
    useState<StructureColumn[]>([]);

  const [previewColumns, setPreviewColumns] =
    useState<string[]>([]);

  const [previewRows, setPreviewRows] =
    useState<any[]>([]);

  const [mode, setMode] =
    useState<"OBJECTS" | "STRUCTURE" | "DATA">("OBJECTS");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const activeTargetId =
    typeof window !== "undefined"
      ? localStorage.getItem("kmitora.active.targetId")
      : null;

  const isActive =
    Boolean(runtimeTarget?.id) &&
    runtimeTarget?.id === activeTargetId;

  const selectedTitle = useMemo(() => {
    if (!selectedObject) return "";
    return `${selectedObject.schema ?? schemaName(system)}.${selectedObject.name ?? ""}`;
  }, [selectedObject, system]);

  async function resolveRuntimeTarget() {
    const response = await fetch("/target-api/v1/targets", {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    const payload = await readJson(response);

    const list: RuntimeTarget[] =
      Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.items)
          ? payload.items
          : [];

    const matched =
      list.find((item) => sameTarget(item, system)) ??
      (list.length === 1 ? list[0] : null);

    if (!matched?.id) {
      throw new Error(
        "Connected KMITORA runtime target could not be resolved."
      );
    }

    setRuntimeTarget(matched);
    return matched;
  }

  async function loadObjects(showSuccess = true) {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const target =
        runtimeTarget?.id
          ? runtimeTarget
          : await resolveRuntimeTarget();

      const response = await fetch(
        `/target-api/v1/targets/${encodeURIComponent(target.id)}/objects`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        }
      );

      const payload = await readJson(response);

      const list: TargetObject[] =
        Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.items)
            ? payload.items
            : [];

      setObjects(list);

      if (list.length > 0) {
        const keepSelected =
          selectedObject &&
          list.find(
            (item) =>
              item.name === selectedObject.name &&
              item.schema === selectedObject.schema
          );

        setSelectedObject(
          keepSelected ??
          list[0]
        );
      }

      if (list.length === 0) {
        setSelectedObject(null);
        setStructure([]);
        setPreviewColumns([]);
        setPreviewRows([]);
        setMessage(
          "Connection is registered, but zero tables/views were returned."
        );
      }

      if (list.length > 0 && showSuccess) {
        setMessage(
          `${list.length} target table/view object(s) discovered.`
        );
      }

      setMode("OBJECTS");
      return list;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to discover target objects."
      );
      return [];
    } finally {
      setLoading(false);
    }
  }

  async function testConnection() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const target =
        runtimeTarget?.id
          ? runtimeTarget
          : await resolveRuntimeTarget();

      const response = await fetch(
        `/target-api/v1/targets/${encodeURIComponent(target.id)}/objects`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        }
      );

      const payload = await readJson(response);

      const list =
        Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.items)
            ? payload.items
            : [];

      setObjects(list);

      if (list.length > 0) {
        setSelectedObject(list[0]);
      }

      setMessage(
        `Target connectivity verified. ${list.length} database object(s) visible.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Target connectivity test failed."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadStructure(object?: TargetObject | null) {
    const chosen =
      object ??
      selectedObject;

    if (!chosen?.name) {
      setError("Select a target table/view first.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const target =
        runtimeTarget?.id
          ? runtimeTarget
          : await resolveRuntimeTarget();

      const schema =
        chosen.schema ??
        target.schema ??
        schemaName(system);

      const url =
        `/target-api/v1/targets/${encodeURIComponent(target.id)}` +
        `/structure?schema=${encodeURIComponent(schema)}` +
        `&object=${encodeURIComponent(chosen.name)}`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      const payload = await readJson(response);

      const columns =
        Array.isArray(payload?.columns)
          ? payload.columns
          : Array.isArray(payload)
            ? payload
            : [];

      setSelectedObject(chosen);
      setStructure(columns);
      setMode("STRUCTURE");

      setMessage(
        `${schema}.${chosen.name} structure loaded.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load target structure."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadPreview(object?: TargetObject | null) {
    const chosen =
      object ??
      selectedObject;

    if (!chosen?.name) {
      setError("Select a target table/view first.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const target =
        runtimeTarget?.id
          ? runtimeTarget
          : await resolveRuntimeTarget();

      const schema =
        chosen.schema ??
        target.schema ??
        schemaName(system);

      const url =
        `/target-api/v1/targets/${encodeURIComponent(target.id)}` +
        `/preview?schema=${encodeURIComponent(schema)}` +
        `&object=${encodeURIComponent(chosen.name)}` +
        `&limit=25`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      const payload = await readJson(response);

      const rows =
        Array.isArray(payload?.rows)
          ? payload.rows
          : [];

      const columns =
        Array.isArray(payload?.columns)
          ? payload.columns
          : rows.length > 0
            ? Object.keys(rows[0])
            : [];

      setSelectedObject(chosen);
      setPreviewRows(rows);
      setPreviewColumns(columns);
      setMode("DATA");

      setMessage(
        `${schema}.${chosen.name} read-only preview loaded.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to preview target data."
      );
    } finally {
      setLoading(false);
    }
  }

  async function setActiveTarget() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const target =
        runtimeTarget?.id
          ? runtimeTarget
          : await resolveRuntimeTarget();

      localStorage.setItem(
        "kmitora.active.targetId",
        target.id
      );

      localStorage.setItem(
        "kmitora.dev.targetRuntimeConnection",
        JSON.stringify(target)
      );

      window.dispatchEvent(
        new CustomEvent("kmitora:target-activated", {
          detail: {
            targetId: target.id,
          },
        })
      );

      setMessage(
        `${target.name ?? system?.name ?? "Target"} is now the active DEV target.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to activate target."
      );
    } finally {
      setLoading(false);
    }
  }

  function editConnection() {
    setError("");
    setMessage(
      "Edit mode enabled. Update the connection fields above and run Validate Target again. Existing password is never displayed."
    );

    if (onEdit) {
      onEdit();
    }
  }

  async function deleteConnection() {
    setError("");
    setMessage("");

    const target =
      runtimeTarget?.id
        ? runtimeTarget
        : await resolveRuntimeTarget();

    const accepted = window.confirm(
      `Delete target connection "${target.name ?? system?.name ?? "Target"}"?\n\n` +
      "This removes only the KMITORA connection registration. " +
      "It does NOT delete the PostgreSQL database, schema, tables or records."
    );

    if (!accepted) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `/target-api/v1/targets/${encodeURIComponent(target.id)}`,
        {
          method: "DELETE",
          headers: {
            Accept: "application/json",
          },
        }
      );

      await readJson(response);

      if (
        localStorage.getItem("kmitora.active.targetId") ===
        target.id
      ) {
        localStorage.removeItem("kmitora.active.targetId");
      }

      localStorage.removeItem(
        "kmitora.dev.targetRuntimeConnection"
      );

      localStorage.removeItem(
        "kmitora.dev.targetConnection"
      );

      localStorage.removeItem(
        "kmitora.dev.targetValidation"
      );

      setRuntimeTarget(null);
      setObjects([]);
      setSelectedObject(null);
      setStructure([]);
      setPreviewRows([]);
      setPreviewColumns([]);

      setMessage(
        "Target connection removed from KMITORA. Physical PostgreSQL data was not modified."
      );

      if (onDeleted) {
        onDeleted();
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete target connection."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      style={{
        marginTop: 14,
        paddingTop: 14,
        borderTop: "1px solid #e5e7eb",
      }}
    >
      <div className="panelHeader">
        <div>
          <span className="eyebrow">
            TARGET MANAGEMENT
          </span>

          <h3 style={{ marginTop: 5 }}>
            Connectivity, Structure & Data
          </h3>

          <p>
            Live read-only target inspection. Connection
            deletion never deletes physical target data.
          </p>
        </div>

        <span
          className={`statusPill ${
            isActive ? "success" : "review"
          }`}
        >
          {isActive ? "ACTIVE TARGET" : "DEV TARGET"}
        </span>
      </div>

      <div
        className="buttonRow"
        style={{
          flexWrap: "wrap",
          marginTop: 12,
        }}
      >
        <button
          type="button"
          className="primary"
          onClick={() => void loadObjects()}
          disabled={loading}
        >
          {loading ? (
            <LoaderCircle size={15} />
          ) : (
            <Eye size={15} />
          )}
          View Tables
        </button>

        <button
          type="button"
          onClick={() => void loadObjects()}
          disabled={loading}
        >
          <RefreshCw size={15} />
          Refresh Objects
        </button>

        <button
          type="button"
          onClick={() => void testConnection()}
          disabled={loading}
        >
          <Cable size={15} />
          Test Connection
        </button>

        <button
          type="button"
          onClick={() => void loadStructure()}
          disabled={loading || !selectedObject}
        >
          <Table2 size={15} />
          Structure
        </button>

        <button
          type="button"
          onClick={() => void loadPreview()}
          disabled={loading || !selectedObject}
        >
          <Database size={15} />
          View Data
        </button>

        <button
          type="button"
          onClick={() => void setActiveTarget()}
          disabled={loading}
        >
          <CheckCircle2 size={15} />
          Set Active
        </button>

        <button
          type="button"
          onClick={editConnection}
          disabled={loading}
        >
          <Pencil size={15} />
          Edit Connection
        </button>

        <button
          type="button"
          onClick={() => void deleteConnection()}
          disabled={loading}
          style={{
            color: "#991b1b",
          }}
        >
          <Trash2 size={15} />
          Delete
        </button>
      </div>

      {error && (
        <div
          style={{
            marginTop: 12,
            padding: 10,
            border: "1px solid #fecaca",
            borderRadius: 8,
            background: "#fef2f2",
            color: "#991b1b",
            fontSize: 12,
          }}
        >
          <strong>Target management error</strong>
          <div style={{ marginTop: 4 }}>
            {error}
          </div>
        </div>
      )}

      {message && (
        <div
          style={{
            marginTop: 12,
            padding: 10,
            border: "1px solid #d1fae5",
            borderRadius: 8,
            background: "#f0fdf4",
            fontSize: 12,
          }}
        >
          {message}
        </div>
      )}

      {objects.length > 0 && (
        <div
          style={{
            marginTop: 14,
            display: "grid",
            gridTemplateColumns: "minmax(190px, 0.8fr) minmax(0, 2fr)",
            gap: 14,
          }}
        >
          <aside
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              padding: 10,
              maxHeight: 370,
              overflowY: "auto",
            }}
          >
            <strong>
              Tables / Views ({objects.length})
            </strong>

            <div
              style={{
                display: "grid",
                gap: 6,
                marginTop: 10,
              }}
            >
              {objects.map((item, index) => {
                const selected =
                  selectedObject?.name === item.name &&
                  selectedObject?.schema === item.schema;

                return (
                  <button
                    type="button"
                    key={`${item.schema}-${item.name}-${index}`}
                    onClick={() => {
                      setSelectedObject(item);
                      setMode("OBJECTS");
                    }}
                    style={{
                      textAlign: "left",
                      padding: 8,
                      borderRadius: 7,
                      fontWeight: selected ? 700 : 400,
                    }}
                  >
                    {item.schema ?? schemaName(system)}.
                    {item.name}
                    <small
                      style={{
                        display: "block",
                        marginTop: 3,
                      }}
                    >
                      {item.type ?? "TABLE"}
                    </small>
                  </button>
                );
              })}
            </div>
          </aside>

          <main
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              padding: 12,
              minWidth: 0,
            }}
          >
            <div className="panelHeader">
              <div>
                <span className="eyebrow">
                  {mode === "STRUCTURE"
                    ? "TABLE STRUCTURE"
                    : mode === "DATA"
                      ? "READ-ONLY DATA PREVIEW"
                      : "TARGET OBJECT"}
                </span>

                <h3>
                  {selectedTitle ||
                    "Select a table or view"}
                </h3>
              </div>
            </div>

            {selectedObject && mode === "OBJECTS" && (
              <div
                className="buttonRow"
                style={{ marginTop: 10 }}
              >
                <button
                  type="button"
                  onClick={() =>
                    void loadStructure(selectedObject)
                  }
                >
                  <Table2 size={15} />
                  Structure
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void loadPreview(selectedObject)
                  }
                >
                  <Eye size={15} />
                  View Data
                </button>
              </div>
            )}

            {mode === "STRUCTURE" && (
              <div
                style={{
                  overflowX: "auto",
                  marginTop: 10,
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 12,
                  }}
                >
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: 7 }}>
                        Column
                      </th>
                      <th style={{ textAlign: "left", padding: 7 }}>
                        Type
                      </th>
                      <th style={{ textAlign: "left", padding: 7 }}>
                        Nullable
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {structure.map((column, index) => (
                      <tr key={`${column.name}-${index}`}>
                        <td
                          style={{
                            padding: 7,
                            borderTop: "1px solid #eef2f7",
                          }}
                        >
                          {column.name ?? ""}
                        </td>

                        <td
                          style={{
                            padding: 7,
                            borderTop: "1px solid #eef2f7",
                          }}
                        >
                          {column.type ??
                            column.data_type ??
                            ""}
                        </td>

                        <td
                          style={{
                            padding: 7,
                            borderTop: "1px solid #eef2f7",
                          }}
                        >
                          {String(
                            column.nullable ??
                            column.is_nullable ??
                            ""
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {structure.length === 0 && (
                  <p>
                    No column metadata returned.
                  </p>
                )}
              </div>
            )}

            {mode === "DATA" && (
              <div
                style={{
                  overflowX: "auto",
                  maxHeight: 350,
                  overflowY: "auto",
                  marginTop: 10,
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 12,
                  }}
                >
                  <thead>
                    <tr>
                      {previewColumns
                        .slice(0, 14)
                        .map((column) => (
                          <th
                            key={column}
                            style={{
                              textAlign: "left",
                              padding: 7,
                              borderBottom:
                                "1px solid #d1d5db",
                            }}
                          >
                            {column}
                          </th>
                        ))}
                    </tr>
                  </thead>

                  <tbody>
                    {previewRows
                      .slice(0, 25)
                      .map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {previewColumns
                            .slice(0, 14)
                            .map((column) => (
                              <td
                                key={column}
                                style={{
                                  padding: 7,
                                  borderBottom:
                                    "1px solid #eef2f7",
                                }}
                              >
                                {String(
                                  row?.[column] ?? ""
                                )}
                              </td>
                            ))}
                        </tr>
                      ))}
                  </tbody>
                </table>

                {previewRows.length === 0 && (
                  <p>
                    Table/view contains no preview rows.
                  </p>
                )}
              </div>
            )}
          </main>
        </div>
      )}

      <div
        className="checkList"
        style={{ marginTop: 14 }}
      >
        <div className="checkRow">
          <span />
          <span>Inspection mode</span>
          <small>READ ONLY</small>
        </div>

        <div className="checkRow">
          <span />
          <span>Target write requested</span>
          <small>NO</small>
        </div>

        <div className="checkRow">
          <span />
          <span>Production action</span>
          <small>NO</small>
        </div>

        <div className="checkRow">
          <span />
          <span>Delete physical database/table/data</span>
          <small>NEVER</small>
        </div>
      </div>
    </section>
  );
}
