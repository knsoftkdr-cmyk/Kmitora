import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Database,
  FileCheck2,
  GitBranch,
  List,
  Network,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import "../styles/activity-audit-premium.css";

type View = "OVERVIEW" | "LEGACY" | "TIMELINE" | "LIST" | "GRAPH" | "INTELLIGENCE";
type Severity = "INFO" | "SUCCESS" | "WARNING" | "ERROR" | "CRITICAL";

type AuditEvent = {
  id: string;
  title: string;
  detail: string;
  category: string;
  severity: Severity;
  timestamp?: string;
  actor: string;
  module: string;
  reference?: string;
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function toIso(value: unknown): string | undefined {
  const raw = String(value ?? "").trim();
  if (!raw) return undefined;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function event(
  id: string,
  title: string,
  detail: string,
  category: string,
  severity: Severity,
  actor: string,
  module: string,
  timestamp?: unknown,
  reference?: unknown
): AuditEvent {
  return {
    id,
    title,
    detail,
    category,
    severity,
    actor,
    module,
    timestamp: toIso(timestamp),
    reference: reference ? String(reference) : undefined,
  };
}

function fmtDate(value?: string) {
  if (!value) return "Timestamp unavailable";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "Timestamp unavailable" : d.toLocaleString();
}

export default function ActivityAuditPremiumWorkspace() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>("OVERVIEW");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");
  const [severity, setSeverity] = useState("ALL");
  const [refreshToken, setRefreshToken] = useState(0);

  const snapshot = useMemo(() => {
    const discovery = readJson<any>("kmitora.dev.discoveryResult", null);
    const approval = readJson<any>("kmitora.dev.approvalRequest", null);
    const execution = readJson<any>("kmitora.dev.executionResult", null);
    const reconciliation = readJson<any>("kmitora.dev.lastReconciliation", null);
    const evidence = readJson<any>("kmitora.dev.lastEvidence", null);
    const intelligence =
      readJson<any>("kmitora.dev.enterpriseIntelligence", null) ??
      readJson<any>("kmitora.dev.a000EnterpriseIntelligence", null);
    const workflow = readJson<any>("kmitora.dev.workflowState", null);

    const events: AuditEvent[] = [];

    if (discovery) {
      events.push(event(
        "discovery",
        "Discovery state recorded",
        `Discovery status: ${discovery.status ?? "RECORDED"}`,
        "DISCOVERY",
        "INFO",
        "KMITORA",
        "Discover",
        discovery.completed_at ?? discovery.updated_at ?? discovery.created_at,
        discovery.migration_id
      ));
    }

    const mappings = Array.isArray(discovery?.suggested_mappings)
      ? discovery.suggested_mappings
      : [];
    if (mappings.length) {
      events.push(event(
        "mapping",
        "Mapping evidence available",
        `${mappings.length} source-to-target mapping candidate(s) recorded.`,
        "MAPPING",
        "SUCCESS",
        "KMITORA",
        "Map",
        discovery?.completed_at ?? discovery?.updated_at,
        discovery?.migration_id
      ));
    }

    const transformations = Array.isArray(discovery?.transformation_plan)
      ? discovery.transformation_plan
      : [];
    if (transformations.length) {
      events.push(event(
        "transform",
        "Transformation plan recorded",
        `${transformations.length} governed transformation action(s) recorded.`,
        "TRANSFORMATION",
        "INFO",
        "KMITORA",
        "Transform",
        discovery?.completed_at ?? discovery?.updated_at,
        discovery?.migration_id
      ));
    }

    const findings = Array.isArray(discovery?.quality_findings)
      ? discovery.quality_findings
      : [];
    if (discovery) {
      const blocking = findings.filter(
        (item: any) => String(item?.severity ?? "").toUpperCase() === "ERROR"
      ).length;
      events.push(event(
        "validation",
        "Validation readiness observed",
        blocking
          ? `${blocking} blocking validation finding(s) are present.`
          : "No blocking validation findings were derived from current discovery evidence.",
        "VALIDATION",
        blocking ? "WARNING" : "SUCCESS",
        "KMITORA",
        "Validate",
        discovery?.completed_at ?? discovery?.updated_at,
        discovery?.migration_id
      ));
    }

    if (approval) {
      const status = String(
        approval.approved ? "APPROVED" : approval.rejected ? "REJECTED" : approval.status ?? "PENDING"
      ).toUpperCase();
      events.push(event(
        "approval",
        "Approval request recorded",
        `Authoritative approval status: ${status}.`,
        "APPROVAL",
        status === "APPROVED" ? "SUCCESS" : status === "REJECTED" ? "WARNING" : "INFO",
        approval.decision_by ?? "KMITORA",
        "Approvals",
        approval.decision_at ?? approval.requested_at,
        approval.id ?? approval.input?.migration_id
      ));
    }

    if (execution) {
      const failed = Number(execution.failed_record_count ?? execution.failure_count ?? 0);
      events.push(event(
        "execution",
        "DEV dry-run execution recorded",
        `Execution status: ${execution.status ?? execution.execution_state ?? "RECORDED"}.`,
        "MIGRATION",
        failed > 0 ? "WARNING" : "SUCCESS",
        "KMITORA",
        "Migrate",
        execution.completed_at ?? execution.created_at,
        execution.execution_id
      ));
    }

    if (reconciliation) {
      const pass = String(reconciliation.status ?? "").toUpperCase() === "PASS";
      events.push(event(
        "reconciliation",
        "Reconciliation result recorded",
        `Variance: ${Number(reconciliation.count_variance ?? 0)} · matched: ${Number(reconciliation.matched_records ?? 0)}.`,
        "RECONCILIATION",
        pass ? "SUCCESS" : "WARNING",
        "KMITORA",
        "Reconcile",
        reconciliation.created_at ?? reconciliation.completed_at,
        reconciliation.reconciliation_id
      ));
    }

    if (evidence) {
      events.push(event(
        "evidence",
        "Evidence package recorded",
        `Evidence status: ${evidence.status ?? "AVAILABLE"}.`,
        "EVIDENCE",
        "SUCCESS",
        "KMITORA",
        "Evidence",
        evidence.created_at,
        evidence.evidence_id
      ));
    }

    if (intelligence) {
      events.push(event(
        "intelligence",
        "Enterprise intelligence state recorded",
        `Primary domain: ${intelligence.primaryDomain ?? "Not analyzed"}.`,
        "SYSTEM",
        "INFO",
        "KMITORA",
        "Agents",
        intelligence.generatedAt ?? intelligence.created_at,
        intelligence.traceId
      ));
    }

    if (workflow) {
      events.push(event(
        "workflow",
        "Workflow state recorded",
        `Workflow: ${workflow.currentStage ?? workflow.status ?? "AVAILABLE"}.`,
        "SYSTEM",
        "INFO",
        "KMITORA",
        "System",
        workflow.updatedAt ?? workflow.updated_at,
        workflow.traceId
      ));
    }

    events.sort((a, b) => {
      const at = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const bt = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return bt - at;
    });

    const review = events.filter((item) =>
      ["WARNING", "ERROR", "CRITICAL"].includes(item.severity)
    );
    const successful = events.filter((item) => item.severity === "SUCCESS");
    const timestamped = events.filter((item) => Boolean(item.timestamp));
    const health = events.length
      ? Math.round((Math.max(0, events.length - review.length) / events.length) * 100)
      : 100;

    const safety = {
      targetWrites:
        Number(evidence?.safety?.target_write_count ?? reconciliation?.target_write_count ?? 0),
      productionActions:
        Number(evidence?.safety?.production_action_count ?? reconciliation?.production_action_count ?? 0),
      targetWriteExecuted:
        evidence?.safety?.target_write_executed === true ||
        reconciliation?.target_write_executed === true,
      productionActionExecuted:
        evidence?.safety?.production_action_executed === true ||
        reconciliation?.production_action_executed === true,
    };

    return {
      events,
      review,
      successful,
      timestamped,
      health,
      safety,
      evidenceAvailable: Boolean(evidence),
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

    children.forEach((el) => (el.style.display = "none"));
    return reset;
  }, [view]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return snapshot.events.filter((item) => {
      if (category !== "ALL" && item.category !== category) return false;
      if (severity !== "ALL" && item.severity !== severity) return false;
      if (!q) return true;
      return [
        item.title,
        item.detail,
        item.category,
        item.severity,
        item.actor,
        item.module,
        item.reference,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [category, query, severity, snapshot.events]);

  const categories = Array.from(new Set(snapshot.events.map((item) => item.category))).sort();
  const categoryCounts = categories
    .map((name) => ({
      name,
      count: snapshot.events.filter((item) => item.category === name).length,
    }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="activityPremium" ref={rootRef}>
      <header className="actHeader">
        <div>
          <span className="actEyebrow">OBSERVABILITY · RUNTIME AUDIT</span>
          <div className="actTitleRow">
            <h1>Activity &amp; Audit Stream</h1>
            <span className="actStatus"><CheckCircle2 size={13}/>ACTIVE</span>
          </div>
          <p>
            Read-only operational chronology derived from persisted KMITORA discovery,
            approval, DEV execution, reconciliation, evidence and enterprise-intelligence state.
          </p>
          <div className="actSafety">
            <span><ShieldCheck size={13}/>Read only</span>
            <span><FileCheck2 size={13}/>No fabricated runtime events</span>
            <span><Activity size={13}/>Runtime events</span>
            <span><Database size={13}/>Workspace: DEV</span>
          </div>
        </div>
        <div className="actHeaderActions">
          <div className="actWorkspace"><small>Workspace</small><strong>DEV</strong></div>
          <button type="button" onClick={() => setView("LEGACY")}>Existing Activity Controls</button>
        </div>
      </header>

      <section className="actKpis">
        <article><Activity size={19}/><span>Recorded Events</span><strong>{snapshot.events.length}</strong><small>Persisted state-derived</small></article>
        <article><Database size={19}/><span>Timestamped</span><strong>{snapshot.timestamped.length}</strong><small>Chronology available</small></article>
        <article><CheckCircle2 size={19}/><span>Successful / Safe</span><strong>{snapshot.successful.length}</strong><small>Success evidence</small></article>
        <article><AlertTriangle size={19}/><span>Review Signals</span><strong>{snapshot.review.length}</strong><small>Require attention</small></article>
        <article><ShieldCheck size={19}/><span>Evidence Read-Only</span><strong>YES</strong><small>No state mutation</small></article>
        <article><Sparkles size={19}/><span>Activity Health</span><strong>{snapshot.health}%</strong><small>{snapshot.review.length ? "Review signals present" : "Active & healthy"}</small></article>
      </section>

      <nav className="actTabs">
        {([
          ["OVERVIEW", "Overview", Activity],
          ["TIMELINE", "Timeline", GitBranch],
          ["LIST", "List", List],
          ["GRAPH", "Graph", Network],
          ["INTELLIGENCE", "Audit Intelligence", Sparkles],
        ] as Array<[View, string, typeof Activity]>).map(([id, label, Icon]) => (
          <button key={id} type="button" className={view === id ? "active" : ""} onClick={() => setView(id)}>
            <Icon size={14}/>{label}
          </button>
        ))}
        <button type="button" className="actRefresh" onClick={() => setRefreshToken((v) => v + 1)}>
          <RefreshCw size={13}/>Refresh
        </button>
      </nav>

      {(view === "OVERVIEW" || view === "TIMELINE" || view === "LIST" || view === "GRAPH") && (
        <div className="actBody">
          <div className="actMainGrid">
            <aside className="actFilters">
              <div className="actPanelHead"><div><span>RUNTIME AUDIT OVERVIEW</span><h2>Filters</h2></div></div>
              <div className="actSearch"><Search size={13}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search activity, IDs or categories..."/></div>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="ALL">All activity</option>
                {categories.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
                <option value="ALL">All severities</option>
                {(["INFO","SUCCESS","WARNING","ERROR","CRITICAL"] as Severity[]).map((item) => <option key={item}>{item}</option>)}
              </select>
              <button type="button" className="actOutline" onClick={() => { setQuery(""); setCategory("ALL"); setSeverity("ALL"); }}>Clear filters</button>

              <div className="actSnapshotCards">
                {snapshot.events.slice(0,2).map((item) => (
                  <article key={item.id}>
                    <strong>{item.title}</strong>
                    <span>{fmtDate(item.timestamp)}</span>
                    <small>{item.reference ?? "Reference unavailable"} · {item.severity}</small>
                    <em>{item.category}</em>
                  </article>
                ))}
              </div>
            </aside>

            <section className="actTimeline">
              <div className="actPanelHead">
                <div>
                  <span>RUNTIME ACTIVITY</span>
                  <h2>{view === "GRAPH" ? "Runtime relationship graph" : view === "LIST" ? "Runtime activity list" : "Runtime activity timeline"}</h2>
                </div>
                <span className="actBadge blue">{filtered.length} EVENTS</span>
              </div>

              {view === "GRAPH" ? (
                <div className="actGraph">
                  {categoryCounts.map((item, index) => (
                    <div className="actGraphNode" key={item.name}>
                      <CircleDot size={16}/>
                      <strong>{item.name}</strong>
                      <span>{item.count} event{item.count === 1 ? "" : "s"}</span>
                      {index < categoryCounts.length - 1 && <i/>}
                    </div>
                  ))}
                  {!categoryCounts.length && <div className="actEmpty">No runtime evidence exists for the current graph.</div>}
                </div>
              ) : (
                <div className={view === "LIST" ? "actEventList compact" : "actEventList"}>
                  {filtered.map((item) => (
                    <article key={item.id}>
                      <time>{fmtDate(item.timestamp)}</time>
                      <div className={`actEventIcon ${item.severity.toLowerCase()}`}>
                        {item.severity === "SUCCESS" ? <CheckCircle2 size={15}/> : item.severity === "WARNING" ? <AlertTriangle size={15}/> : <Activity size={15}/>}
                      </div>
                      <div className="actEventMain">
                        <strong>{item.title}</strong>
                        <p>{item.detail}</p>
                        <div><span>{item.severity}</span><span>{item.category}</span>{item.reference && <span>{item.reference}</span>}</div>
                      </div>
                      <div className="actEventMeta">
                        <span>Actor</span><strong>{item.actor}</strong>
                        <span>Module</span><strong>{item.module}</strong>
                      </div>
                    </article>
                  ))}
                  {!filtered.length && <div className="actEmpty">No recorded runtime events match the current filters.</div>}
                </div>
              )}
            </section>

            <aside className="actInsights">
              <section>
                <div className="actPanelHead"><div><span>EVENT CATEGORIES</span><h2>Runtime distribution</h2></div></div>
                <div className="actCategoryRows">
                  {categoryCounts.map((item) => <div key={item.name}><span>{item.name}</span><strong>{item.count}</strong></div>)}
                  {!categoryCounts.length && <div><span>No categories</span><strong>0</strong></div>}
                </div>
              </section>

              <section>
                <div className="actPanelHead"><div><span>SEVERITIES</span><h2>Attention profile</h2></div></div>
                <div className="actSeverityRows">
                  {(["INFO","SUCCESS","WARNING","ERROR","CRITICAL"] as Severity[]).map((item) => (
                    <div key={item}><i className={item.toLowerCase()}/><span>{item}</span><strong>{snapshot.events.filter((e) => e.severity === item).length}</strong></div>
                  ))}
                </div>
              </section>

              <section>
                <div className="actPanelHead"><div><span>MODE &amp; SAFETY</span><h2>Observational controls</h2></div></div>
                <div className="actSafetyRows">
                  <div><ShieldCheck size={12}/><span>Evidence Mode</span><strong>READ ONLY</strong></div>
                  <div><ShieldCheck size={12}/><span>State Mutation</span><strong>DISABLED</strong></div>
                  <div><ShieldCheck size={12}/><span>Target Writes</span><strong>{snapshot.safety.targetWrites}</strong></div>
                  <div><ShieldCheck size={12}/><span>Production Actions</span><strong>{snapshot.safety.productionActions}</strong></div>
                  <div><ShieldCheck size={12}/><span>Migration Execution</span><strong>DISABLED</strong></div>
                </div>
              </section>
            </aside>
          </div>

          <div className="actSafetyBanner">
            <ShieldCheck size={14}/>
            <strong>Observational audit workspace.</strong>
            <span>Activity Stream reads persisted frontend runtime evidence only. It does not create approvals, execute migrations, perform target writes or trigger production actions.</span>
          </div>
        </div>
      )}

      {view === "INTELLIGENCE" && (
        <div className="actIntelligence">
          <section className="actIntelHero">
            <div>
              <span className="actEyebrow">ADVANCED OBSERVABILITY INTELLIGENCE</span>
              <h2>Runtime Audit Decision Twin</h2>
              <p>
                Read-only reasoning over the currently persisted chronology. No timestamps,
                event volumes, actors or outcomes are fabricated when source evidence is absent.
              </p>
            </div>
            <span className="actStatus"><ShieldCheck size={13}/>READ ONLY</span>
          </section>
          <div className="actIntelCards">
            <article><Activity size={18}/><span>Recorded Events</span><strong>{snapshot.events.length}</strong><small>Derived from current persisted state</small></article>
            <article><AlertTriangle size={18}/><span>Review Signals</span><strong>{snapshot.review.length}</strong><small>Warning/error/critical evidence</small></article>
            <article><FileCheck2 size={18}/><span>Evidence Package</span><strong>{snapshot.evidenceAvailable ? "AVAILABLE" : "PENDING"}</strong><small>Read-only evidence state</small></article>
            <article><ShieldCheck size={18}/><span>Safety</span><strong>{snapshot.safety.targetWrites === 0 && snapshot.safety.productionActions === 0 ? "PRESERVED" : "REVIEW"}</strong><small>Production mutation evidence</small></article>
          </div>
        </div>
      )}
    </div>
  );
}

