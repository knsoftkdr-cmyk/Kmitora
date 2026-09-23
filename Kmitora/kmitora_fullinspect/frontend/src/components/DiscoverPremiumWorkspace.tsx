import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Database,
  GitBranch,
  Layers3,
  Network,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import A000DigitalTwinPanel from "./A000DigitalTwinPanel";
import type { MigrationSystem } from "../models/MigrationTopology";
import type { KnowledgeItem } from "../models/KnowledgeContext";
import "../styles/discover-premium-workspace.css";
import "../styles/discover-control-tower-typography.css";

type DiscoverView =
  | "OVERVIEW"
  | "STRUCTURE"
  | "ACTIVITY"
  | "DIGITAL_TWIN"
  | "DETAILS";

type Props = {
  result: any;
  loading: boolean;
  error: string;
  traceId: string;
  onRunDiscovery: () => void | Promise<void>;
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function textOf(element: Element) {
  return (element.textContent ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function hasAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function safeArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

export default function DiscoverPremiumWorkspace({
  result,
  loading,
  error,
  traceId,
  onRunDiscovery,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<DiscoverView>("OVERVIEW");
  const [refreshToken, setRefreshToken] = useState(0);

  const summary = result?.summary ?? {};
  const entities = safeArray(result?.source?.entities);
  const relationships = safeArray(result?.relationships);
  const rules = safeArray(result?.business_rules);
  const mappings = safeArray(result?.suggested_mappings);
  const transformations = safeArray(result?.transformation_plan);

  const snapshot = useMemo(() => {
    const sources = readJson<MigrationSystem[]>("kmitora.dev.sources", []);
    const targets = readJson<MigrationSystem[]>("kmitora.dev.targets", []);
    const knowledgeItems = readJson<KnowledgeItem[]>("kmitora.dev.knowledgeItems", []);

    const sourceEntities = Number(summary.source_entity_count ?? entities.length ?? 0);
    const targetEntities = Number(summary.target_entity_count ?? 0);
    const relationshipCount = Number(summary.relationship_count ?? relationships.length ?? 0);
    const businessRuleCount = Number(summary.business_rule_count ?? rules.length ?? 0);
    const transformationCount = Number(summary.transformation_plan_count ?? transformations.length ?? 0);
    const qualityCount = Number(summary.quality_finding_count ?? 0);

    const signals = [
      sourceEntities > 0,
      relationshipCount > 0 || result != null,
      businessRuleCount > 0 || result != null,
      mappings.length > 0 || result != null,
      transformationCount > 0 || result != null,
    ];
    const coverage = result
      ? Math.round((signals.filter(Boolean).length / signals.length) * 100)
      : 0;

    return {
      sources,
      targets,
      knowledgeItems,
      sourceEntities,
      targetEntities,
      relationshipCount,
      businessRuleCount,
      transformationCount,
      qualityCount,
      coverage,
    };
  }, [result, refreshToken, summary, entities.length, relationships.length, rules.length, mappings.length, transformations.length]);

  useEffect(() => {
    const host = rootRef.current;
    const page = host?.closest(".page") as HTMLElement | null;
    if (!page || !host) return;

    const directChildren = Array.from(page.children).filter(
      (element) => element !== host
    ) as HTMLElement[];

    const pageTitle = page.querySelector(":scope > .pageTitle") as HTMLElement | null;

    const reset = () => {
      directChildren.forEach((element) => {
        element.style.display = "";
      });
      if (pageTitle) pageTitle.style.display = "none";
    };

    reset();

    if (view === "OVERVIEW" || view === "DIGITAL_TWIN") {
      directChildren.forEach((element) => {
        element.style.display = "none";
      });
      return reset;
    }

    const showOnly = (terms: string[]) => {
      directChildren.forEach((element) => {
        if (element === pageTitle) {
          element.style.display = "none";
          return;
        }
        const text = textOf(element);
        element.style.display = hasAny(text, terms) ? "" : "none";
      });

      const visible = directChildren.filter(
        (element) => element !== pageTitle && element.style.display !== "none"
      );

      if (!visible.length) {
        directChildren.forEach((element) => {
          if (element !== pageTitle) element.style.display = "";
        });
      }
    };

    if (view === "STRUCTURE") {
      showOnly([
        "source system structure",
        "source system digital twin",
        "entities",
        "relationships",
        "dependencies",
        "business entities",
      ]);
    }

    if (view === "ACTIVITY") {
      showOnly([
        "discovery activity",
        "schemas discovered",
        "relationships analyzed",
        "business entities inferred",
        "data quality",
        "application dependency",
      ]);
    }

    if (view === "DETAILS") {
      showOnly([
        "what kmitora discovered",
        "discovery health",
        "metric",
        "source entities",
        "business rules",
        "suggested mappings",
        "transformation",
        "readiness",
        "trace",
      ]);
    }

    return reset;
  }, [view, refreshToken]);

  const activity = [
    { label: "Infrastructure identified", done: Boolean(result) },
    { label: "Schemas discovered", done: snapshot.sourceEntities > 0 },
    { label: "Relationships analyzed", done: Boolean(result) },
    { label: "Business rules inferred", done: Boolean(result) },
    { label: "Mapping candidates generated", done: mappings.length > 0 },
    { label: "Transformation plan prepared", done: transformations.length > 0 },
  ];

  return (
    <div className="discoverPremium" ref={rootRef}>
      <div className="discoverPremiumHeader">
        <div>
          <span className="discoverPremiumEyebrow">STEP 02 · DISCOVERY</span>
          <h1>Discover Explorer</h1>
          <p>
            Understand business systems, applications, data, infrastructure,
            dependencies and migration readiness from one governed workspace.
          </p>
          <div className="discoverPremiumActions">
            <button
              type="button"
              className="primary"
              onClick={() => void onRunDiscovery()}
              disabled={loading}
            >
              {loading ? <RefreshCw size={14} className="spin" /> : <Play size={14} />}
              {loading ? "Discovering..." : "Run Discovery"}
            </button>
            <span className="discoverReadOnly">
              <ShieldCheck size={13} />
              Read-only discovery
            </span>
            {result?.status && (
              <span className="discoverStatus success">
                {String(result.status).replaceAll("_", " ")}
              </span>
            )}
          </div>
        </div>

        <div className="discoverPremiumHeaderMeta">
          <span>Environment</span>
          <strong>DEV</strong>
          <small>Production migration disabled</small>
        </div>
      </div>

      <nav className="discoverPremiumTabs" aria-label="Discover workspace">
        {([
          ["OVERVIEW", "Overview", Layers3],
          ["STRUCTURE", "System Structure", GitBranch],
          ["ACTIVITY", "Discovery Activity", Activity],
          ["DIGITAL_TWIN", "Digital Twins", Boxes],
          ["DETAILS", "Discovery Details", Database],
        ] as Array<[DiscoverView, string, typeof Layers3]>).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            className={view === id ? "active" : ""}
            onClick={() => setView(id)}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
        <button
          type="button"
          className="refresh"
          onClick={() => setRefreshToken((value) => value + 1)}
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </nav>

      {error && (
        <div className="discoverPremiumError">
          <AlertTriangle size={15} />
          <span>{error}</span>
        </div>
      )}

      {view === "OVERVIEW" && (
        <div className="discoverOverview">
          <section className="discoverResultsStrip">
            <article>
              <Database size={17} />
              <div><span>Source Entities</span><strong>{snapshot.sourceEntities}</strong><small>Discovered source structures</small></div>
            </article>
            <article>
              <GitBranch size={17} />
              <div><span>Relationships</span><strong>{snapshot.relationshipCount}</strong><small>Analyzed dependencies</small></div>
            </article>
            <article>
              <Workflow size={17} />
              <div><span>Business Rules</span><strong>{snapshot.businessRuleCount}</strong><small>Business logic signals</small></div>
            </article>
            <article>
              <Sparkles size={17} />
              <div><span>Transformations</span><strong>{snapshot.transformationCount}</strong><small>Plan candidates</small></div>
            </article>
            <article>
              <ShieldCheck size={17} />
              <div><span>Coverage</span><strong>{snapshot.coverage}%</strong><small>Discovery readiness score</small></div>
            </article>
          </section>

          <section className="discoverLiveMetrics">
            <div className="discoverSectionTitle">
              <div><h2>Live Discovery Metrics</h2><p>Current structural and migration-readiness signals.</p></div>
            </div>
            <div className="discoverMetricGrid">
              <div><Network size={15}/><span>Systems Connected</span><strong>{snapshot.sources.length}</strong></div>
              <div><Database size={15}/><span>Target Systems</span><strong>{snapshot.targets.length}</strong></div>
              <div><GitBranch size={15}/><span>Relationships</span><strong>{snapshot.relationshipCount}</strong></div>
              <div><Workflow size={15}/><span>Mappings</span><strong>{mappings.length}</strong></div>
              <div><AlertTriangle size={15}/><span>Quality Findings</span><strong>{snapshot.qualityCount}</strong></div>
              <div><CheckCircle2 size={15}/><span>Discovery Status</span><strong>{result ? "READY" : "WAITING"}</strong></div>
            </div>
          </section>

          <div className="discoverMainGrid">
            <section className="discoverStructureCard">
              <div className="discoverSectionTitle">
                <div>
                  <h2>Source System Structure and Progress</h2>
                  <p>Interactive enterprise discovery twin derived from the latest discovery state.</p>
                </div>
                <button type="button" onClick={() => setView("STRUCTURE")}>Expand View</button>
              </div>

              <div className="discoverGraph">
                <div className="graphColumn">
                  <span className="graphNode blue">SOURCE</span>
                  <small>{snapshot.sources.length || 1} connected</small>
                </div>
                <div className="graphLine" />
                <div className="graphColumn">
                  <span className="graphNode purple">ENTITIES</span>
                  <small>{snapshot.sourceEntities} discovered</small>
                </div>
                <div className="graphLine" />
                <div className="graphColumn">
                  <span className="graphNode teal">RELATIONSHIPS</span>
                  <small>{snapshot.relationshipCount} mapped</small>
                </div>
                <div className="graphLine" />
                <div className="graphColumn">
                  <span className="graphNode green">TARGET VIEW</span>
                  <small>{snapshot.targetEntities || snapshot.targets.length} modeled</small>
                </div>
              </div>

              <div className="discoverProgressRow">
                <div><span>Scanned</span><strong>{snapshot.sourceEntities}</strong><i><b style={{width: result ? "100%" : "0%"}} /></i></div>
                <div><span>Identified</span><strong>{entities.length}</strong><i><b style={{width: `${snapshot.coverage}%`}} /></i></div>
                <div><span>Mapped</span><strong>{mappings.length}</strong><i><b style={{width: mappings.length ? "75%" : "0%"}} /></i></div>
                <div><span>Validated</span><strong>{result ? "Yes" : "No"}</strong><i><b style={{width: result ? "62%" : "0%"}} /></i></div>
              </div>
            </section>

            <section className="discoverActivityCard">
              <div className="discoverSectionTitle">
                <div><h2>Discovery Activity</h2><p>Latest steps and governed signals.</p></div>
                <button type="button" onClick={() => setView("ACTIVITY")}>View All</button>
              </div>
              <div className="discoverActivityList">
                {activity.map((item) => (
                  <div key={item.label}>
                    {item.done ? <CheckCircle2 size={14}/> : <RefreshCw size={14}/>}
                    <span>{item.label}</span>
                    <small>{item.done ? "Completed" : "Pending"}</small>
                  </div>
                ))}
              </div>

              <div className="discoverTrace">
                <span>Trace ID</span>
                <strong>{traceId || "Not available"}</strong>
              </div>
            </section>
          </div>

          <section className="discoverBottomKpis">
            <article><Layers3 size={16}/><div><span>Discovered Domains</span><strong>{entities.length ? Math.max(1, Math.min(entities.length, 6)) : 0}</strong></div></article>
            <article><Database size={16}/><div><span>Schema Inventory</span><strong>{snapshot.sourceEntities}</strong></div></article>
            <article><Boxes size={16}/><div><span>Source Objects</span><strong>{entities.length}</strong></div></article>
            <article><GitBranch size={16}/><div><span>Dependencies</span><strong>{snapshot.relationshipCount}</strong></div></article>
            <article><ShieldCheck size={16}/><div><span>Discovery Coverage</span><strong>{snapshot.coverage}%</strong></div></article>
          </section>
        </div>
      )}

      {view === "DIGITAL_TWIN" && (
        <div className="discoverDigitalTwinView">
          <div className="discoverTwinIntro">
            <div>
              <span className="discoverPremiumEyebrow">ADVANCED DIGITAL TWINS</span>
              <h2>Enterprise Discovery Twin</h2>
              <p>
                Reuse KMITORA's existing read-only enterprise digital twin to model F1 current state,
                F2 future state and migration impact before execution.
              </p>
            </div>
            <span className="discoverStatus success">READ-ONLY SIMULATION</span>
          </div>

          <A000DigitalTwinPanel
            sources={snapshot.sources}
            targets={snapshot.targets}
            knowledgeItems={snapshot.knowledgeItems}
            problemPrompt="Analyze discovery structure, dependencies, data quality and business-rule impact."
            migrationPrompt="Prepare read-only migration twin analysis from the latest discovery state."
          />

          <div className="discoverTwinSafety">
            <div><ShieldCheck size={15}/><span>Target production writes</span><strong>0</strong></div>
            <div><Activity size={15}/><span>Production actions</span><strong>0</strong></div>
            <div><Sparkles size={15}/><span>Simulation mode</span><strong>READ ONLY</strong></div>
          </div>
        </div>
      )}
    </div>
  );
}

