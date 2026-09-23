import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  GitBranch,
  Layers3,
  Link2,
  Network,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import "../styles/mapping-premium-workspace.css";

type MappingView =
  | "OVERVIEW"
  | "WORKSPACE"
  | "CANDIDATES"
  | "RULES"
  | "REVIEW"
  | "INTELLIGENCE";

type RawMapping = {
  source?: string;
  source_entity?: string;
  source_field?: string;
  target?: string;
  target_entity?: string;
  target_field?: string;
  action?: string;
  decision?: string;
  confidence?: number;
  rule?: string;
  business_rule?: string;
};

type NormalizedMapping = {
  source: string;
  target: string;
  decision: string;
  confidence: number;
  rule: string;
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeConfidence(value: unknown): number {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, numeric <= 1 ? numeric * 100 : numeric));
}

function normalizeMapping(item: RawMapping): NormalizedMapping {
  const source =
    item.source ??
    [item.source_entity, item.source_field].filter(Boolean).join(".") ??
    "";
  const target =
    item.target ??
    [item.target_entity, item.target_field].filter(Boolean).join(".") ??
    "";

  return {
    source: source || "SOURCE.FIELD",
    target: target || "TARGET.FIELD",
    decision: String(item.decision ?? item.action ?? "REVIEW").toUpperCase(),
    confidence: Math.round(normalizeConfidence(item.confidence)),
    rule: String(item.rule ?? item.business_rule ?? "Governed rule"),
  };
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

export default function MappingPremiumWorkspace() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<MappingView>("OVERVIEW");
  const [selected, setSelected] = useState(0);
  const [refreshToken, setRefreshToken] = useState(0);

  const snapshot = useMemo(() => {
    const discovery = readJson<any>("kmitora.dev.discoveryResult", null);
    const rawMappings = safeArray<RawMapping>(discovery?.suggested_mappings);
    const mappings = rawMappings.map(normalizeMapping);

    const safe = mappings.filter(
      (item) =>
        item.confidence >= 90 &&
        !item.decision.includes("REVIEW") &&
        !item.decision.includes("RELATIONSHIP") &&
        !item.decision.includes("REJECT") &&
        !item.decision.includes("BLOCK")
    );

    const review = mappings.filter(
      (item) =>
        item.confidence < 90 ||
        item.decision.includes("REVIEW") ||
        item.decision.includes("RELATIONSHIP")
    );

    const blocked = mappings.filter(
      (item) =>
        item.decision.includes("REJECT") || item.decision.includes("BLOCK")
    );

    const governed = readJson<any[]>("kmitora.dev.safeMappings", []);
    const averageConfidence = mappings.length
      ? Math.round(
          mappings.reduce((sum, item) => sum + item.confidence, 0) /
            mappings.length
        )
      : 0;

    const uniqueRules = new Set(
      mappings.map((item) => item.rule).filter((rule) => Boolean(rule))
    ).size;

    return {
      discovery,
      mappings,
      safe,
      review,
      blocked,
      governed,
      averageConfidence,
      uniqueRules,
      migrationId:
        discovery?.migration_id ??
        localStorage.getItem("kmitora.dev.migrationId") ??
        "Not available",
    };
  }, [refreshToken]);

  useEffect(() => {
    if (selected >= snapshot.mappings.length) setSelected(0);
  }, [selected, snapshot.mappings.length]);

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

    if (view === "WORKSPACE") {
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
      Exclude<MappingView, "OVERVIEW" | "WORKSPACE" | "INTELLIGENCE">,
      string[]
    > = {
      CANDIDATES: [
        "mapping decisions",
        "source-to-target",
        "mapping candidates",
        "source",
        "target",
        "confidence",
      ],
      RULES: [
        "governed mapping contract",
        "rule",
        "business rule",
        "decision context",
        "direct_map",
        "normalize",
        "relationship_only",
      ],
      REVIEW: [
        "human review",
        "review required",
        "requires review",
        "approval-gated",
        "blocked / rejected",
        "review mappings",
      ],
    };

    const terms = termsByView[view as keyof typeof termsByView];

    directChildren.forEach((element) => {
      const text = textOf(element);
      element.style.display = containsAny(text, terms) ? "" : "none";
    });

    const visible = directChildren.filter(
      (element) => element.style.display !== "none"
    );

    // Fail open: if a future MapPage structure no longer matches our
    // presentation classifier, preserve the original business UI.
    if (!visible.length) reset();

    return reset;
  }, [view]);

  const selectedMapping = snapshot.mappings[selected] ?? null;
  const mappedCount = snapshot.mappings.length - snapshot.blocked.length;
  const safePercent = snapshot.mappings.length
    ? Math.round((snapshot.safe.length / snapshot.mappings.length) * 100)
    : 0;
  const reviewPercent = snapshot.mappings.length
    ? Math.round((snapshot.review.length / snapshot.mappings.length) * 100)
    : 0;

  return (
    <div className="mappingPremium" ref={rootRef}>
      <header className="mappingPremiumHeader">
        <div>
          <span className="mappingPremiumEyebrow">STEP 03 · GOVERNED MAPPING</span>
          <div className="mappingTitleRow">
            <h1>Mapping Studio</h1>
            <span className="mappingStatusPill">
              <ShieldCheck size={13} />
              Governed Mapping
            </span>
          </div>
          <p>
            Review source-to-target mappings with confidence, business-rule,
            decision and human-review context while keeping production changes disabled.
          </p>
          <div className="mappingSafetyRow">
            <span><ShieldCheck size={13}/>Review mappings remain governed</span>
            <span><GitBranch size={13}/>Decision context remains visible</span>
            <span><CheckCircle2 size={13}/>No production changes executed</span>
          </div>
        </div>

        <div className="mappingHeaderActions">
          <div className="mappingRun">
            <small>Mapping Run</small>
            <strong>{snapshot.migrationId}</strong>
          </div>
          <button type="button" onClick={() => setView("WORKSPACE")}>
            <WandSparkles size={14} />
            Safe Mapping Controls
          </button>
        </div>
      </header>

      <section className="mappingKpiStrip">
        <article>
          <span>Total Mappings</span>
          <strong>{snapshot.mappings.length}</strong>
          <small>Discovery candidates</small>
        </article>
        <article>
          <span>Mapped</span>
          <strong>{mappedCount}</strong>
          <small>{snapshot.mappings.length ? `${Math.round((mappedCount / snapshot.mappings.length) * 100)}%` : "0%"}</small>
        </article>
        <article>
          <span>Safe Candidates</span>
          <strong>{snapshot.safe.length}</strong>
          <small>{safePercent}% high confidence</small>
        </article>
        <article>
          <span>Needs Review</span>
          <strong>{snapshot.review.length}</strong>
          <small>{reviewPercent}% governed review</small>
        </article>
        <article>
          <span>Blocked / Rejected</span>
          <strong>{snapshot.blocked.length}</strong>
          <small>Never auto-resolved</small>
        </article>
        <article className="confidenceKpi">
          <span>Mapping Confidence</span>
          <div className="mappingConfidenceRing" style={{"--score": `${snapshot.averageConfidence * 3.6}deg`} as CSSProperties}>
            <strong>{snapshot.averageConfidence}%</strong>
          </div>
        </article>
      </section>

      <nav className="mappingPremiumTabs" aria-label="Mapping workspace">
        {([
          ["OVERVIEW", "Mapping Workspace", Layers3],
          ["WORKSPACE", "Governed Controls", ShieldCheck],
          ["CANDIDATES", `Mapping Candidates (${snapshot.mappings.length})`, Link2],
          ["RULES", `Rule Library (${snapshot.uniqueRules})`, GitBranch],
          ["REVIEW", `Review Queue (${snapshot.review.length})`, AlertTriangle],
          ["INTELLIGENCE", "Mapping Intelligence", Sparkles],
        ] as Array<[MappingView, string, typeof Layers3]>).map(([id, label, Icon]) => (
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
          className="mappingRefresh"
          onClick={() => setRefreshToken((value) => value + 1)}
        >
          <RefreshCw size={13}/>
          Refresh
        </button>
      </nav>

      {view === "OVERVIEW" && (
        <div className="mappingOverview">
          <div className="mappingWorkspaceGrid">
            <aside className="mappingObjectPanel">
              <div className="mappingPanelTitle">
                <div>
                  <span>SOURCE SYSTEM</span>
                  <h2>Discovered Objects</h2>
                </div>
                <span className="mappingCountBadge">{snapshot.mappings.length}</span>
              </div>

              <div className="mappingObjectSearch">Search source fields...</div>

              <div className="mappingObjectList">
                {snapshot.mappings.slice(0, 8).map((mapping, index) => (
                  <button
                    type="button"
                    key={`${mapping.source}-${index}`}
                    className={selected === index ? "selected" : ""}
                    onClick={() => setSelected(index)}
                  >
                    <span>{mapping.source}</span>
                    <small>{mapping.confidence}%</small>
                  </button>
                ))}
                {!snapshot.mappings.length && (
                  <div className="mappingEmpty">
                    <Network size={20}/>
                    <strong>No Mapping Candidates</strong>
                    <span>Run Discovery to generate governed mapping candidates.</span>
                  </div>
                )}
              </div>
            </aside>

            <main className="mappingCanvasPanel">
              <div className="mappingCanvasToolbar">
                <div>
                  <span>View</span>
                  <strong>Smart Mapping</strong>
                </div>
                <div>
                  <span>Show</span>
                  <strong>All Mappings</strong>
                </div>
                <button type="button" onClick={() => setView("WORKSPACE")}>
                  Open Full Mapping Controls
                </button>
              </div>

              <div className="mappingCanvasLabels">
                <span>SOURCE</span>
                <strong>{mappedCount} mapped</strong>
                <span>TARGET</span>
              </div>

              <div className="mappingCanvasRows">
                {snapshot.mappings.slice(0, 7).map((mapping, index) => {
                  const safe = snapshot.safe.some(
                    (item) =>
                      item.source === mapping.source &&
                      item.target === mapping.target
                  );
                  const blocked = snapshot.blocked.some(
                    (item) =>
                      item.source === mapping.source &&
                      item.target === mapping.target
                  );
                  return (
                    <button
                      type="button"
                      key={`${mapping.source}-${mapping.target}-${index}`}
                      className={selected === index ? "selected" : ""}
                      onClick={() => setSelected(index)}
                    >
                      <span className="mappingNode sourceNode">
                        <strong>{mapping.source}</strong>
                        <small>{mapping.decision}</small>
                      </span>
                      <span className="mappingConnector">
                        <i />
                        <b className={blocked ? "blocked" : safe ? "safe" : "review"}>
                          {blocked ? "!" : safe ? "âœ“" : "?"}
                        </b>
                        <i />
                      </span>
                      <span className="mappingNode targetNode">
                        <strong>{mapping.target}</strong>
                        <small>{mapping.confidence}% confidence</small>
                      </span>
                    </button>
                  );
                })}

                {!snapshot.mappings.length && (
                  <div className="mappingCanvasEmpty">
                    <GitBranch size={24}/>
                    <h3>Mapping canvas waiting for Discovery</h3>
                    <p>
                      Existing Mapping Studio logic remains available under Governed Controls.
                    </p>
                  </div>
                )}
              </div>

              <div className="mappingLegend">
                <span><i className="safe"/>Safe candidate</span>
                <span><i className="review"/>Needs review</span>
                <span><i className="blocked"/>Blocked / rejected</span>
                <span><ShieldCheck size={12}/>Governed decision</span>
              </div>
            </main>

            <aside className="mappingDetailPanel">
              <div className="mappingPanelTitle">
                <div>
                  <span>MAPPING DETAILS</span>
                  <h2>{selectedMapping ? `${selectedMapping.source} â†’ ${selectedMapping.target}` : "Select a mapping"}</h2>
                </div>
              </div>

              {selectedMapping ? (
                <>
                  <dl className="mappingDetails">
                    <div><dt>Decision</dt><dd>{selectedMapping.decision}</dd></div>
                    <div><dt>Confidence</dt><dd>{selectedMapping.confidence}%</dd></div>
                    <div><dt>Rule</dt><dd>{selectedMapping.rule}</dd></div>
                    <div><dt>Governance</dt><dd>Controlled</dd></div>
                    <div><dt>Production Action</dt><dd>Disabled</dd></div>
                  </dl>

                  <div className="mappingAiRecommendation">
                    <span><Sparkles size={13}/>KMITORA MAPPING INTELLIGENCE</span>
                    <p>
                      {selectedMapping.confidence >= 90 &&
                      !selectedMapping.decision.includes("REVIEW")
                        ? "High-confidence candidate. Use the existing governed controls to apply safe resolution."
                        : "Human review remains required before this candidate can advance."}
                    </p>
                  </div>

                  <button
                    type="button"
                    className="mappingPrimaryWide"
                    onClick={() => setView("WORKSPACE")}
                  >
                    Review in Governed Controls
                    <ArrowRight size={14}/>
                  </button>
                </>
              ) : (
                <div className="mappingNoSelection">
                  Select a discovered mapping to review its decision context.
                </div>
              )}
            </aside>
          </div>

          <div className="mappingBottomGrid">
            <section>
              <div className="mappingPanelTitle">
                <div><span>MAPPING ACTIVITY</span><h2>Current Mapping State</h2></div>
                <span className="mappingLiveBadge">LIVE</span>
              </div>
              <div className="mappingActivityRows">
                <div><CheckCircle2 size={13}/><span>Discovery candidates loaded</span><strong>{snapshot.mappings.length}</strong></div>
                <div><ShieldCheck size={13}/><span>Safe candidates identified</span><strong>{snapshot.safe.length}</strong></div>
                <div><AlertTriangle size={13}/><span>Review candidates retained</span><strong>{snapshot.review.length}</strong></div>
              </div>
            </section>

            <section>
              <div className="mappingPanelTitle">
                <div><span>STATUS DISTRIBUTION</span><h2>Mapping Readiness</h2></div>
              </div>
              <div className="mappingStatusSummary">
                <div className="mappingDonut" style={{"--safe": `${safePercent * 3.6}deg`, "--review": `${(safePercent + reviewPercent) * 3.6}deg`} as CSSProperties}>
                  <strong>{snapshot.mappings.length}</strong>
                  <span>Total</span>
                </div>
                <div>
                  <p><i className="safe"/><span>Safe</span><strong>{snapshot.safe.length}</strong></p>
                  <p><i className="review"/><span>Review</span><strong>{snapshot.review.length}</strong></p>
                  <p><i className="blocked"/><span>Blocked</span><strong>{snapshot.blocked.length}</strong></p>
                </div>
              </div>
            </section>

            <section>
              <div className="mappingPanelTitle">
                <div><span>GOVERNANCE</span><h2>Potential Issues</h2></div>
                <span className="mappingCountBadge">{snapshot.review.length + snapshot.blocked.length}</span>
              </div>
              <div className="mappingIssueRows">
                <div><AlertTriangle size={13}/><span>Mappings requiring review</span><strong>{snapshot.review.length}</strong></div>
                <div><AlertTriangle size={13}/><span>Blocked or rejected mappings</span><strong>{snapshot.blocked.length}</strong></div>
                <div><ShieldCheck size={13}/><span>Production execution</span><strong>DISABLED</strong></div>
              </div>
            </section>
          </div>
        </div>
      )}

      {view === "INTELLIGENCE" && (
        <div className="mappingIntelligence">
          <section className="mappingIntelHero">
            <div>
              <span className="mappingPremiumEyebrow">ADVANCED MAPPING INTELLIGENCE</span>
              <h2>Semantic Mapping Decision Twin</h2>
              <p>
                A read-only decision model of source, target, confidence, rules and review
                state. It explains mapping risk and readiness without changing mapping
                decisions or executing production actions.
              </p>
            </div>
            <span className="mappingStatusPill"><ShieldCheck size={13}/>READ ONLY</span>
          </section>

          <div className="mappingIntelCards">
            <article><Sparkles size={18}/><span>Average Confidence</span><strong>{snapshot.averageConfidence}%</strong><small>Across discovered candidates</small></article>
            <article><GitBranch size={18}/><span>Rule Coverage</span><strong>{snapshot.uniqueRules}</strong><small>Distinct governed rule signals</small></article>
            <article><ShieldCheck size={18}/><span>Governed Safe Set</span><strong>{snapshot.governed.length}</strong><small>Existing safeMappings state</small></article>
            <article><AlertTriangle size={18}/><span>Human Review</span><strong>{snapshot.review.length}</strong><small>Preserved for authoritative review</small></article>
          </div>

          <section className="mappingDecisionFlow">
            <div><span>DISCOVERY</span><strong>{snapshot.mappings.length} candidates</strong></div>
            <ArrowRight size={16}/>
            <div><span>CONFIDENCE</span><strong>{snapshot.averageConfidence}% average</strong></div>
            <ArrowRight size={16}/>
            <div><span>BUSINESS RULES</span><strong>{snapshot.uniqueRules} signals</strong></div>
            <ArrowRight size={16}/>
            <div><span>GOVERNANCE</span><strong>{snapshot.review.length} review</strong></div>
            <ArrowRight size={16}/>
            <div><span>SAFE SET</span><strong>{snapshot.safe.length} candidates</strong></div>
          </section>

          <div className="mappingSafetyBanner">
            <Activity size={15}/>
            <span>
              Mapping Intelligence is advisory/read-only. Existing MapPage decisions,
              Auto-resolve Safe Mappings behavior, approval gates and downstream business
              flow remain authoritative.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

