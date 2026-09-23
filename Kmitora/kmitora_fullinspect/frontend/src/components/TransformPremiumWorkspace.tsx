import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  Beaker,
  CheckCircle2,
  Clock3,
  Code2,
  Eye,
  FileCheck2,
  GitBranch,
  Layers3,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import "../styles/transform-premium-workspace.css";
import { compileUniversalTransformations } from "../services/api";

import "../styles/transform-premium-final-r2.css";
type TransformView =
  | "OVERVIEW"
  | "WORKBENCH"
  | "RULES"
  | "IMPACT"
  | "VALIDATION"
  | "INTELLIGENCE";

type TransformItem = {
  action?: string;
  entity?: string;
  field?: string;
  source_field?: string;
  target_field?: string;
  condition?: string;
  expression?: string;
  rule?: string;
  business_rules?: string[];
  finding_type?: string;
  severity?: string;
  status?: string;
  before?: unknown;
  after?: unknown;
  source_value?: unknown;
  target_value?: unknown;
};

type UniversalLogicNode = {
  id?: string;
  capability?: string;
  op?: string;
  entity?: string | null;
  field?: string | null;
  execution?: string;
  confidence?: number;
  business_rules?: string[];
  params?: Record<string, unknown>;
};

type UniversalLogicPayload = {
  plan?: {
    nodes?: UniversalLogicNode[];
    capability_coverage?: { catalog_size?: number; planned_native?: number; planned_policy?: number; planned_adapter?: number };
    target_mutations?: Array<Record<string, unknown>>;
    llm_status?: string;
    internal_prompt_hash?: string;
  };
  simulation?: {
    total_records?: number;
    applied_transform_count?: number;
    exception_count?: number;
    counts?: Record<string, number>;
  };
};

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

function valueOf(item: TransformItem, keys: (keyof TransformItem)[], fallback: string) {
  for (const key of keys) {
    const value = item[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value);
  }
  return fallback;
}

function classify(item: TransformItem) {
  const text = `${item.action ?? ""} ${item.rule ?? ""} ${item.condition ?? ""} ${item.expression ?? ""}`.toUpperCase();
  if (text.includes("VALIDAT") || text.includes("REFERENCE")) return "VALIDATION";
  if (text.includes("UPPER") || text.includes("LOWER") || text.includes("TRIM") || text.includes("NORMAL")) return "STANDARDIZATION";
  if (text.includes("FORMAT") || text.includes("DATE") || text.includes("CAST")) return "FORMAT";
  if (text.includes("DERIV") || text.includes("CALCUL")) return "DERIVATION";
  return "BUSINESS_RULE";
}

export default function TransformPremiumWorkspace() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<TransformView>("OVERVIEW");
  const [selected, setSelected] = useState(0);
  const [refreshToken, setRefreshToken] = useState(0);
  const [universalLogic, setUniversalLogic] = useState<UniversalLogicPayload | null>(null);
  const [universalLogicStatus, setUniversalLogicStatus] = useState("WAITING");

  const snapshot = useMemo(() => {
    const discovery = readJson<any>("kmitora.dev.discoveryResult", null);
    const plan = safeArray<TransformItem>(discovery?.transformation_plan);
    const findings = safeArray<any>(discovery?.quality_findings);

    const highRisk = plan.filter((item) =>
      ["HIGH", "ERROR", "CRITICAL"].includes(String(item.severity ?? "").toUpperCase())
    );
    const review = plan.filter((item) =>
      ["REVIEW", "PENDING", "DRAFT"].includes(String(item.status ?? "").toUpperCase())
    );
    const validationRules = safeArray<any>(discovery?.validation_plan);
    const categories = plan.reduce<Record<string, number>>((acc, item) => {
      const key = classify(item);
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
    const confidenceBase = plan.length
      ? Math.max(0, 100 - Math.round(((highRisk.length + review.length) / Math.max(plan.length, 1)) * 50))
      : 0;

    return {
      discovery,
      plan,
      findings,
      highRisk,
      review,
      validationRules,
      categories,
      confidence: confidenceBase,
      migrationId:
        discovery?.migration_id ??
        localStorage.getItem("kmitora.dev.migrationId") ??
        "Not available",
    };
  }, [refreshToken]);

  useEffect(() => {
    const migrationId = String(snapshot.migrationId ?? "").trim();
    if (!migrationId || migrationId === "Not available") {
      setUniversalLogic(null);
      setUniversalLogicStatus("WAITING");
      return;
    }
    let cancelled = false;
    setUniversalLogicStatus("COMPILING");
    compileUniversalTransformations(migrationId)
      .then((body: any) => {
        if (cancelled) return;
        const payload = (body?.payload ?? body) as UniversalLogicPayload;
        setUniversalLogic(payload);
        setUniversalLogicStatus("READY");
      })
      .catch(() => {
        if (cancelled) return;
        setUniversalLogic(null);
        setUniversalLogicStatus("UNAVAILABLE");
      });
    return () => { cancelled = true; };
  }, [snapshot.migrationId, refreshToken]);

  useEffect(() => {
    if (selected >= snapshot.plan.length) setSelected(0);
  }, [selected, snapshot.plan.length]);

  useEffect(() => {
    const host = rootRef.current;
    const page = host?.closest(".page") as HTMLElement | null;
    if (!page || !host) return;

    const directChildren = Array.from(page.children).filter(
      (element) => element !== host
    ) as HTMLElement[];

    const reset = () => {
      directChildren.forEach((element) => {
        element.style.display = "";
      });
    };

    if (view === "WORKBENCH") {
      reset();
      return reset;
    }

    if (view === "OVERVIEW" || view === "INTELLIGENCE") {
      directChildren.forEach((element) => {
        element.style.display = "none";
      });
      return reset;
    }

    const termsByView: Record<
      Exclude<TransformView, "OVERVIEW" | "WORKBENCH" | "INTELLIGENCE">,
      string[]
    > = {
      RULES: [
        "rule editor",
        "condition",
        "reference values",
        "execution policy",
        "apply & revalidate",
      ],
      IMPACT: [
        "impact analysis",
        "impact",
        "records affected",
        "fields impacted",
        "downstream",
      ],
      VALIDATION: [
        "validation",
        "test sample",
        "revalidation",
        "target preview",
        "reference validation",
      ],
    };

    const terms = termsByView[view as keyof typeof termsByView];

    directChildren.forEach((element) => {
      const text = textOf(element);
      element.style.display = containsAny(text, terms) ? "" : "none";
    });

    const visible = directChildren.filter((element) => element.style.display !== "none");
    if (!visible.length) reset();

    return reset;
  }, [view]);

  const current = snapshot.plan[selected] ?? null;
  const currentBefore = current
    ? valueOf(current, ["source_value", "before"], "Source value")
    : "Source value";
  const currentAfter = current
    ? valueOf(current, ["target_value", "after"], "Target preview")
    : "Target preview";
  const currentAction = current
    ? valueOf(current, ["action", "rule", "expression"], "Transformation")
    : "Transformation";

  const categoryEntries = (Object.entries(snapshot.categories) as Array<[string, number]>).sort((a, b) => b[1] - a[1]);
  const universalNodes = safeArray<UniversalLogicNode>(universalLogic?.plan?.nodes);
  const universalCoverage = universalLogic?.plan?.capability_coverage ?? {};
  const schemaMutations = safeArray<Record<string, unknown>>(universalLogic?.plan?.target_mutations);

  return (
    <div className="transformPremium" ref={rootRef}>
      <header className="transformPremiumHeader">
        <div>
          <span className="transformEyebrow">STEP 04 · DEV TRANSFORMATION WORKBENCH</span>
          <div className="transformTitleRow">
            <h1>Transformation Studio</h1>
            <span className="transformStatus safe">
              <ShieldCheck size={13}/>
              DEV SAFE
            </span>
          </div>
          <p>
            Understand what KMITORA plans to transform, why each change is required,
            which business rules are involved, and what target structure is previewed
            before any governed execution occurs.
          </p>
          <div className="transformSafetyRow">
            <span><Eye size={13}/>Read-only planning</span>
            <span><ShieldCheck size={13}/>Target-safe</span>
            <span><FileCheck2 size={13}/>Business-rules aware</span>
            <span><GitBranch size={13}/>Impact & validation ready</span>
            <span><AlertTriangle size={13}/>Execution not enabled</span>
          </div>
        </div>

        <div className="transformHeaderActions">
          <div className="transformRun">
            <small>Plan Run</small>
            <strong>{snapshot.migrationId}</strong>
          </div>
          <button type="button" onClick={() => setView("WORKBENCH")}>
            <WandSparkles size={14}/>
            Existing Controls
          </button>
        </div>
      </header>

      <section className="transformKpiStrip">
        <article><span>Transformation Rules</span><strong>{snapshot.plan.length}</strong><small>Total planned rules</small></article>
        <article><span>Field Transformations</span><strong>{snapshot.plan.length}</strong><small>Current plan items</small></article>
        <article><span>High Impact Rules</span><strong>{snapshot.highRisk.length}</strong><small>Needs attention</small></article>
        <article><span>Validation Rules</span><strong>{snapshot.validationRules.length}</strong><small>Reference / validation logic</small></article>
        <article><span>Quality Findings</span><strong>{snapshot.findings.length}</strong><small>Discovery quality signals</small></article>
        <article className="transformConfidenceKpi">
          <span>Plan Confidence</span>
          <div
            className="transformConfidenceRing"
            style={{"--score": `${snapshot.confidence * 3.6}deg`} as CSSProperties}
          >
            <strong>{snapshot.confidence}%</strong>
          </div>
        </article>
      </section>

      <section className="universalLogicPanel" aria-label="Universal business logic compiler">
        <div className="universalLogicHead">
          <div>
            <span className="transformEyebrow">A230 / A240 · BUSINESS LOGIC COMPILER</span>
            <h2>Universal Transformation Intelligence</h2>
            <p>Business prompts are compiled against the live source and target schemas into bounded transformation capabilities. Row execution is deterministic; external/custom actions remain adapter-gated.</p>
          </div>
          <span className={`transformStatus ${universalLogicStatus === "READY" ? "safe" : ""}`}>{universalLogicStatus}</span>
        </div>
        <div className="universalLogicKpis">
          <article><span>Capability Catalog</span><strong>{universalCoverage.catalog_size ?? 0}</strong><small>PowerCenter / IDQ / MDM equivalents</small></article>
          <article><span>Compiled Nodes</span><strong>{universalNodes.length}</strong><small>Prompt-derived logic</small></article>
          <article><span>Native</span><strong>{universalCoverage.planned_native ?? 0}</strong><small>Deterministic executor</small></article>
          <article><span>Adapter / Policy</span><strong>{(universalCoverage.planned_adapter ?? 0) + (universalCoverage.planned_policy ?? 0)}</strong><small>Fail-closed / governed</small></article>
          <article><span>Applied Changes</span><strong>{universalLogic?.simulation?.applied_transform_count ?? 0}</strong><small>Simulation only</small></article>
          <article><span>Exceptions</span><strong>{universalLogic?.simulation?.exception_count ?? 0}</strong><small>Review / reject candidates</small></article>
        </div>
        <div className="universalLogicGrid">
          <div className="universalLogicTableWrap">
            <table>
              <thead><tr><th>Capability</th><th>Operation</th><th>Entity</th><th>Field</th><th>Execution</th><th>Rules</th></tr></thead>
              <tbody>
                {universalNodes.slice(0, 12).map((node, index) => (
                  <tr key={node.id ?? `${node.op}-${index}`}>
                    <td><strong>{node.capability ?? "Transformation"}</strong></td>
                    <td>{node.op ?? "--"}</td>
                    <td>{node.entity ?? "All / derived"}</td>
                    <td>{node.field ?? "--"}</td>
                    <td>{node.execution ?? "--"}</td>
                    <td>{safeArray<string>(node.business_rules).join(", ") || "--"}</td>
                  </tr>
                ))}
                {!universalNodes.length && <tr><td colSpan={6}>Run governed Discovery to compile business logic against the live source/target model.</td></tr>}
              </tbody>
            </table>
          </div>
          <aside className="universalLogicAside">
            <strong>Target mutation planning</strong>
            <p>{schemaMutations.length} schema mutation(s) planned. INSERT / UPDATE / DELETE decisions are classified per record; actual target state change remains separately authorized.</p>
            <small>Compiler: {universalLogic?.plan?.llm_status ?? "deterministic"}</small>
            <small>Prompt fingerprint: {universalLogic?.plan?.internal_prompt_hash?.slice(0, 16) ?? "not available"}</small>
          </aside>
        </div>
      </section>

      <nav className="transformPremiumTabs" aria-label="Transformation workspace">
        {([
          ["OVERVIEW", "Transformation Preview", Layers3],
          ["WORKBENCH", "Existing Workbench", Code2],
          ["RULES", `Rule Editor (${snapshot.plan.length})`, GitBranch],
          ["IMPACT", `Impact Analysis (${snapshot.highRisk.length})`, AlertTriangle],
          ["VALIDATION", `Validation Plan (${snapshot.validationRules.length})`, FileCheck2],
          ["INTELLIGENCE", "Transformation Intelligence", Sparkles],
        ] as Array<[TransformView, string, typeof Layers3]>).map(([id, label, Icon]) => (
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
          className="transformRefresh"
          onClick={() => setRefreshToken((value) => value + 1)}
        >
          <RefreshCw size={13}/>
          Refresh
        </button>
      </nav>

      {view === "OVERVIEW" && (
        <div className="transformOverview">
          <div className="transformWorkspaceGrid">
            <aside className="transformFlowPanel">
              <div className="transformPanelTitle">
                <div>
                  <span>TRANSFORMATION FLOW</span>
                  <h2>Plan Preview</h2>
                </div>
                <span className="transformCountBadge">{snapshot.plan.length}</span>
              </div>

              {current ? (
                <div className="transformFlow">
                  <div className="transformFlowNode blue">
                    <span>Source</span>
                    <strong>{currentBefore}</strong>
                  </div>
                  <ArrowDown size={16}/>
                  <div className="transformFlowNode purple">
                    <span>Rule / Action</span>
                    <strong>{currentAction}</strong>
                  </div>
                  <ArrowDown size={16}/>
                  <div className="transformFlowNode green">
                    <span>Validation</span>
                    <strong>{classify(current)}</strong>
                  </div>
                  <ArrowDown size={16}/>
                  <div className="transformFlowNode violet">
                    <span>Target Preview</span>
                    <strong>{currentAfter}</strong>
                  </div>
                </div>
              ) : (
                <div className="transformEmpty">
                  <GitBranch size={22}/>
                  <strong>No Transformation Plan</strong>
                  <span>Discovery completed, but no transformation actions were generated.</span>
                </div>
              )}

              <div className="transformSafeNotice">
                <ShieldCheck size={14}/>
                <span>Plan is safe for review. Execution remains disabled.</span>
              </div>
            </aside>

            <main className="transformRulePanel">
              <div className="transformPanelTitle">
                <div>
                  <span>RULE EDITOR</span>
                  <h2>Transformation Rule Context</h2>
                </div>
                <span className={`transformRisk ${snapshot.highRisk.length ? "medium" : "safe"}`}>
                  {snapshot.highRisk.length ? "REVIEW RISK" : "SAFE PLAN"}
                </span>
              </div>

              <div className="transformRuleBody">
                <div className="transformRuleList">
                  {snapshot.plan.slice(0, 8).map((item, index) => (
                    <button
                      type="button"
                      key={`${item.action ?? "rule"}-${item.entity ?? ""}-${item.field ?? ""}-${index}`}
                      className={selected === index ? "selected" : ""}
                      onClick={() => setSelected(index)}
                    >
                      <span>{index + 1}</span>
                      <div>
                        <strong>{valueOf(item, ["action", "rule"], "Transformation")}</strong>
                        <small>
                          {[item.entity, item.field].filter(Boolean).join(".") || classify(item)}
                        </small>
                      </div>
                      <em>{String(item.status ?? "PLANNED").toUpperCase()}</em>
                    </button>
                  ))}

                  {!snapshot.plan.length && (
                    <div className="transformRulePlaceholder">
                      <Code2 size={24}/>
                      <h3>Rule editor waiting for transformation plan</h3>
                      <p>The original Transformation Studio remains available in Existing Workbench.</p>
                    </div>
                  )}
                </div>

                <aside className="transformRuleProperties">
                  <span>RULE PROPERTIES</span>
                  <dl>
                    <div><dt>Action</dt><dd>{current ? valueOf(current, ["action"], "—") : "—"}</dd></div>
                    <div><dt>Entity</dt><dd>{current?.entity ?? "—"}</dd></div>
                    <div><dt>Field</dt><dd>{current?.field ?? current?.source_field ?? "—"}</dd></div>
                    <div><dt>Category</dt><dd>{current ? classify(current) : "—"}</dd></div>
                    <div><dt>Status</dt><dd>{current?.status ?? "PLANNED"}</dd></div>
                    <div><dt>Execution</dt><dd>DISABLED</dd></div>
                  </dl>
                </aside>
              </div>

              <div className="transformActionBar">
                <button type="button" onClick={() => setView("VALIDATION")}>
                  <Beaker size={14}/>
                  Test / Validation View
                </button>
                <button type="button" onClick={() => setView("INTELLIGENCE")}>
                  <Sparkles size={14}/>
                  Ask KMITORA
                </button>
                <button type="button" className="primary" onClick={() => setView("WORKBENCH")}>
                  Review Existing Apply & Revalidate
                </button>
              </div>
            </main>

            <aside className="transformImpactPanel">
              <div className="transformPanelTitle">
                <div>
                  <span>IMPACT SUMMARY</span>
                  <h2>Plan Impact</h2>
                </div>
              </div>

              <div className="transformImpactRows">
                <div><Layers3 size={14}/><span>Plan Items</span><strong>{snapshot.plan.length}</strong></div>
                <div><AlertTriangle size={14}/><span>High Impact</span><strong>{snapshot.highRisk.length}</strong></div>
                <div><FileCheck2 size={14}/><span>Validation Rules</span><strong>{snapshot.validationRules.length}</strong></div>
                <div><GitBranch size={14}/><span>Rule Categories</span><strong>{categoryEntries.length}</strong></div>
                <div><Activity size={14}/><span>Quality Findings</span><strong>{snapshot.findings.length}</strong></div>
              </div>

              <div className="transformConfidenceBar">
                <div><span>Plan Confidence</span><strong>{snapshot.confidence}%</strong></div>
                <i><b style={{width: `${snapshot.confidence}%`}}/></i>
              </div>

              <button type="button" className="transformImpactButton" onClick={() => setView("IMPACT")}>
                View Full Impact Analysis
                <ArrowRight size={14}/>
              </button>
            </aside>
          </div>

          <div className="transformBottomGrid">
            <section>
              <div className="transformPanelTitle">
                <div><span>RECENT RULE ACTIVITY</span><h2>Current Plan State</h2></div>
                <span className="transformLiveBadge">LIVE</span>
              </div>
              <div className="transformActivityRows">
                <div><CheckCircle2 size={13}/><span>Transformation plan loaded</span><strong>{snapshot.plan.length}</strong></div>
                <div><FileCheck2 size={13}/><span>Validation-aware rules</span><strong>{snapshot.validationRules.length}</strong></div>
                <div><ShieldCheck size={13}/><span>Execution state</span><strong>DISABLED</strong></div>
              </div>
            </section>

            <section>
              <div className="transformPanelTitle">
                <div><span>RULE HEALTH OVERVIEW</span><h2>Transformation Readiness</h2></div>
              </div>
              <div className="transformHealthSummary">
                <div
                  className="transformDonut"
                  style={{
                    "--safe": `${Math.max(0, snapshot.plan.length - snapshot.highRisk.length - snapshot.review.length) / Math.max(snapshot.plan.length,1) * 360}deg`,
                    "--review": `${Math.max(0, snapshot.plan.length - snapshot.highRisk.length) / Math.max(snapshot.plan.length,1) * 360}deg`,
                  } as CSSProperties}
                >
                  <strong>{snapshot.plan.length}</strong>
                  <span>Total Rules</span>
                </div>
                <div>
                  <p><i className="safe"/><span>Safe / Planned</span><strong>{Math.max(0, snapshot.plan.length - snapshot.highRisk.length - snapshot.review.length)}</strong></p>
                  <p><i className="review"/><span>Review</span><strong>{snapshot.review.length}</strong></p>
                  <p><i className="risk"/><span>High Impact</span><strong>{snapshot.highRisk.length}</strong></p>
                </div>
              </div>
            </section>

            <section>
              <div className="transformPanelTitle">
                <div><span>TOP RULE CATEGORIES</span><h2>Plan Composition</h2></div>
              </div>
              <div className="transformCategoryRows">
                {categoryEntries.slice(0, 5).map(([category, count]) => (
                  <div key={category}><GitBranch size={13}/><span>{category.replaceAll("_", " ")}</span><strong>{count}</strong></div>
                ))}
                {!categoryEntries.length && (
                  <div><Clock3 size={13}/><span>No rule categories yet</span><strong>0</strong></div>
                )}
              </div>
            </section>
          </div>
        </div>
      )}

      {view === "INTELLIGENCE" && (
        <div className="transformIntelligence">
          <section className="transformIntelHero">
            <div>
              <span className="transformEyebrow">ADVANCED TRANSFORMATION INTELLIGENCE</span>
              <h2>Transformation Decision Twin</h2>
              <p>
                A read-only model of transformation rules, dependencies, impact,
                validation requirements and target previews. It explains and simulates
                transformation intent without executing target writes.
              </p>
            </div>
            <span className="transformStatus safe"><ShieldCheck size={13}/>READ ONLY</span>
          </section>

          <div className="transformIntelCards">
            <article><Sparkles size={18}/><span>Plan Confidence</span><strong>{snapshot.confidence}%</strong><small>Derived from current plan risk/review state</small></article>
            <article><GitBranch size={18}/><span>Rule Categories</span><strong>{categoryEntries.length}</strong><small>Transformation patterns identified</small></article>
            <article><FileCheck2 size={18}/><span>Validation Rules</span><strong>{snapshot.validationRules.length}</strong><small>Reference and validation-aware steps</small></article>
            <article><AlertTriangle size={18}/><span>High Impact</span><strong>{snapshot.highRisk.length}</strong><small>Preserved for governed review</small></article>
          </div>

          <section className="transformDecisionFlow">
            <div><span>DISCOVERY</span><strong>{snapshot.plan.length} plan items</strong></div>
            <ArrowRight size={16}/>
            <div><span>RULE ANALYSIS</span><strong>{categoryEntries.length} categories</strong></div>
            <ArrowRight size={16}/>
            <div><span>IMPACT</span><strong>{snapshot.highRisk.length} high-impact</strong></div>
            <ArrowRight size={16}/>
            <div><span>VALIDATION</span><strong>{snapshot.validationRules.length} validation rules</strong></div>
            <ArrowRight size={16}/>
            <div><span>TARGET PREVIEW</span><strong>READ ONLY</strong></div>
          </section>

          <div className="transformSafetyBanner">
            <ShieldCheck size={15}/>
            <span>
              Transformation Intelligence is advisory and read-only. Existing Rule Editor,
              Test Sample, Apply & Revalidate, discovery contracts and downstream validation
              remain authoritative. Target writes and production actions are not enabled.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

