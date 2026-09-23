import React, { useEffect, useMemo, useState } from "react";
import type {
  TargetColumn,
  TargetConnectAdapter,
  TargetConnection,
  TargetConnectionDraft,
  TargetObject,
  TargetPreview,
  TargetType,
} from "./types";
import "./target-connect.css";

const initialDraft: TargetConnectionDraft = {
  name: "",
  type: "postgresql",
  host: "127.0.0.1",
  port: 5432,
  database: "",
  schema: "public",
  username: "",
  password: "",
  environment: "DEV",
};

const ports: Record<TargetType, number> = { postgresql: 5432, oracle: 1521, sqlserver: 1433, mysql: 3306, snowflake: 443 };

function fingerprint(t: Partial<TargetConnection & TargetConnectionDraft>) {
  return [String(t.type || "").toLowerCase(), String(t.host || "").toLowerCase(), String(t.port || ""), String(t.database || "").toLowerCase(), String(t.schema || "").toLowerCase(), String(t.environment || "DEV").toUpperCase()].join("|");
}
function dedupeTargets(items: TargetConnection[]) {
  const seen = new Set<string>();
  return items.filter((item) => { const key=fingerprint(item); if (seen.has(key)) return false; seen.add(key); return true; });
}

export default function KMITORATargetConnectWorkspace({ adapter }: { adapter: TargetConnectAdapter }) {
  const [draft, setDraft] = useState<TargetConnectionDraft>(initialDraft);
  const [targets, setTargets] = useState<TargetConnection[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<TargetConnection | null>(null);
  const [objects, setObjects] = useState<TargetObject[]>([]);
  const [selectedObject, setSelectedObject] = useState<TargetObject | null>(null);
  const [structure, setStructure] = useState<TargetColumn[]>([]);
  const [preview, setPreview] = useState<TargetPreview | null>(null);
  const [viewMode, setViewMode] = useState<"structure" | "data">("structure");
  const [browserError, setBrowserError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [formMode, setFormMode] = useState<"new" | "view" | "edit">("new");

  const announce = (listed: TargetConnection[]) => window.dispatchEvent(new CustomEvent("kmitora:target-state", { detail: { connected: listed.some((x) => x.status === "connected") } }));

  const refreshTargets = async () => {
    const listed = dedupeTargets(await adapter.listTargets());
    setTargets(listed); announce(listed);
    if (selectedTarget) setSelectedTarget(listed.find((x) => x.id === selectedTarget.id) || null);
    return listed;
  };
  useEffect(() => { refreshTargets().catch((e) => setMessage(String(e?.message || e))); }, []);

  const canSave = useMemo(() => Boolean(draft.name.trim() && draft.host.trim() && draft.database.trim() && draft.username.trim()), [draft]);
  const updateType = (type: TargetType) => setDraft((prev) => ({ ...prev, type, port: ports[type] }));
  const resetForNew = () => { setDraft(initialDraft); setFormMode("new"); setMessage(""); };
  const showTargetDetails = (target: TargetConnection) => {
    setFormMode("view");
    setDraft({ name: target.name, type: target.type, host: target.host || "", port: target.port || ports[target.type], database: target.database || "", schema: target.schema || "public", username: "", password: "", environment: target.environment || "DEV" });
  };

  const editTarget = (target: TargetConnection) => {
    setSelectedTarget(target);
    setFormMode("edit");
    setMessage(
      "Edit Target connection details. Re-enter Username and Password, then use Test Connection before Save & Reconnect."
    );

    setDraft({
      name: target.name,
      type: target.type,
      host: target.host || "",
      port: target.port || ports[target.type],
      database: target.database || "",
      schema: target.schema || "public",
      username: "",
      password: "",
      environment: target.environment || "DEV",
    });
  };

  const testSelectedTarget = async (
    target: TargetConnection
  ) => {
    setBusy(true);
    setMessage("");
    setBrowserError("");

    try {
      const testDraft: TargetConnectionDraft = {
        name: target.name,
        type: target.type,
        host: target.host || "",
        port: target.port || ports[target.type],
        database: target.database || "",
        schema: target.schema || "public",
        username: draft.username,
        password: draft.password,
        environment: target.environment || "DEV",
      };

      if (!testDraft.username || !testDraft.password) {
        setMessage(
          "For a fresh credential test, click Edit and enter Username and Password. Existing stored credentials remain hidden."
        );

        const data = await adapter.listObjects(target.id);

        if (data.length > 0) {
          setMessage(
            `Existing Target connection is operational. ${data.length} table/view object(s) discovered.`
          );
        } else {
          setMessage(
            "Existing Target connection responded but returned zero tables/views."
          );
        }

        return;
      }

      const result = await adapter.testTarget(testDraft);

      setMessage(
        result.ok
          ? "Target connection successful."
          : result.message ||
            "Target connection failed."
      );
    } catch (e: any) {
      setMessage(
        e?.message ||
        String(e)
      );
    } finally {
      setBusy(false);
    }
  };

  const selectStructure = async (target: TargetConnection, obj: TargetObject) => {
    setSelectedObject(obj); setViewMode("structure"); setStructure([]); setPreview(null); setBrowserError(""); setBusy(true);
    try { const result = await adapter.getStructure(target.id, obj.schema, obj.name); setStructure(result.columns || []); }
    catch (e: any) { setBrowserError(e?.message || String(e)); }
    finally { setBusy(false); }
  };
  const selectData = async (target: TargetConnection, obj: TargetObject) => {
    setSelectedObject(obj); setViewMode("data"); setPreview(null); setBrowserError(""); setBusy(true);
    try { setPreview(await adapter.previewObject(target.id, obj.schema, obj.name, 100)); }
    catch (e: any) { setBrowserError(e?.message || String(e)); }
    finally { setBusy(false); }
  };
  const loadObjects = async (target: TargetConnection) => {
    setBrowserError(""); setObjects([]); setSelectedObject(null); setStructure([]); setPreview(null); setBusy(true);
    try {
      const data = await adapter.listObjects(target.id);
      setObjects(data);
      if (data.length) await selectStructure(target, data[0]);
      else setBrowserError("No target tables or views discovered.");
    } catch (e: any) { setBrowserError(e?.message || String(e)); }
    finally { setBusy(false); }
  };
  const test = async () => { setBusy(true); setMessage(""); try { const result=await adapter.testTarget(draft); setMessage(result.ok ? "Target connection successful." : result.message || "Target connection failed."); } catch(e:any){ setMessage(e?.message || String(e)); } finally { setBusy(false); } };
  const save = async () => {
    setBusy(true); setMessage("");
    try {
      const created = await adapter.createTarget(draft); // backend refreshes credentials for canonical duplicate
      const listed = dedupeTargets(await adapter.listTargets()); setTargets(listed); announce(listed);
      const canonical = listed.find((x) => x.id === created.id) || created; localStorage.setItem("kmitora.active.targetId", canonical.id); localStorage.removeItem("kmitora.discovery.unified.v1"); localStorage.removeItem("kmitora.dev.discoveryResult"); localStorage.removeItem("kmitora.dev.migrationId");
      setSelectedTarget(canonical);
      showTargetDetails(canonical);
      setMessage(
        formMode === "edit"
          ? "Target connection updated/reconnected."
          : "Target created/updated and connected."
      );
      await loadObjects(canonical);
    } catch(e:any){ setMessage(e?.message || String(e)); }
    finally { setBusy(false); }
  };
  const openTarget = async (target: TargetConnection) => { const previousActiveTarget=localStorage.getItem("kmitora.active.targetId"); localStorage.setItem("kmitora.active.targetId", target.id); if(previousActiveTarget && previousActiveTarget!==target.id){ localStorage.removeItem("kmitora.discovery.unified.v1"); localStorage.removeItem("kmitora.dev.discoveryResult"); localStorage.removeItem("kmitora.dev.migrationId"); } setSelectedTarget(target); showTargetDetails(target); await loadObjects(target); };
  const disconnect = async (target: TargetConnection) => {
    if (!window.confirm(
      `Delete Target connection "${target.name}"?\n\n` +
      "This removes only the KMITORA Target connection registration. " +
      "It does NOT delete the PostgreSQL database, schema, tables, or rows."
    )) return;
    setBusy(true); setMessage("");
    try { await adapter.deleteTarget(target.id); const remaining=dedupeTargets(await adapter.listTargets()); setTargets(remaining); setSelectedTarget(null); setObjects([]); setSelectedObject(null); setStructure([]); setPreview(null); resetForNew(); setMessage("Target connection deleted from KMITORA. No physical target data was modified."); announce(remaining); }
    catch(e:any){ setMessage(e?.message || String(e)); } finally { setBusy(false); }
  };

  return <section className="kt-wrap">
    <div className="kt-grid">
      <div className="kt-card">
        <div className="kt-head"><div><div className="kt-eyebrow">{formMode === "new" ? "NEW TARGET" : "TARGET DETAILS"}</div><h2>{formMode === "new" ? "Create Target Connection" : "Connected Target"}</h2></div>{formMode === "view" && <button className="kt-ghost" onClick={resetForNew}>+ Add New Target</button>}</div>
        <div className="kt-form-grid">
          <label>Target Name<input disabled={formMode === "view"} value={draft.name} onChange={(e)=>setDraft({...draft,name:e.target.value})} placeholder="KMITORA DEV Target"/></label>
          <label>Target Type<select disabled={formMode === "view"} value={draft.type} onChange={(e)=>updateType(e.target.value as TargetType)}><option value="postgresql">PostgreSQL</option><option value="oracle">Oracle</option><option value="sqlserver">SQL Server</option><option value="mysql">MySQL</option><option value="snowflake">Snowflake</option></select></label>
          <label>Environment<select disabled={formMode === "view"} value={draft.environment} onChange={(e)=>setDraft({...draft,environment:e.target.value as any})}><option>DEV</option><option>QA</option><option>UAT</option><option>PROD</option></select></label>
          <label>Host<input disabled={formMode === "view"} value={draft.host} onChange={(e)=>setDraft({...draft,host:e.target.value})}/></label>
          <label>Port<input disabled={formMode === "view"} type="number" value={draft.port} onChange={(e)=>setDraft({...draft,port:Number(e.target.value)})}/></label>
          <label>Database / Service<input disabled={formMode === "view"} value={draft.database} onChange={(e)=>setDraft({...draft,database:e.target.value})}/></label>
          <label>Schema<input disabled={formMode === "view"} value={draft.schema || ""} onChange={(e)=>setDraft({...draft,schema:e.target.value})}/></label>
          <label>Username<input disabled={formMode === "view"} value={draft.username} onChange={(e)=>setDraft({...draft,username:e.target.value})} placeholder={formMode === "view" ? "Stored in process memory" : ""}/></label>
          <label>Password<input disabled={formMode === "view"} type="password" value={draft.password} onChange={(e)=>setDraft({...draft,password:e.target.value})} placeholder={formMode === "view" ? "Not displayed" : ""}/></label>
        </div>
        {draft.environment === "PROD" && <div className="kt-warning">Production target is read-only here. Production writes remain disabled.</div>}
        {message && <div className={"kt-message " + (/fail|error|invalid|denied|refused|unable|cannot|missing|timeout|not found/i.test(message) ? "is-err" : "is-ok")}>{message}</div>}
        <div className="kt-actions">
          {formMode === "new" && (
            <>
              <button
                className="kt-secondary"
                onClick={test}
                disabled={busy || !canSave}
              >
                Test Target Connection
              </button>

              <button
                className="kt-primary"
                onClick={save}
                disabled={busy || !canSave}
              >
                Connect & Create Target
              </button>
            </>
          )}

          {formMode === "edit" && (
            <>
              <button
                className="kt-secondary"
                onClick={test}
                disabled={busy || !canSave}
              >
                Test Connection
              </button>

              <button
                className="kt-primary"
                onClick={save}
                disabled={busy || !canSave}
              >
                Save & Reconnect
              </button>

              <button
                className="kt-ghost"
                onClick={() => {
                  if (selectedTarget) {
                    showTargetDetails(selectedTarget);
                  }
                }}
                disabled={busy || !selectedTarget}
              >
                Cancel Edit
              </button>
            </>
          )}

          {formMode === "view" && (
            <>
              <button
                className="kt-secondary"
                onClick={() =>
                  selectedTarget &&
                  void loadObjects(selectedTarget)
                }
                disabled={busy || !selectedTarget}
              >
                View Target
              </button>

              <button
                className="kt-secondary"
                onClick={() =>
                  selectedTarget &&
                  void loadObjects(selectedTarget)
                }
                disabled={busy || !selectedTarget}
              >
                Refresh Objects
              </button>

              <button
                className="kt-secondary"
                onClick={() =>
                  selectedTarget &&
                  void testSelectedTarget(
                    selectedTarget
                  )
                }
                disabled={busy || !selectedTarget}
              >
                Test Connection
              </button>

              <button
                className="kt-secondary"
                onClick={() => {
                  if (
                    selectedTarget &&
                    selectedObject
                  ) {
                    void selectStructure(
                      selectedTarget,
                      selectedObject
                    );
                  }
                }}
                disabled={
                  busy ||
                  !selectedTarget ||
                  !selectedObject
                }
              >
                Structure
              </button>

              <button
                className="kt-secondary"
                onClick={() => {
                  if (
                    selectedTarget &&
                    selectedObject
                  ) {
                    void selectData(
                      selectedTarget,
                      selectedObject
                    );
                  }
                }}
                disabled={
                  busy ||
                  !selectedTarget ||
                  !selectedObject
                }
              >
                View Data
              </button>

              <button
                className="kt-secondary"
                onClick={() =>
                  selectedTarget &&
                  editTarget(selectedTarget)
                }
                disabled={busy || !selectedTarget}
              >
                Edit
              </button>

              <button
                className="kt-ghost"
                onClick={() =>
                  selectedTarget &&
                  void disconnect(selectedTarget)
                }
                disabled={busy || !selectedTarget}
              >
                Delete
              </button>

              <button
                className="kt-primary"
                onClick={resetForNew}
              >
                + Add New Target
              </button>
            </>
          )}
        </div>
      </div>
      <div className="kt-card">
        <div className="kt-head"><div><div className="kt-eyebrow">TARGETS</div><h2>Connected Targets</h2></div><button className="kt-ghost" onClick={()=>refreshTargets().catch((e)=>setMessage(String(e?.message||e)))}>Refresh</button></div>
        <div className="kt-target-list">{!targets.length ? <div className="kt-empty">No targets created yet.</div> : targets.map((target)=><div key={target.id} className={`kt-target-row ${selectedTarget?.id===target.id?"active":""}`}><button className="kt-object-main" onClick={()=>void openTarget(target)}><strong>{target.name}</strong><span>{target.type} · {target.host || ""}:{target.port || ""} · {target.database || ""}</span></button><div className="kt-pills"><span className="kt-env">{target.environment || "DEV"}</span><span className={`kt-pill ${target.status}`}>{target.status}</span></div></div>)}</div>
      </div>
    </div>

    {selectedTarget && <div className="kt-card kt-browser">
      <div className="kt-head"><div><div className="kt-eyebrow">TARGET VIEW</div><h2>{selectedTarget.name}</h2><p>Read-only table structure and data preview. No target writes are enabled.</p></div><button className="kt-ghost" onClick={()=>void loadObjects(selectedTarget)} disabled={busy}>Refresh Objects</button></div>
      {browserError && <div className="kt-preview-error"><strong>Target view error</strong><span>{browserError}</span></div>}
      <div className="kt-browser-grid">
        <aside className="kt-object-list">
          {!objects.length && !browserError && <div className="kt-empty">No target objects loaded.</div>}
          {objects.map((obj)=><div key={`${obj.schema}.${obj.name}`} className={`kt-object-row ${selectedObject?.name===obj.name&&selectedObject?.schema===obj.schema?"active":""}`}><button className="kt-object-main" onClick={()=>void selectStructure(selectedTarget,obj)}><strong title={obj.name}>{obj.name}</strong><span>{obj.schema} · {obj.type}</span></button><div className="kt-object-actions"><button className="kt-view-data" onClick={()=>void selectStructure(selectedTarget,obj)}>Structure</button><button className="kt-view-data" onClick={()=>void selectData(selectedTarget,obj)}>View Data</button></div></div>)}
        </aside>
        <div className="kt-preview">
          {!selectedObject ? <div className="kt-empty">Select a target table or view.</div> : busy ? <div className="kt-empty">Loading target metadata...</div> : browserError ? <div className="kt-empty">Correct the error above and retry.</div> : viewMode === "structure" ? <><div className="kt-preview-head"><strong>{selectedObject.schema}.{selectedObject.name}</strong><span>{structure.length} columns · STRUCTURE</span></div><div className="kt-table-wrap"><table><thead><tr><th>#</th><th>Column</th><th>Data Type</th><th>Nullable</th></tr></thead><tbody>{structure.map((c)=><tr key={c.name}><td>{c.ordinal}</td><td>{c.name}</td><td>{c.dataType}</td><td>{c.nullable ? "YES" : "NO"}</td></tr>)}</tbody></table></div></> : preview ? <><div className="kt-preview-head"><strong>{selectedObject.schema}.{selectedObject.name}</strong><span>{preview.totalRows != null ? `${preview.totalRows.toLocaleString()} total rows` : `${preview.rows.length} preview rows`} · DATA</span></div>{preview.columns.length ? <div className="kt-table-wrap"><table><thead><tr>{preview.columns.map((c)=><th key={c}>{c}</th>)}</tr></thead><tbody>{preview.rows.length ? preview.rows.map((row,i)=><tr key={i}>{preview.columns.map((c)=><td key={c}>{String(row[c] ?? "")}</td>)}</tr>) : <tr><td colSpan={preview.columns.length}>0 rows — table is empty.</td></tr>}</tbody></table></div> : <div className="kt-empty">No columns returned.</div>}</> : <div className="kt-empty">No preview available.</div>}
        </div>
      </div>
    </div>}
  </section>;
}


