import { useMemo, useState } from "react";
import { Activity, BrainCircuit, GitBranch, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import type { KnowledgeItem } from "../models/KnowledgeContext";
import type { MigrationSystem } from "../models/MigrationTopology";
import { buildEnterpriseDigitalTwin } from "../services/digitalTwinEngine";

export default function A000DigitalTwinPanel({
  sources,
  targets,
  knowledgeItems,
  problemPrompt = "",
  migrationPrompt = "",
}: {
  sources: MigrationSystem[];
  targets: MigrationSystem[];
  knowledgeItems: KnowledgeItem[];
  problemPrompt?: string;
  migrationPrompt?: string;
}) {
  const [scenarioPrompt, setScenarioPrompt] = useState("");
  const [scenarioResult, setScenarioResult] = useState("");
  const state = useMemo(
    () => buildEnterpriseDigitalTwin({ sources, targets, knowledgeItems, problemPrompt, migrationPrompt }),
    [sources, targets, knowledgeItems, problemPrompt, migrationPrompt]
  );

  const active = state.twins.filter((t) => t.status === "ACTIVE").length;
  const adapterRequired = state.twins.filter((t) => t.status === "ADAPTER_REQUIRED").length;
  const avgFidelity = state.twins.length
    ? Math.round(state.twins.reduce((sum, t) => sum + t.quality.fidelity, 0) / state.twins.length)
    : 0;

  function prepareScenario() {
    const text = scenarioPrompt.trim();
    if (!text) return;
    setScenarioResult(
      `KMITORA prepared a read-only what-if simulation plan for: "${text}". The Migration Twin will evaluate rule impact, record disposition, target-preview delta, dependency risk and reconciliation readiness. No target write or production action is executed.`
    );
  }

  return (
    <div className="panel" style={{ marginTop: 18 }}>
      <div className="panelHeader">
        <div>
          <span className="eyebrow">KMITORA ENTERPRISE DIGITAL TWIN</span>
          <h3>F1 Current State + F2 Future State + Migration Twin</h3>
          <p>KMITORA models the enterprise before changing it, then uses read-only simulation, digital thread and target preview to diagnose, rehearse and optimize the migration.</p>
        </div>
        <span className="statusPill success">TWIN MODEL READY</span>
      </div>

      <div className="metricStrip" style={{ marginBottom: 16 }}>
        <div><BrainCircuit /><span>Active Twins</span><strong>{active}</strong></div>
        <div><GitBranch /><span>Digital Thread</span><strong>{state.digitalThread.length}</strong></div>
        <div><Activity /><span>Twin Fidelity</span><strong>{avgFidelity}%</strong></div>
        <div><ShieldCheck /><span>Adapter Required</span><strong>{adapterRequired}</strong></div>
      </div>

      <div className="checkList">
        {state.twins.slice(0, 12).map((twin) => (
          <div className="checkRow" key={twin.id}>
            <span />
            <span>{twin.name}</span>
            <small>{twin.status.replaceAll("_", " ")}  ·  {twin.quality.confidence}% CONF</small>
          </div>
        ))}
      </div>

      <div className="panelHeader" style={{ marginTop: 18, marginBottom: 8 }}>
        <div><span className="eyebrow">DIGITAL THREAD</span><p>Requirement → Source → Rule → Mapping → Transformation → Validation → Target Preview → Execution → Reconciliation → Evidence</p></div>
      </div>
      <div className="checkList">
        {state.digitalThread.map((event) => (
          <div className="checkRow" key={event.id}><span /><span>{event.stage}: {event.label}</span><small>{event.status} · CONFIDENCE {event.confidence}</small></div>
        ))}
      </div>

      <div className="panelHeader" style={{ marginTop: 18, marginBottom: 8 }}>
        <div><span className="eyebrow">WHAT-IF / DIGITAL REHEARSAL</span><p>Ask KMITORA to simulate a migration or business-rule change before execution.</p></div>
      </div>
      <div className="formGrid">
        <label className="full">
          <span>Scenario Prompt</span>
          <textarea rows={3} value={scenarioPrompt} onChange={(e) => setScenarioPrompt(e.target.value)} placeholder="Example: What happens if 10% of customer records fail target mandatory-field validation?" />
        </label>
      </div>
      <div className="buttonRow">
        <button type="button" className="primary" onClick={prepareScenario} disabled={!scenarioPrompt.trim()}><Sparkles size={16} /> Prepare What-If</button>
        <button type="button" onClick={() => setScenarioPrompt("")}><RefreshCw size={16} /> Clear</button>
      </div>
      {scenarioResult && <p style={{ marginTop: 12, fontSize: 12 }}>{scenarioResult}</p>}

      <div className="checkList" style={{ marginTop: 14 }}>
        {state.scenarios.map((scenario) => (
          <div className="checkRow" key={scenario.id}><span /><span>{scenario.name}</span><small>{scenario.status.replaceAll("_", " ")}</small></div>
        ))}
      </div>

      <div className="panelHeader" style={{ marginTop: 18, marginBottom: 8 }}>
        <div><span className="eyebrow">KMITORA TWIN RECOMMENDATIONS</span><p>Recommendations are advisory or governed until the relevant execution gate is authorized.</p></div>
      </div>
      <div className="checkList">
        {state.recommendations.map((rec) => (
          <div className="checkRow" key={rec.id}><span /><span>{rec.category}: {rec.title}</span><small>{rec.confidence}%  ·  {rec.governed ? "GOVERNED" : "SAFE PLAN"}</small></div>
        ))}
      </div>

      <div className="checkList" style={{ marginTop: 16 }}>
        <div className="checkRow"><ShieldCheck size={16} /><span>Read-only twin modeling</span><small>YES</small></div>
        <div className="checkRow"><span /><span>Source write executed</span><small>NO</small></div>
        <div className="checkRow"><span /><span>Target write executed</span><small>NO</small></div>
        <div className="checkRow"><span /><span>Production execution observed</span><small>NO</small></div>
        <div className="checkRow"><span /><span>Closed-loop / control actions</span><small>GOVERNED</small></div>
      </div>
    </div>
  );
}




