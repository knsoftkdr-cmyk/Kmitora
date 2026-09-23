import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Database,
  FileCheck2,
  GitCompareArrows,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import "../styles/reconcile-premium-workspace.css";

type ReconView =
  | "OVERVIEW"
  | "WORKBENCH"
  | "SOURCE_TARGET"
  | "MAPPING"
  | "VARIANCE"
  | "EVIDENCE"
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

function numberOf(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function textOf(element: Element) {
  return (element.textContent ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function includesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

export default function ReconcilePremiumWorkspace() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<ReconView>("OVERVIEW");
  const [refreshToken, setRefreshToken] = useState(0);

  const snapshot = useMemo(() => {
    const result = readJson<any>("kmitora.dev.lastReconciliation", null);
    const evidence = readJson<any>("kmitora.dev.lastEvidence", null);
    const execution =
      readJson<any>("kmitora.dev.executionResult", null);

    const input = numberOf(result?.input_record_count);
    const simulated = numberOf(result?.simulated_record_count);
    const matched = numberOf(result?.matched_records);
    const unmatched = numberOf(result?.unmatched_source);
    const unexpected = numberOf(result?.unexpected_simulated);
    const failed = numberOf(result?.failed_records);
    const variance = numberOf(result?.count_variance);
    const targetWrites = numberOf(
      result?.target_write_count ??
        evidence?.safety?.target_write_count
    );
    const productionActions = numberOf(
      result?.production_action_count ??
        evidence?.safety?.production_action_count
    );

    const recordResults = safeArray<any>(evidence?.record_results);
    const transformationEvidence = safeArray<any>(
      evidence?.transformation_evidence
    );
    const businessRules = safeArray<any>(evidence?.business_rules);

    const reconciliationPassed =
      String(result?.status ?? "").toUpperCase() === "PASS";

    const invariantPreserved =
      targetWrites === 0 &&
      productionActions === 0 &&
      result?.target_write_executed !== true &&
      result?.production_action_executed !== true &&
      evidence?.safety?.target_write_executed !== true &&
      evidence?.safety?.production_action_executed !== true &&
      evidence?.safety?.production_executed !== true;

    const health =
      input > 0
        ? Math.max(
            0,
            Math.min(100, Math.round((matched / input) * 100))
          )
        : 0;

    const mismatch = Math.max(
      0,
      unmatched + unexpected + failed
    );

    const evidenceReady =
      reconciliationPassed && Boolean(evidence)
        ? 100
        : reconciliationPassed
        ? 50
        : 0;

    return {
      result,
      evidence,
      execution,
      input,
      simulated,
      matched,
      unmatched,
      unexpected,
      failed,
      variance,
      targetWrites,
      productionActions,
      recordResults,
      transformationEvidence,
      businessRules,
      reconciliationPassed,
      invariantPreserved,
      health,
      mismatch,
      evidenceReady,
      executionId:
        result?.execution_id ??
        evidence?.execution_id ??
        localStorage.getItem("kmitora.dev.lastExecutionId") ??
        localStorage.getItem("kmitora.dev.executionId") ??
        execution?.execution_id ??
        "Not available",
    };
  }, [refreshToken]);

  useEffect(() => {
    const host = rootRef.current;
    const parent = host?.parentElement;
    if (!parent || !host) return;

    const siblings = Array.from(parent.children).filter(
      (element) => element !== host
    ) as HTMLElement[];

    const reset = () =>
      siblings.forEach((element) => (element.style.display = ""));

    if (view === "WORKBENCH") {
      reset();
      return reset;
    }

    if (view === "OVERVIEW" || view === "INTELLIGENCE") {
      siblings.forEach((element) => (element.style.display = "none"));
      return reset;
    }

    const terms: Record<
      Exclude<ReconView, "OVERVIEW" | "WORKBENCH" | "INTELLIGENCE">,
      string[]
    > = {
      SOURCE_TARGET: [
        "source",
        "target simulation",
        "record results",
        "simulated target",
      ],
      MAPPING: [
        "mapping",
        "transformation",
        "business rules",
        "transformation evidence",
      ],
      VARIANCE: [
        "reconciliation",
        "variance",
        "matched",
        "unmatched",
        "unexpected",
      ],
      EVIDENCE: [
        "evidence",
        "evidence package",
        "identity chain",
        "proof for discovery",
      ],
      READINESS: [
        "dry-run invariant",
        "target writes",
        "production actions",
        "status",
        "readiness",
      ],
    };

    siblings.forEach((element) => {
      element.style.display = includesAny(
        textOf(element),
        terms[view as keyof typeof terms]
      )
        ? ""
        : "none";
    });

    if (!siblings.some((element) => element.style.display !== "none")) {
      reset();
    }

    return reset;
  }, [view]);

  const hasResult = Boolean(snapshot.result);
  const hasEvidence = Boolean(snapshot.evidence);

  return (
    <div className="reconcilePremium" ref={rootRef}>
      <header className="reconcilePremiumHeader">
        <div>
          <span className="reconcileEyebrow">
            STEP 07 · DEV RECONCILIATION & VERIFICATION
          </span>
          <div className="reconcileTitleRow">
            <h1>Reconciliation & Verification Center</h1>
            <span
              className={`reconcileStatus ${
                snapshot.reconciliationPassed ? "pass" : "waiting"
              }`}
            >
              {snapshot.reconciliationPassed ? "PASS" : "WAITING"}
            </span>
          </div>
          <p>
            Compare source data, simulated target results, mapping and
            transformation evidence from the same KMITORA DEV dry-run execution.
          </p>
          <div className="reconcileSafetyRow">
            <span><ShieldCheck size={13}/>DEV dry-run verification</span>
            <span><Database size={13}/>Target writes: {snapshot.targetWrites}</span>
            <span><ShieldCheck size={13}/>Dry-run invariant: {snapshot.invariantPreserved ? "PRESERVED" : "REVIEW"}</span>
            <span><FileCheck2 size={13}/>Evidence: {hasEvidence ? "AVAILABLE" : "PENDING"}</span>
          </div>
        </div>

        <div className="reconcileHeaderActions">
          <div className="reconcileRun">
            <small>Execution Context</small>
            <strong>{snapshot.executionId}</strong>
          </div>
          <button type="button" onClick={() => setView("WORKBENCH")}>
            <GitCompareArrows size={14}/>
            Existing Reconciliation Controls
          </button>
        </div>
      </header>

      <section className="reconcileKpis">
        <article className="reconcileHealthKpi">
          <div
            className="reconcileRing"
            style={{"--score": `${snapshot.health * 3.6}deg`} as CSSProperties}
          >
            <strong>{snapshot.health}%</strong>
          </div>
          <div><span>Reconciliation Health</span><strong>{snapshot.health}%</strong><small>{hasResult ? "Current result" : "Awaiting execution"}</small></div>
        </article>
        <article><span>Records Compared</span><strong>{snapshot.input}</strong><small>Source input records</small></article>
        <article><span>Matched Records</span><strong>{snapshot.matched}</strong><small>Exact reconciliation matches</small></article>
        <article><span>Mismatched</span><strong>{snapshot.mismatch}</strong><small>Unmatched + unexpected + failed</small></article>
        <article><span>Missing in Target</span><strong>{snapshot.unmatched}</strong><small>Unmatched source</small></article>
        <article><span>Extra in Target</span><strong>{snapshot.unexpected}</strong><small>Unexpected simulated</small></article>
        <article><span>Count Variance</span><strong>{snapshot.variance}</strong><small>Source vs simulated</small></article>
        <article><span>Evidence Readiness</span><strong>{snapshot.evidenceReady}%</strong><small>{hasEvidence ? "Evidence available" : "Pending"}</small></article>
      </section>

      <nav className="reconcileTabs" aria-label="Reconciliation workspace">
        {([
          ["OVERVIEW", "Overview", Activity],
          ["WORKBENCH", "Reconcile DEV Dry-Run", GitCompareArrows],
          ["SOURCE_TARGET", "Source vs Target", Database],
          ["MAPPING", `Mappings & Transformations (${snapshot.transformationEvidence.length})`, GitCompareArrows],
          ["VARIANCE", `Variance Analysis (${snapshot.mismatch})`, AlertTriangle],
          ["EVIDENCE", `Evidence (${snapshot.recordResults.length})`, FileCheck2],
          ["READINESS", "Readiness", CheckCircle2],
          ["INTELLIGENCE", "Reconciliation Intelligence", Sparkles],
        ] as Array<[ReconView, string, typeof Activity]>).map(([id, label, Icon]) => (
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
          className="reconcileRefresh"
          onClick={() => setRefreshToken((value) => value + 1)}
        >
          <RefreshCw size={13}/>
          Refresh
        </button>
      </nav>

      {view === "OVERVIEW" && (
        <div className="reconcileOverview">
          <div className="reconcileTopGrid">
            <section>
              <div className="reconcilePanelTitle">
                <div>
                  <span>RECONCILE DEV DRY-RUN</span>
                  <h2>Execution & Evidence Control</h2>
                </div>
              </div>
              <div className="reconcileControlState">
                <div>
                  <span>Execution ID</span>
                  <strong>{snapshot.executionId}</strong>
                </div>
                <p>
                  Use the existing authoritative control to reconcile a completed
                  DEV dry-run and generate evidence only after PASS.
                </p>
                <button type="button" onClick={() => setView("WORKBENCH")}>
                  Open Reconcile + Generate Evidence
                  <ArrowRight size={13}/>
                </button>
              </div>
            </section>

            <section>
              <div className="reconcilePanelTitle">
                <div>
                  <span>DRY-RUN INVARIANT</span>
                  <h2>Protected Safety State</h2>
                </div>
              </div>
              <div className="reconcileInvariant">
                <ShieldCheck size={28}/>
                <div>
                  <strong>DRY_RUN = TRUE</strong>
                  <p>
                    Target production writes remain {snapshot.targetWrites} and
                    production actions remain {snapshot.productionActions}.
                  </p>
                  <span className={`reconcileBadge ${snapshot.invariantPreserved ? "green" : "amber"}`}>
                    {snapshot.invariantPreserved ? "PRESERVED" : "REVIEW"}
                  </span>
                </div>
              </div>
            </section>

            <section>
              <div className="reconcilePanelTitle">
                <div><span>RECONCILIATION SUMMARY</span><h2>Match Profile</h2></div>
              </div>
              <div className="reconcileSummary">
                <div
                  className="reconcileLargeRing"
                  style={{"--score": `${snapshot.health * 3.6}deg`} as CSSProperties}
                >
                  <strong>{snapshot.health}%</strong>
                  <span>{snapshot.reconciliationPassed ? "PASS" : "WAITING"}</span>
                </div>
                <div>
                  <p><i className="green"/><span>Matched</span><strong>{snapshot.matched}</strong></p>
                  <p><i className="amber"/><span>Unmatched</span><strong>{snapshot.unmatched}</strong></p>
                  <p><i className="red"/><span>Failed</span><strong>{snapshot.failed}</strong></p>
                  <p><i className="purple"/><span>Unexpected</span><strong>{snapshot.unexpected}</strong></p>
                </div>
              </div>
            </section>
          </div>

          {!hasResult ? (
            <section className="reconcileAwaiting">
              <GitCompareArrows size={25}/>
              <div>
                <span className="reconcileEyebrow">EXECUTION INPUT REQUIRED</span>
                <h2>Awaiting DEV Dry-Run Reconciliation</h2>
                <p>
                  KMITORA does not fabricate reconciliation, variance or target
                  data. Provide a valid DEV dry-run execution ID through the existing
                  reconciliation control.
                </p>
              </div>
              <button type="button" onClick={() => setView("WORKBENCH")}>
                Open Existing Control
              </button>
            </section>
          ) : (
            <>
              <div className="reconcileMiddleGrid">
                <section>
                  <div className="reconcilePanelTitle">
                    <div><span>RECONCILIATION COUNTS</span><h2>Source vs Simulated Target</h2></div>
                  </div>
                  <div className="reconcileCompareRows">
                    <div><span>Input records</span><strong>{snapshot.input}</strong></div>
                    <div><span>Simulated records</span><strong>{snapshot.simulated}</strong></div>
                    <div><span>Matched records</span><strong>{snapshot.matched}</strong></div>
                    <div><span>Unmatched source</span><strong>{snapshot.unmatched}</strong></div>
                    <div><span>Unexpected simulated</span><strong>{snapshot.unexpected}</strong></div>
                    <div><span>Failed records</span><strong>{snapshot.failed}</strong></div>
                  </div>
                </section>

                <section>
                  <div className="reconcilePanelTitle">
                    <div><span>VARIANCE ANALYSIS</span><h2>Current Variance</h2></div>
                  </div>
                  <div className="reconcileVarianceHero">
                    <strong>{snapshot.variance}</strong>
                    <span>Count variance</span>
                  </div>
                  <div className="reconcileVarianceBars">
                    <div><span>Matched</span><i><b style={{width: `${snapshot.input ? snapshot.matched / snapshot.input * 100 : 0}%`}}/></i></div>
                    <div><span>Mismatch</span><i><b className="amber" style={{width: `${snapshot.input ? snapshot.mismatch / snapshot.input * 100 : 0}%`}}/></i></div>
                  </div>
                </section>

                <section>
                  <div className="reconcilePanelTitle">
                    <div><span>RECONCILIATION READINESS</span><h2>Evidence Gate</h2></div>
                  </div>
                  <div className="reconcileChecklist">
                    <div><CheckCircle2 size={13}/><span>Reconciliation result</span><strong>{snapshot.result?.status ?? "WAITING"}</strong></div>
                    <div><ShieldCheck size={13}/><span>Invariant preserved</span><strong>{snapshot.invariantPreserved ? "YES" : "REVIEW"}</strong></div>
                    <div><Database size={13}/><span>Target writes</span><strong>{snapshot.targetWrites}</strong></div>
                    <div><Activity size={13}/><span>Production actions</span><strong>{snapshot.productionActions}</strong></div>
                    <div><FileCheck2 size={13}/><span>Evidence package</span><strong>{hasEvidence ? "AVAILABLE" : "PENDING"}</strong></div>
                  </div>
                </section>
              </div>

              <div className="reconcileBottomGrid">
                <section>
                  <div className="reconcilePanelTitle"><div><span>MISMATCH BREAKDOWN</span><h2>Exception Composition</h2></div></div>
                  <div className="reconcileExceptionRows">
                    <div><i className="amber"/><span>Unmatched source</span><strong>{snapshot.unmatched}</strong></div>
                    <div><i className="purple"/><span>Unexpected simulated</span><strong>{snapshot.unexpected}</strong></div>
                    <div><i className="red"/><span>Failed records</span><strong>{snapshot.failed}</strong></div>
                  </div>
                </section>

                <section>
                  <div className="reconcilePanelTitle"><div><span>EVIDENCE CONTENT</span><h2>Evidence Package</h2></div></div>
                  <div className="reconcileEvidenceRows">
                    <div><span>Record results</span><strong>{snapshot.recordResults.length}</strong></div>
                    <div><span>Transformation evidence</span><strong>{snapshot.transformationEvidence.length}</strong></div>
                    <div><span>Business rules</span><strong>{snapshot.businessRules.length}</strong></div>
                    <div><span>Status</span><strong>{snapshot.evidence?.status ?? "PENDING"}</strong></div>
                  </div>
                </section>

                <section>
                  <div className="reconcilePanelTitle"><div><span>IDENTITY CHAIN</span><h2>Audit References</h2></div></div>
                  <div className="reconcileEvidenceRows">
                    <div><span>Migration ID</span><strong>{snapshot.result?.migration_id ?? snapshot.evidence?.migration_id ?? "—"}</strong></div>
                    <div><span>Approval ID</span><strong>{snapshot.result?.approval_id ?? snapshot.evidence?.approval_id ?? "—"}</strong></div>
                    <div><span>Execution ID</span><strong>{snapshot.executionId}</strong></div>
                    <div><span>Reconciliation ID</span><strong>{snapshot.result?.reconciliation_id ?? "—"}</strong></div>
                  </div>
                </section>

                <section>
                  <div className="reconcilePanelTitle"><div><span>EVIDENCE READINESS</span><h2>Package Status</h2></div></div>
                  <div
                    className="reconcileEvidenceRing"
                    style={{"--score": `${snapshot.evidenceReady * 3.6}deg`} as CSSProperties}
                  >
                    <strong>{snapshot.evidenceReady}%</strong>
                    <span>{hasEvidence ? "READY" : "PENDING"}</span>
                  </div>
                  <button type="button" className="reconcileOutline" onClick={() => setView("EVIDENCE")}>
                    View Evidence Details
                  </button>
                </section>
              </div>
            </>
          )}
        </div>
      )}

      {view === "INTELLIGENCE" && (
        <div className="reconcileIntelligence">
          <section className="reconcileIntelHero">
            <div>
              <span className="reconcileEyebrow">
                ADVANCED RECONCILIATION INTELLIGENCE
              </span>
              <h2>Reconciliation Evidence Decision Twin</h2>
              <p>
                A read-only decision model connecting source records, simulated
                target results, mappings, transformations, reconciliation results
                and evidence lineage without changing reconciliation truth.
              </p>
            </div>
            <span className="reconcileStatus pass">
              <ShieldCheck size={13}/>READ ONLY
            </span>
          </section>

          <div className="reconcileIntelCards">
            <article><Sparkles size={18}/><span>Match Health</span><strong>{snapshot.health}%</strong><small>Derived from current reconciliation result</small></article>
            <article><AlertTriangle size={18}/><span>Mismatches</span><strong>{snapshot.mismatch}</strong><small>Unmatched + unexpected + failed</small></article>
            <article><FileCheck2 size={18}/><span>Evidence Records</span><strong>{snapshot.recordResults.length}</strong><small>Current evidence package only</small></article>
            <article><ShieldCheck size={18}/><span>Safety Invariant</span><strong>{snapshot.invariantPreserved ? "PRESERVED" : "REVIEW"}</strong><small>Writes/actions remain zero when preserved</small></article>
          </div>

          <section className="reconcileDecisionFlow">
            <div><span>DEV EXECUTION</span><strong>{snapshot.executionId}</strong></div>
            <ArrowRight size={16}/>
            <div><span>RECONCILIATION</span><strong>{snapshot.result?.status ?? "WAITING"}</strong></div>
            <ArrowRight size={16}/>
            <div><span>VARIANCE</span><strong>{snapshot.variance}</strong></div>
            <ArrowRight size={16}/>
            <div><span>EVIDENCE</span><strong>{hasEvidence ? "AVAILABLE" : "PENDING"}</strong></div>
            <ArrowRight size={16}/>
            <div><span>PRODUCTION</span><strong>DISABLED</strong></div>
          </section>

          <div className="reconcileSafetyBanner">
            <ShieldCheck size={15}/>
            <span>
              Reconciliation Intelligence is advisory/read-only. Existing
              runReconciliation, postReconciliation, postEvidence, executionId,
              result/evidence state, data-view controls and evidence generation
              remain authoritative.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

