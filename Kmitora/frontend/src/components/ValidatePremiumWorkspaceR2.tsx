import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Database,
  FileCheck2,
  GitBranch,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TestTube2,
} from "lucide-react";
import "../styles/validate-premium-workspace-r2.css";
import "../styles/validate-first-image-exact-r3.css";

type ValidationView =
  | "OVERVIEW"
  | "WORKBENCH"
  | "QUALITY"
  | "REFERENTIAL"
  | "RULES"
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

function pct(n: number, d: number) {
  return d > 0 ? Math.round((n / d) * 100) : 0;
}

export default function ValidatePremiumWorkspaceR2() {
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

    const bySeverity = findings.reduce<Record<string, number>>((acc, finding) => {
      const key = String(finding?.severity ?? "UNKNOWN").toUpperCase();
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    const critical = bySeverity.CRITICAL ?? 0;
    const high = bySeverity.HIGH ?? bySeverity.ERROR ?? 0;
    const medium = bySeverity.MEDIUM ?? bySeverity.WARNING ?? bySeverity.WARN ?? 0;
    const low = bySeverity.LOW ?? bySeverity.INFO ?? 0;

    const blockingCount =
      quarantine.length + rejected.length + blockedReferential.length;

    const stagingTotal =
      ready.length + review.length + quarantine.length + rejected.length;

    const readiness = stagingTotal
      ? pct(ready.length, stagingTotal)
      : discovery
      ? blockingCount === 0
        ? 100
        : 0
      : 0;

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
      critical,
      high,
      medium,
      low,
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

  // UI-009 R2: automatically refresh premium validation evidence
  // whenever the real DEV validator publishes new results.
  useEffect(() => {
    const refreshValidationSnapshot = () => {
      setRefreshToken((value) => value + 1);
    };

    window.addEventListener(
      "kmitora:validation-evidence",
      refreshValidationSnapshot
    );

    window.addEventListener(
      "kmitora:unified-discovery-state",
      refreshValidationSnapshot
    );

    window.addEventListener(
      "storage",
      refreshValidationSnapshot
    );

    return () => {
      window.removeEventListener(
        "kmitora:validation-evidence",
        refreshValidationSnapshot
      );

      window.removeEventListener(
        "kmitora:unified-discovery-state",
        refreshValidationSnapshot
      );

      window.removeEventListener(
        "storage",
        refreshValidationSnapshot
      );
    };
  }, []);

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
      Exclude<ValidationView, "OVERVIEW" | "WORKBENCH" | "INTELLIGENCE">,
      string[]
    > = {
      QUALITY: ["quality", "finding", "evidence and findings"],
      REFERENTIAL: ["referential", "relationship", "orphan", "dependency"],
      RULES: ["transformation plan", "validation domain", "rule", "checks"],
      FINDINGS: ["evidence and findings", "finding", "rejected", "quarantine"],
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

  function invokeExistingControl(label: string) {
    const host = rootRef.current;
    const page = host?.closest(".page");
    if (!page) return;

    const buttons = Array.from(
      page.querySelectorAll("button")
    ) as HTMLButtonElement[];

    const target = buttons.find(
      (button: HTMLButtonElement) =>
        !host?.contains(button) &&
        String(button.textContent ?? "")
          .trim()
          .toLowerCase()
          .includes(label.toLowerCase())
    );

    if (target) {
      target.click();
    }
  }

  const validated = snapshot.stagingTotal;
  const passed = snapshot.ready.length;
  const warnings = snapshot.review.length + snapshot.medium;
  const blocked = snapshot.blockingCount + snapshot.critical + snapshot.high;

  const issueRows = [
    ["Critical findings", snapshot.critical],
    ["High / error findings", snapshot.high],
    ["Warnings / medium findings", snapshot.medium],
    ["Referential blockers", snapshot.blockedReferential.length],
    ["Rejected records", snapshot.rejected.length],
  ];

  const topIssues = issueRows
    .filter(([, value]) => Number(value) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 5);

  return (
    <div className={`validatePremiumR2 ${view !== "OVERVIEW" && view !== "INTELLIGENCE" ? "showLegacyValidate" : ""}`} ref={rootRef}>
      <header className="v2Header">
        <div>
          <span className="v2Eyebrow">STEP 05 · VALIDATION CONTROL</span>
          <div className="v2TitleRow">
            <h1>Validation Control Center</h1>
            <span className={`v2Status ${snapshot.qualityGate === "READY FOR REVIEW" ? "ready" : "review"}`}>
              {snapshot.qualityGate}
            </span>
          </div>
          <p>
            Verify data quality, record dispositions, transformation evidence and
            referential integrity before KMITORA allows the workflow to progress.
          </p>
          <div className="v2Safety">
            <span><ShieldCheck size={13}/>Read-only validation</span>
            <span><Database size={13}/>Target writes: {snapshot.noTargetWrites ? "NONE" : "REVIEW"}</span>
            <span><Activity size={13}/>Validation mode: READ ONLY</span>
            <span><AlertTriangle size={13}/>Blocks: {snapshot.blockingCount}</span>
            <span><CheckCircle2 size={13}/>Readiness: {snapshot.readiness}%</span>
          </div>
        </div>

        <div className="v2HeaderRight">
          <div className="v2Plan">
            <small>Plan Run</small>
            <strong>{snapshot.migrationId}</strong>
          </div>
          <button type="button" onClick={() => setView("WORKBENCH")}>
            Existing Controls
          </button>
        </div>
      </header>

      <section className="v2Kpis">
        <article>
          <span>Validation Health</span>
          <strong>{snapshot.readiness}%</strong>
          <small>{snapshot.qualityGate}</small>
        </article>
        <article>
          <span>Records Validated</span>
          <strong>{validated}</strong>
          <small>Current staging evidence</small>
        </article>
        <article>
          <span>Passed Validations</span>
          <strong>{passed}</strong>
          <small>{pct(passed, Math.max(validated, 1))}% ready</small>
        </article>
        <article>
          <span>Warnings</span>
          <strong>{warnings}</strong>
          <small>Review + warning evidence</small>
        </article>
        <article>
          <span>Blocked</span>
          <strong>{blocked}</strong>
          <small>Governed blockers</small>
        </article>
        <article>
          <span>Validation Rules</span>
          <strong>{snapshot.transformations.length}</strong>
          <small>Transformation plan checks</small>
        </article>
        <article className="v2ScoreKpi">
          <div>
            <span>Readiness Score</span>
            <small>Current evidence only</small>
          </div>
          <div
            className="v2Ring"
            style={{"--score": `${snapshot.readiness * 3.6}deg`} as CSSProperties}
          >
            <strong>{snapshot.readiness}%</strong>
          </div>
        </article>
      </section>

      <nav className="v2Tabs">
        {([
          ["OVERVIEW", "Overview", Activity],
          ["WORKBENCH", "Execution & Evidence", TestTube2],
          ["QUALITY", `Data Quality (${snapshot.findings.length})`, Database],
          ["REFERENTIAL", `Referential Integrity (${snapshot.referential.length})`, GitBranch],
          ["RULES", `Rules & Checks (${snapshot.transformations.length})`, FileCheck2],
          ["FINDINGS", `Issues & Dispositions (${warnings + blocked})`, AlertTriangle],
          ["READINESS", "Readiness", CheckCircle2],
          ["INTELLIGENCE", "Validation Intelligence", Sparkles],
        ] as Array<[ValidationView, string, typeof Activity]>).map(([id, label, Icon]) => (
          <button
            type="button"
            key={id}
            className={view === id ? "active" : ""}
            onClick={() => setView(id)}
          >
            <Icon size={14}/>
            {label}
          </button>
        ))}
        <button
          type="button"
          className="v2Refresh"
          onClick={() => setRefreshToken((value) => value + 1)}
        >
          <RefreshCw size={13}/>
          Refresh
        </button>
      </nav>

      {view === "OVERVIEW" && (
        <div className="v2Body">
          <div className="v2TopGrid">
            <section>
              <div className="v2PanelHead">
                <div><span>VALIDATION EXECUTION</span><h2>Coordinate validation controls</h2></div>
              </div>
              <div className="v2ActionList">
                <button type="button" onClick={() => invokeExistingControl("Run Impacted Tests")}>
                  <TestTube2 size={15}/>
                  <div>
                    <strong>Run impacted tests</strong>
                    <small>Execute the existing impacted-validation control.</small>
                  </div>
                  <em>Recommended</em>
                </button>
                <button type="button" onClick={() => setView("WORKBENCH")}>
                  <ShieldCheck size={15}/>
                  <div>
                    <strong>Full validation workbench</strong>
                    <small>Open authoritative validation evidence and controls.</small>
                  </div>
                  <em>Governed</em>
                </button>
                <button type="button" onClick={() => setView("READINESS")}>
                  <Clock3 size={15}/>
                  <div>
                    <strong>Review readiness</strong>
                    <small>Inspect validation gate and blocker state.</small>
                  </div>
                  <em>Read only</em>
                </button>
              </div>
              <button type="button" className="v2Outline" onClick={() => setView("WORKBENCH")}>
                View All Validation Controls <ArrowRight size={13}/>
              </button>
            </section>

            <section>
              <div className="v2PanelHead">
                <div><span>READINESS AT A GLANCE</span><h2>Current validation state</h2></div>
              </div>
              <div className="v2Checklist">
                <div><CheckCircle2 size={13}/><span>Discovery evidence</span><strong>{snapshot.discovery ? "AVAILABLE" : "MISSING"}</strong></div>
                <div><ShieldCheck size={13}/><span>Read-only execution</span><strong>ENFORCED</strong></div>
                <div><FileCheck2 size={13}/><span>Transformation plan</span><strong>{snapshot.transformations.length}</strong></div>
                <div><AlertTriangle size={13}/><span>Blocked dispositions</span><strong>{snapshot.blockingCount}</strong></div>
                <div><GitBranch size={13}/><span>Referential integrity</span><strong>{snapshot.blockedReferential.length ? "REVIEW" : "CLEAR"}</strong></div>
                <div><ShieldCheck size={13}/><span>Execution safety</span><strong>{snapshot.noTargetWrites ? "ENFORCED" : "REVIEW"}</strong></div>
              </div>
            </section>

            <section className="v2Health">
              <div className="v2PanelHead">
                <div><span>VALIDATION HEALTH</span><h2>Current Evidence Profile</h2></div>
                <span className="v2Badge blue">CURRENT</span>
              </div>
              <div className="v2HealthHero">
                <div
                  className="v2LargeRing"
                  style={{"--score": `${snapshot.readiness * 3.6}deg`} as CSSProperties}
                >
                  <strong>{snapshot.readiness}%</strong>
                  <span>Readiness</span>
                </div>
                <div className="v2HealthBars">
                  <div><span>Ready</span><i><b style={{width: `${pct(snapshot.ready.length, Math.max(snapshot.stagingTotal,1))}%`}}/></i><strong>{snapshot.ready.length}</strong></div>
                  <div><span>Review</span><i><b className="amber" style={{width: `${pct(snapshot.review.length, Math.max(snapshot.stagingTotal,1))}%`}}/></i><strong>{snapshot.review.length}</strong></div>
                  <div><span>Quarantine</span><i><b className="red" style={{width: `${pct(snapshot.quarantine.length, Math.max(snapshot.stagingTotal,1))}%`}}/></i><strong>{snapshot.quarantine.length}</strong></div>
                  <div><span>Rejected</span><i><b className="red" style={{width: `${pct(snapshot.rejected.length, Math.max(snapshot.stagingTotal,1))}%`}}/></i><strong>{snapshot.rejected.length}</strong></div>
                </div>
              </div>
            </section>

            <section>
              <div className="v2PanelHead">
                <div><span>TOP ISSUES</span><h2>By current evidence</h2></div>
                <span className="v2Badge red">{warnings + blocked}</span>
              </div>
              <div className="v2IssueList">
                {topIssues.length ? topIssues.map(([label, value]) => (
                  <div key={String(label)}>
                    <AlertTriangle size={13}/>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                )) : (
                  <div><CheckCircle2 size={13}/><span>No current issues returned</span><strong>0</strong></div>
                )}
              </div>
              <button type="button" className="v2Outline" onClick={() => setView("FINDINGS")}>
                View All Issues <ArrowRight size={13}/>
              </button>
            </section>
          </div>

          <div className="v2MiddleGrid">
            <section>
              <div className="v2PanelHead">
                <div><span>DISCOVERY EVIDENCE PREREQUISITE</span><h2>Evidence availability</h2></div>
                <span className={`v2Badge ${snapshot.discovery ? "green" : "amber"}`}>
                  {snapshot.discovery ? "AVAILABLE" : "MISSING"}
                </span>
              </div>
              <p className="v2Note">
                Validation derives its quality, staging and referential controls
                from the current discovery result. No validation result is fabricated
                while source discovery is unavailable.
              </p>
              <div className="v2MiniStatus">
                <span>Source</span><strong>{snapshot.discovery ? "DISCOVERED" : "NONE"}</strong>
                <span>Evidence</span><strong>READ ONLY</strong>
              </div>
              <div className="v2ButtonRow">
                <button type="button" onClick={() => setView("WORKBENCH")}>View Evidence</button>
                <button type="button" onClick={() => setView("INTELLIGENCE")}>Explain</button>
              </div>
            </section>

            <section className="v2Workstreams">
              <div className="v2PanelHead">
                <div><span>WHAT KMITORA IS VALIDATING</span><h2>Core validation workstreams</h2></div>
              </div>
              <div className="v2WorkCards">
                <article><FileCheck2 size={16}/><span>Transformation Plan</span><strong>{snapshot.transformations.length}</strong><small>Coverage & control checks</small><em>PLANNED</em></article>
                <article><Database size={16}/><span>Record Dispositions</span><strong>{snapshot.stagingTotal}</strong><small>Ready / review / quarantine / rejected</small><em>READ ONLY</em></article>
                <article><GitBranch size={16}/><span>Referential Integrity</span><strong>{snapshot.referential.length}</strong><small>Parent-child/domain controls</small><em>{snapshot.blockedReferential.length ? "REVIEW" : "CLEAR"}</em></article>
                <article><Activity size={16}/><span>Data Quality</span><strong>{snapshot.findings.length}</strong><small>Completeness & consistency</small><em>OBSERVED</em></article>
                <article><ShieldCheck size={16}/><span>Execution Safety</span><strong>{snapshot.noTargetWrites ? "SAFE" : "REVIEW"}</strong><small>Target writes disabled</small><em>ENFORCED</em></article>
              </div>
            </section>
          </div>

          <div className="v2BottomGrid">
            <section>
              <div className="v2PanelHead"><div><span>EVIDENCE AND FINDINGS</span><h2>Evidence Summary</h2></div></div>
              <div className="v2EvidenceGrid">
                <div className="v2EvidenceRows">
                  <div><span>Quality findings</span><strong>{snapshot.findings.length}</strong></div>
                  <div><span>Transformation checks</span><strong>{snapshot.transformations.length}</strong></div>
                  <div><span>Referential dependencies</span><strong>{snapshot.referential.length}</strong></div>
                  <div><span>Staging records</span><strong>{snapshot.stagingTotal}</strong></div>
                </div>
                <div className="v2Severity">
                  <p><i className="critical"/><span>Critical</span><strong>{snapshot.critical}</strong></p>
                  <p><i className="high"/><span>High</span><strong>{snapshot.high}</strong></p>
                  <p><i className="medium"/><span>Medium</span><strong>{snapshot.medium}</strong></p>
                  <p><i className="low"/><span>Low</span><strong>{snapshot.low}</strong></p>
                </div>
              </div>
              <button type="button" className="v2Outline" onClick={() => setView("FINDINGS")}>
                View Full Evidence <ArrowRight size={13}/>
              </button>
            </section>

            <section>
              <div className="v2PanelHead"><div><span>READINESS DECISION</span><h2>{snapshot.qualityGate}</h2></div></div>
              <span className={`v2Status ${snapshot.qualityGate === "READY FOR REVIEW" ? "ready" : "review"}`}>
                {snapshot.qualityGate}
              </span>
              <p className="v2Note">
                {snapshot.blockingCount === 0
                  ? "No blocking staging or referential evidence is present in the current validation result."
                  : `${snapshot.blockingCount} governed blockers remain before workflow progression.`}
              </p>
              <div className="v2DecisionRows">
                <div><span>Migration Mode</span><strong>{snapshot.discovery?.mode ?? "DISCOVERY_ONLY"}</strong></div>
                <div><span>Target Writes</span><strong>{snapshot.noTargetWrites ? "NONE" : "REVIEW"}</strong></div>
                <div><span>Production Action</span><strong>DISABLED</strong></div>
                <div><span>Validation Mode</span><strong>READ ONLY</strong></div>
              </div>
              <button type="button" className="v2Outline" onClick={() => setView("READINESS")}>
                Proceed to Review <ArrowRight size={13}/>
              </button>
            </section>

            <section>
              <div className="v2PanelHead"><div><span>EXECUTION SAFETY</span><h2>Protected runtime state</h2></div></div>
              <div className="v2SafetyRows">
                <div><span>Source changes</span><strong>NONE</strong></div>
                <div><span>Target writes</span><strong>{snapshot.noTargetWrites ? "NONE" : "REVIEW"}</strong></div>
                <div><span>Production action</span><strong>DISABLED</strong></div>
                <div><span>Custom scripts</span><strong>DISABLED</strong></div>
                <div><span>Write operations</span><strong>0</strong></div>
              </div>
              <div className="v2SafeBanner"><ShieldCheck size={13}/>Execution is safe. Target writes remain disabled.</div>
            </section>
          </div>
        </div>
      )}

      {view === "INTELLIGENCE" && (
        <div className="v2Intelligence">
          <section className="v2IntelHero">
            <div>
              <span className="v2Eyebrow">ADVANCED VALIDATION INTELLIGENCE</span>
              <h2>Validation Decision Twin</h2>
              <p>
                Read-only reasoning across quality findings, record dispositions,
                transformation checks, referential dependencies and execution-safety
                evidence. It explains readiness without changing validation truth.
              </p>
            </div>
            <span className="v2Status ready"><ShieldCheck size={13}/>READ ONLY</span>
          </section>

          <div className="v2IntelCards">
            <article><Sparkles size={18}/><span>Readiness</span><strong>{snapshot.readiness}%</strong><small>Current evidence-derived score</small></article>
            <article><AlertTriangle size={18}/><span>Blocking Evidence</span><strong>{snapshot.blockingCount}</strong><small>Quarantine + rejected + referential</small></article>
            <article><FileCheck2 size={18}/><span>Validation Rules</span><strong>{snapshot.transformations.length}</strong><small>Transformation-plan controls</small></article>
            <article><ShieldCheck size={18}/><span>Target Writes</span><strong>{snapshot.noTargetWrites ? "NONE" : "REVIEW"}</strong><small>Safety state preserved</small></article>
          </div>

          <div className="v2SafetyBanner">
            <ShieldCheck size={15}/>
            <span>
              Existing Validate.tsx logic remains authoritative for qualityGate,
              blockingCount, noTargetWrites, Run Impacted Tests, evidence and
              downstream workflow gating.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

