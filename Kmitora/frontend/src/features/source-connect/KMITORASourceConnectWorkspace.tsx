import React, { useEffect, useMemo, useState } from "react";
import type { SourceConnectAdapter, SourceConnection, SourceConnectionDraft, SourceObject, SourcePreview, SourceType } from "./types";
import "./source-connect.css";

const initialDraft: SourceConnectionDraft = { name:"", type:"postgresql", host:"", port:5432, database:"", schema:"public", username:"", password:"" };
const ports: Record<Exclude<SourceType,"file">, number> = {
  postgresql: 5432,
  oracle: 1521,
  sqlserver: 1433,
  mysql: 3306,
  mariadb: 3306,
  db2: 50000,
  teradata: 1025,
  sybase: 5000,
  informix: 9088,
  access: 0,
  snowflake: 443,
  other: 0,
};

export default function KMITORASourceConnectWorkspace({adapter}:{adapter:SourceConnectAdapter}) {
  const [draft,setDraft]=useState(initialDraft);
  const [sources,setSources]=useState<SourceConnection[]>([]);
  const [selectedSource,setSelectedSource]=useState<SourceConnection|null>(null);
  const [objects,setObjects]=useState<SourceObject[]>([]);
  const [selectedObject,setSelectedObject]=useState<SourceObject|null>(null);
  const [preview,setPreview]=useState<SourcePreview|null>(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [previewError,setPreviewError]=useState("");
  const isFile=draft.type==="file";

  const refreshSources=async()=>setSources(await adapter.listSources());
  useEffect(()=>{refreshSources().catch(e=>setMessage(String(e?.message||e)))},[]);

  const canSave=useMemo(()=>{
    if(!draft.name.trim()) return false;
    if(isFile) return Boolean(draft.filePath?.trim());
    return Boolean(draft.host?.trim()&&draft.database?.trim()&&draft.username?.trim());
  },[draft,isFile]);

  const updateType=(type:SourceType)=>setDraft(p=>({...p,type,port:type==="file"?undefined:ports[type]}));

  const loadPreview=async(source:SourceConnection,obj:SourceObject)=>{
    setSelectedObject(obj); setPreview(null); setPreviewError(""); setBusy(true);
    try { setPreview(await adapter.previewObject(source.id,obj.schema,obj.name,100)); }
    catch(e:any){ setPreviewError(e?.message||String(e)); }
    finally { setBusy(false); }
  };

  const loadObjectsAndFirstPreview=async(source:SourceConnection)=>{
    const data=await adapter.listObjects(source.id);
    setObjects(data);
    if(data.length) await loadPreview(source,data[0]);
    else { setSelectedObject(null); setPreview(null); setPreviewError("No supported objects were discovered."); }
  };

  const test=async()=>{ setBusy(true); setMessage("");
    try { const r=await adapter.testSource(draft); setMessage(r.ok?"Connection successful.":r.message||"Connection failed."); }
    catch(e:any){ setMessage(e?.message||String(e)); } finally { setBusy(false); }
  };

  const save=async()=>{ setBusy(true); setMessage("");
    try { const created=await adapter.createSource(draft); localStorage.setItem("kmitora.active.sourceId", created.id); void fetch("/api/v1/ui-state", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active_source_id: created.id }) }).catch((error) => console.warn("KMITORA source selection persistence failed", error)); localStorage.removeItem("kmitora.discovery.unified.v1"); localStorage.removeItem("kmitora.dev.discoveryResult"); localStorage.removeItem("kmitora.dev.migrationId"); setSources(p=>[created,...p.filter(x=>x.id!==created.id)]); setSelectedSource(created); setMessage("Source created and connected."); await loadObjectsAndFirstPreview(created); }
    catch(e:any){ setMessage(e?.message||String(e)); } finally { setBusy(false); }
  };

  const editSource = (source: SourceConnection) => {
    setSelectedSource(source);

    setDraft((current: any) => ({
      ...current,
      name: source.name || "",
      type: source.type || "file",
      host: source.host || "",
      port: source.port || null,
      database: source.database || "",
      schema: source.schema || "public",
      filePath: source.filePath || "",
    }));

    localStorage.setItem(
      "kmitora.active.sourceId",
      String(source.id)
    );

    setMessage(
      `Editing source: ${source.name}. Update the values and save the connection.`
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const deleteSource = async (source: SourceConnection) => {
    const confirmed = window.confirm(
      `Delete source "${source.name}"?\n\nThis removes only the KMITORA source connection. It does not delete the physical source data.`
    );

    if (!confirmed) return;

    try {
      if ((adapter as any).deleteSource) {
        await (adapter as any).deleteSource(source.id);
      } else {
        const response = await fetch(
          `/source-api/v1/sources/${encodeURIComponent(source.id)}`,
          {
            method: "DELETE",
          }
        );

        if (!response.ok) {
          const body = await response.text();
          throw new Error(
            body || `Delete failed with HTTP ${response.status}`
          );
        }
      }

      setSources((current) =>
        current.filter((item) => item.id !== source.id)
      );

      if (selectedSource?.id === source.id) {
        setSelectedSource(null);
        setSelectedObject(null);
        setPreview(null);
        setPreviewError("");
      }

      const activeSourceId =
        localStorage.getItem("kmitora.active.sourceId");

      if (activeSourceId === source.id) {
        localStorage.removeItem("kmitora.active.sourceId");
        localStorage.removeItem("kmitora.discovery.unified.v1");
        localStorage.removeItem("kmitora.dev.discoveryResult");
        localStorage.removeItem("kmitora.dev.migrationId");
      }

      setMessage(
        `Source "${source.name}" deleted successfully.`
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to delete source."
      );
    }
  };
  const openSource=async(source:SourceConnection)=>{ const previousActiveSource=localStorage.getItem("kmitora.active.sourceId"); localStorage.setItem("kmitora.active.sourceId", source.id); void fetch("/api/v1/ui-state", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active_source_id: source.id }) }).catch((error) => console.warn("KMITORA source selection persistence failed", error)); if(previousActiveSource && previousActiveSource!==source.id){ localStorage.removeItem("kmitora.discovery.unified.v1"); localStorage.removeItem("kmitora.dev.discoveryResult"); localStorage.removeItem("kmitora.dev.migrationId"); } setSelectedSource(source); setSelectedObject(null); setPreview(null); setPreviewError("");
    try { await loadObjectsAndFirstPreview(source); } catch(e:any){ setPreviewError(e?.message||String(e)); setBusy(false); }
  };

  const openPreview=async(obj:SourceObject)=>{ if(selectedSource) await loadPreview(selectedSource,obj); };

  return <main className="ks-page">
    <header className="ks-header"><div><div className="ks-eyebrow">KMITORA SOURCE CONTROL</div><h1>Connect Source & View Data</h1><p>Create source connections from the frontend, inspect schemas and preview data without leaving KMITORA.</p></div></header>

    <section className="ks-grid">
      <div className="ks-card">
        <div className="ks-card-head"><div><div className="ks-eyebrow">NEW SOURCE</div><h2>Create Source Connection</h2></div></div>
        <div className="ks-form-grid">
          <label>Source Name<input value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} placeholder="Finance Oracle"/></label>
          <label>Source Type<select value={draft.type} onChange={e=>updateType(e.target.value as SourceType)}>
            <option value="postgresql">PostgreSQL</option>
<option value="oracle">Oracle</option>
<option value="sqlserver">SQL Server</option>
<option value="mysql">MySQL</option>
<option value="mariadb">MariaDB</option>
<option value="db2">IBM DB2</option>
<option value="teradata">Teradata</option>
<option value="sybase">Sybase / SAP ASE</option>
<option value="informix">Informix</option>
<option value="access">Microsoft Access</option>
<option value="snowflake">Snowflake</option>
<option value="file">File System</option>
<option value="other">Other / Custom Database</option>
          </select></label>
          {isFile ? <label className="ks-span-2">File / Folder Path<input value={draft.filePath||""} onChange={e=>setDraft({...draft,filePath:e.target.value})} placeholder="Select or enter source path"/></label> :
          <>
            <label>Host<input value={draft.host||""} onChange={e=>setDraft({...draft,host:e.target.value})}/></label>
            <label>Port<input type="number" value={draft.port||""} onChange={e=>setDraft({...draft,port:Number(e.target.value)})}/></label>
            <label>Database / Service<input value={draft.database||""} onChange={e=>setDraft({...draft,database:e.target.value})}/></label>
            <label>Schema<input value={draft.schema||""} onChange={e=>setDraft({...draft,schema:e.target.value})}/></label>
            <label>Username<input value={draft.username||""} onChange={e=>setDraft({...draft,username:e.target.value})}/></label>
            <label>Password<input type="password" value={draft.password||""} onChange={e=>setDraft({...draft,password:e.target.value})}/></label>
          </>}
        </div>
        {message&&<div className={"ks-message " + (/fail|error|invalid|denied|refused|unable|cannot|missing|timeout|not found/i.test(message) ? "is-err" : "is-ok")}>{message}</div>}
        <div className="ks-actions"><button className="ks-secondary" onClick={test} disabled={busy||!canSave}>Test Connection</button><button className="ks-primary" onClick={save} disabled={busy||!canSave}>Connect & Create Source</button></div>
      </div>

      <div className="ks-card">
        <div className="ks-card-head"><div><div className="ks-eyebrow">SOURCES</div><h2>Connected Sources</h2></div><button className="ks-ghost" onClick={()=>refreshSources().catch(e=>setMessage(String(e?.message||e)))}>Refresh</button></div>
        <div className="ks-source-list">
          {!sources.length ? (
            <div className="ks-empty">No sources created yet.</div>
          ) : (
            sources.map((source) => (
              <div
                key={source.id}
                className={`ks-source-row ${selectedSource?.id === source.id ? "active" : ""}`}
              >
                <button
                  type="button"
                  className="ks-source-main"
                  onClick={() => void openSource(source)}
                >
                  <div>
                    <strong>{source.name}</strong>
                    <span>
                      {source.type} Â· {source.database || source.host || "file source"}
                    </span>
                  </div>

                  <span className={`ks-pill ${source.status}`}>
                    {source.status}
                  </span>
                </button>

                <div className="ks-source-actions">
                  <button
                    type="button"
                    className="ks-secondary"
                    onClick={() => void openSource(source)}
                  >
                    View
                  </button>

                  <button
                    type="button"
                    className="ks-secondary"
                    onClick={() => editSource(source)}
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    className="ks-danger"
                    onClick={() => void deleteSource(source)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>

    {selectedSource&&<section className="ks-card ks-browser">
      <div className="ks-card-head"><div><div className="ks-eyebrow">SOURCE VIEW</div><h2>{selectedSource.name}</h2><p>Click View Data to preview the first 100 rows. The first object opens automatically.</p></div></div>
      <div className="ks-browser-grid">
        <aside className="ks-object-list">
          {objects.map(obj=><div key={`${obj.schema}.${obj.name}`} className={`ks-object-row ${selectedObject?.name===obj.name&&selectedObject?.schema===obj.schema?"active":""}`}>
            <button className="ks-object-main" onClick={()=>void openPreview(obj)}><strong title={obj.name}>{obj.name}</strong><span>{obj.schema} Â· {obj.type}</span></button>
            <button className="ks-view-data" onClick={()=>void openPreview(obj)}>View Data</button>
          </div>)}
        </aside>
        <div className="ks-preview">
          {!selectedObject?<div className="ks-empty">Choose a table or view.</div>:busy?<div className="ks-empty">Loading preview...</div>:previewError?
          <div className="ks-preview-error"><strong>Unable to preview data</strong><span>{previewError}</span><button className="ks-secondary" onClick={()=>selectedObject&&void openPreview(selectedObject)}>Retry</button></div>:preview?
          <><div className="ks-preview-head"><strong>{selectedObject.schema}.{selectedObject.name}</strong><span>{preview.totalRows!=null?`${preview.totalRows.toLocaleString()} total rows`:`${preview.rows.length} preview rows`}</span></div>
          <div className="ks-table-wrap"><table><thead><tr>{preview.columns.map(c=><th key={c}>{c}</th>)}</tr></thead><tbody>{preview.rows.map((row,i)=><tr key={i}>{preview.columns.map(c=><td key={c}>{String(row[c]??"")}</td>)}</tr>)}</tbody></table></div></>:<div className="ks-empty">No preview available.</div>}
        </div>
      </div>
    </section>}
  </main>;
}







