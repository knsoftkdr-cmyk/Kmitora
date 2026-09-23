import { useMemo, useState } from "react";
import { Eye, Search, ChevronDown, ChevronRight } from "lucide-react";
import type { MigrationSystem } from "../models/MigrationTopology";

type Props = {
  sources: MigrationSystem[];
  targets: MigrationSystem[];
  onView: (system: MigrationSystem) => void;
};

function statusClass(status: string) {
  if (status === "VALIDATED") return "success";
  if (status === "FAILED") return "reject";
  return "review";
}

export default function SourceTargetExplorer({ sources, targets, onView }: Props) {
  const [tab, setTab] = useState<"SOURCE" | "TARGET">("SOURCE");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>(sources[0]?.id ?? targets[0]?.id ?? "");
  const [collapsed, setCollapsed] = useState(false);

  const [targetObjects, setTargetObjects] = useState<any[]>([]);
  const [targetObject, setTargetObject] = useState<any | null>(null);
  const [targetStructure, setTargetStructure] = useState<any[]>([]);
  const [targetRows, setTargetRows] = useState<any[]>([]);
  const [targetColumns, setTargetColumns] = useState<string[]>([]);
  const [targetPanelMode, setTargetPanelMode] =
    useState<"OBJECTS" | "STRUCTURE" | "DATA">("OBJECTS");

  const [targetBusy, setTargetBusy] = useState(false);
  const [targetStatusMessage, setTargetStatusMessage] = useState("");
  const [targetError, setTargetError] = useState("");

  async function parseResponse(response: Response) {
    const raw = await response.text();

    let body: any = null;

    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      body = raw;
    }

    if (!response.ok) {
      throw new Error(
        String(
          body?.message ??
          body?.error ??
          raw ??
          `HTTP ${response.status}`
        )
      );
    }

    return body;
  }

  async function resolveTargetRuntime(system: MigrationSystem) {
    const response = await fetch(
      "/target-api/v1/targets",
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      }
    );

    const body = await parseResponse(response);

    const items: any[] =
      Array.isArray(body)
        ? body
        : Array.isArray(body?.items)
          ? body.items
          : [];

    const current: any = system as any;

    const wantedName =
      String(current?.name ?? "").toLowerCase();

    const wantedHost =
      String(current?.host ?? "").toLowerCase();

    const wantedDatabase =
      String(
        current?.database ??
        current?.service ??
        ""
      ).toLowerCase();

    const matched =
      items.find((item: any) => {
        const sameName =
          wantedName &&
          String(item?.name ?? "").toLowerCase() === wantedName;

        const sameHost =
          wantedHost &&
          String(item?.host ?? "").toLowerCase() === wantedHost;

        const sameDatabase =
          wantedDatabase &&
          String(item?.database ?? "").toLowerCase() ===
            wantedDatabase;

        return sameName || (sameHost && sameDatabase);
      }) ??
      (items.length === 1 ? items[0] : null);

    if (!matched?.id) {
      throw new Error(
        "Unable to resolve the connected Target runtime ID."
      );
    }

    return matched;
  }

  async function refreshTargetObjects(system: MigrationSystem) {
    setTargetBusy(true);
    setTargetError("");
    setTargetStatusMessage("");

    try {
      const runtime =
        await resolveTargetRuntime(system);

      const response = await fetch(
        `/target-api/v1/targets/${encodeURIComponent(runtime.id)}/objects`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        }
      );

      const body = await parseResponse(response);

      const objects: any[] =
        Array.isArray(body)
          ? body
          : Array.isArray(body?.items)
            ? body.items
            : [];

      setTargetObjects(objects);
      setTargetObject(objects[0] ?? null);
      setTargetStructure([]);
      setTargetRows([]);
      setTargetColumns([]);
      setTargetPanelMode("OBJECTS");

      if (objects.length === 0) {
        setTargetStatusMessage(
          "Connected Target returned zero tables/views."
        );
      }

      if (objects.length > 0) {
        setTargetStatusMessage(
          `${objects.length} Target object(s) discovered.`
        );
      }
    } catch (error) {
      setTargetError(
        error instanceof Error
          ? error.message
          : "Unable to refresh Target objects."
      );
    } finally {
      setTargetBusy(false);
    }
  }

  async function testTargetConnection(system: MigrationSystem) {
    setTargetBusy(true);
    setTargetError("");
    setTargetStatusMessage("");

    try {
      const runtime =
        await resolveTargetRuntime(system);

      const response = await fetch(
        `/target-api/v1/targets/${encodeURIComponent(runtime.id)}/objects`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        }
      );

      const body = await parseResponse(response);

      const objects: any[] =
        Array.isArray(body)
          ? body
          : Array.isArray(body?.items)
            ? body.items
            : [];

      setTargetObjects(objects);

      if (objects.length > 0) {
        setTargetObject(objects[0]);
      }

      setTargetStatusMessage(
        `Connection successful. ${objects.length} table/view object(s) visible.`
      );
    } catch (error) {
      setTargetError(
        error instanceof Error
          ? error.message
          : "Target connectivity test failed."
      );
    } finally {
      setTargetBusy(false);
    }
  }

  async function loadTargetStructure(
    system: MigrationSystem,
    chosen?: any
  ) {
    const object = chosen ?? targetObject;

    if (!object?.name) {
      setTargetError(
        "Select a Target table/view first."
      );
      return;
    }

    setTargetBusy(true);
    setTargetError("");
    setTargetStatusMessage("");

    try {
      const runtime =
        await resolveTargetRuntime(system);

      const current: any = system as any;

      const schema =
        object.schema ??
        runtime.schema ??
        current?.schema ??
        "public";

      const url =
        `/target-api/v1/targets/${encodeURIComponent(runtime.id)}` +
        `/structure?schema=${encodeURIComponent(schema)}` +
        `&object=${encodeURIComponent(object.name)}`;

      const response = await fetch(
        url,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        }
      );

      const body = await parseResponse(response);

      const columns: any[] =
        Array.isArray(body)
          ? body
          : Array.isArray(body?.columns)
            ? body.columns
            : [];

      setTargetObject(object);
      setTargetStructure(columns);
      setTargetPanelMode("STRUCTURE");

      setTargetStatusMessage(
        `${schema}.${object.name} structure loaded.`
      );
    } catch (error) {
      setTargetError(
        error instanceof Error
          ? error.message
          : "Unable to load Target structure."
      );
    } finally {
      setTargetBusy(false);
    }
  }

  async function loadTargetData(
    system: MigrationSystem,
    chosen?: any
  ) {
    const object = chosen ?? targetObject;

    if (!object?.name) {
      setTargetError(
        "Select a Target table/view first."
      );
      return;
    }

    setTargetBusy(true);
    setTargetError("");
    setTargetStatusMessage("");

    try {
      const runtime =
        await resolveTargetRuntime(system);

      const current: any = system as any;

      const schema =
        object.schema ??
        runtime.schema ??
        current?.schema ??
        "public";

      const url =
        `/target-api/v1/targets/${encodeURIComponent(runtime.id)}` +
        `/preview?schema=${encodeURIComponent(schema)}` +
        `&object=${encodeURIComponent(object.name)}` +
        `&limit=25`;

      const response = await fetch(
        url,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        }
      );

      const body = await parseResponse(response);

      const rows: any[] =
        Array.isArray(body?.rows)
          ? body.rows
          : [];

      const columns: string[] =
        Array.isArray(body?.columns)
          ? body.columns
          : rows.length > 0
            ? Object.keys(rows[0])
            : [];

      setTargetObject(object);
      setTargetRows(rows);
      setTargetColumns(columns);
      setTargetPanelMode("DATA");

      setTargetStatusMessage(
        `${schema}.${object.name} read-only preview loaded.`
      );
    } catch (error) {
      setTargetError(
        error instanceof Error
          ? error.message
          : "Unable to load Target data."
      );
    } finally {
      setTargetBusy(false);
    }
  }

  async function activateTarget(system: MigrationSystem) {
    setTargetBusy(true);
    setTargetError("");
    setTargetStatusMessage("");

    try {
      const runtime =
        await resolveTargetRuntime(system);

      localStorage.setItem(
        "kmitora.active.targetId",
        runtime.id
      );

      localStorage.setItem(
        "kmitora.dev.targetRuntimeConnection",
        JSON.stringify(runtime)
      );

      setTargetStatusMessage(
        `${runtime.name ?? system.name} is now the active DEV Target.`
      );
    } catch (error) {
      setTargetError(
        error instanceof Error
          ? error.message
          : "Unable to activate Target."
      );
    } finally {
      setTargetBusy(false);
    }
  }

  function editTarget(system: MigrationSystem) {
    setTargetError("");

    localStorage.setItem(
      "kmitora.dev.targetEditRequest",
      JSON.stringify({
        id: system.id,
        name: system.name,
        requestedAt: new Date().toISOString(),
      })
    );

    window.dispatchEvent(
      new CustomEvent(
        "kmitora:edit-target",
        {
          detail: {
            target: system,
          },
        }
      )
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });

    setTargetStatusMessage(
      "Target edit requested. Update the Target Details fields above and reconnect. Password remains hidden."
    );
  }

  async function deleteTarget(system: MigrationSystem) {
    setTargetError("");
    setTargetStatusMessage("");

    try {
      const runtime =
        await resolveTargetRuntime(system);

      const accepted = window.confirm(
        `Delete Target connection "${runtime.name ?? system.name}"?\n\n` +
        "This removes only the KMITORA Target connection. " +
        "The PostgreSQL database, schema, tables and records will NOT be deleted."
      );

      if (!accepted) {
        return;
      }

      setTargetBusy(true);

      const response = await fetch(
        `/target-api/v1/targets/${encodeURIComponent(runtime.id)}`,
        {
          method: "DELETE",
          headers: {
            Accept: "application/json",
          },
        }
      );

      await parseResponse(response);

      if (
        localStorage.getItem(
          "kmitora.active.targetId"
        ) === runtime.id
      ) {
        localStorage.removeItem(
          "kmitora.active.targetId"
        );
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

      setTargetObjects([]);
      setTargetObject(null);
      setTargetStructure([]);
      setTargetRows([]);
      setTargetColumns([]);
      setTargetPanelMode("OBJECTS");

      window.dispatchEvent(
        new CustomEvent(
          "kmitora:target-deleted",
          {
            detail: {
              targetId: runtime.id,
            },
          }
        )
      );

      setTargetStatusMessage(
        "Target connection deleted from KMITORA. Physical PostgreSQL data was not modified."
      );
    } catch (error) {
      setTargetError(
        error instanceof Error
          ? error.message
          : "Unable to delete Target connection."
      );
    } finally {
      setTargetBusy(false);
    }
  }


  const systems = tab === "SOURCE" ? sources : targets;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return systems;
    return systems.filter((s) =>
      `${s.id} ${s.name} ${s.connector} ${s.path ?? ""} ${s.pattern ?? ""} ${s.status}`
        .toLowerCase()
        .includes(q)
    );
  }, [systems, query]);

  const selected =
    systems.find((s) => s.id === selectedId) ??
    visible[0] ??
    systems[0];

  return (
    <section className="km-explorer">
      <div className="km-explorer-head">
        <div>
          <span className="eyebrow">PROJECT SYSTEM EXPLORER</span>
          <h2>Saved Sources & Targets</h2>
          <p>Persistent project systems remain visible and selectable whenever the project is reopened.</p>
        </div>

        <button type="button" onClick={() => setCollapsed((v) => !v)}>
          {collapsed ? <ChevronRight size={15}/> : <ChevronDown size={15}/>}
          {collapsed ? "Expand" : "Collapse"}
        </button>
      </div>

      {!collapsed && (
        <>
          <div className="km-explorer-tabs">
            <button
              type="button"
              className={tab === "SOURCE" ? "active" : ""}
              onClick={() => {
                setTab("SOURCE");
                setSelectedId(sources[0]?.id ?? "");
              }}
            >
              Sources <strong>{sources.length}</strong>
            </button>
            <button
              type="button"
              className={tab === "TARGET" ? "active" : ""}
              onClick={() => {
                setTab("TARGET");
                setSelectedId(targets[0]?.id ?? "");
              }}
            >
              Targets <strong>{targets.length}</strong>
            </button>

            <label className="km-explorer-search">
              <Search size={14}/>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${tab === "SOURCE" ? "sources" : "targets"}...`}
              />
            </label>
          </div>

          <div className="km-explorer-grid">
            <div className="km-explorer-list">
              {visible.length === 0 && <p className="km-empty">No matching systems.</p>}
              {visible.map((system) => (
                <button
                  type="button"
                  key={system.id}
                  className={`km-explorer-row ${selected?.id === system.id ? "selected" : ""}`}
                  onClick={() => setSelectedId(system.id)}
                >
                  <span className="km-system-id">{system.id}</span>
                  <span className="km-system-main">
                    <strong>{system.name}</strong>
                    <small>{system.pattern || system.path || "Configuration review required"}</small>
                  </span>
                  <span className={`statusPill ${statusClass(system.status)}`}>
                    {system.status.replaceAll("_", " ")}
                  </span>
                </button>
              ))}
            </div>

            <div className="km-explorer-detail">
              {selected ? (
                <>
                  <div className="km-explorer-detail-head">
                    <div>
                      <span className="eyebrow">{selected.id}</span>
                      <h3>{selected.name}</h3>
                    </div>
                    <span className={`statusPill ${statusClass(selected.status)}`}>
                      {selected.status.replaceAll("_", " ")}
                    </span>
                  </div>

                  <dl>
                    <div><dt>Role</dt><dd>{selected.role}</dd></div>
                    <div><dt>Connector</dt><dd>{selected.connector}</dd></div>
                    <div><dt>Location</dt><dd>{selected.path || "Not configured"}</dd></div>
                    <div><dt>File / Pattern</dt><dd>{selected.pattern || "Review required"}</dd></div>
                    <div><dt>Target Write</dt><dd>{selected.targetWriteExecuted ? "TRUE" : "FALSE"}</dd></div>
                    <div><dt>Production Action</dt><dd>{selected.productionActionExecuted ? "TRUE" : "FALSE"}</dd></div>
                  </dl>

                  {selected.message && <p className="km-explorer-note">{selected.message}</p>}

                  <div
                    className="km-explorer-detail-actions"
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 7,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => onView(selected)}
                    >
                      <Eye size={15}/>
                      {selected.role === "SOURCE"
                        ? "View Source"
                        : "View Target"}
                    </button>

                    {selected.role === "TARGET" && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            void refreshTargetObjects(selected)
                          }
                          disabled={targetBusy}
                        >
                          Refresh Objects
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void testTargetConnection(selected)
                          }
                          disabled={targetBusy}
                        >
                          Test Connection
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void loadTargetStructure(selected)
                          }
                          disabled={
                            targetBusy ||
                            !targetObject
                          }
                        >
                          Structure
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void loadTargetData(selected)
                          }
                          disabled={
                            targetBusy ||
                            !targetObject
                          }
                        >
                          View Data
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void activateTarget(selected)
                          }
                          disabled={targetBusy}
                        >
                          Set Active
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            editTarget(selected)
                          }
                          disabled={targetBusy}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void deleteTarget(selected)
                          }
                          disabled={targetBusy}
                          style={{
                            color: "#991b1b",
                          }}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>

                  {selected.role === "TARGET" && targetError && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: 9,
                        borderRadius: 7,
                        background: "#fef2f2",
                        border: "1px solid #fecaca",
                        color: "#991b1b",
                        fontSize: 12,
                      }}
                    >
                      {targetError}
                    </div>
                  )}

                  {selected.role === "TARGET" &&
                    targetStatusMessage && (
                      <div
                        style={{
                          marginTop: 10,
                          padding: 9,
                          borderRadius: 7,
                          background: "#f8fafc",
                          border: "1px solid #dbe3ef",
                          fontSize: 12,
                        }}
                      >
                        {targetStatusMessage}
                      </div>
                    )}

                  {selected.role === "TARGET" &&
                    targetObjects.length > 0 && (
                      <div
                        style={{
                          marginTop: 12,
                          display: "grid",
                          gridTemplateColumns:
                            "minmax(170px,0.7fr) minmax(0,2fr)",
                          gap: 12,
                        }}
                      >
                        <div
                          style={{
                            border: "1px solid #e2e8f0",
                            borderRadius: 8,
                            padding: 8,
                            maxHeight: 300,
                            overflowY: "auto",
                          }}
                        >
                          <strong
                            style={{
                              fontSize: 12,
                            }}
                          >
                            Tables / Views
                          </strong>

                          <div
                            style={{
                              display: "grid",
                              gap: 5,
                              marginTop: 8,
                            }}
                          >
                            {targetObjects.map(
                              (object, index) => (
                                <button
                                  type="button"
                                  key={`${object.schema}-${object.name}-${index}`}
                                  onClick={() => {
                                    setTargetObject(object);
                                    setTargetPanelMode(
                                      "OBJECTS"
                                    );
                                  }}
                                  style={{
                                    textAlign: "left",
                                    fontSize: 11,
                                  }}
                                >
                                  {object.schema ??
                                    "public"}.
                                  {object.name}
                                </button>
                              )
                            )}
                          </div>
                        </div>

                        <div
                          style={{
                            border: "1px solid #e2e8f0",
                            borderRadius: 8,
                            padding: 10,
                            minWidth: 0,
                          }}
                        >
                          {targetObject && (
                            <>
                              <strong>
                                {targetObject.schema ??
                                  "public"}.
                                {targetObject.name}
                              </strong>

                              {targetPanelMode ===
                                "OBJECTS" && (
                                <div
                                  style={{
                                    display: "flex",
                                    gap: 7,
                                    marginTop: 8,
                                  }}
                                >
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void loadTargetStructure(
                                        selected,
                                        targetObject
                                      )
                                    }
                                  >
                                    Structure
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      void loadTargetData(
                                        selected,
                                        targetObject
                                      )
                                    }
                                  >
                                    View Data
                                  </button>
                                </div>
                              )}

                              {targetPanelMode ===
                                "STRUCTURE" && (
                                <div
                                  style={{
                                    overflowX:
                                      "auto",
                                    marginTop: 8,
                                  }}
                                >
                                  <table
                                    style={{
                                      width: "100%",
                                      borderCollapse:
                                        "collapse",
                                      fontSize: 11,
                                    }}
                                  >
                                    <thead>
                                      <tr>
                                        <th>
                                          Column
                                        </th>
                                        <th>
                                          Type
                                        </th>
                                        <th>
                                          Nullable
                                        </th>
                                      </tr>
                                    </thead>

                                    <tbody>
                                      {targetStructure.map(
                                        (
                                          column,
                                          index
                                        ) => (
                                          <tr
                                            key={`${column.name}-${index}`}
                                          >
                                            <td>
                                              {column.name ??
                                                ""}
                                            </td>
                                            <td>
                                              {column.type ??
                                                column.data_type ??
                                                ""}
                                            </td>
                                            <td>
                                              {String(
                                                column.nullable ??
                                                column.is_nullable ??
                                                ""
                                              )}
                                            </td>
                                          </tr>
                                        )
                                      )}
                                    </tbody>
                                  </table>

                                  {targetStructure.length ===
                                    0 && (
                                    <p>
                                      No column metadata
                                      returned.
                                    </p>
                                  )}
                                </div>
                              )}

                              {targetPanelMode ===
                                "DATA" && (
                                <div
                                  style={{
                                    overflowX:
                                      "auto",
                                    overflowY:
                                      "auto",
                                    maxHeight: 300,
                                    marginTop: 8,
                                  }}
                                >
                                  <table
                                    style={{
                                      width: "100%",
                                      borderCollapse:
                                        "collapse",
                                      fontSize: 11,
                                    }}
                                  >
                                    <thead>
                                      <tr>
                                        {targetColumns
                                          .slice(0, 12)
                                          .map(
                                            (
                                              column
                                            ) => (
                                              <th
                                                key={
                                                  column
                                                }
                                              >
                                                {
                                                  column
                                                }
                                              </th>
                                            )
                                          )}
                                      </tr>
                                    </thead>

                                    <tbody>
                                      {targetRows
                                        .slice(0, 25)
                                        .map(
                                          (
                                            row,
                                            rowIndex
                                          ) => (
                                            <tr
                                              key={
                                                rowIndex
                                              }
                                            >
                                              {targetColumns
                                                .slice(
                                                  0,
                                                  12
                                                )
                                                .map(
                                                  (
                                                    column
                                                  ) => (
                                                    <td
                                                      key={
                                                        column
                                                      }
                                                    >
                                                      {String(
                                                        row?.[
                                                          column
                                                        ] ??
                                                        ""
                                                      )}
                                                    </td>
                                                  )
                                                )}
                                            </tr>
                                          )
                                        )}
                                    </tbody>
                                  </table>

                                  {targetRows.length ===
                                    0 && (
                                    <p>
                                      No rows returned.
                                    </p>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )}

                  {selected.role === "TARGET" && (
                    <p
                      style={{
                        marginTop: 10,
                        fontSize: 11,
                        color: "#64748b",
                      }}
                    >
                      READ ONLY inspection · DEV Target ·
                      Production migration disabled · Delete
                      removes only the KMITORA connection.
                    </p>
                  )}
                </>
              ) : (
                <p className="km-empty">Select a system.</p>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

