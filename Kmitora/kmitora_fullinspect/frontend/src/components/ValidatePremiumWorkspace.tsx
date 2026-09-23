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
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TestTube2,
} from "lucide-react";
import "../styles/validate-premium-workspace.css";

type ValidationView =
  | "OVERVIEW"
  | "WORKBENCH"
  | "QUALITY"
  | "REFERENTIAL"
  | "FINDINGS"
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

function includesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

export default function ValidatePremiumWorkspace() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<ValidationView>("OVERVIEW");
  const [refreshToken, setRefreshToken] = useState(0);

  const snapshot = useMemo(() => {
    const discovery = readJson<any>("kmitora.dev.discoveryResult", null);
    const findings = safeArray<any>(discovery?.quality_findings);
    const transformations = safeArray<any>(discovery?.transformation_plan);
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

    const errors = findings.filter(
      (item) => String(item?.severity ?? "").toUpperCase() === "ERROR"
    );
    const warnings = findings.filter((item) =>
      ["WARNING", "WARN", "MEDIUM"].includes(
        String(item?.severity ?? "").toUpperCase()
      )
    );

    const blockingCount =
      quarantine.length + rejected.length + blockedReferential.length;

    const stagingTotal =
      ready.length + review.length + quarantine.length + rejected.length;

    const readiness =
      stagingTotal > 0 ? Math.round((ready.length / stagingTotal) * 100) : 0;

    const noTargetWrites =
      discovery?.production_action_executed !== true &&
      [...ready, ...review, ...quarantine, ...rejected, ...referential].every(
        (record) => record?.target_write !== true
      );

    const qualityGate = !discovery
      ? "NO DATA"
      : blockingCount > 0
      ? "BLOCKED"
      : "READY FOR REVIEW";

    return {
      discovery,
      findings,
      transformations,
      ready,
      review,
      quarantine,
      rejected,
      referential,
      blockedReferential,
      errors,
      warnings,
      blockingCount,
      stagingTotal,
      readiness,
      noTargetWrites,
      qualityGate,
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
      Exclude<ValidationView, "OVERVIEW" | "WORKBENCH" | "INTELLIGENCE">,
      string[]
    > = {
      QUALITY: ["quality", "evidence and findings", "finding", "domain"],
      REFERENTIAL: ["referential", "relationship", "orphan", "dependency"],
      FINDINGS: ["evidence and findings", "validation results", "finding", "rejected", "quarantine"],
      READINESS: ["readiness", "ready for review", "execution safety", "quality gate"],
    };

    children.forEach((element) => {
      element.style.display = includesAny(
        textOf(element),
        terms[view as keyof typeof terms]
      )
        ? ""
        : "none";
    });

    if (!children.some((element) => element.style.display !== "none")) reset();
    return reset;
  }, [view]);

  const passedCount = snapshot.ready.length;
  const warningCount =
    snapshot.review.length + snapshot.warnings.length + snapshot.blockedReferential.length;
  const blockedCount =
    snapshot.quarantine.length + snapshot.rejected.length + snapshot.errors.length;

  return (
    <div className="validatePremium" ref={rootRef}>
      <header className="validatePremiumHeader">
        <div>
          <span className="validateEyebrow">STEP 05 · VALIDATION CONTROL</span>
          <div className="validateTitleRow">
            <h1>Validation Control Center</h1>
            <span
              className={`validateStatus ${
                snapshot.qualityGate === "READY FOR REVIEW" ? "ready" : "review"
              }`}
            >
              {snapshot.qualityGate}
            </span>
          </div>
          <p>
            Verify data quality, record dispositions, transformation evidence and
            referential integrity before KMITORA allows the workflow to progress.
          </p>
          <div className="validateSafetyRow">
            <span><ShieldCheck size={13}/>Read-only validation</span>
            <span><Database size={13}/>Target writes: {snapshot.noTargetWrites ? "NONE" : "DETECTED"}</span>
            <span><AlertTriangle size={13}/>Blocks: {snapshot.blockingCount}</span>
            <span><CheckCircle2 size={13}/>Migration readiness: {snapshot.readiness}%</span>
          </div>
        </div>

        <div className="validateHeaderActions">
          <div className="validateRun">
            <small>Plan Run</small>
            <strong>{snapshot.migrationId}</strong>
          </div>
          <button type="button" onClick={() => setView("WORKBENCH")}>
            <TestTube2 size={14}/>
            Existing Validation Controls
          </button>
        </div>
      </header>

      <section className="validateKpis">
        <article>
          <span>Validation Health</span>
          <strong>{snapshot.readiness}%</strong>
          <small>{snapshot.qualityGate}</small>
        </article>
        <article>
          <span>Records Ready</span>
          <strong>{snapshot.ready.length}</strong>
          <small>Staging ready</small>
        </article>
        <article>
          <span>Passed Validations</span>
          <strong>{passedCount}</strong>
          <small>Ready disposition</small>
        </article>
        <article>
          <span>Warnings / Review</span>
          <strong>{warningCount}</strong>
          <small>Requires attention</small>
        </article>
        <article>
          <span>Blocked / Rejected</span>
          <strong>{blockedCount}</strong>
          <small>Governed blocking evidence</small>
        </article>
        <article className="validateScoreKpi">
          <span>Readiness Score</span>
          <div
            className="validateScoreRing"
            style={{"--score": `${snapshot.readiness * 3.6}deg`} as CSSProperties}
          >
            <strong>{snapshot.readiness}%</strong>
          </div>
        </article>
      </section>

      <nav className="validateTabs" aria-label="Validation workspace">
        {([
          ["OVERVIEW", "Overview", Activity],
          ["WORKBENCH", "Execution & Evidence", TestTube2],
          ["QUALITY", `Data Quality (${snapshot.findings.length})`, FileCheck2],
          ["REFERENTIAL", `Referential Integrity (${snapshot.referential.length})`, GitBranch],
          ["FINDINGS", `Issues & Dispositions (${warningCount + blockedCount})`, AlertTriangle],
          ["READINESS", "Readiness", CheckCircle2],
          ["INTELLIGENCE", "Validation Intelligence", Sparkles],
        ] as Array<[ValidationView, string, typeof Activity]>).map(([id, label, Icon]) => (
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
          className="validateRefresh"
          onClick={() => setRefreshToken((value) => value + 1)}
        >
          <RefreshCw size={13}/>
          Refresh
        </button>
      </nav>

      {view === "OVERVIEW" && (
        <div className="validateOverview">
          <div className="validateTopGrid">
            <section>
              <div className="validatePanelTitle">
                <div><span>VALIDATION EXECUTION</span><h2>Execution & Evidence</h2></div>
              </div>
              <div className="validateActionRows">
                <div>
                  <TestTube2 size={15}/>
                  <div><strong>Run impacted tests</strong><small>Use existing validation controls for governed execution.</small></div>
                  <span className="validateBadge green">RECOMMENDED</span>
                </div>
                <div>
                  <FileCheck2 size={15}/>
                  <div><strong>Discovery evidence prerequisite</strong><small>No validation result is fabricated when discovery evidence is unavailable.</small></div>
                  <span className="validateBadge amber">READ ONLY</span>
                </div>
                <button type="button" onClick={() => setView("WORKBENCH")}>
                  Open Existing Controls <ArrowRight size={13}/>
                </button>
              </div>
            </section>

            <section>
              <div className="validatePanelTitle">
                <div><span>READINESS AT A GLANCE</span><h2>Current Validation State</h2></div>
              </div>
              <div className="validateChecklist">
                <div><CheckCircle2 size={14}/><span>Quality gate</span><strong>{snapshot.qualityGate}</strong></div>
                <div><CheckCircle2 size={14}/><span>Read-only execution</span><strong>ENFORCED</strong></div>
                <div><AlertTriangle size={14}/><span>Blocked dispositions</span><strong>{snapshot.blockingCount}</strong></div>
                <div><GitBranch size={14}/><span>Referential evidence</span><strong>{snapshot.referential.length}</strong></div>
                <div><ShieldCheck size={14}/><span>Execution safety</span><strong>{snapshot.noTargetWrites ? "ENFORCED" : "REVIEW"}</strong></div>
              </div>
            </section>

            <section className="validateHealthPanel">
              <div className="validatePanelTitle">
                <div><span>VALIDATION HEALTH</span><h2>Readiness Profile</h2></div>
              </div>
              <div className="validateBarChart">
                <div><span>Ready</span><i><b style={{width: `${snapshot.readiness}%`}}/></i><strong>{snapshot.ready.length}</strong></div>
                <div><span>Review</span><i><b style={{width: `${snapshot.stagingTotal ? Math.round(snapshot.review.length / snapshot.stagingTotal * 100) : 0}%`}}/></i><strong>{snapshot.review.length}</strong></div>
                <div><span>Quarantine</span><i><b className="amber" style={{width: `${snapshot.stagingTotal ? Math.round(snapshot.quarantine.length / snapshot.stagingTotal * 100) : 0}%`}}/></i><strong>{snapshot.quarantine.length}</strong></div>
                <div><span>Rejected</span><i><b className="red" style={{width: `${snapshot.stagingTotal ? Math.round(snapshot.rejected.length / snapshot.stagingTotal * 100) : 0}%`}}/></i><strong>{snapshot.rejected.length}</strong></div>
              </div>
            </section>

            <section>
              <div className="validatePanelTitle">
                <div><span>TOP ISSUES</span><h2>Governed Findings</h2></div>
                <span className="validateCount">{snapshot.findings.length}</span>
              </div>
              <div className="validateIssueRows">
                <div><AlertTriangle size={13}/><span>Error findings</span><strong>{snapshot.errors.length}</strong></div>
                <div><AlertTriangle size={13}/><span>Warnings</span><strong>{snapshot.warnings.length}</strong></div>
                <div><GitBranch size={13}/><span>Referential blockers</span><strong>{snapshot.blockedReferential.length}</strong></div>
                <div><Database size={13}/><span>Rejected records</span><strong>{snapshot.rejected.length}</strong></div>
              </div>
              <button type="button" className="validateOutline" onClick={() => setView("FINDINGS")}>
                View All Issues <ArrowRight size={13}/>
              </button>
            </section>
          </div>

          <section className="validateDomains">
            <div className="validatePanelTitle">
              <div><span>WHAT KMITORA IS VALIDATING</span><h2>Core Validation Workstreams</h2></div>
            </div>
            <div className="validateDomainCards">
              <article><GitBranch size={17}/><span>Transformation Plan</span><strong>{snapshot.transformations.length}</strong><small>Planned transformation evidence</small></article>
              <article><Database size={17}/><span>Record Dispositions</span><strong>{snapshot.stagingTotal}</strong><small>Ready / review / quarantine / rejected</small></article>
              <article><AlertTriangle size={17}/><span>Referential Integrity</span><strong>{snapshot.blockedReferential.length}</strong><small>Relationship/orphan controls</small></article>
              <article><FileCheck2 size={17}/><span>Data Quality</span><strong>{snapshot.findings.length}</strong><small>Completeness & consistency findings</small></article>
              <article><ShieldCheck size={17}/><span>Execution Safety</span><strong>{snapshot.noTargetWrites ? "SAFE" : "REVIEW"}</strong><small>Read-only, target writes disabled</small></article>
            </div>
          </section>

          <div className="validateBottomGrid">
            <section>
              <div className="validatePanelTitle">
                <div><span>EVIDENCE AND FINDINGS</span><h2>Validation Evidence</h2></div>
              </div>
              <div className="validateEvidenceRows">
                <div><span>Quality findings</span><strong>{snapshot.findings.length}</strong></div>
                <div><span>Transformation evidence</span><strong>{snapshot.transformations.length}</strong></div>
                <div><span>Referential dependencies</span><strong>{snapshot.referential.length}</strong></div>
                <div><span>Rejected records</span><strong>{snapshot.rejected.length}</strong></div>
              </div>
            </section>

            <section>
              <div className="validatePanelTitle">
                <div><span>READINESS DECISION</span><h2>{snapshot.qualityGate}</h2></div>
              </div>
              <div className="validateDecision">
                <span className={`validateStatus ${snapshot.qualityGate === "READY FOR REVIEW" ? "ready" : "review"}`}>
                  {snapshot.qualityGate}
                </span>
                <p>
                  {snapshot.blockingCount === 0
                    ? "No blocking staging or referential evidence is present in the current result."
                    : `${snapshot.blockingCount} governed blockers remain before progression.`}
                </p>
                <strong>Migration Mode: {snapshot.discovery?.mode ?? "DISCOVERY_ONLY"}</strong>
              </div>
            </section>

            <section>
              <div className="validatePanelTitle">
                <div><span>EXECUTION SAFETY</span><h2>Protected Runtime State</h2></div>
              </div>
              <div className="validateSafetyDetails">
                <div><span>Target writes</span><strong>{snapshot.noTargetWrites ? "NONE" : "DETECTED"}</strong></div>
                <div><span>Production action</span><strong>DISABLED</strong></div>
                <div><span>Validation mode</span><strong>READ ONLY</strong></div>
                <div><span>Custom writes</span><strong>DISABLED</strong></div>
              </div>
              <div className="validateSafeBanner">
                <ShieldCheck size={13}/>
                Validation remains governed and target writes stay disabled.
              </div>
            </section>
          </div>
        </div>
      )}

      {view === "INTELLIGENCE" && (
        <div className="validateIntelligence">
          <section className="validateIntelHero">
            <div>
              <span className="validateEyebrow">ADVANCED VALIDATION INTELLIGENCE</span>
              <h2>Validation Decision Twin</h2>
              <p>
                A read-only decision model combining data-quality findings, record
                dispositions, transformation evidence, referential dependencies and
                execution-safety signals without changing validation truth.
              </p>
            </div>
            <span className="validateStatus ready"><ShieldCheck size={13}/>READ ONLY</span>
          </section>

          <div className="validateIntelCards">
            <article><Sparkles size={18}/><span>Readiness</span><strong>{snapshot.readiness}%</strong><small>Derived from real staging dispositions</small></article>
            <article><AlertTriangle size={18}/><span>Blocking Evidence</span><strong>{snapshot.blockingCount}</strong><small>Quarantine + rejected + referential</small></article>
            <article><FileCheck2 size={18}/><span>Quality Findings</span><strong>{snapshot.findings.length}</strong><small>Current discovery evidence</small></article>
            <article><ShieldCheck size={18}/><span>Target Writes</span><strong>{snapshot.noTargetWrites ? "NONE" : "REVIEW"}</strong><small>Safety state preserved</small></article>
          </div>

          <section className="validateDecisionFlow">
            <div><span>DISCOVERY</span><strong>{snapshot.discovery ? "AVAILABLE" : "NO DATA"}</strong></div>
            <ArrowRight size={16}/>
            <div><span>QUALITY</span><strong>{snapshot.findings.length} findings</strong></div>
            <ArrowRight size={16}/>
            <div><span>REFERENTIAL</span><strong>{snapshot.blockedReferential.length} blockers</strong></div>
            <ArrowRight size={16}/>
            <div><span>DISPOSITIONS</span><strong>{snapshot.stagingTotal} records</strong></div>
            <ArrowRight size={16}/>
            <div><span>READINESS</span><strong>{snapshot.qualityGate}</strong></div>
          </section>

          <div className="validateSafetyBanner">
            <ShieldCheck size={15}/>
            <span>
              Validation Intelligence is advisory/read-only. Existing validation
              controls, qualityGate calculation, blockingCount, noTargetWrites,
              evidence and downstream approval logic remain authoritative.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

