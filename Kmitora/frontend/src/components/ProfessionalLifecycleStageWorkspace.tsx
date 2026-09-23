import { useMemo } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Gauge,
  Lightbulb,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";

import A000ScenarioContextBanner from "./A000ScenarioContextBanner";
import { KMITORA_LIFECYCLE } from "../config/kmitoraLifecycle";

type ProfessionalStageKey = "detect" | "diagnose" | "predict" | "recommend" | "simulate";

type Props = {
  stageKey: ProfessionalStageKey;
  onNavigate?: (key: string) => void;
};

type Row = {
  id: string;
  primary: string;
  secondary: string;
  impact: string;
  confidence: string;
  status: string;
};

type StageDefinition = {
  number: string;
  title: string;
  eyebrow: string;
  purpose: string;
  question: string;
  next: string;
  nextLabel: string;
  icon: typeof AlertTriangle;
  activities: Array<[string, string, string]>;
  columns: [string, string, string, string, string, string];
  rows: Row[];
};

const DEFINITIONS: Record<ProfessionalStageKey, StageDefinition> = {
  detect: {
    number: "03",
    title: "Detect",
    eyebrow: "ERRORS, DRIFT & SILENT FAILURE",
    purpose: "Detect explicit errors, anomalies, data-quality gaps, drift and silent failures without fabricating findings.",
    question: "What is wrong?",
    next: "diagnose",
    nextLabel: "Diagnose",
    icon: AlertTriangle,
    activities: [
      ["Data quality detection", "Find missing, invalid and malformed values", "Prevent poor-quality records from moving downstream"],
      ["Duplicate detection", "Identify exact and near-duplicate entities", "Reduce duplicate target creation and reconciliation noise"],
      ["Temporal detection", "Find overlapping or conflicting effective periods", "Protect current-state and historical accuracy"],
      ["Relationship detection", "Surface orphaned or broken references", "Preserve referential integrity across migration"],
      ["Rule validation", "Evaluate records against governed business rules", "Expose policy and business-rule violations"],
      ["Silent failure detection", "Identify risky conditions that may not raise technical errors", "Surface hidden migration risk before execution"],
    ],
    columns: ["Finding", "Category", "Object / Scope", "Impact", "Confidence", "Status"],
    rows: [
      { id: "DET-001", primary: "Missing / invalid values", secondary: "Required and constrained fields", impact: "Data quality", confidence: "Evidence-led", status: "Analyze" },
      { id: "DET-002", primary: "Duplicate candidates", secondary: "Entity identity and similarity", impact: "Target duplication", confidence: "Evidence-led", status: "Analyze" },
      { id: "DET-003", primary: "Temporal conflicts", secondary: "Effective-date overlaps", impact: "Current-state accuracy", confidence: "Evidence-led", status: "Analyze" },
      { id: "DET-004", primary: "Referential breaks", secondary: "Parent / child relationships", impact: "Integrity", confidence: "Evidence-led", status: "Analyze" },
      { id: "DET-005", primary: "Drift / silent failures", secondary: "Schema, rule and behavior drift", impact: "Migration risk", confidence: "Evidence-led", status: "Analyze" },
    ],
  },
  diagnose: {
    number: "04",
    title: "Diagnose",
    eyebrow: "ROOT CAUSE & IMPACT",
    purpose: "Determine root cause, localization, dependency impact and business effect for detected findings.",
    question: "Why is it wrong?",
    next: "predict",
    nextLabel: "Predict",
    icon: Activity,
    activities: [
      ["Root-cause analysis", "Trace each finding to its most likely evidence-backed cause", "Avoid treating symptoms as causes"],
      ["Localization", "Identify source system, object, field, rule or dependency", "Make remediation precise and auditable"],
      ["Dependency analysis", "Trace upstream and downstream impact", "Prevent local fixes creating secondary failures"],
      ["Business impact", "Translate technical defects into business consequences", "Support prioritization and approvals"],
      ["Confidence assessment", "Separate proven, probable and ambiguous diagnoses", "Keep automation within evidence limits"],
    ],
    columns: ["Diagnosis", "Root-cause lens", "Evidence scope", "Impact", "Confidence", "Disposition"],
    rows: [
      { id: "DIA-001", primary: "Source-data cause", secondary: "Record / field provenance", impact: "Business + technical", confidence: "Evidence-led", status: "Localize" },
      { id: "DIA-002", primary: "Business-rule cause", secondary: "Rule and exception context", impact: "Policy / process", confidence: "Evidence-led", status: "Explain" },
      { id: "DIA-003", primary: "Mapping cause", secondary: "Source-to-target semantics", impact: "Transformation", confidence: "Evidence-led", status: "Trace" },
      { id: "DIA-004", primary: "Dependency cause", secondary: "Relationship / sequence", impact: "Propagation risk", confidence: "Evidence-led", status: "Trace" },
      { id: "DIA-005", primary: "Configuration / drift cause", secondary: "Schema and environment differences", impact: "Operational", confidence: "Evidence-led", status: "Review" },
    ],
  },
  predict: {
    number: "05",
    title: "Predict",
    eyebrow: "RISK & FORWARD IMPACT",
    purpose: "Estimate evidence-supported downstream risks if diagnosed conditions remain unresolved or proposed changes are applied.",
    question: "What could happen?",
    next: "recommend",
    nextLabel: "Recommend",
    icon: Gauge,
    activities: [
      ["Risk projection", "Estimate likely downstream failure modes", "Prioritize issues before execution"],
      ["Impact propagation", "Trace how defects can affect dependent objects", "Expose systemic rather than isolated risk"],
      ["Migration readiness", "Estimate effect on ready, review and blocked populations", "Support governed progression"],
      ["Scenario comparison", "Compare unresolved versus remediated outcomes", "Make consequences understandable"],
      ["Uncertainty control", "Expose confidence and evidence limits", "Prevent unsupported forecasting"],
    ],
    columns: ["Prediction", "Risk scenario", "Trigger", "Impact", "Confidence", "Horizon"],
    rows: [
      { id: "PRD-001", primary: "Incorrect target state", secondary: "Unresolved data / temporal defects", impact: "High", confidence: "Evidence-led", status: "Migration" },
      { id: "PRD-002", primary: "Duplicate target entity", secondary: "Unresolved identity duplicates", impact: "Medium / High", confidence: "Evidence-led", status: "Load" },
      { id: "PRD-003", primary: "Relationship failure", secondary: "Missing or inconsistent references", impact: "High", confidence: "Evidence-led", status: "Execution" },
      { id: "PRD-004", primary: "Rule non-compliance", secondary: "Business-rule exceptions", impact: "High", confidence: "Evidence-led", status: "Validation" },
      { id: "PRD-005", primary: "Reconciliation variance", secondary: "Transformation or dependency mismatch", impact: "Medium", confidence: "Evidence-led", status: "Post-load" },
    ],
  },
  recommend: {
    number: "06",
    title: "Recommend",
    eyebrow: "DECISION & REMEDIATION OPTIONS",
    purpose: "Generate evidence-backed remediation options, alternatives, controls and approval requirements.",
    question: "What should be done?",
    next: "simulate",
    nextLabel: "Simulate",
    icon: Lightbulb,
    activities: [
      ["Action generation", "Generate safe remediation options from evidence", "Turn diagnosis into practical decisions"],
      ["Alternative comparison", "Show primary and fallback approaches", "Avoid single-path automation"],
      ["Governance classification", "Separate safe, review and approval-required actions", "Keep authority explicit"],
      ["Expected benefit", "Explain the intended result of each action", "Make recommendations decision-ready"],
      ["Risk disclosure", "Show residual and execution risk", "Support accountable approval"],
    ],
    columns: ["Recommendation", "Proposed action", "Alternative", "Impact", "Confidence", "Governance"],
    rows: [
      { id: "REC-001", primary: "Correct governed data issue", secondary: "Preserve original evidence", impact: "Quality improvement", confidence: "Evidence-led", status: "Safe / Review" },
      { id: "REC-002", primary: "Resolve duplicate identity", secondary: "Quarantine ambiguous candidates", impact: "Canonical target", confidence: "Evidence-led", status: "Review" },
      { id: "REC-003", primary: "Repair relationship", secondary: "Hold unresolved orphan", impact: "Integrity", confidence: "Evidence-led", status: "Review" },
      { id: "REC-004", primary: "Apply transformation rule", secondary: "Manual exception handling", impact: "Rule compliance", confidence: "Evidence-led", status: "Governed" },
      { id: "REC-005", primary: "Preserve correlated evidence", secondary: "Defer uncertain change", impact: "Auditability", confidence: "Evidence-led", status: "Required" },
    ],
  },
  simulate: {
    number: "07",
    title: "Simulate",
    eyebrow: "BEFORE / AFTER SAFE DRY RUN",
    purpose: "Model the effect of recommended actions before execution while keeping source and production writes disabled.",
    question: "What happens if we do it?",
    next: "execute",
    nextLabel: "Execute",
    icon: Sparkles,
    activities: [
      ["Dry-run transformation", "Apply recommended logic in a non-production simulation", "Verify behavior before any governed write"],
      ["Before / after comparison", "Compare original and simulated states", "Make change impact visible"],
      ["Rule re-validation", "Re-run business and technical checks", "Confirm the proposed change solves the intended issue"],
      ["Dependency replay", "Re-evaluate dependent records and relationships", "Catch secondary effects"],
      ["Promotion evidence", "Capture pass, review and residual-risk evidence", "Support the Execute gate"],
    ],
    columns: ["Simulation", "Before", "Proposed change", "After", "Confidence", "Result"],
    rows: [
      { id: "SIM-001", primary: "Data-quality remediation", secondary: "Issue present", impact: "Corrected candidate", confidence: "Evidence-led", status: "Validate" },
      { id: "SIM-002", primary: "Duplicate resolution", secondary: "Multiple candidates", impact: "Canonical candidate", confidence: "Evidence-led", status: "Validate" },
      { id: "SIM-003", primary: "Relationship repair", secondary: "Broken reference", impact: "Restored relation", confidence: "Evidence-led", status: "Validate" },
      { id: "SIM-004", primary: "Rule transformation", secondary: "Rule violation", impact: "Rule-compliant candidate", confidence: "Evidence-led", status: "Validate" },
      { id: "SIM-005", primary: "Residual-review population", secondary: "Ambiguous records", impact: "Preserved for review", confidence: "Governed", status: "Review" },
    ],
  },
};

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function findNumber(value: unknown, keys: string[]): number | null {
  const wanted = new Set(keys.map((key) => key.toLowerCase()));
  const seen = new Set<unknown>();
  const queue: unknown[] = [value];
  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);
    for (const [key, child] of Object.entries(current as Record<string, unknown>)) {
      if (wanted.has(key.toLowerCase())) {
        const n = typeof child === "number" ? child : Number(child);
        if (Number.isFinite(n)) return n;
      }
      if (child && typeof child === "object") queue.push(child);
    }
  }
  return null;
}

function findText(value: unknown, keys: string[]): string | null {
  const wanted = new Set(keys.map((key) => key.toLowerCase()));
  const seen = new Set<unknown>();
  const queue: unknown[] = [value];
  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);
    for (const [key, child] of Object.entries(current as Record<string, unknown>)) {
      if (wanted.has(key.toLowerCase()) && (typeof child === "string" || typeof child === "number")) {
        return String(child);
      }
      if (child && typeof child === "object") queue.push(child);
    }
  }
  return null;
}

function formatValue(value: number | null): string {
  return value === null ? "N/A" : value.toLocaleString();
}

export default function ProfessionalLifecycleStageWorkspace({ stageKey, onNavigate }: Props) {
  const definition = DEFINITIONS[stageKey];
  const lifecycle = KMITORA_LIFECYCLE.find((item) => item.key === stageKey);

  const runtime = useMemo(() => {
    const discovery = readJson("kmitora.dev.discoveryResult");
    const domain = readJson("kmitora.dev.domainContext");
    const readiness = readJson("kmitora.dev.readiness");
    const execution = readJson("kmitora.dev.latestExecution");
    const combined = { discovery, domain, readiness, execution };

    const total = findNumber(combined, ["total", "total_records", "records", "records_evaluated", "totalplanned", "discovered_scope"]);
    const findings = findNumber(combined, ["findings", "finding_count", "discovery_findings", "review", "review_count"]);
    const rules = findNumber(combined, ["business_rules", "business_rule_count", "rules", "rules_count"]);
    const ready = findNumber(combined, ["ready", "ready_count", "ready_records"]);
    const review = findNumber(combined, ["review", "review_count", "review_records"]);
    const rejected = findNumber(combined, ["rejected", "rejected_count"]);
    const confidence = findText(combined, ["confidence", "confidence_level"]);
    const domainName = findText(domain, ["domainName", "domain_name"]);
    const businessFunction = findText(domain, ["businessFunction", "business_function"]);

    return { total, findings, rules, ready, review, rejected, confidence, domainName, businessFunction };
  }, [stageKey]);

  const progress = lifecycle?.progress ?? 0;
  const lifecycleStatus = lifecycle?.status ?? "pending";
  const completed = progress >= 100 || lifecycleStatus === "done";
  const StageIcon = definition.icon;

  const kpis = [
    ["Records in scope", formatValue(runtime.total)],
    [stageKey === "detect" ? "Findings" : stageKey === "diagnose" ? "Diagnoses" : stageKey === "predict" ? "Risk scenarios" : stageKey === "recommend" ? "Action candidates" : "Simulation scope", formatValue(runtime.findings)],
    ["Business rules", formatValue(runtime.rules)],
    ["Ready", formatValue(runtime.ready)],
    ["Review", formatValue(runtime.review)],
    ["Rejected", formatValue(runtime.rejected)],
  ];

  return (
    <div className="page kmProStagePage">
      <A000ScenarioContextBanner />

      <section className="kmProHero">
        <div className="kmProHeroIcon"><StageIcon size={22} /></div>
        <div className="kmProHeroCopy">
          <span>{definition.eyebrow}</span>
          <h1>{definition.number} | {definition.title}</h1>
          <p>{definition.purpose}</p>
        </div>
        <div className="kmProHeroStatus">
          <span className={`kmProStatus ${completed ? "is-good" : "is-active"}`}>{completed ? "COMPLETE" : String(lifecycleStatus).toUpperCase()}</span>
          <span className="kmProStatus is-neutral">DEV | READ ONLY</span>
          <span className="kmProStatus is-neutral">{runtime.confidence ? `CONFIDENCE ${runtime.confidence}` : "EVIDENCE DRIVEN"}</span>
        </div>
      </section>

      <section className="kmProQuestionBar">
        <div><Target size={18} /><span>STAGE QUESTION</span><strong>{definition.question}</strong></div>
        <div className="kmProDomainContext">
          <span>DOMAIN INTELLIGENCE</span>
          <strong>{runtime.domainName || "Not selected"}</strong>
          {runtime.businessFunction && <small>{runtime.businessFunction}</small>}
        </div>
      </section>

      <section className="kmProKpis">
        {kpis.map(([label, value]) => (
          <article className="kmProKpi" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <section className="kmProPanel">
        <header className="kmProPanelHeader">
          <div><SearchCheck size={18} /><span>WHAT KMITORA IS DOING</span><h2>Stage responsibilities and purpose</h2></div>
          <span className="kmProEvidenceBadge"><ShieldCheck size={14} /> Governed analysis</span>
        </header>
        <div className="kmProActivityTableWrap">
          <table className="kmProTable kmProActivityTable">
            <thead><tr><th>Activity</th><th>What KMITORA does</th><th>Why it matters</th></tr></thead>
            <tbody>
              {definition.activities.map(([activity, what, why]) => (
                <tr key={activity}><td><strong>{activity}</strong></td><td>{what}</td><td>{why}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="kmProPanel">
        <header className="kmProPanelHeader">
          <div><Activity size={18} /><span>{definition.title.toUpperCase()} ANALYSIS</span><h2>{definition.question}</h2></div>
          <span className="kmProEvidenceBadge"><CheckCircle2 size={14} /> Evidence linked</span>
        </header>
        <div className="kmProTableWrap">
          <table className="kmProTable">
            <thead>
              <tr>{definition.columns.map((column) => <th key={column}>{column}</th>)}</tr>
            </thead>
            <tbody>
              {definition.rows.map((row) => (
                <tr key={row.id}>
                  <td><code>{row.id}</code></td>
                  <td><strong>{row.primary}</strong></td>
                  <td>{row.secondary}</td>
                  <td>{row.impact}</td>
                  <td>{row.confidence}</td>
                  <td><span className="kmProRowStatus">{row.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="kmProTableNote">Rows describe governed analysis categories. KMITORA should populate record-level evidence from the authoritative runtime rather than fabricate unsupported findings.</p>
      </section>

      {stageKey === "predict" && (
        <section className="kmProGrid2">
          <article className="kmProPanel kmProRiskPanel">
            <header className="kmProPanelHeader"><div><Gauge size={18} /><span>RISK MATRIX</span><h2>Probability Ã— impact</h2></div></header>
            <div className="kmProRiskMatrix">
              <span className="riskAxisY">Probability</span>
              <div className="riskCell low">Low</div><div className="riskCell medium">Medium</div><div className="riskCell high">High</div>
              <div className="riskCell low">Low</div><div className="riskCell medium">Medium</div><div className="riskCell high">High</div>
              <div className="riskCell medium">Medium</div><div className="riskCell high">High</div><div className="riskCell critical">Critical</div>
              <span className="riskAxisX">Impact (low to high)</span>
            </div>
          </article>
          <article className="kmProPanel kmProDecisionPanel">
            <header className="kmProPanelHeader"><div><ShieldCheck size={18} /><span>PREDICTION CONTROL</span><h2>Evidence limits</h2></div></header>
            <ul><li>Predictions remain evidence-supported scenarios, not guaranteed outcomes.</li><li>Confidence and affected scope remain visible.</li><li>Ambiguous conditions stay in review rather than being auto-promoted.</li></ul>
          </article>
        </section>
      )}

      {stageKey === "recommend" && (
        <section className="kmProDecisionStrip">
          <div><span>SAFE AUTO</span><strong>Evidence-backed, reversible actions</strong></div>
          <div><span>REVIEW</span><strong>Ambiguous or business-sensitive actions</strong></div>
          <div><span>APPROVAL</span><strong>Governed actions requiring authority</strong></div>
          <div><span>DO NOT EXECUTE</span><strong>Unsupported or production-prohibited actions</strong></div>
        </section>
      )}

      {stageKey === "simulate" && (
        <section className="kmProBeforeAfter">
          <article><span>BEFORE</span><strong>Authoritative source / staged state</strong><p>Original values and evidence remain preserved.</p></article>
          <ArrowRight size={24} />
          <article><span>PROPOSED CHANGE</span><strong>Governed recommendation applied in simulation</strong><p>No production cutover is implied.</p></article>
          <ArrowRight size={24} />
          <article><span>AFTER</span><strong>Simulated candidate state</strong><p>Re-validated before any execution decision.</p></article>
        </section>
      )}

      <section className="kmProFooterGrid">
        <article className="kmProGate">
          <div><ShieldCheck size={18} /><span>PROMOTION GATE</span><strong>{progress}%</strong></div>
          <p>{lifecycle?.summary || "Governed lifecycle stage"}</p>
          <div className="kmProProgress"><i style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} /></div>
        </article>

        <article className="kmProNext">
          <div><span>NEXT GOVERNED STAGE</span><strong>{definition.nextLabel}</strong><p>Continue with the same authoritative migration context and evidence chain.</p></div>
          <button type="button" onClick={() => onNavigate?.(definition.next)}>Continue to {definition.nextLabel}<ArrowRight size={16} /></button>
        </article>
      </section>
    </div>
  );
}