import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  Boxes,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileInput,
  GitBranch,
  Network,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  TimerReset,
  Workflow,
  Wrench,
  Zap,
} from "lucide-react";
import {
  DEFAULT_WORKFLOWS,
  IMPORT_FAMILIES,
  KMITORA_WORKFLOW_CAPABILITIES,
  type WorkflowDefinition,
  type WorkflowStatus,
} from "../config/workflowAutomationModel";

const STORAGE_KEY = "kmitora.dev.workflowAutomation.v1";
const TABS = [
  "Overview",
  "Workflows",
  "Reusable Modules",
  "Jobs",
  "Batches",
  "Schedules",
  "Calendar",
  "Dependencies",
  "Triggers",
  "Runs",
  "Queue",
  "SLA",
  "Recovery",
  "Templates",
  "Imports",
  "Digital Twin",
] as const;

type Tab = (typeof TABS)[number];

type RunRecord = {
  id: string;
  workflowId: string;
  workflowName: string;
  startedAt: string;
  status: WorkflowStatus;
  progress: number;
  evidence: string;
};

type PersistedState = {
  workflows: WorkflowDefinition[];
  runs: RunRecord[];
};

function readState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { workflows: DEFAULT_WORKFLOWS, runs: [] };
    const parsed = JSON.parse(raw) as PersistedState;
    return {
      workflows: Array.isArray(parsed.workflows) && parsed.workflows.length ? parsed.workflows : DEFAULT_WORKFLOWS,
      runs: Array.isArray(parsed.runs) ? parsed.runs : [],
    };
  } catch {
    return { workflows: DEFAULT_WORKFLOWS, runs: [] };
  }
}

function tone(status: WorkflowStatus) {
  if (["COMPLETED", "READY"].includes(status)) return "success";
  if (["FAILED", "BLOCKED", "CANCELLED"].includes(status)) return "danger";
  if (["RUNNING", "RETRYING", "QUEUED"].includes(status)) return "info";
  if (["WAITING", "WAITING_APPROVAL", "PAUSED", "PARTIAL_SUCCESS"].includes(status)) return "warning";
  return "neutral";
}

export default function WorkflowAutomationCenter() {
  const [tab, setTab] = useState<Tab>("Overview");
  const [state, setState] = useState<PersistedState>(() => readState());
  const [selectedId, setSelectedId] = useState(() => readState().workflows[0]?.id ?? "");
  const [search, setSearch] = useState("");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const selected = state.workflows.find((workflow) => workflow.id === selectedId) ?? state.workflows[0];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return state.workflows;
    return state.workflows.filter((workflow) =>
      [workflow.name, workflow.id, workflow.domain, workflow.businessFunction, workflow.trigger, workflow.status]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [search, state.workflows]);

  const counts = useMemo(() => ({
    total: state.workflows.length,
    active: state.workflows.filter((item) => ["RUNNING", "QUEUED", "RETRYING"].includes(item.status)).length,
    scheduled: state.workflows.filter((item) => item.status === "SCHEDULED").length,
    waiting: state.workflows.filter((item) => ["WAITING", "WAITING_APPROVAL", "PAUSED"].includes(item.status)).length,
    failed: state.workflows.filter((item) => ["FAILED", "BLOCKED"].includes(item.status)).length,
    runs: state.runs.length,
  }), [state]);

  const updateWorkflow = (id: string, patch: Partial<WorkflowDefinition>) => {
    setState((current) => ({
      ...current,
      workflows: current.workflows.map((workflow) => workflow.id === id ? { ...workflow, ...patch } : workflow),
    }));
  };

  const createDraft = () => {
    const next = state.workflows.length + 1;
    const workflow: WorkflowDefinition = {
      ...DEFAULT_WORKFLOWS[0],
      id: `WF-${String(next + 100).padStart(3, "0")}`,
      name: `New Governed Workflow ${next}`,
      description: "Draft workflow created from the KMITORA governed migration template.",
      status: "DRAFT",
      trigger: "MANUAL",
      schedule: "On demand",
      nextRun: "Manual",
      batch: `BATCH-DRAFT-${String(next).padStart(3, "0")}`,
      nodes: DEFAULT_WORKFLOWS[0].nodes.map((node, index) => ({ ...node, id: `draft-${next}-${index + 1}` })),
    };
    setState((current) => ({ ...current, workflows: [...current.workflows, workflow] }));
    setSelectedId(workflow.id);
    setTab("Workflows");
  };

  const simulateRun = (workflow: WorkflowDefinition) => {
    const runId = `RUN-${Date.now()}`;
    const run: RunRecord = {
      id: runId,
      workflowId: workflow.id,
      workflowName: workflow.name,
      startedAt: new Date().toISOString(),
      status: "RUNNING",
      progress: 10,
      evidence: "DEV simulation only - no production mutation",
    };
    setState((current) => ({
      workflows: current.workflows.map((item) => item.id === workflow.id ? { ...item, status: "RUNNING" } : item),
      runs: [run, ...current.runs].slice(0, 100),
    }));
  };

  const resetDemo = () => {
    setState({ workflows: DEFAULT_WORKFLOWS, runs: [] });
    setSelectedId(DEFAULT_WORKFLOWS[0].id);
  };

  return (
    <div className="kwa-page">
      <header className="kwa-hero">
        <div>
          <div className="kwa-eyebrow"><Workflow size={15} /> AUTOMATION & ORCHESTRATION</div>
          <h1>Workflow & Automation Center</h1>
          <p>
            Govern workflows, worklets, mapplets, execution jobs, batches, schedules, dependencies,
            events, recovery, SLA, evidence and A000 orchestration from one DEV-safe control plane.
          </p>
        </div>
        <div className="kwa-hero-actions">
          <button className="kwa-primary" onClick={createDraft}><Sparkles size={15} /> Create Workflow</button>
          <button onClick={resetDemo}><RotateCcw size={15} /> Reset DEV Model</button>
        </div>
      </header>

      <div className="kwa-safety">
        <ShieldCheck size={16} />
        <strong>DEV CONTROL-PLANE MODEL</strong>
        <span>Schedules, runs and recovery controls shown here are governed UI state. Production execution remains disabled.</span>
      </div>

      <nav className="kwa-tabs">
        {TABS.map((item) => (
          <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>
        ))}
      </nav>

      {tab === "Overview" && (
        <>
          <section className="kwa-kpis">
            <Kpi icon={<Workflow size={17}/>} label="Workflows" value={counts.total} sub="Registered definitions" />
            <Kpi icon={<Activity size={17}/>} label="Active" value={counts.active} sub="Running / queued" />
            <Kpi icon={<CalendarDays size={17}/>} label="Scheduled" value={counts.scheduled} sub="Time based" />
            <Kpi icon={<Clock3 size={17}/>} label="Waiting" value={counts.waiting} sub="Event / approval / paused" />
            <Kpi icon={<AlertTriangle size={17}/>} label="Blocked" value={counts.failed} sub="Failure or policy block" />
            <Kpi icon={<Boxes size={17}/>} label="Runs" value={counts.runs} sub="DEV run history" />
          </section>

          <section className="kwa-grid-2">
            <Panel title="A000 Orchestration Model" subtitle="How KMITORA coordinates governed automation">
              <div className="kwa-flow">
                {["Trigger", "A000", "DAG", "Jobs", "Approval", "Execute", "Validate", "Reconcile", "Evidence"].map((x, i) => (
                  <div key={x} className="kwa-flow-node"><span>{i + 1}</span>{x}</div>
                ))}
              </div>
              <p className="kwa-note">A000 remains the master orchestrator; the scheduler supplies time, event and dependency triggers without bypassing governance.</p>
            </Panel>

            <Panel title="Enterprise Concepts" subtitle="Unified model beyond a single ETL product">
              <div className="kwa-chip-grid">
                {["Workflow", "Worklet", "Mapplet", "Session / Job", "Batch", "DAG", "Sensor", "Calendar", "SLA", "Retry", "Checkpoint", "Watermark", "CDC", "Backfill", "Replay", "Human Task", "Approval", "Digital Twin"].map((x) => <span key={x}>{x}</span>)}
              </div>
            </Panel>
          </section>

          <Panel title="Current Workflow Portfolio" subtitle="Governed workflows registered in this DEV control-plane model">
            <WorkflowTable workflows={state.workflows} onSelect={(id) => { setSelectedId(id); setTab("Workflows"); }} />
          </Panel>

          <Panel title="Advanced Capability Coverage" subtitle={`${KMITORA_WORKFLOW_CAPABILITIES.length} workflow, scheduling and automation capabilities modeled`}>
            <div className="kwa-capabilities">
              {KMITORA_WORKFLOW_CAPABILITIES.map((capability, index) => (
                <div key={capability}><CheckCircle2 size={14}/><span>{String(index + 1).padStart(2, "0")}</span>{capability}</div>
              ))}
            </div>
          </Panel>
        </>
      )}

      {tab === "Workflows" && (
        <section className="kwa-grid-workflow">
          <Panel title="Workflow Registry" subtitle="Versioned governed definitions">
            <input className="kwa-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search workflow, domain, trigger, status..." />
            <div className="kwa-workflow-list">
              {filtered.map((workflow) => (
                <button key={workflow.id} className={selected?.id === workflow.id ? "active" : ""} onClick={() => setSelectedId(workflow.id)}>
                  <div><strong>{workflow.name}</strong><small>{workflow.id} | v{workflow.version}</small></div>
                  <Status status={workflow.status}/>
                </button>
              ))}
            </div>
          </Panel>

          {selected && (
            <Panel title={selected.name} subtitle={`${selected.id} | ${selected.domain} | ${selected.businessFunction}`}>
              <div className="kwa-detail-grid">
                <Field label="Status" value={<Status status={selected.status}/>} />
                <Field label="Trigger" value={selected.trigger} />
                <Field label="Schedule" value={selected.schedule} />
                <Field label="Timezone" value={selected.timezone} />
                <Field label="Batch" value={selected.batch} />
                <Field label="Priority" value={selected.priority} />
                <Field label="Retry" value={`${selected.retryCount} x ${selected.retryDelayMinutes} min`} />
                <Field label="Timeout" value={`${selected.timeoutMinutes} min`} />
                <Field label="Concurrency" value={selected.concurrency} />
                <Field label="SLA" value={`${selected.slaMinutes} min`} />
                <Field label="Checkpoint" value={`Every ${selected.checkpointEvery.toLocaleString()} records`} />
                <Field label="Watermark" value={selected.watermark} />
              </div>
              <div className="kwa-action-row">
                <button className="kwa-primary" onClick={() => simulateRun(selected)}><Play size={14}/> Run DEV Simulation</button>
                <button onClick={() => updateWorkflow(selected.id, { status: "PAUSED" })}><Pause size={14}/> Pause</button>
                <button onClick={() => updateWorkflow(selected.id, { status: "READY" })}><RefreshCw size={14}/> Resume</button>
                <button onClick={() => updateWorkflow(selected.id, { status: "RETRYING" })}><TimerReset size={14}/> Retry</button>
              </div>
              <h3 className="kwa-section-title">Workflow DAG</h3>
              <div className="kwa-dag">
                {selected.nodes.map((node) => (
                  <div className="kwa-dag-node" key={node.id}>
                    <span>{node.type}</span>
                    <strong>{node.label}</strong>
                    <small>{node.dependsOn?.length ? `Depends on ${node.dependsOn.join(", ")}` : "Start node"}</small>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </section>
      )}

      {tab === "Reusable Modules" && (
        <section className="kwa-grid-3">
          <Concept icon={<Network size={18}/>} title="Reusable Workflow Module" badge="WORKLET EQUIVALENT" text="Reusable task groups for pre-load checks, quality gates, approvals, reconciliation and notifications." />
          <Concept icon={<Wrench size={18}/>} title="Reusable Transformation Component" badge="MAPPLET EQUIVALENT" text="Reusable cleansing, lookup, normalization, masking, validation and enrichment logic." />
          <Concept icon={<Zap size={18}/>} title="Execution Job" badge="SESSION EQUIVALENT" text="Bounded runtime unit with parameters, retries, checkpoints, evidence and deterministic status." />
        </section>
      )}

      {tab === "Jobs" && <JobsView workflows={state.workflows} />}
      {tab === "Batches" && <BatchesView workflows={state.workflows} />}
      {tab === "Schedules" && <SchedulesView workflows={state.workflows} />}
      {tab === "Calendar" && <CalendarView />}
      {tab === "Dependencies" && <DependenciesView workflow={selected} />}
      {tab === "Triggers" && <TriggersView />}
      {tab === "Runs" && <RunsView runs={state.runs} />}
      {tab === "Queue" && <QueueView workflows={state.workflows} />}
      {tab === "SLA" && <SlaView workflows={state.workflows} />}
      {tab === "Recovery" && <RecoveryView workflow={selected} />}
      {tab === "Templates" && <TemplatesView />}
      {tab === "Imports" && <ImportsView />}
      {tab === "Digital Twin" && <DigitalTwinView workflows={state.workflows} />}
    </div>
  );
}

function Kpi({icon,label,value,sub}:{icon:ReactNode;label:string;value:number|string;sub:string}) {
  return <div className="kwa-kpi"><div>{icon}<span>{label}</span></div><strong>{value}</strong><small>{sub}</small></div>;
}
function Panel({title,subtitle,children}:{title:string;subtitle:string;children:ReactNode}) {
  return <section className="kwa-panel"><header><div><h2>{title}</h2><p>{subtitle}</p></div></header><div className="kwa-panel-body">{children}</div></section>;
}
function Status({status}:{status:WorkflowStatus}) { return <span className={`kwa-status ${tone(status)}`}>{status}</span>; }
function Field({label,value}:{label:string;value:ReactNode}) { return <div className="kwa-field"><span>{label}</span><strong>{value}</strong></div>; }
function Concept({icon,title,badge,text}:{icon:ReactNode;title:string;badge:string;text:string}) { return <article className="kwa-concept"><div>{icon}<span>{badge}</span></div><h3>{title}</h3><p>{text}</p></article>; }
function WorkflowTable({workflows,onSelect}:{workflows:WorkflowDefinition[];onSelect:(id:string)=>void}) {
  return <div className="kwa-table-wrap"><table className="kwa-table"><thead><tr><th>Workflow</th><th>Trigger</th><th>Batch</th><th>Priority</th><th>Status</th><th></th></tr></thead><tbody>{workflows.map((w)=><tr key={w.id}><td><strong>{w.name}</strong><small>{w.id} | {w.domain}</small></td><td>{w.trigger}<small>{w.schedule}</small></td><td>{w.batch}</td><td>{w.priority}</td><td><Status status={w.status}/></td><td><button onClick={()=>onSelect(w.id)}>Open</button></td></tr>)}</tbody></table></div>;
}
function JobsView({workflows}:{workflows:WorkflowDefinition[]}) { const jobs=workflows.flatMap(w=>w.nodes.map(n=>({w,n}))); return <Panel title="Job Registry" subtitle={`${jobs.length} execution nodes modeled across registered workflows`}><div className="kwa-table-wrap"><table className="kwa-table"><thead><tr><th>Job</th><th>Workflow</th><th>Type</th><th>Dependency</th><th>Policy</th></tr></thead><tbody>{jobs.map(({w,n})=><tr key={`${w.id}-${n.id}`}><td><strong>{n.label}</strong><small>{n.id}</small></td><td>{w.name}</td><td>{n.type}</td><td>{n.dependsOn?.join(", ")||"Start"}</td><td>{n.policy||"Governed default"}</td></tr>)}</tbody></table></div></Panel>; }
function BatchesView({workflows}:{workflows:WorkflowDefinition[]}) { return <Panel title="Batch Control Center" subtitle="Job grouping, wave control, concurrency and batch-level recovery"><div className="kwa-card-grid">{workflows.map(w=><article className="kwa-mini-card" key={w.id}><span>{w.batch}</span><h3>{w.name}</h3><p>{w.nodes.length} jobs | concurrency {w.concurrency}</p><Status status={w.status}/></article>)}</div></Panel>; }
function SchedulesView({workflows}:{workflows:WorkflowDefinition[]}) { return <Panel title="Schedules" subtitle="Manual, recurring, event and dependency-driven schedules"><div className="kwa-table-wrap"><table className="kwa-table"><thead><tr><th>Workflow</th><th>Trigger</th><th>Schedule</th><th>Timezone</th><th>Next Run</th></tr></thead><tbody>{workflows.map(w=><tr key={w.id}><td>{w.name}</td><td>{w.trigger}</td><td>{w.schedule}</td><td>{w.timezone}</td><td>{w.nextRun}</td></tr>)}</tbody></table></div></Panel>; }
function CalendarView() { return <Panel title="Operational Calendar" subtitle="Business-day, holiday, blackout and maintenance-window aware scheduling"><div className="kwa-calendar-grid">{["00:00 Reference Data","01:00 Customer Discovery","02:00 Customer Batch","03:00 Orders","04:00 Reconcile","05:00 Evidence","06:00 Reports","Blackout: Maintenance window"].map(x=><div key={x}>{x}</div>)}</div><p className="kwa-note">Calendars can later be bound to banking days, regional holidays, month-end, quarter-end and regulatory windows.</p></Panel>; }
function DependenciesView({workflow}:{workflow?:WorkflowDefinition}) { return <Panel title="Dependency DAG" subtitle="Parent-child conditions, fan-out/fan-in, conditional branches and approval gates"><div className="kwa-dependency-map">{(workflow?.nodes??[]).map(n=><div key={n.id}><strong>{n.label}</strong><span>{n.dependsOn?.length?`After: ${n.dependsOn.join(", ")}`:"Start"}</span></div>)}</div></Panel>; }
function TriggersView() { return <Panel title="Trigger Catalog" subtitle="Supported enterprise trigger patterns"><div className="kwa-card-grid">{["Manual","Cron / Schedule","File Arrival","Database Change","API / Webhook","Message Queue","Dependency","Approval","Threshold","Agent Event","Lifecycle Event","Business Calendar"].map(x=><article className="kwa-mini-card" key={x}><Zap size={16}/><h3>{x}</h3><p>Governed trigger definition</p></article>)}</div></Panel>; }
function RunsView({runs}:{runs:RunRecord[]}) { return <Panel title="Run History" subtitle="Workflow run, status, progress and evidence linkage">{runs.length===0?<div className="kwa-empty">No DEV simulations have been started yet.</div>:<div className="kwa-table-wrap"><table className="kwa-table"><thead><tr><th>Run</th><th>Workflow</th><th>Started</th><th>Progress</th><th>Status</th><th>Evidence</th></tr></thead><tbody>{runs.map(r=><tr key={r.id}><td>{r.id}</td><td>{r.workflowName}</td><td>{r.startedAt}</td><td>{r.progress}%</td><td><Status status={r.status}/></td><td>{r.evidence}</td></tr>)}</tbody></table></div>}</Panel>; }
function QueueView({workflows}:{workflows:WorkflowDefinition[]}) { return <Panel title="Queue & Priority" subtitle="Priority, concurrency and resource-aware dispatch"><div className="kwa-card-grid">{["P0 Critical","P1 High","P2 Standard","P3 Low","Bulk","Maintenance"].map((q,i)=><article className="kwa-mini-card" key={q}><span>QUEUE {i+1}</span><h3>{q}</h3><p>{workflows.filter(w=>w.priority===`P${Math.min(i,3)}`).length} workflow(s)</p></article>)}</div></Panel>; }
function SlaView({workflows}:{workflows:WorkflowDefinition[]}) { return <Panel title="SLA Control" subtitle="Expected completion, warning threshold and breach prediction"><div className="kwa-table-wrap"><table className="kwa-table"><thead><tr><th>Workflow</th><th>SLA</th><th>Timeout</th><th>Retry</th><th>Risk</th></tr></thead><tbody>{workflows.map(w=><tr key={w.id}><td>{w.name}</td><td>{w.slaMinutes} min</td><td>{w.timeoutMinutes} min</td><td>{w.retryCount} x {w.retryDelayMinutes}m</td><td>{w.timeoutMinutes>w.slaMinutes?"WATCH":"NORMAL"}</td></tr>)}</tbody></table></div></Panel>; }
function RecoveryView({workflow}:{workflow?:WorkflowDefinition}) { return <Panel title="Retry, Recovery & Replay" subtitle="Safe restart controls for long-running migration workflows"><div className="kwa-card-grid">{["Retry Failed Job","Restart from Checkpoint","Restart from Stage","Skip Completed Jobs","Rerun Failed Records","Replay Batch","Reprocess Quarantine","Rollback Governed Change","Backfill Historical Range"].map(x=><article className="kwa-mini-card" key={x}><RotateCcw size={16}/><h3>{x}</h3><p>{workflow?.name??"Select a workflow"}</p></article>)}</div></Panel>; }
function TemplatesView() { return <Panel title="Workflow Templates" subtitle="Reusable migration and operations blueprints"><div className="kwa-card-grid">{["Oracle to PostgreSQL","Oracle to Snowflake","SQL Server to PostgreSQL","CSV/XML/TXT to PostgreSQL","Mainframe to Cloud","SAP to Data Lake","Customer 360","Data Warehouse Migration","Application Modernization","CDC Incremental Load","Backfill & Replay","Month-End Reconciliation"].map(x=><article className="kwa-mini-card" key={x}><Workflow size={16}/><h3>{x}</h3><p>Template ready for governed customization</p></article>)}</div></Panel>; }
function ImportsView() { return <Panel title="Workflow Import & Conversion" subtitle="Canonicalize external schedulers and ETL orchestration into the KMITORA workflow model"><div className="kwa-import-grid">{IMPORT_FAMILIES.map(([name,scope])=><article key={name}><FileInput size={18}/><div><h3>{name}</h3><p>{scope}</p></div><span>ADAPTER MODEL</span></article>)}</div></Panel>; }
function DigitalTwinView({workflows}:{workflows:WorkflowDefinition[]}) { const nodes=workflows.reduce((n,w)=>n+w.nodes.length,0); return <><section className="kwa-kpis"><Kpi icon={<Workflow size={17}/>} label="Workflow twins" value={workflows.length} sub="Definitions"/><Kpi icon={<GitBranch size={17}/>} label="Task nodes" value={nodes} sub="Graph nodes"/><Kpi icon={<Network size={17}/>} label="Dependencies" value={workflows.reduce((n,w)=>n+w.nodes.reduce((m,x)=>m+(x.dependsOn?.length??0),0),0)} sub="Directed edges"/><Kpi icon={<ShieldCheck size={17}/>} label="Governance" value="ENABLED" sub="Approval aware"/></section><Panel title="Workflow Digital Twin" subtitle="Graph model of workflows, jobs, dependencies, schedules, SLA, evidence, systems and agents"><div className="kwa-twin"><div>A000</div><div>Workflow Registry</div><div>DAG Graph</div><div>Scheduler</div><div>Batch Manager</div><div>Queue</div><div>Agents</div><div>Evidence</div></div><p className="kwa-note">Future runtime integration can project actual durations, resource pressure, failure patterns and SLA risk onto this graph.</p></Panel></>; }