import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Database,
  GitBranch,
  Link2,
  Network,
  RefreshCw,
  Search,
  Server,
  Settings2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import "../styles/system-explorer-premium.css";

type ExplorerView =
  | "OVERVIEW"
  | "LEGACY"
  | "TOPOLOGY"
  | "RELATIONSHIPS"
  | "INVENTORY"
  | "AUTOMATION"
  | "INTELLIGENCE";

type SystemLike = {
  id?: string;
  name?: string;
  role?: string;
  connector?: string;
  category?: string;
  path?: string;
  pattern?: string;
  status?: string;
};

type RelationshipLike = {
  sourceSystemId?: string;
  targetSystemId?: string;
  source?: string;
  target?: string;
  status?: string;
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

function textOf(el: Element) {
  return (el.textContent ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function includesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function systemLabel(system: SystemLike, index: number, role: "SOURCE" | "TARGET") {
  return (
    system.name ??
    system.id ??
    `${role === "SOURCE" ? "Source" : "Target"} ${index + 1}`
  );
}

function normalizeStatus(value: unknown, fallback = "NOT_CONFIGURED") {
  const raw = String(value ?? fallback).trim();
  return raw ? raw.toUpperCase().replaceAll(" ", "_") : fallback;
}

export default function SystemExplorerPremiumWorkspace() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<ExplorerView>("OVERVIEW");
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"ALL" | "SOURCE" | "TARGET">("ALL");
  const [refreshToken, setRefreshToken] = useState(0);

  const snapshot = useMemo(() => {
    const sources = safeArray<SystemLike>(readJson("kmitora.dev.sources", []));
    const targets = safeArray<SystemLike>(readJson("kmitora.dev.targets", []));
    const workflow = readJson<any>("kmitora.dev.workflowState", null);
    const discoveryResults = safeArray<any>(readJson("kmitora.dev.discoveryResults", []));
    const discovery = readJson<any>("kmitora.dev.discoveryResult", null);
    const topologyType =
      localStorage.getItem("kmitora.dev.topologyType") ?? "ONE_TO_ONE";

    const relationshipResults = safeArray<any>(workflow?.results);

    let relationships = safeArray<RelationshipLike>(
      readJson("kmitora.dev.relationships", [])
    );

    if (!relationships.length && relationshipResults.length) {
      relationships = relationshipResults.map((item) => ({
        sourceSystemId: item?.sourceSystemId,
        targetSystemId: item?.targetSystemId,
        status: item?.status,
      }));
    }

    if (!relationships.length && sources.length && targets.length) {
      relationships = sources.flatMap((source) =>
        targets.map((target) => ({
          sourceSystemId: source.id,
          targetSystemId: target.id,
          status: "CONFIGURED",
        }))
      );
    }

    const discoveredCount =
      Number(workflow?.discoveredRelationships ?? 0) ||
      relationshipResults.filter(
        (item) => normalizeStatus(item?.status) === "DISCOVERED"
      ).length;

    const waitingCount = relationshipResults.filter((item) =>
      ["WAITING", "QUEUED", "DISCOVERY_QUEUED", "DISCOVERY_RUNNING"].includes(
        normalizeStatus(item?.status)
      )
    ).length;

    const failedCount =
      Number(workflow?.failedRelationships ?? 0) ||
      relationshipResults.filter(
        (item) => normalizeStatus(item?.status) === "FAILED"
      ).length;

    const adapterWaitingCount = relationshipResults.filter((item) =>
      ["SKIPPED", "ADAPTER_WAITING", "WAITING_FOR_ADAPTER"].includes(
        normalizeStatus(item?.status)
      )
    ).length;

    const validatedSources = sources.filter((item) =>
      ["VALIDATED", "CONNECTED", "READY"].includes(normalizeStatus(item.status))
    ).length;
    const validatedTargets = targets.filter((item) =>
      ["VALIDATED", "CONNECTED", "READY"].includes(normalizeStatus(item.status))
    ).length;

    const systemTotal = sources.length + targets.length;
    const validatedTotal = validatedSources + validatedTargets;
    const connectionCoverage = systemTotal
      ? Math.round((validatedTotal / systemTotal) * 100)
      : 0;

    const relationshipTotal = relationships.length || Number(workflow?.totalRelationships ?? 0);
    const discoveryCoverage = relationshipTotal
      ? Math.round((discoveredCount / relationshipTotal) * 100)
      : 0;

    const sourceObjects =
      Number(discovery?.summary?.source_entity_count ?? 0);
    const targetObjects =
      Number(discovery?.summary?.target_entity_count ?? 0);
    const businessRules = safeArray<any>(discovery?.business_rules).length;

    const workflowStatus = normalizeStatus(
      workflow?.status ?? workflow?.currentStage ?? "WAITING_FOR_CONNECTIONS"
    );

    const automationConfigured =
      Boolean(workflow) &&
      !["WAITING_FOR_CONNECTIONS", "NOT_CONFIGURED", "IDLE"].includes(workflowStatus);

    return {
      sources,
      targets,
      relationships,
      workflow,
      discoveryResults,
      discovery,
      topologyType,
      discoveredCount,
      waitingCount,
      failedCount,
      adapterWaitingCount,
      validatedSources,
      validatedTargets,
      validatedTotal,
      connectionCoverage,
      relationshipTotal,
      discoveryCoverage,
      sourceObjects,
      targetObjects,
      businessRules,
      workflowStatus,
      automationConfigured,
    };
  }, [refreshToken]);

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

    if (view === "LEGACY") {
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
      Exclude<ExplorerView, "OVERVIEW" | "LEGACY" | "INTELLIGENCE">,
      string[]
    > = {
      TOPOLOGY: ["current enterprise topology", "topology map", "source", "target"],
      RELATIONSHIPS: ["source → target relationships", "relationships", "relationship discovery state"],
      INVENTORY: ["system inventory", "search the current landscape", "source systems", "target systems"],
      AUTOMATION: ["automation coverage", "workflow", "discovery automation state", "adapter"],
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

  const filteredSystems = useMemo(() => {
    const q = query.trim().toLowerCase();

    return [
      ...snapshot.sources.map((system, index) => ({
        ...system,
        __role: "SOURCE" as const,
        __label: systemLabel(system, index, "SOURCE"),
      })),
      ...snapshot.targets.map((system, index) => ({
        ...system,
        __role: "TARGET" as const,
        __label: systemLabel(system, index, "TARGET"),
      })),
    ].filter((system) => {
      if (scope !== "ALL" && system.__role !== scope) return false;
      if (!q) return true;
      return [
        system.__label,
        system.id,
        system.connector,
        system.category,
        system.path,
        system.status,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [query, scope, snapshot.sources, snapshot.targets]);

  const donutDiscovered = snapshot.relationshipTotal
    ? (snapshot.discoveredCount / snapshot.relationshipTotal) * 360
    : 0;

  return (
    <div className="systemExplorerPremium" ref={rootRef}>
      <header className="seHeader">
        <div>
          <span className="seEyebrow">STEP 09 · ENTERPRISE LANDSCAPE</span>
          <div className="seTitleRow">
            <h1>System Explorer</h1>
            <span className="seStatus"><ShieldCheck size={13}/>READ ONLY</span>
          </div>
          <p>
            Explore the current KMITORA source, target, topology, relationships and
            discovery landscape using persisted DEV runtime evidence.
          </p>
          <div className="seSafetyRow">
            <span><ShieldCheck size={13}/>Read-only explorer</span>
            <span><Network size={13}/>Topology: {snapshot.sources.length} Source → {snapshot.targets.length} Target</span>
            <span><Database size={13}/>Systems: {snapshot.sources.length + snapshot.targets.length}</span>
            <span><Activity size={13}/>Workflow: {snapshot.workflowStatus}</span>
          </div>
        </div>

        <div className="seHeaderActions">
          <div className="seWorkspace">
            <small>Workspace</small>
            <strong>DEV</strong>
          </div>
          <button type="button" onClick={() => setView("LEGACY")}>
            Existing Explorer
          </button>
        </div>
      </header>

      <section className="seKpis">
        <article><Server size={18}/><span>Source Systems</span><strong>{snapshot.sources.length}</strong><small>{snapshot.validatedSources} validated</small></article>
        <article><Database size={18}/><span>Target Systems</span><strong>{snapshot.targets.length}</strong><small>{snapshot.validatedTargets} validated</small></article>
        <article><Link2 size={18}/><span>Connections</span><strong>{snapshot.validatedTotal}</strong><small>{snapshot.connectionCoverage}% coverage</small></article>
        <article><GitBranch size={18}/><span>Relationships</span><strong>{snapshot.relationshipTotal}</strong><small>{snapshot.discoveredCount} discovered</small></article>
        <article><Settings2 size={18}/><span>Automation Coverage</span><strong>{snapshot.discoveryCoverage}%</strong><small>{snapshot.automationConfigured ? snapshot.workflowStatus : "Not configured"}</small></article>
        <article><ShieldCheck size={18}/><span>Explorer State</span><strong>READ ONLY</strong><small>Immutable workspace</small></article>
      </section>

      <nav className="seTabs">
        {([
          ["OVERVIEW", "Overview", Activity],
          ["TOPOLOGY", "Topology Map", Network],
          ["RELATIONSHIPS", `Relationships (${snapshot.relationshipTotal})`, GitBranch],
          ["INVENTORY", `System Inventory (${snapshot.sources.length + snapshot.targets.length})`, Database],
          ["AUTOMATION", "Automation Coverage", Settings2],
          ["INTELLIGENCE", "Landscape Intelligence", Sparkles],
        ] as Array<[ExplorerView, string, typeof Activity]>).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            className={view === id ? "active" : ""}
            onClick={() => setView(id)}
          >
            <Icon size={14}/>{label}
          </button>
        ))}
        <button
          type="button"
          className="seRefresh"
          onClick={() => setRefreshToken((value) => value + 1)}
        >
          <RefreshCw size={13}/>Refresh
        </button>
      </nav>

      {view === "OVERVIEW" && (
        <div className="seBody">
          <div className="seTopGrid">
            <section>
              <div className="sePanelHead">
                <div><span>CURRENT ENTERPRISE TOPOLOGY</span><h2>Runtime Landscape</h2></div>
              </div>
              <div className="seMetricRows">
                <div><Server size={13}/><span>Source Systems</span><strong>{snapshot.sources.length}</strong></div>
                <div><Database size={13}/><span>Target Systems</span><strong>{snapshot.targets.length}</strong></div>
                <div><CheckCircle2 size={13}/><span>Validated Systems</span><strong>{snapshot.connectionCoverage}%</strong></div>
                <div><GitBranch size={13}/><span>Relationships</span><strong>{snapshot.relationshipTotal}</strong></div>
                <div><Activity size={13}/><span>Workflow</span><strong>{snapshot.workflowStatus}</strong></div>
              </div>
              <button type="button" className="seOutline" onClick={() => setView("TOPOLOGY")}>
                View Topology Map <ArrowRight size={13}/>
              </button>
            </section>

            <section className="seTopologyPanel">
              <div className="sePanelHead">
                <div><span>TOPOLOGY MAP</span><h2>{snapshot.topologyType.replaceAll("_", " ")}</h2></div>
                <span className="seBadge blue">READ ONLY</span>
              </div>
              <div className="seTopologyMap">
                <div className="seTopologySide">
                  <span>SOURCE</span>
                  <strong>{snapshot.sources.length} System{snapshot.sources.length === 1 ? "" : "s"}</strong>
                  <div className="seNode source">
                    <Server size={18}/>
                    <b>{snapshot.sources[0]?.id ?? "SOURCE"}</b>
                    <small>{snapshot.sources[0]?.connector ?? "Not configured"}</small>
                  </div>
                </div>
                <div className="seConnector">
                  <span>{snapshot.relationshipTotal}</span>
                  <i/>
                  <small>Relationship{snapshot.relationshipTotal === 1 ? "" : "s"}</small>
                </div>
                <div className="seTopologySide">
                  <span>TARGET</span>
                  <strong>{snapshot.targets.length} System{snapshot.targets.length === 1 ? "" : "s"}</strong>
                  <div className="seNode target">
                    <Database size={18}/>
                    <b>{snapshot.targets[0]?.id ?? "TARGET"}</b>
                    <small>{snapshot.targets[0]?.connector ?? "Not configured"}</small>
                  </div>
                </div>
              </div>
              <div className="seLegend">
                <span><i className="green"/>Validated</span>
                <span><i className="amber"/>Waiting</span>
                <span><i className="red"/>Not Configured</span>
                <span><i className="gray"/>Disabled</span>
              </div>
            </section>

            <section>
              <div className="sePanelHead">
                <div><span>RELATIONSHIP DISCOVERY STATE</span><h2>Discovery Coverage</h2></div>
              </div>
              <div className="seDonutWrap">
                <div
                  className="seDonut"
                  style={{"--discovered": `${donutDiscovered}deg`} as CSSProperties}
                >
                  <strong>{snapshot.relationshipTotal}</strong>
                  <span>Total</span>
                </div>
                <div className="seDonutLegend">
                  <p><i className="green"/><span>Discovered</span><strong>{snapshot.discoveredCount}</strong></p>
                  <p><i className="amber"/><span>Waiting</span><strong>{snapshot.waitingCount}</strong></p>
                  <p><i className="red"/><span>Failed</span><strong>{snapshot.failedCount}</strong></p>
                  <p><i className="gray"/><span>Adapter Waiting</span><strong>{snapshot.adapterWaitingCount}</strong></p>
                </div>
              </div>
              <button type="button" className="seOutline" onClick={() => setView("RELATIONSHIPS")}>
                View Details <ArrowRight size={13}/>
              </button>
            </section>
          </div>

          <div className="seMiddleGrid">
            <section>
              <div className="sePanelHead">
                <div><span>SOURCE → TARGET RELATIONSHIPS</span><h2>Configured Topology</h2></div>
                <span className={`seBadge ${snapshot.connectionCoverage === 100 ? "green" : "amber"}`}>
                  {snapshot.connectionCoverage === 100 ? "VALIDATED" : "REVIEW"}
                </span>
              </div>
              <div className="seRelationshipMap">
                <div>
                  <span>SOURCES</span>
                  <div className="seSystemCard">
                    <Server size={16}/>
                    <strong>{systemLabel(snapshot.sources[0] ?? {}, 0, "SOURCE")}</strong>
                    <small>{snapshot.sources[0]?.connector ?? "Not configured"}</small>
                    <em>{normalizeStatus(snapshot.sources[0]?.status)}</em>
                  </div>
                </div>
                <div className="seRelCenter">
                  <strong>{snapshot.relationshipTotal}</strong>
                  <span>Relationship</span>
                  <small>{snapshot.connectionCoverage}% connection coverage</small>
                </div>
                <div>
                  <span>TARGETS</span>
                  <div className="seSystemCard">
                    <Database size={16}/>
                    <strong>{systemLabel(snapshot.targets[0] ?? {}, 0, "TARGET")}</strong>
                    <small>{snapshot.targets[0]?.connector ?? "Not configured"}</small>
                    <em>{normalizeStatus(snapshot.targets[0]?.status)}</em>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <div className="sePanelHead">
                <div><span>SEARCH THE CURRENT LANDSCAPE</span><h2>System Inventory</h2></div>
              </div>
              <div className="seSearch">
                <Search size={14}/>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search systems..."
                />
              </div>
              <div className="seScopeButtons">
                {(["ALL", "SOURCE", "TARGET"] as const).map((item) => (
                  <button
                    type="button"
                    key={item}
                    className={scope === item ? "active" : ""}
                    onClick={() => setScope(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <div className="seSearchResults">
                {filteredSystems.slice(0, 4).map((system, index) => (
                  <article key={`${system.__role}-${system.id ?? index}`}>
                    {system.__role === "SOURCE" ? <Server size={14}/> : <Database size={14}/>}
                    <strong>{system.__label}</strong>
                    <small>{system.connector ?? "Not configured"}</small>
                    <em>{normalizeStatus(system.status)}</em>
                  </article>
                ))}
                {!filteredSystems.length && (
                  <div className="seEmpty">No systems match the current search.</div>
                )}
              </div>
              <button type="button" className="seOutline" onClick={() => setView("INVENTORY")}>
                Advanced Inventory <ArrowRight size={13}/>
              </button>
            </section>

            <section>
              <div className="sePanelHead">
                <div><span>AUTOMATION COVERAGE</span><h2>Workflow Automation</h2></div>
              </div>
              <div className="seAutomationRows">
                {[
                  ["Discovery Automation", snapshot.discoveryResults.length > 0 || snapshot.discoveredCount > 0],
                  ["Mapping Automation", Boolean(snapshot.discovery?.suggested_mappings?.length)],
                  ["Transformation Automation", Boolean(snapshot.discovery?.transformation_plan?.length)],
                  ["Validation Automation", Boolean(snapshot.discovery?.quality_findings)],
                  ["Migration Automation", false],
                ].map(([label, configured]) => (
                  <div key={String(label)}>
                    {configured ? <CheckCircle2 size={13}/> : <Settings2 size={13}/>}
                    <span>{label}</span>
                    <strong>{configured ? "AVAILABLE" : "NOT CONFIGURED"}</strong>
                  </div>
                ))}
              </div>
              <button type="button" className="seOutline" onClick={() => setView("AUTOMATION")}>
                View Automation State <ArrowRight size={13}/>
              </button>
            </section>
          </div>

          <section className="seInventorySnapshot">
            <div className="sePanelHead">
              <div><span>SYSTEM INVENTORY SNAPSHOT</span><h2>Current Runtime Inventory</h2></div>
            </div>
            <div className="seInventoryKpis">
              <article><strong>{snapshot.sources.length + snapshot.targets.length}</strong><span>Total Systems</span><small>{snapshot.sources.length} Source · {snapshot.targets.length} Target</small></article>
              <article><strong>{snapshot.sourceObjects}</strong><span>Source Objects</span><small>Discovered</small></article>
              <article><strong>{snapshot.targetObjects}</strong><span>Target Objects</span><small>Discovered</small></article>
              <article><strong>{snapshot.businessRules}</strong><span>Business Rules</span><small>Discovered</small></article>
              <article><strong>{snapshot.adapterWaitingCount}</strong><span>Adapters</span><small>Waiting</small></article>
              <article><strong>{snapshot.relationshipTotal}</strong><span>Data Flows</span><small>Configured relationships</small></article>
            </div>
          </section>

          <div className="seFooterSafety">
            <span><ShieldCheck size={12}/>Read-only explorer</span>
            <span><Database size={12}/>No write actions</span>
            <span><AlertTriangle size={12}/>Production migration: DISABLED</span>
            <span><AlertTriangle size={12}/>Cutover: DISABLED</span>
          </div>
        </div>
      )}

      {view === "INTELLIGENCE" && (
        <div className="seIntelligence">
          <section className="seIntelHero">
            <div>
              <span className="seEyebrow">ADVANCED LANDSCAPE INTELLIGENCE</span>
              <h2>Enterprise Landscape Digital Twin</h2>
              <p>
                A read-only topology twin derived from persisted source, target,
                relationship, workflow and discovery evidence. It explains system
                structure and automation gaps without changing connections or runtime state.
              </p>
            </div>
            <span className="seStatus"><ShieldCheck size={13}/>READ ONLY</span>
          </section>

          <div className="seIntelCards">
            <article><Sparkles size={18}/><span>Connection Coverage</span><strong>{snapshot.connectionCoverage}%</strong><small>Validated source and target systems</small></article>
            <article><Network size={18}/><span>Discovery Coverage</span><strong>{snapshot.discoveryCoverage}%</strong><small>Relationship discovery state</small></article>
            <article><Settings2 size={18}/><span>Workflow State</span><strong>{snapshot.workflowStatus}</strong><small>Current persisted orchestration state</small></article>
            <article><ShieldCheck size={18}/><span>Explorer Safety</span><strong>READ ONLY</strong><small>No source or target mutation</small></article>
          </div>

          <div className="seSafetyBanner">
            <ShieldCheck size={15}/>
            <span>
              Existing SystemExplorer.tsx remains authoritative for persisted
              topology, relationship and inventory behavior. This premium layer
              reads current DEV state only.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

