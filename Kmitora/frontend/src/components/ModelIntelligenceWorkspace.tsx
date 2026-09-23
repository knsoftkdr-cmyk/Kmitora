import { useEffect, useMemo, useState } from 'react'
import { loadModelWorkspaceSnapshot } from '../services/modelIntelligence'
import type { ModelWorkspaceSnapshot } from '../types/modelIntelligence'
import './ModelIntelligenceWorkspace.css'

const EMPTY: ModelWorkspaceSnapshot = {
  generatedAt: '', registryCoveragePct: 0, evaluationCoveragePct: 0,
  governanceCoveragePct: 0, traceabilityCoveragePct: 0, models: [], warnings: []
}

export default function ModelIntelligenceWorkspace() {
  const [snapshot, setSnapshot] = useState<ModelWorkspaceSnapshot>(EMPTY)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadModelWorkspaceSnapshot().then(setSnapshot).finally(() => setLoading(false))
  }, [])

  const models = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return snapshot.models
    return snapshot.models.filter(m =>
      [m.name, m.provider, m.modelType, m.version, m.environment, m.status, ...m.capabilities]
        .filter(Boolean).join(' ').toLowerCase().includes(q)
    )
  }, [snapshot.models, query])

  return (
    <section className="miw">
      <header className="miw-head">
        <div>
          <div className="miw-eyebrow">KMITORA MODEL INTELLIGENCE</div>
          <h1>Model Intelligence Workspace</h1>
          <p>Discover, evaluate, govern and route registered models without fabricating model quality.</p>
        </div>
        <div className="miw-mode">DEV · READ / ANALYZE / PLAN</div>
      </header>

      <div className="miw-kpis">
        <Kpi label="Discovered Models" value={String(snapshot.models.length)} />
        <Kpi label="Registry Coverage" value={`${snapshot.registryCoveragePct}%`} />
        <Kpi label="Evaluation Coverage" value={`${snapshot.evaluationCoveragePct}%`} />
        <Kpi label="Governance Coverage" value={`${snapshot.governanceCoveragePct}%`} />
        <Kpi label="Traceability" value={`${snapshot.traceabilityCoveragePct}%`} />
      </div>

      <div className="miw-note">
        Deterministic safety and reconciliation gates may require 100% conformance. Probabilistic model accuracy is always shown as the actual measured value.
      </div>

      <div className="miw-toolbar">
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search model, provider, type, capability..." />
        <button onClick={() => { setLoading(true); loadModelWorkspaceSnapshot().then(setSnapshot).finally(() => setLoading(false)) }}>Refresh</button>
      </div>

      {snapshot.warnings.length > 0 && (
        <div className="miw-warnings">{snapshot.warnings.map((w, i) => <div key={i}>• {w}</div>)}</div>
      )}

      <div className="miw-table-wrap">
        <table className="miw-table">
          <thead><tr>
            <th>MODEL</th><th>PROVIDER</th><th>TYPE</th><th>VERSION</th><th>ENV</th><th>STATUS</th><th>CAPABILITIES</th><th>MEASURED QUALITY</th><th>PROD ELIGIBLE</th><th>SOURCE</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={10}>Loading model intelligence…</td></tr> :
             models.length === 0 ? <tr><td colSpan={10}>No registered/trained model metadata discovered. No synthetic model records were created.</td></tr> :
             models.map(m => <tr key={`${m.id}-${m.version ?? ''}`}>
               <td className="miw-model">{m.name}</td>
               <td>{m.provider}</td><td>{m.modelType}</td><td>{m.version ?? 'N/A'}</td><td>{m.environment}</td>
               <td><span className={`miw-pill ${m.status.toLowerCase()}`}>{m.status}</span></td>
               <td>{m.capabilities.length ? m.capabilities.join(', ') : 'N/A'}</td>
               <td>{m.metrics ? Object.entries(m.metrics).map(([k,v]) => `${k}: ${v ?? 'N/A'}`).join(' · ') : 'NOT EVALUATED'}</td>
               <td>{m.productionEligible ? 'YES' : 'NO'}</td><td className="miw-source">{m.source}</td>
             </tr>)}
          </tbody>
        </table>
      </div>

      <footer className="miw-foot">Production migration: DISABLED · Cutover: DISABLED · Target production writes: 0 · Production actions: 0</footer>
    </section>
  )
}

function Kpi({label,value}:{label:string,value:string}) {
  return <div className="miw-kpi"><div>{label}</div><strong>{value}</strong></div>
}

