import { useMemo, useState } from "react";
import { Activity, Brain, ChevronRight, Eye, Filter, FolderTree, Search, Settings2, Sparkles, Table2, WandSparkles } from "lucide-react";
import type { MigrationSystem } from "../models/MigrationTopology";
import type { SourceTargetObject } from "../models/SourceTargetAutomation";
import { buildAutomationObjects, summarizeModules } from "../services/sourceTargetAutomation";

type Props = {
  sources: MigrationSystem[];
  targets: MigrationSystem[];
  onView: (system: MigrationSystem) => void;
  onAddSource: () => void;
  onAddTarget: () => void;
};

type Scope = "ALL" | "SOURCE" | "TARGET";
type DetailTab = "OVERVIEW" | "ANALYZER" | "QUALIFIER" | "WRITER";

function statusClass(status: SourceTargetObject["status"]) {
  if (status === "READY") return "success";
  if (status === "BLOCKED") return "reject";
  return "review";
}

export default function SourceTargetDashboard({
  sources, targets, onView, onAddSource, onAddTarget
}: Props) {
  const [scope, setScope] = useState<Scope>("ALL");
  const [query, setQuery] = useState("");
  const [moduleFilter, setModuleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedId, setSelectedId] = useState("");
  const [detailTab, setDetailTab] = useState<DetailTab>("OVERVIEW");

  const objects = useMemo(() => buildAutomationObjects(sources, targets), [sources, targets]);
  const modules = useMemo(() => summarizeModules(objects), [objects]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return objects.filter((o) => {
      if (scope !== "ALL" && o.role !== scope) return false;
      if (moduleFilter !== "ALL" && o.module !== moduleFilter) return false;
      if (statusFilter !== "ALL" && o.status !== statusFilter) return false;
      if (!q) return true;
      return `${o.systemId} ${o.module} ${o.schema} ${o.name} ${o.connector} ${o.status}`.toLowerCase().includes(q);
    });
  }, [objects, scope, moduleFilter, statusFilter, query]);

  const selected = visible.find((o) => o.id === selectedId) ?? objects.find((o) => o.id === selectedId) ?? visible[0];
  const selectedSystem = selected ? [...sources, ...targets].find((s) => s.id === selected.systemId) : undefined;

  const sourceCount = objects.filter((x) => x.role === "SOURCE").length;
  const targetCount = objects.filter((x) => x.role === "TARGET").length;
  const readyCount = objects.filter((x) => x.status === "READY").length;
  const reviewCount = objects.filter((x) => x.status === "REVIEW" || x.status === "UNANALYZED").length;
  const blockedCount = objects.filter((x) => x.status === "BLOCKED").length;

  return (
    <section className="km-auto-landscape">
      <div className="km-auto-head">
        <div>
          <span className="eyebrow">SOURCE & TARGET AUTOMATION LANDSCAPE</span>
          <h2>Connected Systems & Object Intelligence</h2>
          <p>Connect once. KMITORA groups systems into modules, analyzes readiness and recommends qualifier/writer strategies while surfacing only exceptions.</p>
        </div>
        <div className="km-auto-actions">
          <button type="button" onClick={onAddSource}>+ Source System</button>
          <button type="button" onClick={onAddTarget}>+ Target System</button>
          <button type="button" className="primary"><WandSparkles size={15}/> Auto Analyze</button>
        </div>
      </div>

      <div className="km-auto-kpis">
        <div><span>Sources</span><strong>{sourceCount}</strong></div>
        <div><span>Targets</span><strong>{targetCount}</strong></div>
        <div><span>Modules</span><strong>{modules.length}</strong></div>
        <div><span>Ready</span><strong>{readyCount}</strong></div>
        <div><span>Review</span><strong>{reviewCount}</strong></div>
        <div><span>Blocked</span><strong>{blockedCount}</strong></div>
      </div>

      <div className="km-auto-toolbar">
        <div className="km-segment">
          {(["ALL","SOURCE","TARGET"] as Scope[]).map((item) => (
            <button key={item} type="button" className={scope === item ? "active" : ""} onClick={() => setScope(item)}>
              {item === "ALL" ? "All" : item === "SOURCE" ? "Sources" : "Targets"}
            </button>
          ))}
        </div>

        <label className="km-auto-search"><Search size={14}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search system, module, schema, object, connector..."/></label>

        <label className="km-auto-select"><Filter size={13}/>
          <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)}>
            <option value="ALL">All Modules</option>
            {modules.map((m) => <option key={m.name} value={m.name}>{m.name}</option>)}
          </select>
        </label>

        <label className="km-auto-select"><Activity size={13}/>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">All Statuses</option>
            <option value="READY">Ready</option>
            <option value="REVIEW">Review</option>
            <option value="BLOCKED">Blocked</option>
            <option value="UNANALYZED">Unanalyzed</option>
          </select>
        </label>
      </div>

      <div className="km-auto-layout">
        <aside className="km-auto-modules">
          <div className="km-auto-panel-title"><FolderTree size={15}/><strong>Module Explorer</strong></div>
          <button type="button" className={moduleFilter === "ALL" ? "selected" : ""} onClick={() => setModuleFilter("ALL")}>
            <span>All Modules</span><strong>{objects.length}</strong>
          </button>
          {modules.map((m) => (
            <button type="button" key={m.name} className={moduleFilter === m.name ? "selected" : ""} onClick={() => setModuleFilter(m.name)}>
              <span><ChevronRight size={12}/>{m.name}</span>
              <strong>{m.sourceObjects + m.targetObjects}</strong>
              <small>{m.ready} ready · {m.review} review · {m.blocked} blocked</small>
            </button>
          ))}
        </aside>

        <div className="km-auto-objects">
          <div className="km-auto-panel-title"><Table2 size={15}/><strong>Object Explorer</strong><span>{visible.length} shown</span></div>
          <div className="km-auto-table-wrap">
            <table className="km-auto-table">
              <thead><tr><th>Role</th><th>Module</th><th>System</th><th>Schema</th><th>Object</th><th>Connector</th><th>Status</th><th>Readiness</th></tr></thead>
              <tbody>
                {visible.map((o) => (
                  <tr key={o.id} className={selected?.id === o.id ? "selected" : ""} onClick={() => { setSelectedId(o.id); setDetailTab("OVERVIEW"); }}>
                    <td><span className="km-role">{o.role}</span></td>
                    <td>{o.module}</td>
                    <td>{o.systemId}</td>
                    <td>{o.schema}</td>
                    <td><strong>{o.name}</strong><small>{o.kind}</small></td>
                    <td>{o.connector}</td>
                    <td><span className={`statusPill ${statusClass(o.status)}`}>{o.status}</span></td>
                    <td>{o.readinessScore ?? "--"}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="km-auto-detail">
          {selected ? <>
            <div className="km-auto-detail-head">
              <div><span className="eyebrow">{selected.systemId}</span><h3>{selected.name}</h3><p>{selected.module} / {selected.schema}</p></div>
              <span className={`statusPill ${statusClass(selected.status)}`}>{selected.status}</span>
            </div>

            <div className="km-auto-detail-tabs">
              <button className={detailTab === "OVERVIEW" ? "active" : ""} onClick={() => setDetailTab("OVERVIEW")}>Overview</button>
              <button className={detailTab === "ANALYZER" ? "active" : ""} onClick={() => setDetailTab("ANALYZER")}>Analyzer</button>
              {selected.role === "SOURCE" && <button className={detailTab === "QUALIFIER" ? "active" : ""} onClick={() => setDetailTab("QUALIFIER")}>Qualifier</button>}
              {selected.role === "TARGET" && <button className={detailTab === "WRITER" ? "active" : ""} onClick={() => setDetailTab("WRITER")}>Writer</button>}
            </div>

            {detailTab === "OVERVIEW" && <dl className="km-auto-dl">
              <div><dt>Role</dt><dd>{selected.role}</dd></div><div><dt>Connector</dt><dd>{selected.connector}</dd></div>
              <div><dt>Module</dt><dd>{selected.module}</dd></div><div><dt>Schema</dt><dd>{selected.schema}</dd></div>
              <div><dt>Object Type</dt><dd>{selected.kind}</dd></div><div><dt>Readiness</dt><dd>{selected.readinessScore ?? "--"}%</dd></div>
              <div><dt>Confidence</dt><dd>{Math.round((selected.confidence ?? 0) * 100)}%</dd></div><div><dt>Imported</dt><dd>{selected.imported ? "YES" : "NO"}</dd></div>
            </dl>}

            {detailTab === "ANALYZER" && <div className="km-auto-recommendation"><Brain size={16}/><div>
              <strong>KMITORA Analyzer</strong>
              <p>Module, readiness and strategy recommendations are generated from current connected-system metadata. Deep table/schema profiling activates when connector discovery metadata is available.</p>
              <div className="km-mini-kpis"><span>Quality {selected.qualityScore ?? "--"}%</span><span>Readiness {selected.readinessScore ?? "--"}%</span><span>Confidence {Math.round((selected.confidence ?? 0) * 100)}%</span></div>
            </div></div>}

            {detailTab === "QUALIFIER" && <div className="km-auto-strategy">
              <div className="km-strategy-title"><Sparkles size={15}/><strong>Recommended Source Qualifier</strong></div>
              <dl className="km-auto-dl">
                <div><dt>Read Mode</dt><dd>{selected.suggestedReadMode ?? "FULL"}</dd></div>
                <div><dt>Filter</dt><dd>{selected.suggestedReadMode === "CDC" || selected.suggestedReadMode === "INCREMENTAL" ? "KMITORA_RECOMMENDED_WATERMARK" : "No filter recommended"}</dd></div>
                <div><dt>Partitions</dt><dd>{/transaction|payment/i.test(selected.name) ? 8 : 1}</dd></div>
                <div><dt>Preview Limit</dt><dd>1,000</dd></div>
                <div><dt>Pushdown</dt><dd>{selected.kind === "TABLE" || selected.kind === "VIEW" ? "ELIGIBLE" : "N/A"}</dd></div>
                <div><dt>Confidence</dt><dd>{Math.round((selected.confidence ?? 0) * 100)}%</dd></div>
              </dl>
            </div>}

            {detailTab === "WRITER" && <div className="km-auto-strategy">
              <div className="km-strategy-title"><Settings2 size={15}/><strong>Recommended Target Writer</strong></div>
              <dl className="km-auto-dl">
                <div><dt>Write Mode</dt><dd>{selected.suggestedWriteMode ?? "INSERT"}</dd></div>
                <div><dt>Batch Size</dt><dd>5,000</dd></div>
                <div><dt>Commit Interval</dt><dd>10,000</dd></div>
                <div><dt>Retries</dt><dd>3</dd></div>
                <div><dt>Reject Handling</dt><dd>QUARANTINE</dd></div>
                <div><dt>Confidence</dt><dd>{Math.round((selected.confidence ?? 0) * 100)}%</dd></div>
              </dl>
            </div>}

            <div className="km-auto-detail-actions">
              {selectedSystem && <button type="button" onClick={() => onView(selectedSystem)}><Eye size={14}/> View Data</button>}
              <button type="button"><Sparkles size={14}/> Auto Analyze</button>
              <button type="button"><Settings2 size={14}/> Configure</button>
            </div>
          </> : <p className="km-empty">Select an object to inspect.</p>}
        </aside>
      </div>

      <div className="km-auto-footer"><div><strong>Automation policy</strong><span>Metadata-first · preview/read-only by default · no production target writes · governed execution only.</span></div></div>
    </section>
  );
}

