import { useEffect, useMemo, useState } from "react";
import { Activity, Bot, CheckCircle2, Clock3, Code2, Database, FileSearch, GitBranch, Play, RefreshCw, ShieldCheck, Sparkles, Workflow } from "lucide-react";
import { ASSISTANT_CAPABILITIES, ASSISTANT_MODES, type AssistantMode } from "../config/assistantCapabilityModel";
import { executeAssistantTask, getAssistantRuntimeHealth, getWorkspaceContext, planAssistantTask, scheduleAssistantTask, type AssistantPlan } from "../services/kmitoraAutonomousAssistant";

const STORAGE_KEY = "kmitora.assistant.v2.lastPlan";

export default function AutonomousAssistantWorkbench() {
  const [mode,setMode] = useState<AssistantMode>("ASK");
  const [prompt,setPrompt] = useState("");
  const [plan,setPlan] = useState<AssistantPlan | null>(()=>{
    try { const raw=localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) as AssistantPlan : null; } catch { return null; }
  });
  const [runtime,setRuntime] = useState<{status:string;mode:string;workspace:string}>({status:"CHECKING",mode:"",workspace:""});
  const [context,setContext] = useState<Record<string,unknown>|null>(null);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  const [showCapabilities,setShowCapabilities] = useState(false);
  const [schedule,setSchedule] = useState("Daily 01:00");

  useEffect(()=>{ void refreshContext(); },[]);
  async function refreshContext(){
    setRuntime(await getAssistantRuntimeHealth());
    setContext(await getWorkspaceContext());
  }
  async function createPlan(){
    if(!prompt.trim()) return;
    setBusy(true); setMessage("");
    try {
      const next=await planAssistantTask(prompt,mode,{});
      setPlan(next); localStorage.setItem(STORAGE_KEY,JSON.stringify(next));
      setMessage("A000 created a governed plan. Review authority and execution gates before running.");
    } catch(e){ setMessage(e instanceof Error ? e.message : "Planning failed"); }
    finally { setBusy(false); }
  }
  async function runPlan(){
    if(!plan) return;
    setBusy(true); setMessage("");
    try {
      const result=await executeAssistantTask(plan,{});
      setMessage(`Task ${result.task_id}: ${result.status}. Runtime evidence is available from the task result.`);
    } catch(e){ setMessage(e instanceof Error ? e.message : "Execution failed"); }
    finally { setBusy(false); }
  }
  async function saveSchedule(){
    if(!plan) return;
    setBusy(true);
    try { const result=await scheduleAssistantTask(plan,schedule); setMessage(`Schedule created: ${result.schedule_id}`); }
    catch(e){ setMessage(e instanceof Error ? e.message : "Scheduling failed"); }
    finally { setBusy(false); }
  }
  const grouped=useMemo(()=>{
    const map=new Map<string,number>(); ASSISTANT_CAPABILITIES.forEach(c=>map.set(c.group,(map.get(c.group)||0)+1)); return [...map.entries()];
  },[]);

  return <section className="kaa-workbench">
    <div className="kaa-header">
      <div><span className="kaa-eyebrow">AUTONOMOUS ENTERPRISE WORKBENCH</span><strong>KMITORA Assistant V2</strong><small>Prompt to understand, plan, build, automate, validate, operate and prove.</small></div>
      <div className={`kaa-runtime ${runtime.status === "HEALTHY" ? "online" : "offline"}`}><span />{runtime.status}</div>
    </div>

    <div className="kaa-mode-row">{ASSISTANT_MODES.map(item=><button key={item.id} className={mode===item.id?"active":""} onClick={()=>setMode(item.id)} title={item.purpose}>{item.label}</button>)}</div>

    <div className="kaa-context-strip">
      <span><Bot size={14}/> A000</span><span><ShieldCheck size={14}/> DEV governed</span><span><Workflow size={14}/> DAG aware</span><span><Database size={14}/> DB aware</span><span><GitBranch size={14}/> repo aware</span><span><FileSearch size={14}/> files + evidence</span>
    </div>

    <div className="kaa-prompt-box">
      <textarea value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Describe the business requirement or problem. Example: Understand this application, find the root cause, implement the safest DEV fix, run tests, schedule the reusable job and prepare evidence." />
      <div><button onClick={createPlan} disabled={busy || !prompt.trim()}><Sparkles size={15}/>{busy?"Working...":"Create autonomous plan"}</button><button onClick={refreshContext}><RefreshCw size={15}/>Refresh context</button></div>
    </div>

    {plan && <div className="kaa-plan">
      <div className="kaa-plan-head"><div><span>{plan.taskId}</span><strong>{plan.mode}: {plan.objective}</strong></div><div><b>{plan.risk} RISK</b><b>{plan.authorityRequired}</b><b>PROD WRITE OFF</b></div></div>
      <div className="kaa-steps">{plan.steps.map((step,index)=><div key={step.id} className="kaa-step"><span>{index+1}</span><div><strong>{step.label}</strong><small>{step.authority} | {step.dependsOn.length ? `depends on ${step.dependsOn.join(", ")}` : "start"}</small></div><em>{step.status}</em></div>)}</div>
      <div className="kaa-actions"><button className="primary" onClick={runPlan} disabled={busy || runtime.status!=="HEALTHY"}><Play size={15}/>Run governed DEV task</button><input value={schedule} onChange={e=>setSchedule(e.target.value)} /><button onClick={saveSchedule} disabled={busy || runtime.status!=="HEALTHY"}><Clock3 size={15}/>Schedule</button></div>
    </div>}

    <div className="kaa-status-grid">
      <article><Code2 size={17}/><strong>Prompt-to-Implementation</strong><span>Requirement to impact analysis, patch, build, tests, simulation and evidence.</span></article>
      <article><Activity size={17}/><strong>Autonomous Repair Loop</strong><span>Bounded diagnose, patch, rebuild and re-test. Escalates instead of looping indefinitely.</span></article>
      <article><CheckCircle2 size={17}/><strong>Reuse Before Create</strong><span>Checks existing code, capabilities, agents, workflows and tools before generating duplicates.</span></article>
    </div>

    <button className="kaa-cap-toggle" onClick={()=>setShowCapabilities(v=>!v)}>{showCapabilities?"Hide":"Show"} {ASSISTANT_CAPABILITIES.length} assistant capabilities</button>
    {showCapabilities && <div className="kaa-capabilities">{grouped.map(([group,count])=><span key={group}><b>{group}</b>{count}</span>)}</div>}

    <div className="kaa-runtime-info"><span>Runtime: {runtime.mode || "not connected"}</span><span>Workspace: {runtime.workspace || "not available"}</span><span>Context objects: {context ? Object.keys(context).length : 0}</span></div>
    {message && <div className="kaa-message">{message}</div>}
  </section>;
}