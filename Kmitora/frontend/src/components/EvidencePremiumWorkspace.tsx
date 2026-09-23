import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Database,
  FileCheck2,
  Fingerprint,
  GitBranch,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { loadAuthoritativeEvidenceProjection } from "../services/authoritativeEvidenceProjection";
import "../styles/evidence-premium-workspace.css";

type EvidenceView =
  | "OVERVIEW"
  | "WORKBENCH"
  | "PACKAGES"
  | "CUSTODY"
  | "TRACE"
  | "READINESS"
  | "EXPORT"
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

export default function EvidencePremiumWorkspace() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<EvidenceView>("OVERVIEW");
  const [refreshToken, setRefreshToken] = useState(0);
  const [authoritativeEvidence, setAuthoritativeEvidence] = useState<any | null>(null);

  // PROVE_EVIDENCE_AUTHORITATIVE_SYNC_007
  // Operations evidence is server-first. Browser storage is bootstrap metadata only.
  useEffect(() => {
    let cancelled = false;
    void loadAuthoritativeEvidenceProjection().then((next) => {
      if (!cancelled) setAuthoritativeEvidence(next);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshToken, authoritativeEvidence]);

  const snapshot = useMemo(() => {
    const evidence = authoritativeEvidence ?? readJson<any>("kmitora.dev.lastEvidence", null);
    const reconciliation = readJson<any>("kmitora.dev.lastReconciliation", null);
    const execution = readJson<any>("kmitora.dev.executionResult", null);

    const recordResults = safeArray<any>(evidence?.record_results);
    const transformationEvidence = safeArray<any>(evidence?.transformation_evidence);
    const businessRules = safeArray<any>(evidence?.business_rules);
    const recordResultCount = numberOf(evidence?.record_result_count ?? recordResults.length);
    const transformationEvidenceCount = numberOf(evidence?.transformation_evidence_count ?? transformationEvidence.length);
    const businessRuleCount = numberOf(evidence?.business_rule_count ?? businessRules.length);

    const categories = [
      Boolean(evidence?.discovery_summary || evidence?.migration_id),
      Boolean(evidence?.approval_summary || evidence?.approval_id),
      Boolean(evidence?.execution_summary || evidence?.execution_id),
      Boolean(evidence?.reconciliation_summary || evidence?.reconciliation_id),
      transformationEvidenceCount > 0 || recordResultCount > 0 || businessRuleCount > 0,
      Boolean(evidence?.safety) || evidence?.target_write_count !== undefined || evidence?.production_action_count !== undefined,
    ];

    const completedCategories = categories.filter(Boolean).length;
    const completeness = Math.round((completedCategories / categories.length) * 100);

    const targetWrites = numberOf(evidence?.safety?.target_write_count ?? evidence?.target_write_count);
    const productionActions = numberOf(evidence?.safety?.production_action_count ?? evidence?.production_action_count);

    const isPostLoad =
      String(reconciliation?.reconciliation_mode ?? "").toUpperCase() === "POST_LOAD_DEV";

    const safetyPreserved =
      productionActions === 0 &&
      evidence?.safety?.production_executed !== true &&
      evidence?.safety?.production_action_executed !== true &&
      (isPostLoad
        ? targetWrites > 0
        : targetWrites === 0 && evidence?.safety?.target_write_executed !== true);

    const reconciliationPassed =
      String(reconciliation?.status ?? evidence?.reconciliation_summary?.status ?? "")
        .toUpperCase() === "PASS";

    const packageReady = Boolean(evidence) && reconciliationPassed;
    const artifactCount =
      recordResultCount + transformationEvidenceCount + businessRuleCount;

    const decisionTraceStages = [
      Boolean(evidence?.migration_id || evidence?.discovery_summary),
      Boolean(evidence?.approval_id || evidence?.approval_summary),
      Boolean(evidence?.execution_id || evidence?.execution_summary),
      Boolean(evidence?.reconciliation_id || evidence?.reconciliation_summary),
      Boolean(evidence?.evidence_id),
    ];
    const decisionTraceCount = decisionTraceStages.filter(Boolean).length;

    return {
      evidence,
      reconciliation,
      execution,
      recordResults,
      transformationEvidence,
      businessRules,
      recordResultCount,
      transformationEvidenceCount,
      businessRuleCount,
      isPostLoad,
      completedCategories,
      completeness,
      targetWrites,
      productionActions,
      safetyPreserved,
      reconciliationPassed,
      packageReady,
      artifactCount,
      decisionTraceCount,
      createdAt: evidence?.created_at ?? null,
      evidenceId: evidence?.evidence_id ?? "Not available",
      executionId:
        evidence?.execution_id ??
        reconciliation?.execution_id ??
        localStorage.getItem("kmitora.dev.lastExecutionId") ??
        "Not available",
    };
  }, [refreshToken, authoritativeEvidence]);

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

    if (view === "WORKBENCH") {
      reset();
      return reset;
    }

    if (view === "OVERVIEW" || view === "INTELLIGENCE") {
      children.forEach((element) => {
        element.style.display = "none";
      });
      return reset;
    }

    const terms: Record<
      Exclude<EvidenceView, "OVERVIEW" | "WORKBENCH" | "INTELLIGENCE">,
      string[]
    > = {
      PACKAGES: ["evidence package", "record results", "transformation evidence", "business rule"],
      CUSTODY: ["approval id", "execution id", "reconciliation id", "migration id", "identity chain"],
      TRACE: ["decision", "approval", "execution", "reconciliation", "proof"],
      READINESS: ["completeness", "readiness", "safety", "status", "pending"],
      EXPORT: ["search", "evidence table", "category", "object", "rule", "status"],
    };

    children.forEach((element) => {
      element.style.display = includesAny(
        textOf(element),
        terms[view as keyof typeof terms]
      ) ? "" : "none";
    });

    if (!children.some((element) => element.style.display !== "none")) reset();
    return reset;
  }, [view]);

  const gaps = [
    ["No reconciliation PASS result", !snapshot.reconciliationPassed],
    ["No evidence package generated", !snapshot.evidence],
    ["No transformation evidence captured", snapshot.transformationEvidence.length === 0],
    ["No record-level evidence captured", snapshot.recordResults.length === 0],
    ["No business-rule evidence captured", snapshot.businessRules.length === 0],
    ["No runtime safety proof available", !snapshot.evidence?.safety],
  ].filter(([, missing]) => missing);

  return (
    <div className="evidencePremium" ref={rootRef}>
      <header className="evidenceHeader">
        <div>
          <span className="evidenceEyebrow">STEP 08 Â· AUDIT & EVIDENCE</span>
          <div className="evidenceTitleRow">
            <h1>Evidence & Audit Center</h1>
            <span className={`evidenceStatus ${snapshot.packageReady ? "ready" : "waiting"}`}>
              {snapshot.packageReady ? "AUDIT READY" : "WAITING"}
            </span>
          </div>
          <p>
            Audit-ready migration proof becomes available only after a successful
            reconciliation. Evidence remains read-only and tied to the same governed DEV execution.
          </p>
          <div className="evidenceSafetyRow">
            <span><ShieldCheck size={13}/>READ ONLY</span>
            <span><Fingerprint size={13}/>Audit-safe</span>
            <span><Database size={13}/>Target writes: {snapshot.targetWrites}</span>
            <span><Activity size={13}/>Production actions: {snapshot.productionActions}</span>
          </div>
        </div>

        <div className="evidenceHeaderActions">
          <div className="evidenceRun">
            <small>Plan Run</small>
            <strong>{snapshot.executionId}</strong>
          </div>
          <button type="button" onClick={() => setView("WORKBENCH")}>
            Existing Evidence Controls
          </button>
        </div>
      </header>

      <section className="evidenceKpis">
        <article>
          <span>Evidence Completeness</span>
          <strong>{snapshot.completeness}%</strong>
          <small>{snapshot.completedCategories} / 6 categories</small>
        </article>
        <article className="evidenceRingCard">
          <div>
            <span>Audit Readiness</span>
            <small>{snapshot.packageReady ? "Ready" : "Run reconciliation to generate evidence"}</small>
          </div>
          <div
            className="evidenceRing"
            style={{"--score": `${snapshot.completeness * 3.6}deg`} as CSSProperties}
          >
            <strong>{snapshot.completeness}%</strong>
          </div>
        </article>
        <article>
          <span>Artifacts Captured</span>
          <strong>{snapshot.artifactCount}</strong>
          <small>Current package artifacts</small>
        </article>
        <article>
          <span>Decision Trace Coverage</span>
          <strong>{snapshot.decisionTraceCount}</strong>
          <small>Migration â†’ approval â†’ execution â†’ reconciliation â†’ evidence</small>
        </article>
        <article>
          <span>Safety Integrity</span>
          <strong>{snapshot.safetyPreserved ? "SAFE" : "REVIEW"}</strong>
          <small>Production mutation evidence</small>
        </article>
        <article>
          <span>Package Freshness</span>
          <strong>{snapshot.createdAt ? "AVAILABLE" : "â€”"}</strong>
          <small>{snapshot.createdAt ?? "No evidence package"}</small>
        </article>
      </section>

      <nav className="evidenceTabs">
        {([
          ["OVERVIEW", "Overview", Activity],
          ["PACKAGES", `Evidence Packages (${snapshot.artifactCount})`, FileCheck2],
          ["CUSTODY", "Chain of Custody", Fingerprint],
          ["TRACE", `Decision Trace (${snapshot.decisionTraceCount}/5)`, GitBranch],
          ["READINESS", "Audit Readiness", ClipboardCheck],
          ["EXPORT", "Evidence Explorer", Database],
          ["INTELLIGENCE", "Evidence Intelligence", Sparkles],
        ] as Array<[EvidenceView, string, typeof Activity]>).map(([id, label, Icon]) => (
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
          className="evidenceRefresh"
          onClick={() => setRefreshToken((value) => value + 1)}
        >
          <RefreshCw size={13}/>
          Refresh
        </button>
      </nav>

      {view === "OVERVIEW" && (
        <div className="evidenceBody">
          <div className="evidenceTopGrid">
            <section>
              <div className="evidencePanelHead">
                <div><span>EVIDENCE STATUS</span><h2>{snapshot.evidence ? "Evidence package available" : "Evidence not generated yet"}</h2></div>
              </div>
              <div className="evidenceStatusHero">
                <FileCheck2 size={30}/>
                <strong>{snapshot.evidence ? snapshot.evidenceId : "Awaiting reconciliation evidence"}</strong>
                <p>
                  {snapshot.evidence
                    ? "A persisted evidence package is available from the governed reconciliation flow."
                    : "Run DEV reconciliation first. KMITORA automatically generates and persists the evidence package after a PASS result."}
                </p>
                <span className={`evidenceBadge ${snapshot.evidence ? "green" : "gray"}`}>
                  {snapshot.evidence ? "AVAILABLE" : "AWAITING EVIDENCE"}
                </span>
              </div>
              <button type="button" className="evidenceOutline" onClick={() => setView("WORKBENCH")}>
                View Existing Evidence <ArrowRight size={13}/>
              </button>
            </section>

            <section>
              <div className="evidencePanelHead">
                <div><span>COMPLETENESS CHECKLIST</span><h2>Evidence Categories</h2></div>
              </div>
              <div className="evidenceChecklist">
                {[
                  ["Discovery Summary", Boolean(snapshot.evidence?.discovery_summary)],
                  ["Approval Proof", Boolean(snapshot.evidence?.approval_summary || snapshot.evidence?.approval_id)],
                  ["Execution Proof", Boolean(snapshot.evidence?.execution_summary || snapshot.evidence?.execution_id)],
                  ["Reconciliation Proof", Boolean(snapshot.evidence?.reconciliation_summary || snapshot.evidence?.reconciliation_id)],
                  ["Transformation / Record Evidence", snapshot.transformationEvidence.length > 0 || snapshot.recordResults.length > 0],
                  ["Runtime Safety Proof", Boolean(snapshot.evidence?.safety)],
                ].map(([label, available]) => (
                  <div key={String(label)}>
                    {available ? <CheckCircle2 size={13}/> : <AlertTriangle size={13}/>}
                    <span>{label}</span>
                    <strong className={available ? "ok" : "missing"}>{available ? "AVAILABLE" : "MISSING"}</strong>
                  </div>
                ))}
              </div>
              <div className="evidenceProgress">
                <div><span>{snapshot.completedCategories} of 6 complete</span><strong>{snapshot.completeness}%</strong></div>
                <i><b style={{width: `${snapshot.completeness}%`}}/></i>
              </div>
            </section>

            <section>
              <div className="evidencePanelHead">
                <div><span>SAFETY VERIFICATION</span><h2>Runtime Evidence Integrity</h2></div>
              </div>
              <div className="evidenceHashState">
                <ShieldCheck size={28}/>
                <strong>{snapshot.safetyPreserved ? "SAFETY INVARIANT PRESERVED" : "AWAITING SAFETY EVIDENCE"}</strong>
                <p>Target writes: {snapshot.targetWrites} Â· Production actions: {snapshot.productionActions}</p>
              </div>
              <div className="evidenceSafetyMini">
                <div><span>Production executed</span><strong>{snapshot.evidence?.safety?.production_executed === true ? "YES" : "NO"}</strong></div>
                <div><span>Target write executed</span><strong>{snapshot.evidence?.safety?.target_write_executed === true ? "YES" : "NO"}</strong></div>
                <div><span>Production action executed</span><strong>{snapshot.evidence?.safety?.production_action_executed === true ? "YES" : "NO"}</strong></div>
              </div>
            </section>

            <section>
              <div className="evidencePanelHead">
                <div><span>TOP GAPS / EXCEPTIONS</span><h2>Audit Gaps</h2></div>
                <span className="evidenceBadge red">{gaps.length}</span>
              </div>
              <div className="evidenceGapRows">
                {gaps.length ? gaps.map(([label]) => (
                  <div key={String(label)}>
                    <AlertTriangle size={13}/>
                    <span>{label}</span>
                    <strong>PENDING</strong>
                  </div>
                )) : (
                  <div><CheckCircle2 size={13}/><span>No current audit gaps detected</span><strong>CLEAR</strong></div>
                )}
              </div>
              <button type="button" className="evidenceOutline" onClick={() => setView("READINESS")}>
                View All Gaps <ArrowRight size={13}/>
              </button>
            </section>
          </div>

          <section className="evidenceAuditScope">
            <div className="evidencePanelHead">
              <div><span>WHAT KMITORA IS AUDITING</span><h2>Evidence Scope</h2></div>
            </div>
            <div className="evidenceScopeCards">
              <article><FileCheck2 size={16}/><span>Evidence Package</span><strong>{snapshot.artifactCount}</strong><small>Complete set of run artifacts</small><em>{snapshot.evidence ? "AVAILABLE" : "AWAITING"}</em></article>
              <article><GitBranch size={16}/><span>Decision Trace</span><strong>{snapshot.decisionTraceCount}</strong><small>Approval, execution and reconciliation context</small><em>{snapshot.decisionTraceCount ? "AVAILABLE" : "AWAITING"}</em></article>
              <article><ShieldCheck size={16}/><span>Policy Controls</span><strong>{snapshot.evidence?.safety ? "1" : "0"}</strong><small>Runtime safety control evidence</small><em>{snapshot.evidence?.safety ? "EVIDENCED" : "AWAITING"}</em></article>
              <article><ClipboardCheck size={16}/><span>Reconciliation Proof</span><strong>{snapshot.reconciliationPassed ? "PASS" : "â€”"}</strong><small>Authoritative reconciliation result</small><em>{snapshot.reconciliationPassed ? "AVAILABLE" : "AWAITING"}</em></article>
              <article><Database size={16}/><span>Export Safety</span><strong>{snapshot.targetWrites}</strong><small>DEV target writes</small><em>READ ONLY</em></article>
              <article><Fingerprint size={16}/><span>Audit Scope</span><strong>DEV</strong><small>Current evidence boundary</small><em>GOVERNED</em></article>
            </div>
          </section>

          <div className="evidenceBottomGrid">
            <section>
              <div className="evidencePanelHead"><div><span>EVIDENCE SUMMARY</span><h2>Package Contents</h2></div></div>
              <div className="evidenceSummaryGrid">
                <div>
                  <div><span>Record results</span><strong>{snapshot.recordResultCount}</strong></div>
                  <div><span>Transformation evidence</span><strong>{snapshot.transformationEvidenceCount}</strong></div>
                  <div><span>Business rules</span><strong>{snapshot.businessRuleCount}</strong></div>
                  <div><span>Package status</span><strong>{snapshot.evidence?.status ?? "PENDING"}</strong></div>
                </div>
                <div>
                  <div><span>Migration ID</span><strong>{snapshot.evidence?.migration_id ?? "â€”"}</strong></div>
                  <div><span>Approval ID</span><strong>{snapshot.evidence?.approval_id ?? "â€”"}</strong></div>
                  <div><span>Execution ID</span><strong>{snapshot.executionId}</strong></div>
                  <div><span>Reconciliation ID</span><strong>{snapshot.evidence?.reconciliation_id ?? "â€”"}</strong></div>
                </div>
              </div>
              <button type="button" className="evidenceOutline" onClick={() => setView("EXPORT")}>
                View Full Evidence <ArrowRight size={13}/>
              </button>
            </section>

            <section>
              <div className="evidencePanelHead"><div><span>READINESS DECISION</span><h2>{snapshot.packageReady ? "AUDIT READY" : "NOT READY"}</h2></div></div>
              <span className={`evidenceStatus ${snapshot.packageReady ? "ready" : "waiting"}`}>
                {snapshot.packageReady ? "READY" : "NOT READY"}
              </span>
              <p className="evidenceNote">
                {snapshot.packageReady
                  ? "A reconciliation PASS and evidence package are both available for review."
                  : "Evidence becomes audit-ready only after a successful reconciliation and persisted evidence package."}
              </p>
              <div className="evidenceDecisionRows">
                <div><span>Reconciliation</span><strong>{snapshot.reconciliationPassed ? "PASS" : "PENDING"}</strong></div>
                <div><span>Evidence package</span><strong>{snapshot.evidence ? "AVAILABLE" : "PENDING"}</strong></div>
                <div><span>Target writes</span><strong>{snapshot.targetWrites}</strong></div>
                <div><span>Production action</span><strong>DISABLED</strong></div>
              </div>
            </section>

            <section>
              <div className="evidencePanelHead"><div><span>EXECUTION SAFETY</span><h2>Protected Runtime State</h2></div></div>
              <div className="evidenceDecisionRows">
                <div><span>Source writes</span><strong>NONE</strong></div>
                <div><span>Target writes</span><strong>{snapshot.targetWrites}</strong></div>
                <div><span>Production actions</span><strong>{snapshot.productionActions}</strong></div>
                <div><span>Production migration</span><strong>DISABLED</strong></div>
                <div><span>Cutover</span><strong>DISABLED</strong></div>
              </div>
              <div className="evidenceSafeBanner">
                <ShieldCheck size={13}/>
                Evidence is read-only; production execution remains disabled.
              </div>
            </section>
          </div>
        </div>
      )}

      {view === "INTELLIGENCE" && (
        <div className="evidenceIntelligence">
          <section className="evidenceIntelHero">
            <div>
              <span className="evidenceEyebrow">ADVANCED EVIDENCE INTELLIGENCE</span>
              <h2>Audit Evidence Decision Twin</h2>
              <p>
                Read-only reasoning across discovery, approval, execution,
                reconciliation, transformation evidence, business rules and safety proof.
                It explains audit readiness without changing or generating evidence.
              </p>
            </div>
            <span className="evidenceStatus ready"><ShieldCheck size={13}/>READ ONLY</span>
          </section>

          <div className="evidenceIntelCards">
            <article><Sparkles size={18}/><span>Completeness</span><strong>{snapshot.completeness}%</strong><small>Actual available evidence categories</small></article>
            <article><FileCheck2 size={18}/><span>Artifacts</span><strong>{snapshot.artifactCount}</strong><small>Current persisted package content</small></article>
            <article><GitBranch size={18}/><span>Decision Trace</span><strong>{snapshot.decisionTraceCount}</strong><small>Available summary evidence</small></article>
            <article><ShieldCheck size={18}/><span>Safety</span><strong>{snapshot.safetyPreserved ? "PRESERVED" : "REVIEW"}</strong><small>DEV write boundary + production-action safety</small></article>
          </div>

          <div className="evidenceSafetyBanner">
            <ShieldCheck size={15}/>
            <span>
              Existing Evidence.tsx remains authoritative for persisted evidence,
              search/filter behavior and evidence rows. This premium layer is read-only.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}


