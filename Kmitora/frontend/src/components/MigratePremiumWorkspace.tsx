import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Database,
  FileCheck2,
  GitBranch,
  Layers3,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Waves,
} from "lucide-react";
import "../styles/migrate-premium-workspace.css";

type MigrationView =
  | "OVERVIEW"
  | "WORKBENCH"
  | "WAVE"
  | "OBJECTS"
  | "ERRORS"
  | "RECONCILIATION"
  | "READINESS"
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

function textOf(element: Element) {
  return (element.textContent ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function containsAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

export default function MigratePremiumWorkspace() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<MigrationView>("OVERVIEW");
  const [refreshToken, setRefreshToken] = useState(0);

  const snapshot = useMemo(() => {
    const discovery = readJson<any>("kmitora.dev.discoveryResult", null);
    const approval = readJson<any>("kmitora.dev.approvalRequest", null);
    const execution = readJson<any>("kmitora.dev.executionResult", null);

    const mappings = safeArray<any>(discovery?.suggested_mappings);
    const transformations = safeArray<any>(discovery?.transformation_plan);
    const findings = safeArray<any>(discovery?.quality_findings);
    const staging = discovery?.target_staging_plan ?? {};
    const ready = safeArray<any>(staging.ready_records);
    const review = safeArray<any>(staging.review_records);
    const quarantine = safeArray<any>(staging.quarantine_records);
    const rejected = safeArray<any>(staging.rejected_records);
    const referential = safeArray<any>(staging.referential_dependencies);

    const blockedReferential = referential.filter(
      (item) =>
        Boolean(item?.entity) &&
        Boolean(item?.field) &&
        item?.row !== undefined &&
        item?.row !== null &&
        item?.value !== undefined &&
        item?.value !== null
    );

    const blockingFindings = findings.filter(
      (item) => String(item?.severity ?? "").toUpperCase() === "ERROR"
    );

    const plannedRecords =
      ready.length +
      review.length +
      quarantine.length +
      rejected.length +
      blockedReferential.length;

    const validationReady =
      Boolean(discovery) &&
      blockingFindings.length === 0 &&
      quarantine.length === 0 &&
      rejected.length === 0 &&
      blockedReferential.length === 0;

    const noTargetWrites =
      discovery?.production_action_executed !== true &&
      [...ready, ...review, ...quarantine, ...rejected].every(
        (record) => record?.target_write !== true
      ) &&
      referential.every((record) => record?.target_write !== true);

    const safeMappings = mappings.filter((mapping) => {
      const raw = Number(mapping?.confidence ?? 0);
      const confidence = raw <= 1 ? raw * 100 : raw;
      const decision = String(mapping?.decision ?? mapping?.action ?? "").toUpperCase();
      return (
        confidence >= 90 &&
        !decision.includes("REVIEW") &&
        !decision.includes("RELATIONSHIP") &&
        !decision.includes("REJECT") &&
        !decision.includes("BLOCK")
      );
    });

    const readiness =
      plannedRecords > 0
        ? Math.max(
            0,
            Math.min(
              100,
              Math.round(
                (ready.length / plannedRecords) * 100 -
                  Math.min(20, blockingFindings.length * 3)
              )
            )
          )
        : 0;

    const executionStatus = String(
      execution?.status ?? execution?.execution_state ?? "NOT EXECUTED"
    ).toUpperCase();

    return {
      discovery,
      approval,
      execution,
      mappings,
      transformations,
      findings,
      ready,
      review,
      quarantine,
      rejected,
      referential,
      blockedReferential,
      blockingFindings,
      plannedRecords,
      validationReady,
      noTargetWrites,
      safeMappings,
      readiness,
      executionStatus,
      migrationId:
        discovery?.migration_id ??
        localStorage.getItem("kmitora.dev.migrationId") ??
        "Not available",
    };
  }, [refreshToken]);

  useEffect(() => {
    const host = rootRef.current;
    const page = host?.closest(".page") as HTMLElement | null;
    if (!page || !host) return;

    const children = Array.from(page.children).filter(
      (element) => element !== host
    ) as HTMLElement[];

    const reset = () => children.forEach((element) => (element.style.display = ""));

    if (view === "WORKBENCH") {
      reset();
      return reset;
    }

    if (view === "OVERVIEW" || view === "INTELLIGENCE") {
      children.forEach((element) => (element.style.display = "none"));
      return reset;
    }

    const terms: Record<
      Exclude<MigrationView, "OVERVIEW" | "WORKBENCH" | "INTELLIGENCE">,
      string[]
    > = {
      WAVE: ["wave preview", "migration staging", "staging population", "preview wave"],
      OBJECTS: ["mappings", "transformations", "ready records", "staging"],
      ERRORS: ["blocking", "rejected", "quarantine", "finding", "error"],
      RECONCILIATION: ["reconcil", "evidence", "execution result"],
      READINESS: ["preflight", "readiness", "approval", "validation ready", "safety"],
    };

    children.forEach((element) => {
      element.style.display = containsAny(
        textOf(element),
        terms[view as keyof typeof terms]
      )
        ? ""
        : "none";
    });

    if (!children.some((element) => element.style.display !== "none")) reset();
    return reset;
  }, [view]);

  const completedPercent =
    snapshot.plannedRecords > 0
      ? Math.round((snapshot.ready.length / snapshot.plannedRecords) * 100)
      : 0;

  const issueCount =
    snapshot.blockingFindings.length +
    snapshot.quarantine.length +
    snapshot.rejected.length +
    snapshot.blockedReferential.length;

  const hasExecution = Boolean(snapshot.execution);
  const hasApproval = Boolean(snapshot.approval);

  return (
    <div className="migratePremium" ref={rootRef}>
      <header className="migratePremiumHeader">
        <div>
          <span className="migrateEyebrow">STEP 06 · GUARDED MIGRATION CONTROL</span>
          <div className="migrateTitleRow">
            <h1>Migration Command Center</h1>
            <span className="migrateStatus guarded">
              <ShieldCheck size={13}/>
              GUARDED
            </span>
          </div>
          <p>
            Plan migration waves safely with full readiness, approval, staging,
            execution-state and reconciliation context before any production cutover.
          </p>
          <div className="migrateSafetyRow">
            <span><CheckCircle2 size={13}/>Migration readiness: {snapshot.readiness}%</span>
            <span><Database size={13}/>Target writes: {snapshot.noTargetWrites ? "DISABLED" : "REVIEW"}</span>
            <span><Waves size={13}/>Execution: {snapshot.executionStatus}</span>
            <span><ShieldCheck size={13}/>Safety: GUARDED</span>
          </div>
        </div>

        <div className="migrateHeaderActions">
          <div className="migrateRun">
            <small>Migration Plan</small>
            <strong>{snapshot.migrationId}</strong>
          </div>
          <button type="button" onClick={() => setView("WORKBENCH")}>
            <Layers3 size={14}/>
            Existing Migration Controls
          </button>
        </div>
      </header>

      <section className="migrateKpis">
        <article className="migrateProgressKpi">
          <div
            className="migrateProgressRing"
            style={{"--score": `${completedPercent * 3.6}deg`} as CSSProperties}
          >
            <strong>{completedPercent}%</strong>
          </div>
          <div><span>Overall Progress</span><strong>{completedPercent}%</strong><small>Staging readiness</small></div>
        </article>
        <article><span>Records Planned</span><strong>{snapshot.plannedRecords}</strong><small>Current staging population</small></article>
        <article><span>Records Ready</span><strong>{snapshot.ready.length}</strong><small>Ready disposition</small></article>
        <article><span>Safe Mappings</span><strong>{snapshot.safeMappings.length}</strong><small>High-confidence governed set</small></article>
        <article><span>Errors / Blocks</span><strong>{issueCount}</strong><small>Must remain governed</small></article>
        <article><span>Review / Warnings</span><strong>{snapshot.review.length}</strong><small>Pending review disposition</small></article>
        <article><span>Approval</span><strong>{hasApproval ? "PRESENT" : "NONE"}</strong><small>Does not authorize execution</small></article>
        <article><span>Execution</span><strong>{hasExecution ? snapshot.executionStatus : "DISABLED"}</strong><small>Production remains disabled</small></article>
      </section>

      <nav className="migrateTabs" aria-label="Migration workspace">
        {([
          ["OVERVIEW", "Overview", Activity],
          ["WORKBENCH", "Governed Controls", ShieldCheck],
          ["WAVE", "Wave Planning", Waves],
          ["OBJECTS", `Objects & Data (${snapshot.plannedRecords})`, Database],
          ["ERRORS", `Errors & Warnings (${issueCount})`, AlertTriangle],
          ["RECONCILIATION", "Reconciliation", GitBranch],
          ["READINESS", "Readiness", CheckCircle2],
          ["INTELLIGENCE", "Migration Intelligence", Sparkles],
        ] as Array<[MigrationView, string, typeof Activity]>).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            className={view === id ? "active" : ""}
            onClick={() => setView(id)}
          >
            <Icon size={14}/>
            {label}
          </button>
        ))}
        <button
          type="button"
          className="migrateRefresh"
          onClick={() => setRefreshToken((value) => value + 1)}
        >
          <RefreshCw size={13}/>
          Refresh
        </button>
      </nav>

      {view === "OVERVIEW" && (
        <div className="migrateOverview">
          {!snapshot.discovery ? (
            <section className="migrateNoDiscovery">
              <Database size={28}/>
              <div>
                <span className="migrateEyebrow">DISCOVERY PREREQUISITE</span>
                <h2>No Discovery Result Available</h2>
                <p>
                  Return to Connect and Discovery before preparing a migration wave.
                  KMITORA will not fabricate migration counts, readiness, approvals or execution state.
                </p>
              </div>
              <button type="button" onClick={() => setView("WORKBENCH")}>
                View Existing Guarded State
              </button>
            </section>
          ) : (
            <>
              <div className="migrateTopGrid">
                <section>
                  <div className="migratePanelTitle">
                    <div><span>MIGRATION EXECUTION</span><h2>Governed Lifecycle</h2></div>
                  </div>
                  <div className="migrateLifecycle">
                    <div className={snapshot.validationReady ? "done" : "active"}><CheckCircle2 size={14}/><span>Plan & Prepare</span><strong>{snapshot.validationReady ? "READY" : "REVIEW"}</strong></div>
                    <div><Waves size={14}/><span>Wave Preview</span><strong>AVAILABLE</strong></div>
                    <div><Activity size={14}/><span>Monitoring & Controls</span><strong>GUARDED</strong></div>
                    <div><FileCheck2 size={14}/><span>Post-Wave Validation</span><strong>NOT EXECUTED</strong></div>
                    <div><GitBranch size={14}/><span>Wave Reconciliation</span><strong>NOT EXECUTED</strong></div>
                    <div><ShieldCheck size={14}/><span>Cutover</span><strong>DISABLED</strong></div>
                  </div>
                  <button type="button" className="migrateOutline" onClick={() => setView("WORKBENCH")}>
                    Open Authoritative Controls <ArrowRight size={13}/>
                  </button>
                </section>

                <section className="migrateWavePanel">
                  <div className="migratePanelTitle">
                    <div><span>WAVE EXECUTION PROGRESS</span><h2>Current Staging Plan</h2></div>
                    <span className="migrateBadge blue">PREVIEW</span>
                  </div>
                  <div className="migrateWaveProgress">
                    <div><span>Ready staging population</span><strong>{completedPercent}%</strong></div>
                    <i><b style={{width: `${completedPercent}%`}}/></i>
                  </div>
                  <div className="migrateWaveMetrics">
                    <article><strong>{snapshot.plannedRecords}</strong><span>Planned</span></article>
                    <article><strong>{snapshot.ready.length}</strong><span>Ready</span></article>
                    <article><strong>{snapshot.review.length}</strong><span>Review</span></article>
                    <article><strong>{snapshot.quarantine.length}</strong><span>Quarantine</span></article>
                    <article><strong>{snapshot.rejected.length}</strong><span>Rejected</span></article>
                  </div>
                  <div className="migrateObjectRows">
                    <div><span>Mappings</span><strong>{snapshot.mappings.length}</strong><em>Discovered</em></div>
                    <div><span>Transformations</span><strong>{snapshot.transformations.length}</strong><em>Planned</em></div>
                    <div><span>Quality findings</span><strong>{snapshot.findings.length}</strong><em>Evidence</em></div>
                    <div><span>Referential dependencies</span><strong>{snapshot.referential.length}</strong><em>Governed</em></div>
                  </div>
                  <button type="button" className="migrateOutline" onClick={() => setView("WAVE")}>
                    View Wave Planning <ArrowRight size={13}/>
                  </button>
                </section>

                <aside>
                  <div className="migratePanelTitle">
                    <div><span>MIGRATION READINESS</span><h2>Preflight Decision</h2></div>
                  </div>
                  <div className="migrateReadiness">
                    <div
                      className="migrateReadinessRing"
                      style={{"--score": `${snapshot.readiness * 3.6}deg`} as CSSProperties}
                    >
                      <strong>{snapshot.readiness}%</strong>
                      <span>READY</span>
                    </div>
                    <div className="migrateReadinessChecks">
                      <p><CheckCircle2 size={12}/><span>Validation ready</span><strong>{snapshot.validationReady ? "YES" : "NO"}</strong></p>
                      <p><AlertTriangle size={12}/><span>Blocking issues</span><strong>{issueCount}</strong></p>
                      <p><ShieldCheck size={12}/><span>Target writes</span><strong>{snapshot.noTargetWrites ? "NONE" : "REVIEW"}</strong></p>
                      <p><FileCheck2 size={12}/><span>Approval</span><strong>{hasApproval ? "PRESENT" : "NOT REQUESTED"}</strong></p>
                    </div>
                  </div>
                  <button type="button" className="migrateOutline" onClick={() => setView("READINESS")}>
                    View Readiness Details <ArrowRight size={13}/>
                  </button>
                </aside>

                <aside>
                  <div className="migratePanelTitle">
                    <div><span>SAFETY CONTROLS</span><h2>Execution Guard</h2></div>
                  </div>
                  <div className="migrateSafetyControls">
                    <div><span>Target Writes</span><strong>DISABLED</strong></div>
                    <div><span>Production Migration</span><strong>DISABLED</strong></div>
                    <div><span>Cutover</span><strong>DISABLED</strong></div>
                    <div><span>Production Actions</span><strong>0</strong></div>
                    <div><span>Approval Effect</span><strong>NO EXECUTION</strong></div>
                  </div>
                  <div className="migrateSafeBanner"><ShieldCheck size={13}/>Safety gates remain authoritative.</div>
                </aside>
              </div>

              <div className="migrateBottomGrid">
                <section>
                  <div className="migratePanelTitle"><div><span>DATA MOVEMENT</span><h2>Disposition Profile</h2></div></div>
                  <div className="migrateBars">
                    <div><span>Ready</span><i><b style={{width: `${snapshot.plannedRecords ? snapshot.ready.length / snapshot.plannedRecords * 100 : 0}%`}}/></i><strong>{snapshot.ready.length}</strong></div>
                    <div><span>Review</span><i><b className="amber" style={{width: `${snapshot.plannedRecords ? snapshot.review.length / snapshot.plannedRecords * 100 : 0}%`}}/></i><strong>{snapshot.review.length}</strong></div>
                    <div><span>Quarantine</span><i><b className="red" style={{width: `${snapshot.plannedRecords ? snapshot.quarantine.length / snapshot.plannedRecords * 100 : 0}%`}}/></i><strong>{snapshot.quarantine.length}</strong></div>
                  </div>
                </section>

                <section>
                  <div className="migratePanelTitle"><div><span>RECENT MIGRATION STATE</span><h2>Lifecycle Signals</h2></div></div>
                  <div className="migrateEventRows">
                    <div><CheckCircle2 size={13}/><span>Discovery result available</span><strong>YES</strong></div>
                    <div><FileCheck2 size={13}/><span>Approval request</span><strong>{hasApproval ? "PRESENT" : "NONE"}</strong></div>
                    <div><Activity size={13}/><span>Execution result</span><strong>{hasExecution ? snapshot.executionStatus : "NONE"}</strong></div>
                  </div>
                </section>

                <section>
                  <div className="migratePanelTitle"><div><span>TOP GOVERNED ISSUES</span><h2>Blocking Evidence</h2></div></div>
                  <div className="migrateIssueRows">
                    <div><AlertTriangle size={13}/><span>Blocking findings</span><strong>{snapshot.blockingFindings.length}</strong></div>
                    <div><AlertTriangle size={13}/><span>Quarantine records</span><strong>{snapshot.quarantine.length}</strong></div>
                    <div><AlertTriangle size={13}/><span>Rejected records</span><strong>{snapshot.rejected.length}</strong></div>
                    <div><GitBranch size={13}/><span>Referential blockers</span><strong>{snapshot.blockedReferential.length}</strong></div>
                  </div>
                </section>

                <section>
                  <div className="migratePanelTitle"><div><span>RECONCILIATION SUMMARY</span><h2>Current State</h2></div></div>
                  <div className="migrateReconcile">
                    <strong>{hasExecution ? snapshot.executionStatus : "NOT EXECUTED"}</strong>
                    <p>
                      Reconciliation evidence appears only after a governed DEV dry-run execution.
                      No result is inferred or fabricated here.
                    </p>
                    <button type="button" className="migrateOutline" onClick={() => setView("RECONCILIATION")}>
                      View Reconciliation Context
                    </button>
                  </div>
                </section>
              </div>
            </>
          )}
        </div>
      )}

      {view === "INTELLIGENCE" && (
        <div className="migrateIntelligence">
          <section className="migrateIntelHero">
            <div>
              <span className="migrateEyebrow">ADVANCED MIGRATION INTELLIGENCE</span>
              <h2>Migration Execution Decision Twin</h2>
              <p>
                A read-only model of migration readiness, staging, mappings,
                transformation evidence, approvals, blockers and execution state.
                It supports planning and explanation without enabling production execution.
              </p>
            </div>
            <span className="migrateStatus guarded"><ShieldCheck size={13}/>READ ONLY</span>
          </section>

          <div className="migrateIntelCards">
            <article><Sparkles size={18}/><span>Readiness</span><strong>{snapshot.readiness}%</strong><small>Derived from current governed evidence</small></article>
            <article><Database size={18}/><span>Planned Records</span><strong>{snapshot.plannedRecords}</strong><small>Staging population</small></article>
            <article><AlertTriangle size={18}/><span>Blocking Evidence</span><strong>{issueCount}</strong><small>Findings + dispositions + referential</small></article>
            <article><ShieldCheck size={18}/><span>Production</span><strong>DISABLED</strong><small>Writes and cutover remain blocked</small></article>
          </div>

          <section className="migrateDecisionFlow">
            <div><span>DISCOVERY</span><strong>{snapshot.discovery ? "AVAILABLE" : "NO DATA"}</strong></div>
            <ArrowRight size={16}/>
            <div><span>VALIDATION</span><strong>{snapshot.validationReady ? "READY" : "REVIEW"}</strong></div>
            <ArrowRight size={16}/>
            <div><span>APPROVAL</span><strong>{hasApproval ? "PRESENT" : "NONE"}</strong></div>
            <ArrowRight size={16}/>
            <div><span>DEV DRY RUN</span><strong>{hasExecution ? snapshot.executionStatus : "NOT EXECUTED"}</strong></div>
            <ArrowRight size={16}/>
            <div><span>PRODUCTION</span><strong>DISABLED</strong></div>
          </section>

          <div className="migrateSafetyBanner">
            <ShieldCheck size={15}/>
            <span>
              Migration Intelligence is advisory/read-only. Existing
              handleRequestApproval, preflightChecks, approval state, postMigration,
              executionAllowed, noTargetWrites, and downstream reconciliation controls
              remain authoritative.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

