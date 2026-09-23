import { useMemo, useState, type ReactNode } from "react";
import {
  BrainCircuit, CheckCircle2, Database, GitBranch, Network,
  ShieldCheck, Sparkles, Search, Workflow, AlertTriangle, LineChart,
  Boxes, Cpu, FileCode2, Gauge, Layers3, Microscope, Route, WandSparkles,
} from "lucide-react";
import {
  LIFECYCLE_NEURAL_MAP,
  NEURAL_CAPABILITIES,
  REUSED_KMITORA_CAPABILITIES,
  type NeuralCapability,
} from "../config/neuralIntelligenceModel";
import {
  buildGovernanceSummary,
  capabilityReadiness,
  readNeuralRuntimeContext,
} from "../services/neuralIntelligenceEngine";

const TABS = [
  "Overview","Database","Schema","Entity Resolution","Data Quality","Query Intelligence",
  "Workload & Scheduler","Failure & RCA","Graph & Lineage","Logs & Time Series",
  "Embeddings & RAG","Neural-Symbolic","Privacy & Learning","Model Router",
  "Model Registry","Evaluation","Drift","Explainability","Digital Twin","Lifecycle Integration"
] as const;
type Tab = (typeof TABS)[number];

const TAB_CATEGORIES: Record<Tab, string[]> = {
  Overview: [], Database:["Database"], Schema:["Schema","Migration"], "Entity Resolution":["Data Quality"],
  "Data Quality":["Data Quality"], "Query Intelligence":["Database"], "Workload & Scheduler":["Operations","Automation","Prediction"],
  "Failure & RCA":["Operations","Diagnosis"], "Graph & Lineage":["Graph","Lineage","Reverse Engineering"],
  "Logs & Time Series":["Operations","Prediction"], "Embeddings & RAG":["Knowledge"], "Neural-Symbolic":["Governance","Simulation"],
  "Privacy & Learning":["Privacy","Learning"], "Model Router":["Model Ops"], "Model Registry":["Model Ops"],
  Evaluation:["Model Ops"], Drift:["Model Ops"], Explainability:["Governance"], "Digital Twin":["Digital Twin"],
  "Lifecycle Integration":[]
};

export default function NeuralIntelligenceCenter() {
  const [tab,setTab] = useState<Tab>("Overview");
  const [query,setQuery] = useState("");
  const context = readNeuralRuntimeContext();
  const governance = buildGovernanceSummary();
  const categories = TAB_CATEGORIES[tab];
  const items = useMemo(() => {
    let list = NEURAL_CAPABILITIES;
    if (categories.length) list = list.filter((c) => categories.includes(c.category));
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((c) => `${c.name} ${c.description} ${c.category} ${c.modelFamilies.join(" ")}`.toLowerCase().includes(q));
    return list;
  },[tab,query,categories]);
  const reused = NEURAL_CAPABILITIES.filter((x)=>x.status === "REUSE_EXISTING").length;
  const research = NEURAL_CAPABILITIES.filter((x)=>x.status === "RESEARCH_ONLY").length;
  const adapters = NEURAL_CAPABILITIES.filter((x)=>x.status === "MODEL_ADAPTER").length;
  const native = NEURAL_CAPABILITIES.filter((x)=>x.status === "NATIVE_MODEL").length;

  return <div className="kni-page">
    <section className="kni-hero">
      <div className="kni-icon"><BrainCircuit size={24}/></div>
      <div>
        <span className="kni-eyebrow">KMITORA NEURAL & PREDICTIVE INTELLIGENCE</span>
        <h1>Neural Intelligence Control Center</h1>
        <p>Governed neural, predictive, graph, semantic and model-operational intelligence for databases, migration, workflows and enterprise modernization.</p>
      </div>
      <div className="kni-hero-badges"><span>DEV</span><span>READ ONLY BY DEFAULT</span><span>A000 GOVERNED</span></div>
    </section>

    <section className="kni-context">
      <Field label="Migration" value={context.migrationId || "Not selected"}/>
      <Field label="Domain" value={context.domain || "Universal"}/>
      <Field label="Discovery" value={context.hasDiscovery ? "Available" : "Not available"}/>
      <Field label="Evidence" value={context.hasEvidence ? "Available" : "Not available"}/>
      <Field label="Workflow Automation" value={context.hasWorkflowAutomation ? "Available" : "Not initialized"}/>
    </section>

    <section className="kni-kpis">
      <Kpi icon={<BrainCircuit size={18}/>} label="Neural capabilities" value={NEURAL_CAPABILITIES.length}/>
      <Kpi icon={<CheckCircle2 size={18}/>} label="Native control-plane" value={native}/>
      <Kpi icon={<Network size={18}/>} label="Reusing existing KMITORA" value={reused}/>
      <Kpi icon={<Route size={18}/>} label="Adapters required" value={adapters}/>
      <Kpi icon={<Microscope size={18}/>} label="Research only" value={research}/>
    </section>

    <nav className="kni-tabs">{TABS.map((t)=><button key={t} className={tab===t?"active":""} onClick={()=>setTab(t)}>{t}</button>)}</nav>

    {tab === "Overview" && <>
      <section className="kni-grid-3">
        <Info icon={<Database size={18}/>} title="Database Intelligence" text="Schema meaning, workload prediction, query intelligence, learned cardinality research, capacity and performance forecasting."/>
        <Info icon={<GitBranch size={18}/>} title="Graph & Causal Intelligence" text="Dependency prediction, root-cause ranking, blast radius, inferred lineage and graph-assisted migration ordering."/>
        <Info icon={<ShieldCheck size={18}/>} title="Neural-Symbolic Governance" text="Neural models propose and predict; deterministic rules, policy gates, evidence and approval govern execution."/>
        <Info icon={<Workflow size={18}/>} title="Workflow Intelligence" text="SLA risk, duration forecasting, resource-aware scheduling and concurrency recommendations integrated with Workflow & Automation."/>
        <Info icon={<Layers3 size={18}/>} title="Knowledge & Retrieval" text="Embeddings, vector stores and RAG across schemas, rules, code, mappings, logs, workflows and evidence."/>
        <Info icon={<Gauge size={18}/>} title="Model Operations" text="Routing, registry, evaluation, calibration, drift, explainability and verified continuous learning."/>
      </section>
      <section className="kni-panel"><header><h2>Reuse existing KMITORA capabilities</h2><p>No duplicate capability ownership is introduced where KMITORA already has a governed capability.</p></header>
        <div className="kni-reuse-grid">{REUSED_KMITORA_CAPABILITIES.map((x)=><div key={x.id}><strong>{x.id}</strong><span>{x.purpose}</span></div>)}</div>
      </section>
      <section className="kni-panel"><header><h2>Governance contract</h2><p>Neural intelligence remains advisory until validated by deterministic controls and evidence.</p></header>
        <div className="kni-governance">
          <Field label="Recommend" value={governance.neuralCanRecommend ? "Allowed" : "Blocked"}/>
          <Field label="Predict" value={governance.neuralCanPredict ? "Allowed" : "Blocked"}/>
          <Field label="Simulate" value={governance.neuralCanSimulate ? "Allowed" : "Blocked"}/>
          <Field label="Production mutation" value={governance.productionMutationAllowed ? "Allowed" : "Disabled"}/>
          <Field label="Deterministic validation" value="Required"/>
          <Field label="Evidence" value="Required"/>
        </div>
      </section>
    </>}

    {tab === "Lifecycle Integration" ? <LifecycleMap/> : tab !== "Overview" ? <CapabilityWorkspace items={items} query={query} setQuery={setQuery}/> : null}
  </div>;
}

function CapabilityWorkspace({items,query,setQuery}:{items:NeuralCapability[];query:string;setQuery:(v:string)=>void}) {
  return <>
    <section className="kni-search"><Search size={16}/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search neural capabilities, model families, inputs or outputs..."/></section>
    <section className="kni-cap-grid">{items.map((c)=><div key={c.id}><CapabilityCard c={c}/></div>)}</section>
  </>;
}

function CapabilityCard({c}:{c:NeuralCapability}) {
  const readiness = capabilityReadiness(c);
  const Icon = iconFor(c.category);
  return <article className="kni-card">
    <div className="kni-card-head"><span className="kni-card-icon"><Icon size={18}/></span><div><small>{c.category}</small><h3>{c.name}</h3></div><span className={`kni-state ${readiness.readiness.toLowerCase()}`}>{readiness.readiness.replaceAll("_"," ")}</span></div>
    <p>{c.description}</p>
    {c.reuseId && <div className="kni-reuse">Reuses existing capability: <strong>{c.reuseId}</strong></div>}
    <div className="kni-section"><span>Model families</span><div>{c.modelFamilies.map((x)=><em key={x}>{x}</em>)}</div></div>
    <div className="kni-io"><div><span>Inputs</span>{c.inputs.map((x)=><small key={x}>{x}</small>)}</div><div><span>Outputs</span>{c.outputs.map((x)=><small key={x}>{x}</small>)}</div></div>
    <div className="kni-stage-row">{c.stages.map((x)=><span key={x}>{x}</span>)}</div>
    <div className="kni-rule"><ShieldCheck size={15}/><span>{c.governance}</span></div>
    <div className="kni-evidence"><span>Evidence</span>{c.evidence.map((x)=><small key={x}>{x}</small>)}</div>
  </article>;
}

function LifecycleMap(){ return <section className="kni-panel"><header><h2>Lifecycle integration</h2><p>Neural intelligence augments the existing lifecycle instead of creating a parallel duplicate workflow.</p></header><div className="kni-life">{LIFECYCLE_NEURAL_MAP.map(([stage,text],i)=><div key={stage}><span>{String(i+1).padStart(2,"0")}</span><strong>{stage}</strong><p>{text}</p></div>)}</div></section> }
function Kpi({icon,label,value}:{icon:ReactNode;label:string;value:number|string}){ return <div className="kni-kpi"><div>{icon}<span>{label}</span></div><strong>{value}</strong></div> }
function Field({label,value}:{label:string;value:ReactNode}){ return <div className="kni-field"><span>{label}</span><strong>{value}</strong></div> }
function Info({icon,title,text}:{icon:ReactNode;title:string;text:string}){ return <article className="kni-info"><div>{icon}<h3>{title}</h3></div><p>{text}</p></article> }
function iconFor(category:string){ if(category.includes("Database")) return Database; if(category.includes("Graph")||category.includes("Lineage")) return GitBranch; if(category.includes("Knowledge")) return Boxes; if(category.includes("Model")) return Cpu; if(category.includes("Operations")||category.includes("Prediction")) return LineChart; if(category.includes("Reverse")) return FileCode2; if(category.includes("Governance")) return ShieldCheck; if(category.includes("Automation")) return Workflow; if(category.includes("Data Quality")) return AlertTriangle; if(category.includes("Learning")||category.includes("Privacy")) return Sparkles; return WandSparkles; }