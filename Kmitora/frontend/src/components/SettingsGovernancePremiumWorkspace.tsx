import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Brain,
  CheckCircle2,
  Database,
  FileCheck2,
  Gauge,
  KeyRound,
  Network,
  RefreshCw,
  Server,
  Settings2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { a000KnowledgePacks } from "../config/knowledgePackRegistry";
import "../styles/settings-governance-premium.css";

type View =
  | "OVERVIEW"
  | "LEGACY"
  | "RUNTIME"
  | "AUTHORITY"
  | "SAFETY"
  | "INTEGRATIONS"
  | "INTELLIGENCE_PACKS"
  | "READINESS"
  | "GOVERNANCE_INTELLIGENCE";

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function boolLabel(value: boolean) {
  return value ? "AVAILABLE" : "NOT CONFIGURED";
}

export default function SettingsGovernancePremiumWorkspace() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>("OVERVIEW");
  const [refreshToken, setRefreshToken] = useState(0);

  const snapshot = useMemo(() => {
    const workflow = readJson<any>("kmitora.dev.workflowState", null);
    const discovery = readJson<any>("kmitora.dev.discoveryResult", null);
    const approval = readJson<any>("kmitora.dev.approvalRequest", null);
    const execution = readJson<any>("kmitora.dev.executionResult", null);
    const reconciliation = readJson<any>("kmitora.dev.lastReconciliation", null);
    const evidence = readJson<any>("kmitora.dev.lastEvidence", null);
    const enterprise =
      readJson<any>("kmitora.dev.enterpriseIntelligence", null) ??
      readJson<any>("kmitora.dev.a000EnterpriseIntelligence", null);

    const activePacks = a000KnowledgePacks.filter((pack) => pack.status === "ACTIVE");
    const totalTopics = a000KnowledgePacks.reduce(
      (sum, pack) => sum + Number(pack.topicCount ?? 0),
      0
    );

    const targetWrites =
      Number(evidence?.safety?.target_write_count ?? reconciliation?.target_write_count ?? 0);
    const productionActions =
      Number(evidence?.safety?.production_action_count ?? reconciliation?.production_action_count ?? 0);

    const targetWriteExecuted =
      evidence?.safety?.target_write_executed === true ||
      reconciliation?.target_write_executed === true;
    const productionActionExecuted =
      evidence?.safety?.production_action_executed === true ||
      reconciliation?.production_action_executed === true;

    const safetyPreserved =
      targetWrites === 0 &&
      productionActions === 0 &&
      !targetWriteExecuted &&
      !productionActionExecuted;

    const capabilityItems = [
      ["Runtime API", Boolean(workflow || discovery || approval || execution)],
      ["Discovery State", Boolean(discovery)],
      ["Approval State", Boolean(approval)],
      ["DEV Execution Evidence", Boolean(execution)],
      ["Reconciliation Evidence", Boolean(reconciliation)],
      ["Evidence Package", Boolean(evidence)],
      ["Enterprise Intelligence", Boolean(enterprise)],
      ["Knowledge Registry", a000KnowledgePacks.length > 0],
    ] as const;

    const configuredCapabilities = capabilityItems.filter(([, available]) => available).length;
    const readiness = Math.round(
      (configuredCapabilities / capabilityItems.length) * 100
    );

    return {
      workflow,
      discovery,
      approval,
      execution,
      reconciliation,
      evidence,
      enterprise,
      activePacks,
      totalTopics,
      targetWrites,
      productionActions,
      safetyPreserved,
      capabilityItems,
      configuredCapabilities,
      readiness,
      currentEnvironment: "DEV",
      workflowStatus:
        workflow?.currentStage ??
        workflow?.status ??
        "NOT CONFIGURED",
    };
  }, [refreshToken]);

  useEffect(() => {
    const host = rootRef.current;
    const page = host?.closest(".page") as HTMLElement | null;
    if (!page || !host) return;

    const children = Array.from(page.children).filter(
      (element) => element !== host
    ) as HTMLElement[];

    const reset = () =>
      children.forEach((element) => {
        element.style.display = "";
      });

    if (view === "LEGACY") {
      reset();
      return reset;
    }

    if (view === "OVERVIEW" || view === "GOVERNANCE_INTELLIGENCE") {
      children.forEach((element) => {
        element.style.display = "none";
      });
      return reset;
    }

    const terms: Record<
      Exclude<View, "OVERVIEW" | "LEGACY" | "GOVERNANCE_INTELLIGENCE">,
      string[]
    > = {
      RUNTIME: ["runtime configuration posture", "configuration"],
      AUTHORITY: ["promotion and authority model", "authority", "dev", "qa", "uat", "prod"],
      SAFETY: ["protected safety policies", "safety", "production migration", "cutover"],
      INTEGRATIONS: ["interaction capability contract", "capability"],
      INTELLIGENCE_PACKS: ["active intelligence packs", "knowledge", "topics"],
      READINESS: ["settings must represent real platform capability", "governance boundary"],
    };

    children.forEach((element) => {
      const text = (element.textContent ?? "").replace(/\s+/g, " ").toLowerCase();
      element.style.display = terms[view].some((term) => text.includes(term))
        ? ""
        : "none";
    });

    if (!children.some((element) => element.style.display !== "none")) reset();
    return reset;
  }, [view]);

  const promotionStages = [
    { name: "DEV", state: "ACTIVE", note: "Current development workspace" },
    { name: "QA", state: "CONTROLLED", note: "Promotion requires governed process" },
    { name: "UAT", state: "CONTROLLED", note: "Promotion requires governed process" },
    { name: "PRE-PROD", state: "CONTROLLED", note: "Pre-production authority gate" },
    { name: "PROD", state: "AUTHORITY REQUIRED", note: "No implicit production authority" },
  ];

  const protectedPolicies = [
    ["Production Migration", "DISABLED", "No production migration authority is granted from Settings."],
    ["Cutover", "DISABLED", "Cutover remains an explicit governed authorization gate."],
    ["Target Production Writes", "DISABLED", `Current recorded write count: ${snapshot.targetWrites}.`],
    ["Production Actions", "DISABLED", `Current recorded action count: ${snapshot.productionActions}.`],
    ["Destructive Operations", "GUARDED", "Delete/drop/truncate/destructive behavior is not enabled here."],
    ["Approval Authority", "GOVERNED", "Approval decisions remain separate from execution authority."],
  ];

  return (
    <div className="settingsPremium" ref={rootRef}>
      <header className="spHeader">
        <div>
          <span className="spEyebrow">PLATFORM ADMINISTRATION · GOVERNANCE</span>
          <div className="spTitleRow">
            <h1>Platform Settings &amp; Governance</h1>
            <span className="spStatus">
              <ShieldCheck size={13}/>GOVERNED
            </span>
          </div>
          <p>
            Central visibility into KMITORA runtime configuration, environment authority,
            protected safety policies, integration capability and active intelligence foundations.
          </p>
          <div className="spSafetyRow">
            <span><Settings2 size={13}/>Environment: {snapshot.currentEnvironment}</span>
            <span><ShieldCheck size={13}/>Configuration view: GOVERNED</span>
            <span><Database size={13}/>Target writes: {snapshot.targetWrites}</span>
            <span><Activity size={13}/>Production actions: {snapshot.productionActions}</span>
          </div>
        </div>

        <div className="spHeaderActions">
          <div className="spWorkspace">
            <small>Current Environment</small>
            <strong>{snapshot.currentEnvironment}</strong>
          </div>
          <button type="button" onClick={() => setView("LEGACY")}>
            Existing Settings
          </button>
        </div>
      </header>

      <section className="spKpis">
        <article><Server size={19}/><span>Environment</span><strong>DEV</strong><small>Current governed workspace</small></article>
        <article><Gauge size={19}/><span>Configuration Health</span><strong>{snapshot.readiness}%</strong><small>{snapshot.configuredCapabilities}/{snapshot.capabilityItems.length} observed capabilities</small></article>
        <article><ShieldCheck size={19}/><span>Protected Policies</span><strong>{protectedPolicies.length}</strong><small>Safety / authority controls</small></article>
        <article><Network size={19}/><span>Integration Capabilities</span><strong>{snapshot.configuredCapabilities}</strong><small>Observed runtime capabilities</small></article>
        <article><Brain size={19}/><span>Active Intelligence Packs</span><strong>{snapshot.activePacks.length}</strong><small>{snapshot.totalTopics} registered topics</small></article>
        <article><CheckCircle2 size={19}/><span>Governance Readiness</span><strong>{snapshot.safetyPreserved ? "READY" : "REVIEW"}</strong><small>{snapshot.safetyPreserved ? "Safety invariant preserved" : "Safety evidence requires review"}</small></article>
      </section>

      <nav className="spTabs">
        {([
          ["OVERVIEW", "Overview", Activity],
          ["RUNTIME", "Runtime Configuration", Settings2],
          ["AUTHORITY", "Environment Authority", KeyRound],
          ["SAFETY", "Safety Policies", ShieldCheck],
          ["INTEGRATIONS", "Integration Capabilities", Network],
          ["INTELLIGENCE_PACKS", `Intelligence Packs (${snapshot.activePacks.length})`, Brain],
          ["READINESS", "Platform Readiness", CheckCircle2],
          ["GOVERNANCE_INTELLIGENCE", "Governance Intelligence", Sparkles],
        ] as Array<[View, string, typeof Activity]>).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            className={view === id ? "active" : ""}
            onClick={() => setView(id)}
          >
            <Icon size={14}/>{label}
          </button>
        ))}
        <button
          type="button"
          className="spRefresh"
          onClick={() => setRefreshToken((value) => value + 1)}
        >
          <RefreshCw size={13}/>Refresh
        </button>
      </nav>

      {view === "OVERVIEW" && (
        <div className="spBody">
          <div className="spTopGrid">
            <section>
              <div className="spPanelHead">
                <div><span>RUNTIME CONFIGURATION POSTURE</span><h2>Current Governed Runtime</h2></div>
              </div>
              <div className="spRuntimeRows">
                <div><Settings2 size={13}/><span>Environment</span><strong>DEV</strong></div>
                <div><Activity size={13}/><span>Workflow</span><strong>{snapshot.workflowStatus}</strong></div>
                <div><Database size={13}/><span>Discovery State</span><strong>{snapshot.discovery ? "AVAILABLE" : "NOT CONFIGURED"}</strong></div>
                <div><FileCheck2 size={13}/><span>Evidence Package</span><strong>{snapshot.evidence ? "AVAILABLE" : "NOT CONFIGURED"}</strong></div>
                <div><ShieldCheck size={13}/><span>Runtime Safety</span><strong>{snapshot.safetyPreserved ? "PRESERVED" : "REVIEW"}</strong></div>
              </div>
              <button type="button" className="spOutline" onClick={() => setView("RUNTIME")}>
                View Runtime Configuration
              </button>
            </section>

            <section className="spAuthority">
              <div className="spPanelHead">
                <div><span>PROMOTION &amp; AUTHORITY MODEL</span><h2>Environment Governance</h2></div>
                <span className="spBadge blue">AUTHORITY GATED</span>
              </div>
              <div className="spPromotion">
                {promotionStages.map((stage, index) => (
                  <div key={stage.name}>
                    <i className={stage.name === "DEV" ? "active" : ""}>{index + 1}</i>
                    <div><strong>{stage.name}</strong><small>{stage.note}</small></div>
                    <em>{stage.state}</em>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <div className="spPanelHead">
                <div><span>PLATFORM READINESS</span><h2>Observed Capability State</h2></div>
              </div>
              <div className="spReadinessHero">
                <strong>{snapshot.readiness}%</strong>
                <span>Configuration coverage</span>
                <i><b style={{width: `${snapshot.readiness}%`}}/></i>
              </div>
              <div className="spReadinessRows">
                <div><span>Observed capabilities</span><strong>{snapshot.configuredCapabilities}</strong></div>
                <div><span>Capability checks</span><strong>{snapshot.capabilityItems.length}</strong></div>
                <div><span>Safety invariant</span><strong>{snapshot.safetyPreserved ? "PRESERVED" : "REVIEW"}</strong></div>
              </div>
            </section>
          </div>

          <section className="spSafetyPolicies">
            <div className="spPanelHead">
              <div><span>PROTECTED SAFETY POLICIES</span><h2>Immutable Governance Boundaries</h2></div>
              <span className="spBadge green">ENFORCED</span>
            </div>
            <div className="spPolicyGrid">
              {protectedPolicies.map(([name, status, note]) => (
                <article key={name}>
                  <ShieldCheck size={16}/>
                  <span>{name}</span>
                  <strong>{status}</strong>
                  <small>{note}</small>
                </article>
              ))}
            </div>
          </section>

          <div className="spMiddleGrid">
            <section>
              <div className="spPanelHead">
                <div><span>INTERACTION CAPABILITY CONTRACT</span><h2>Observed Platform Capabilities</h2></div>
              </div>
              <div className="spCapabilityRows">
                {snapshot.capabilityItems.map(([name, available]) => (
                  <div key={name}>
                    {available ? <CheckCircle2 size={13}/> : <AlertTriangle size={13}/>}
                    <span>{name}</span>
                    <strong className={available ? "available" : "missing"}>
                      {boolLabel(available)}
                    </strong>
                  </div>
                ))}
              </div>
              <button type="button" className="spOutline" onClick={() => setView("INTEGRATIONS")}>
                View Capability Matrix
              </button>
            </section>

            <section className="spKnowledge">
              <div className="spPanelHead">
                <div><span>ACTIVE INTELLIGENCE PACKS</span><h2>Knowledge Foundation</h2></div>
                <span className="spBadge blue">{snapshot.totalTopics} TOPICS</span>
              </div>
              <div className="spPackGrid">
                {a000KnowledgePacks.map((pack) => (
                  <article key={pack.id}>
                    <Brain size={15}/>
                    <div>
                      <strong>{pack.name}</strong>
                      <small>{pack.id}</small>
                    </div>
                    <span>{pack.topicCount}</span>
                    <em className={pack.status === "ACTIVE" ? "active" : ""}>{pack.status}</em>
                  </article>
                ))}
              </div>
            </section>
          </div>

          <div className="spBottomGrid">
            <section>
              <div className="spPanelHead">
                <div><span>SECURITY &amp; GOVERNANCE</span><h2>Authority Boundaries</h2></div>
              </div>
              <div className="spGovernanceRows">
                <div><KeyRound size={13}/><span>Approval authority</span><strong>GOVERNED</strong></div>
                <div><ShieldCheck size={13}/><span>Production authority</span><strong>NOT IMPLIED</strong></div>
                <div><FileCheck2 size={13}/><span>Evidence / audit</span><strong>{snapshot.evidence ? "AVAILABLE" : "PENDING"}</strong></div>
                <div><Database size={13}/><span>Target mutation</span><strong>DISABLED</strong></div>
                <div><Activity size={13}/><span>Cutover authority</span><strong>DISABLED</strong></div>
              </div>
            </section>

            <section className="spTruth">
              <ShieldCheck size={26}/>
              <div>
                <span className="spEyebrow">CONFIGURATION POLICY</span>
                <h2>Settings must represent real platform capability</h2>
                <p>
                  This console shows only registered intelligence packs and runtime
                  states that are currently observable. Missing capability remains
                  NOT CONFIGURED rather than being represented as available.
                </p>
              </div>
            </section>
          </div>
        </div>
      )}

      {view === "GOVERNANCE_INTELLIGENCE" && (
        <div className="spIntelligence">
          <section className="spIntelHero">
            <div>
              <span className="spEyebrow">ADVANCED GOVERNANCE INTELLIGENCE</span>
              <h2>Platform Governance Digital Twin</h2>
              <p>
                Read-only reasoning across environment authority, safety policies,
                runtime evidence, capability availability and knowledge foundations.
                It cannot change configuration, grant production authority or enable writes.
              </p>
            </div>
            <span className="spStatus"><ShieldCheck size={13}/>READ ONLY</span>
          </section>

          <div className="spIntelCards">
            <article><Gauge size={18}/><span>Configuration Coverage</span><strong>{snapshot.readiness}%</strong><small>Observed capability state</small></article>
            <article><Brain size={18}/><span>Knowledge Topics</span><strong>{snapshot.totalTopics}</strong><small>{snapshot.activePacks.length} active packs</small></article>
            <article><Network size={18}/><span>Observed Capabilities</span><strong>{snapshot.configuredCapabilities}</strong><small>Current runtime evidence only</small></article>
            <article><ShieldCheck size={18}/><span>Governance Safety</span><strong>{snapshot.safetyPreserved ? "PRESERVED" : "REVIEW"}</strong><small>Production mutation boundary</small></article>
          </div>

          <div className="spIntelNote">
            <ShieldCheck size={14}/>
            Existing PlatformSettings and knowledge-pack registry remain authoritative.
            This digital twin is advisory and read-only.
          </div>
        </div>
      )}
    </div>
  );
}

