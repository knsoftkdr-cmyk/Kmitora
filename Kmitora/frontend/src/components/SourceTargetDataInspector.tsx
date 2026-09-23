import { useEffect, useMemo, useState } from "react";

type Side = "source" | "target";
type Connection = {
  id: string;
  name: string;
  type?: string;
  status?: string;
  environment?: string;
};
type DataObject = { schema: string; name: string; type?: string };
type Preview = { columns: string[]; rows: Record<string, unknown>[]; totalRows?: number | null };
type Structure = { columns?: Array<{ name?: string }> };

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(payload?.error || payload?.message || `HTTP ${response.status}`));
  return payload as T;
}

function fmt(value: number | null | undefined): string {
  return value == null ? "N/A" : value.toLocaleString();
}

export default function SourceTargetDataInspector() {
  const [side, setSide] = useState<Side>("source");
  const [sources, setSources] = useState<Connection[]>([]);
  const [targets, setTargets] = useState<Connection[]>([]);
  const [connectionId, setConnectionId] = useState("");
  const [objects, setObjects] = useState<DataObject[]>([]);
  const [objectKey, setObjectKey] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [structureCount, setStructureCount] = useState<number | null>(null);
  const [mode, setMode] = useState<100 | 500 | 1000000>(100);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const connections = side === "source" ? sources : targets;
  const selectedObject = useMemo(() => {
    const [schema, ...rest] = objectKey.split("::");
    const name = rest.join("::");
    return objects.find((item) => item.schema === schema && item.name === name) || null;
  }, [objectKey, objects]);

  async function refreshConnections() {
    setError("");
    try {
      const [s, t] = await Promise.all([
        getJson<Connection[]>("/source-api/v1/sources"),
        getJson<Connection[]>("/target-api/v1/targets"),
      ]);
      setSources(Array.isArray(s) ? s : []);
      setTargets(Array.isArray(t) ? t : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  useEffect(() => { void refreshConnections(); }, []);

  useEffect(() => {
    const list = side === "source" ? sources : targets;
    const nextId = list.some((item) => item.id === connectionId) ? connectionId : (list[0]?.id || "");
    setConnectionId(nextId);
    setObjects([]);
    setObjectKey("");
    setPreview(null);
    setStructureCount(null);
  }, [side, sources, targets]);

  useEffect(() => {
    if (!connectionId) return;
    setBusy(true);
    setError("");
    setPreview(null);
    setStructureCount(null);
    const url = side === "source"
      ? `/source-api/v1/sources/${encodeURIComponent(connectionId)}/objects`
      : `/target-api/v1/targets/${encodeURIComponent(connectionId)}/objects`;
    getJson<DataObject[]>(url)
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setObjects(list);
        setObjectKey(list.length ? `${list[0].schema}::${list[0].name}` : "");
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)))
      .finally(() => setBusy(false));
  }, [connectionId, side]);

  async function loadData(limit: 100 | 500 | 1000000) {
    if (!connectionId || !selectedObject) return;
    if (limit === 1000000) {
      const total = preview?.totalRows ?? null;
      const message = total != null
        ? `Load all ${total.toLocaleString()} rows for this object? This can use significant browser memory.`
        : "Load the entire available object into the browser? This can use significant memory for large tables/files.";
      if (!window.confirm(message)) return;
    }
    setMode(limit);
    setBusy(true);
    setError("");
    try {
      const base = side === "source"
        ? `/source-api/v1/sources/${encodeURIComponent(connectionId)}`
        : `/target-api/v1/targets/${encodeURIComponent(connectionId)}`;
      const q = new URLSearchParams({
        schema: selectedObject.schema,
        object: selectedObject.name,
        limit: String(limit),
      });
      const data = await getJson<Preview>(`${base}/preview?${q.toString()}`);
      setPreview(data);

      if (side === "target") {
        const sq = new URLSearchParams({ schema: selectedObject.schema, object: selectedObject.name });
        const structure = await getJson<Structure>(`${base}/structure?${sq.toString()}`);
        setStructureCount(Array.isArray(structure.columns) ? structure.columns.length : data.columns.length);
      } else {
        setStructureCount(data.columns.length);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (selectedObject) void loadData(100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objectKey]);

  const displayedRows = preview?.rows.length ?? 0;
  const totalRows = preview?.totalRows ?? null;
  const columns = structureCount ?? preview?.columns.length ?? 0;
  const entireLikelyLoaded = mode === 1000000 && (totalRows == null || displayedRows >= totalRows);

  return (
    <section className="stInspector" id="kmitora-source-target-inspector">
      <div className="stInspectorHead">
        <div>
          <span>SOURCE & TARGET DATA INSPECTOR</span>
          <h2>Row count, column count and governed data preview</h2>
          <p>Inspect connected source and target objects without leaving Understand. Preview is read-only.</p>
        </div>
        <button type="button" onClick={() => void refreshConnections()}>Refresh Connections</button>
      </div>

      <div className="stInspectorTabs">
        <button className={side === "source" ? "active" : ""} onClick={() => setSide("source")}>Source</button>
        <button className={side === "target" ? "active" : ""} onClick={() => setSide("target")}>Target</button>
      </div>

      <div className="stInspectorSelectors">
        <label>
          <span>{side === "source" ? "Connected Source" : "Connected Target"}</span>
          <select value={connectionId} onChange={(event) => setConnectionId(event.target.value)}>
            {!connections.length && <option value="">No connected {side}s</option>}
            {connections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label>
          <span>Table / File / Object</span>
          <select value={objectKey} onChange={(event) => setObjectKey(event.target.value)} disabled={!objects.length}>
            {!objects.length && <option value="">No objects available</option>}
            {objects.map((item) => <option key={`${item.schema}.${item.name}`} value={`${item.schema}::${item.name}`}>{item.schema}.{item.name}</option>)}
          </select>
        </label>
      </div>

      <div className="stInspectorMetrics">
        <div><span>Total Rows</span><strong>{fmt(totalRows)}</strong><small>{totalRows == null ? "API count not available; loaded rows shown separately" : "Authoritative object count"}</small></div>
        <div><span>Column Count</span><strong>{columns.toLocaleString()}</strong><small>Columns in selected object</small></div>
        <div><span>Rows Loaded</span><strong>{displayedRows.toLocaleString()}</strong><small>{entireLikelyLoaded ? "Entire requested view" : "Current browser preview"}</small></div>
        <div><span>View Mode</span><strong>{mode === 1000000 ? "ENTIRE" : `FIRST ${mode}`}</strong><small>Read-only data view</small></div>
      </div>

      <div className="stInspectorActions">
        <span>View records:</span>
        <button className={mode === 100 ? "active" : ""} disabled={!selectedObject || busy} onClick={() => void loadData(100)}>First 100</button>
        <button className={mode === 500 ? "active" : ""} disabled={!selectedObject || busy} onClick={() => void loadData(500)}>First 500</button>
        <button className={mode === 1000000 ? "active" : ""} disabled={!selectedObject || busy} onClick={() => void loadData(1000000)}>Entire Records</button>
      </div>

      {error && <div className="stInspectorError">{error}</div>}
      {busy && <div className="stInspectorLoading">Loading read-only metadata / preview...</div>}

      {!busy && preview && (
        <div className="stInspectorTableWrap">
          <table>
            <thead><tr><th>#</th>{preview.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
            <tbody>
              {preview.rows.length ? preview.rows.map((row, index) => (
                <tr key={index}><td>{index + 1}</td>{preview.columns.map((column) => <td key={column}>{String(row[column] ?? "")}</td>)}</tr>
              )) : <tr><td colSpan={Math.max(1, preview.columns.length + 1)}>No rows returned.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}