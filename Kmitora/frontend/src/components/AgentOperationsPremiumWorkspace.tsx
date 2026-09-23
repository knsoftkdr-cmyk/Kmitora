import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock3,
  Database,
  FileCheck2,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { coreAgentRegistry } from "../config/agentRegistry";
import type { DynamicAgent } from "../models/EnterpriseIntelligence";
import "../styles/agent-operations-premium.css";

type AgentView =
  | "OVERVIEW"
  | "LEGACY"
  | "AGENTS"
  | "ASSIGNMENT"
  | "EXECUTION"
  | "SAFETY"
  | "INTELLIGENCE";

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function textOf(el: Element) {
  return (el.textContent ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function includesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

export default function AgentOperationsPremiumWorkspace() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<AgentView>("OVERVIEW");
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"ALL" | "CORE" | "ACTIVE" | "DYNAMIC">("ALL");
  const [refreshToken, setRefreshToken] = useState(0);

  const snapshot = useMemo(() => {
    const intelligence =
      readJson<any>("kmitora.dev.enterpriseIntelligence", null) ??
      readJson<any>("kmitora.dev.a000EnterpriseIntelligence", null);

    const workflow = readJson<any>("kmitora.dev.workflowState", null);
    const discovery = readJson<any>("kmitora.dev.discoveryResult", null);
    const execution = readJson<any>("kmitora.dev.executionResult", null);
    const evidence = readJson<any>("kmitora.dev.lastEvidence", null);

    const activated = safeArray<DynamicAgent>(intelligence?.activatedAgents);
    const dynamic = activated.filter((a) => a.status === "CREATED_FOR_TASK");
    const activeIds = new Set(activated.map((a) => a.id));
    const core = coreAgentRegistry.filter((a) => a.id !== "A000");
    const orchestrator = coreAgentRegistry.find((a) => a.id === "A000");

    const defects = safeArray<any>(intelligence?.defects);
    const domainMatches = safeArray<any>(intelligence?.domainMatches);

    const sourceWriteExecuted =
      intelligence?.safety?.sourceWriteExecuted === true;
    const targetWriteExecuted =
      intelligence?.safety?.targetWriteExecuted === true ||
      evidence?.safety?.target_write_executed === true;
    const productionActionExecuted =
      intelligence?.safety?.productionActionExecuted === true ||
      evidence?.safety?.production_action_executed === true;

    const safetyPreserved =
      !sourceWriteExecuted &&
      !targetWriteExecuted &&
      !productionActionExecuted;

    const totalExecutions =
      Number(execution?.processed_record_count ?? execution?.processed ?? 0) ||
      Number(workflow?.results?.length ?? 0);

    const failures =
      Number(execution?.failed_record_count ?? execution?.failed ?? 0) ||
      Number(workflow?.failedRelationships ?? 0);

    const successes = Math.max(0, totalExecutions - failures);
    const successRate =
      totalExecutions > 0
        ? Math.round((successes / totalExecutions) * 1000) / 10
        : 0;

    return {
      intelligence,
      workflow,
      discovery,
      execution,
      evidence,
      activated,
      dynamic,
      activeIds,
      core,
      orchestrator,
      defects,
      domainMatches,
      sourceWriteExecuted,
      targetWriteExecuted,
      productionActionExecuted,
      safetyPreserved,
      totalExecutions,
      failures,
      successes,
      successRate,
      primaryDomain: intelligence?.primaryDomain ?? "Not analyzed yet",
      businessConfidence:
        Number(intelligence?.businessUnderstandingConfidence ?? 0),
      currentPhase:
        workflow?.currentStage ??
        workflow?.status ??
        discovery?.status ??
        "READY",
    };
  }, [refreshToken]);

  useEffect(() => {
    const host = rootRef.current;
    const page = host?.closest(".page") as HTMLElement | null;
    if (!page || !host) return;

    const children = Array.from(page.children).filter(
      (element) => element !== host
    ) as HTMLElement[];

    const reset = () => children.forEach((el) => (el.style.display = ""));

    if (view === "LEGACY") {
      reset();
      return reset;
    }

    if (view === "OVERVIEW" || view === "INTELLIGENCE") {
      children.forEach((el) => (el.style.display = "none"));
      return reset;
    }

    const terms: Record<
      Exclude<AgentView, "OVERVIEW" | "LEGACY" | "INTELLIGENCE">,
      string[]
    > = {
      AGENTS: ["core and dynamic specialists", "specialists", "agent", "directory"],
      ASSIGNMENT: ["current enterprise assignment", "assignment", "primary domain"],
      EXECUTION: ["execution dashboard", "runtime intelligence", "execution"],
      SAFETY: ["agent execution safety", "source writes", "target writes", "production"],
    };

    children.forEach((el) => {
      el.style.display = includesAny(
        textOf(el),
        terms[view as keyof typeof terms]
      ) ? "" : "none";
    });

    if (!children.some((el) => el.style.display !== "none")) reset();
    return reset;
  }, [view]);

  const agents = useMemo(() => {
    const base = snapshot.core.map((agent) => ({
      id: agent.id,
      name: agent.name,
      capabilities: agent.capabilities,
      knowledge: agent.knowledgePacks,
      status: snapshot.activeIds.has(agent.id) ? "ACTIVE" : "STANDBY",
      dynamic: false,
    }));

    const extras = snapshot.dynamic
      .filter((a) => !base.some((b) => b.id === a.id))
      .map((a) => ({
        id: a.id,
        name: a.name,
        capabilities: a.capabilities,
        knowledge: a.inheritedKnowledge,
        status: a.status,
        dynamic: true,
      }));

    return [...base, ...extras].filter((agent) => {
      if (scope === "CORE" && agent.dynamic) return false;
      if (scope === "ACTIVE" && agent.status !== "ACTIVE") return false;
      if (scope === "DYNAMIC" && !agent.dynamic) return false;

      const q = query.trim().toLowerCase();
      if (!q) return true;

      return [
        agent.id,
        agent.name,
        agent.status,
        ...agent.capabilities,
        ...agent.knowledge,
      ].some((value) => String(value).toLowerCase().includes(q));
    });
  }, [query, scope, snapshot]);

  const activeCount = snapshot.activated.length;

  const healthy = snapshot.safetyPreserved && snapshot.failures === 0;

  return (
    <div className="agentOpsPremium" ref={rootRef}>
      <header className="aoHeader">
        <div>
          <span className="aoEyebrow">STEP 10 · AGENTIC OPERATIONS</span>
          <div className="aoTitleRow">
            <h1>Agent Operations Center</h1>
            <span className="aoStatus ready">
              <CheckCircle2 size={13}/>READY
            </span>
          </div>
          <p>
            Orchestrate KMITORA AI agents, monitor runtime intelligence, review
            enterprise assignments and inspect governed execution state.
          </p>
          <div className="aoSafetyRow">
            <span><CheckCircle2 size={13}/>Workspace: DEV</span>
            <span><Bot size={13}/>Master Orchestrator: KMITORA</span>
            <span><Activity size={13}/>Runtime: {snapshot.currentPhase}</span>
            <span><ShieldCheck size={13}/>Writes: DISABLED</span>
          </div>
        </div>

        <div className="aoHeaderActions">
          <div className="aoWorkspace">
            <small>Workspace</small>
            <strong>DEV</strong>
          </div>
          <button type="button" onClick={() => setView("LEGACY")}>
            Existing Agent Controls
          </button>
        </div>
      </header>

      <section className="aoKpis">
        <article><Bot size={19}/><span>Active Agents</span><strong>{activeCount}</strong><small>{snapshot.dynamic.length} task-created specialists</small></article>
        <article><UsersRound size={19}/><span>Core Specialists</span><strong>{snapshot.core.length}</strong><small>A101â€“A117 registry</small></article>
        <article><FileCheck2 size={19}/><span>Executed Units</span><strong>{snapshot.totalExecutions}</strong><small>Current persisted runtime evidence</small></article>
        <article><ShieldCheck size={19}/><span>Success Rate</span><strong>{snapshot.successRate}%</strong><small>{snapshot.failures} recorded failures</small></article>
        <article><Clock3 size={19}/><span>Business Confidence</span><strong>{snapshot.businessConfidence}%</strong><small>Enterprise intelligence confidence</small></article>
        <article><Activity size={19}/><span>System Health</span><strong>{healthy ? "100%" : "REVIEW"}</strong><small>{healthy ? "Safety controls preserved" : "Inspect current evidence"}</small></article>
      </section>

      <nav className="aoTabs">
        {([
          ["OVERVIEW", "Overview", Activity],
          ["AGENTS", `Agents (${agents.length})`, Bot],
          ["ASSIGNMENT", "Enterprise Assignment", Database],
          ["EXECUTION", "Execution Dashboard", Activity],
          ["SAFETY", "Execution Safety", ShieldCheck],
          ["INTELLIGENCE", "Agent Intelligence", Sparkles],
        ] as Array<[AgentView, string, typeof Activity]>).map(([id, label, Icon]) => (
          <button
            type="button"
            key={id}
            className={view === id ? "active" : ""}
            onClick={() => setView(id)}
          >
            <Icon size={14}/>{label}
          </button>
        ))}
        <button
          type="button"
          className="aoRefresh"
          onClick={() => setRefreshToken((v) => v + 1)}
        >
          <RefreshCw size={13}/>Refresh
        </button>
      </nav>

      {view === "OVERVIEW" && (
        <div className="aoBody">
          <section className="aoOrchestrator">
            <div className="aoBotMark"><Bot size={28}/></div>
            <div>
              <span className="aoEyebrow">INTERNAL ORCHESTRATOR</span>
              <h2>KMITORA · Global Intelligence Orchestrator</h2>
              <p>
                Coordinates domain, business-process, knowledge, migration and
                optimization capabilities and activates appropriate specialist
                agents from available evidence and workflow requirements.
              </p>
            </div>
            <span className="aoStatus ready">ACTIVE</span>
          </section>

          <div className="aoMainGrid">
            <aside>
              <div className="aoPanelHead">
                <div><span>CURRENT ENTERPRISE ASSIGNMENT</span><h2>Assignment Context</h2></div>
              </div>
              <dl className="aoAssignment">
                <div><dt>Primary Domain</dt><dd>{snapshot.primaryDomain}</dd></div>
                <div><dt>Mission Objective</dt><dd>Enterprise Migration</dd></div>
                <div><dt>Current Phase</dt><dd>{snapshot.currentPhase}</dd></div>
                <div><dt>Business Confidence</dt><dd>{snapshot.businessConfidence}%</dd></div>
                <div><dt>Defects / Hypotheses</dt><dd>{snapshot.defects.length}</dd></div>
                <div><dt>Domain Matches</dt><dd>{snapshot.domainMatches.length}</dd></div>
              </dl>
              <button type="button" className="aoOutline" onClick={() => setView("ASSIGNMENT")}>
                View Assignment Details
              </button>
            </aside>

            <section className="aoDirectory">
              <div className="aoPanelHead">
                <div><span>CORE AND DYNAMIC SPECIALISTS</span><h2>Agent Registry</h2></div>
                <div className="aoSearch">
                  <Search size={13}/>
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search agents..."/>
                </div>
              </div>

              <div className="aoScope">
                {(["ALL", "CORE", "ACTIVE", "DYNAMIC"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={scope === item ? "active" : ""}
                    onClick={() => setScope(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>

              <div className="aoAgentGrid">
                {agents.map((agent) => (
                  <article key={agent.id}>
                    <Bot size={14}/>
                    <div>
                      <strong>{agent.id} · {agent.name}</strong>
                      <small>{agent.capabilities.slice(0, 3).join(" · ")}</small>
                    </div>
                    <em className={agent.status === "ACTIVE" ? "active" : agent.dynamic ? "dynamic" : ""}>
                      {agent.status}
                    </em>
                  </article>
                ))}
              </div>

              {!agents.length && (
                <div className="aoEmpty">No agents match the current filter.</div>
              )}
            </section>
          </div>

          <div className="aoBottomGrid">
            <section>
              <div className="aoPanelHead">
                <div><span>AGENT EXECUTION SAFETY</span><h2>Governed Runtime Controls</h2></div>
              </div>
              <div className="aoSafetyList">
                <div><CheckCircle2 size={13}/><span>Discovery Mode</span><strong>AVAILABLE</strong></div>
                <div><ShieldCheck size={13}/><span>Source Writes</span><strong className="danger">{snapshot.sourceWriteExecuted ? "DETECTED" : "DISABLED"}</strong></div>
                <div><ShieldCheck size={13}/><span>Target Writes</span><strong className="danger">{snapshot.targetWriteExecuted ? "DETECTED" : "DISABLED"}</strong></div>
                <div><ShieldCheck size={13}/><span>Production Actions</span><strong className="danger">{snapshot.productionActionExecuted ? "DETECTED" : "DISABLED"}</strong></div>
                <div><ShieldCheck size={13}/><span>Cutover Actions</span><strong className="danger">DISABLED</strong></div>
              </div>
              <div className={`aoSafetyBanner ${snapshot.safetyPreserved ? "safe" : "review"}`}>
                <ShieldCheck size={13}/>
                {snapshot.safetyPreserved
                  ? "Agent execution remains safe. No writes or production actions are enabled."
                  : "Current evidence requires safety review."}
              </div>
            </section>

            <section className="aoExecution">
              <div className="aoPanelHead">
                <div><span>AGENT EXECUTION DASHBOARD</span><h2>Current Runtime Evidence</h2></div>
                <span className="aoStatus ready">LIVE VIEW</span>
              </div>
              <div className="aoExecKpis">
                <article><span>Total Executions</span><strong>{snapshot.totalExecutions}</strong></article>
                <article><span>Active Agents</span><strong>{activeCount}</strong></article>
                <article><span>Success</span><strong>{snapshot.successes}</strong></article>
                <article><span>Failures</span><strong>{snapshot.failures}</strong></article>
              </div>
              <div className="aoExecutionRows">
                <div><CheckCircle2 size={12}/><span>Domain / business intelligence</span><strong>{snapshot.intelligence ? "AVAILABLE" : "WAITING"}</strong></div>
                <div><CheckCircle2 size={12}/><span>Discovery execution</span><strong>{snapshot.discovery ? "AVAILABLE" : "WAITING"}</strong></div>
                <div><CheckCircle2 size={12}/><span>Migration execution evidence</span><strong>{snapshot.execution ? "AVAILABLE" : "WAITING"}</strong></div>
                <div><CheckCircle2 size={12}/><span>Evidence package</span><strong>{snapshot.evidence ? "AVAILABLE" : "WAITING"}</strong></div>
              </div>
            </section>
          </div>
        </div>
      )}

      {view === "INTELLIGENCE" && (
        <div className="aoIntelligence">
          <section className="aoIntelHero">
            <div>
              <span className="aoEyebrow">ADVANCED AGENT INTELLIGENCE</span>
              <h2>Agentic Operations Decision Twin</h2>
              <p>
                Read-only reasoning across agent capability, assignment, domain
                intelligence, execution evidence, defects and safety state. It does
                not create production authority or execute migration actions.
              </p>
            </div>
            <span className="aoStatus ready"><ShieldCheck size={13}/>READ ONLY</span>
          </section>

          <div className="aoIntelCards">
            <article><Sparkles size={18}/><span>Activated Agents</span><strong>{activeCount}</strong><small>Current enterprise-intelligence state</small></article>
            <article><Bot size={18}/><span>Dynamic Specialists</span><strong>{snapshot.dynamic.length}</strong><small>CREATED_FOR_TASK agents only</small></article>
            <article><AlertTriangle size={18}/><span>Defects / Hypotheses</span><strong>{snapshot.defects.length}</strong><small>Current intelligence evidence</small></article>
            <article><ShieldCheck size={18}/><span>Safety</span><strong>{snapshot.safetyPreserved ? "PRESERVED" : "REVIEW"}</strong><small>Source/target/production mutation state</small></article>
          </div>

          <div className="aoIntelligenceNote">
            <ShieldCheck size={14}/>
            Existing AgentOperations and EnterpriseIntelligence contracts remain authoritative.
          </div>
        </div>
      )}
    </div>
  );
}

