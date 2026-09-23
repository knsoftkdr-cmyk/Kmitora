import { Brain, CheckCircle2, LoaderCircle, Search, ShieldCheck, Sparkles, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import type { KnowledgeItem } from "../models/KnowledgeContext";
import type { MigrationSystem } from "../models/MigrationTopology";
import type { EnterpriseIntelligenceState } from "../models/EnterpriseIntelligence";
import { analyzeEnterpriseIntelligence } from "../services/deepEnterpriseIntelligence";

export default function A000EnterpriseIntelligencePanel(props: {
  sources: MigrationSystem[];
  targets: MigrationSystem[];
  knowledgeItems: KnowledgeItem[];
}) {
  const { sources, targets, knowledgeItems } = props;
  const [problemPrompt, setProblemPrompt] = useState("");
  const [state, setState] = useState<EnterpriseIntelligenceState | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("kmitora.dev.enterpriseIntelligence");
      if (saved) setState(JSON.parse(saved));
    } catch {
      // Keep UI usable when old DEV state cannot be parsed.
    }
  }, []);

  function diagnose() {
    const next = analyzeEnterpriseIntelligence({ problemPrompt: problemPrompt.trim(), sources, targets, knowledgeItems });
    setState(next);
    localStorage.setItem("kmitora.dev.enterpriseIntelligence", JSON.stringify(next));
  }

  return (
    <div className="panel" style={{ marginTop: 18 }}>
      <div className="panelHeader">
        <div>
          <span className="eyebrow">KMITORA ENTERPRISE INTELLIGENCE</span>
          <h3>Deep Discovery  ·  Diagnose  ·  Resolve  ·  Modernize</h3>
          <p>Describe the business or system problem. KMITORA correlates business, application, data, database, integration, infrastructure, server, network, security, hardware, cloud, code, operations, source and target context before recommending a fix.</p>
        </div>
        <span className={`statusPill ${state ? "success" : "review"}`}>{state ? "UNDERSTANDING READY" : "WAITING"}</span>
      </div>

      <div className="formGrid">
        <label className="full">
          <span>Problem / Business Need / Defect Prompt</span>
          <textarea value={problemPrompt} onChange={(e) => setProblemPrompt(e.target.value)} rows={4} placeholder="Example: Orders are failing for some customers. Find the root cause across business rules, source data, application, API, database, server, network and target design. Fix everything that is safe, propose governed changes for the rest, and prevent the defect in the future system." />
        </label>
      </div>
      <div className="buttonRow">
        <button type="button" className="primary" onClick={diagnose}><Search size={16} /> Diagnose Enterprise</button>
        <button type="button" disabled={!state}><Sparkles size={16} /> Preview Recommended Resolution</button>
        <button type="button" disabled={!state || !state.defects.some((d) => d.disposition === "AUTO_SAFE")}><Wrench size={16} /> Resolve Safe</button>
      </div>

      {state && (
        <>
          <div className="checkList" style={{ marginTop: 14 }}>
            <div className="checkRow"><Brain size={16} /><span>Primary domain</span><small>{state.primaryDomain}</small></div>
            <div className="checkRow"><CheckCircle2 size={16} /><span>Business understanding</span><small>{state.businessUnderstandingConfidence}%</small></div>
            <div className="checkRow"><span /><span>Activated agents</span><small>{state.activatedAgents.length}</small></div>
            <div className="checkRow"><span /><span>Dynamic specialists</span><small>{state.activatedAgents.filter((a) => a.status === "CREATED_FOR_TASK").length}</small></div>
            <div className="checkRow"><span /><span>Defects / hypotheses</span><small>{state.defects.length}</small></div>
            <div className="checkRow"><ShieldCheck size={16} /><span>Production execution</span><small>NOT EXECUTED</small></div>
          </div>

          <div className="panelHeader" style={{ marginTop: 18, marginBottom: 8 }}>
            <div><span className="eyebrow">DEEP DISCOVERY COVERAGE</span><p>AVAILABLE means evidence is currently accessible. ADAPTER REQUIRED means KMITORA will need an authorized connector/agent before claiming that layer was inspected.</p></div>
          </div>
          <div className="checkList">
            {state.coverage.map((item) => (
              <div className="checkRow" key={item.layer}>
                {item.status === "AVAILABLE" ? <CheckCircle2 size={16} /> : <LoaderCircle size={16} />}
                <span>{item.layer.replaceAll("_", " ")}</span>
                <small>{item.status.replaceAll("_", " ")}  ·  CONFIDENCE {item.confidence}</small>
              </div>
            ))}
          </div>

          <div className="panelHeader" style={{ marginTop: 18, marginBottom: 8 }}>
            <div><span className="eyebrow">DEFECT INTELLIGENCE</span><p>KMITORA ranks symptoms, probable root causes, business impact and safe/governed resolution paths.</p></div>
          </div>
          <div className="checkList">
            {state.defects.length ? state.defects.map((defect) => (
              <div className="checkRow" key={defect.id}>
                <span />
                <span><strong>{defect.title}</strong> — {defect.recommendedAction}</span>
                <small>{defect.priority.replaceAll("_", " ")}  ·  {defect.disposition.replaceAll("_", " ")}  ·  {defect.confidence}%</small>
              </div>
            )) : <div className="checkRow"><span /><span>No defect proven yet. Continue evidence collection / deep discovery.</span><small>READ ONLY</small></div>}
          </div>

          <div className="panelHeader" style={{ marginTop: 18, marginBottom: 8 }}>
            <div><span className="eyebrow">SOLUTION OPTIONS</span><p>Fix current system, transform during migration, or redesign the target based on evidence and business need.</p></div>
          </div>
          <div className="checkList">
            {state.solutionOptions.map((option) => (
              <div className="checkRow" key={option.id}><span /><span>{option.title} — {option.rationale}</span><small>{option.recommended ? "RECOMMENDED" : option.approach.replaceAll("_", " ")}</small></div>
            ))}
          </div>

          <div className="panelHeader" style={{ marginTop: 18, marginBottom: 8 }}>
            <div><span className="eyebrow">ACTIVE INTELLIGENCE TEAM</span><p>KMITORA activates core agents and creates a domain specialist dynamically when confidence justifies it.</p></div>
          </div>
          <div className="checkList">
            {state.activatedAgents.slice(0, 20).map((agent) => (
              <div className="checkRow" key={agent.id}><Brain size={16} /><span>{agent.id}  ·  {agent.name}</span><small>{agent.status.replaceAll("_", " ")}</small></div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}




