import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BrainCircuit,
  ChevronRight,
  GitBranch,
  Layers3,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import A000ScenarioContextBanner from "../components/A000ScenarioContextBanner";
import type {
  EnterpriseTwinGraph,
  TwinGraphNode,
  TwinLayerId,
  TwinTemporalState,
} from "../models/EnterpriseTwinGraph";
import {
  analyzeTwinImpact,
  analyzeTwinRca,
  getDigitalTwinGraph,
  simulateTwinScenario,
  type TwinImpactResult,
  type TwinRcaResult,
  type TwinSimulationResult,
} from "../services/digitalTwinGraphApi";

const layers: Array<{ id: TwinLayerId; label: string }> = [
  { id: "L0_ENTERPRISE", label: "Enterprise" },
  { id: "L1_SYSTEM", label: "Systems" },
  { id: "L2_DATA", label: "Data" },
  { id: "L3_PROCESS", label: "Process" },
  { id: "L4_RUNTIME", label: "Runtime" },
  { id: "L5_INTELLIGENCE", label: "Intelligence" },
  { id: "L6_GOVERNANCE", label: "Governance" },
  { id: "L7_RISK", label: "Risk" },
  { id: "L8_SIMULATION", label: "Simulation" },
  { id: "L9_EVIDENCE", label: "Evidence" },
];

const temporalStates: TwinTemporalState[] = [
  "BEFORE",
  "CURRENT",
  "PROPOSED",
  "SIMULATED",
  "AFTER",
];

type AnalysisMode =
  | "NONE"
  | "IMPACT"
  | "RCA"
  | "SIMULATION"
  | "COMPARE";

function metaNumber(node: TwinGraphNode, key: string): number {
  const raw = node.metadata?.[key];
  return typeof raw === "number" ? raw : Number(raw ?? 0) || 0;
}

function nodeClass(
  node: TwinGraphNode,
  highlighted: boolean,
  selected: boolean,
) {
  return [
    "dtgNode",
    `dtgNode-${node.state.toLowerCase()}`,
    `dtgLayer-${node.layer.slice(1, 2)}`,
    highlighted ? "dtgNode-highlighted" : "",
    selected ? "dtgNode-selected" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export default function DigitalTwinGraph() {
  const [temporalState, setTemporalState] =
    useState<TwinTemporalState>("CURRENT");
  const [graph, setGraph] =
    useState<EnterpriseTwinGraph | null>(null);
  const [activeLayers, setActiveLayers] =
    useState<Set<TwinLayerId>>(
      () => new Set(layers.map((item) => item.id)),
    );
  const [selectedNodeId, setSelectedNodeId] =
    useState("a000");
  const [query, setQuery] = useState("");
  const [analysisMode, setAnalysisMode] =
    useState<AnalysisMode>("NONE");
  const [impact, setImpact] =
    useState<TwinImpactResult | null>(null);
  const [rca, setRca] =
    useState<TwinRcaResult | null>(null);
  const [simulation, setSimulation] =
    useState<TwinSimulationResult | null>(null);
  const [scenarioText, setScenarioText] = useState(
    "What changes downstream if the selected twin node degrades?",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadGraph(state: TwinTemporalState) {
    setLoading(true);
    setError("");

    try {
      const live = await getDigitalTwinGraph(state);
      setGraph(live);
      setImpact(null);
      setRca(null);
      setSimulation(null);
      setAnalysisMode("NONE");
    } catch (reason) {
      setGraph(null);
      setError(
        reason instanceof Error
          ? reason.message
          : String(reason),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadGraph(temporalState);
  }, [temporalState]);

  const visibleNodes = useMemo(() => {
    if (!graph) return [];
    const q = query.trim().toLowerCase();

    return graph.nodes.filter(
      (node) =>
        activeLayers.has(node.layer) &&
        (!q ||
          `${node.label} ${node.type} ${node.layer}`
            .toLowerCase()
            .includes(q)),
    );
  }, [graph, activeLayers, query]);

  const visibleIds = useMemo(
    () => new Set(visibleNodes.map((node) => node.id)),
    [visibleNodes],
  );

  const visibleEdges = useMemo(
    () =>
      (graph?.edges ?? []).filter(
        (edge) =>
          visibleIds.has(edge.source) &&
          visibleIds.has(edge.target),
      ),
    [graph, visibleIds],
  );

  const selected =
    graph?.nodes.find(
      (node) => node.id === selectedNodeId,
    ) ??
    visibleNodes[0] ??
    null;

  const positions: Record<string, TwinGraphNode> =
    Object.fromEntries(
      (graph?.nodes ?? []).map((node) => [node.id, node]),
    );

  const sourceNode = positions.source ?? null;
  const targetNode = positions.target ?? null;

  const highlightedNodes = new Set(
    analysisMode === "IMPACT"
      ? impact?.highlightNodeIds ?? []
      : analysisMode === "RCA"
        ? rca?.pathNodeIds ?? []
        : analysisMode === "SIMULATION"
          ? simulation?.highlightNodeIds ?? []
          : [],
  );

  const highlightedEdges = new Set(
    analysisMode === "IMPACT"
      ? impact?.highlightEdgeIds ?? []
      : analysisMode === "RCA"
        ? rca?.pathEdgeIds ?? []
        : analysisMode === "SIMULATION"
          ? simulation?.highlightEdgeIds ?? []
          : [],
  );

  function toggleLayer(id: TwinLayerId) {
    setActiveLayers((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Clicking the active analysis again clears it, so the highlight can be
  // dismissed without having to pick a different analysis.
  function toggleAnalysis(mode: AnalysisMode, run: () => void) {
    if (analysisMode === mode) {
      setAnalysisMode("NONE");
      return;
    }

    run();
  }

  async function runImpact() {
    if (!selected) return;
    setLoading(true);
    setError("");
    try {
      setImpact(await analyzeTwinImpact(selected.id));
      setAnalysisMode("IMPACT");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : String(reason),
      );
    } finally {
      setLoading(false);
    }
  }

  async function runRca() {
    if (!selected) return;
    setLoading(true);
    setError("");
    try {
      setRca(await analyzeTwinRca(selected.id));
      setAnalysisMode("RCA");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : String(reason),
      );
    } finally {
      setLoading(false);
    }
  }

  async function runSimulation() {
    if (!selected) return;
    setLoading(true);
    setError("");
    try {
      setSimulation(
        await simulateTwinScenario(
          selected.id,
          scenarioText,
        ),
      );
      setAnalysisMode("SIMULATION");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : String(reason),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page dtgPage">
      <A000ScenarioContextBanner />

      <section className="dtgHero">
        <div>
          <span className="eyebrow">
            KMITORA ENTERPRISE DIGITAL TWIN
          </span>
          <h1>Digital Twin Graph</h1>
          <p>
            Live read-only A000 runtime projection for
            architecture, dependencies, risk, causal analysis,
            simulation, governance, reconciliation and evidence.
          </p>
        </div>

        <div className="dtgHeroBadges">
          <span>
            <BrainCircuit size={15} />
            A000 LIVE PROJECTION
          </span>
          <span>
            <ShieldCheck size={15} />
            PROD DENIED
          </span>
        </div>
      </section>

      {error && (
        <div className="a1mAlert" role="alert">
          {error}
        </div>
      )}

      <section className="dtgToolbar">
        <div className="dtgSearch">
          <Search size={16} />
          <input
            aria-label="Search digital twin"
            placeholder="Search system, data, risk, evidence..."
            value={query}
            onChange={(event) =>
              setQuery(event.target.value)
            }
          />
        </div>

        <div className="dtgStats">
          <span>
            <Layers3 size={15} />
            {visibleNodes.length} nodes
          </span>
          <span>
            <GitBranch size={15} />
            {visibleEdges.length} relationships
          </span>
          <button
            type="button"
            onClick={() => void loadGraph(temporalState)}
            disabled={loading}
          >
            <RefreshCw size={14} />
            Refresh live twin
          </button>
        </div>
      </section>

      <section className="dtgAnalysisBar">
        <button
          type="button"
          className={
            analysisMode === "IMPACT" ? "active" : ""
          }
          onClick={() =>
            toggleAnalysis("IMPACT", () => void runImpact())
          }
          disabled={!selected || loading}
          data-testid="dtg-impact"
        >
          <Activity size={15} />
          Blast Radius
        </button>

        <button
          type="button"
          className={
            analysisMode === "RCA" ? "active" : ""
          }
          onClick={() =>
            toggleAnalysis("RCA", () => void runRca())
          }
          disabled={!selected || loading}
          data-testid="dtg-rca"
        >
          <GitBranch size={15} />
          RCA Path
        </button>

        <button
          type="button"
          className={
            analysisMode === "SIMULATION"
              ? "active"
              : ""
          }
          onClick={() =>
            toggleAnalysis("SIMULATION", () => void runSimulation())
          }
          disabled={!selected || loading}
          data-testid="dtg-simulate"
        >
          <Sparkles size={15} />
          Simulate Future
        </button>

        <button
          type="button"
          className={
            analysisMode === "COMPARE" ? "active" : ""
          }
          onClick={() =>
            toggleAnalysis("COMPARE", () =>
              setAnalysisMode("COMPARE"),
            )
          }
          data-testid="dtg-compare"
        >
          Source ↔ Target
        </button>
      </section>

      {analysisMode === "SIMULATION" && (
        <section className="dtgScenarioBar">
          <label>
            <span>Simulation scenario</span>
            <input
              value={scenarioText}
              onChange={(event) =>
                setScenarioText(event.target.value)
              }
            />
          </label>
          <span>
            READ-ONLY · target writes 0 · production actions 0
          </span>
        </section>
      )}

      <section className="dtgWorkspace">
        <aside className="dtgLayers">
          <div className="dtgPanelTitle">
            <span>TWIN LAYERS</span>
            <strong>L0–L9</strong>
          </div>

          {layers.map((layer) => (
            <label
              key={layer.id}
              className="dtgLayerToggle"
            >
              <input
                type="checkbox"
                checked={activeLayers.has(layer.id)}
                onChange={() => toggleLayer(layer.id)}
              />
              <span>{layer.id.slice(0, 2)}</span>
              <strong>{layer.label}</strong>
            </label>
          ))}

          <div className="dtgSafetyCard">
            <ShieldCheck size={18} />
            <strong>Runtime safety</strong>
            <span>Read-only graph projection</span>
            <span>Production write denied</span>
            <span>Cutover denied</span>
            <span>Policy bypass denied</span>
          </div>
        </aside>

        <main className="dtgCanvasPanel">
          <div className="dtgCanvasHeader">
            <div>
              <span className="eyebrow">
                LIVE A000 TWIN
              </span>
              <strong>
                Runtime topology · {temporalState}
              </strong>
            </div>
            <span className="statusPill success">
              {loading ? "SYNCING" : "LIVE PROJECTION"}
            </span>
          </div>

          {analysisMode === "COMPARE" ? (
            <div
              className="dtgCompare"
              data-testid="dtg-comparison"
            >
              <section>
                <span>SOURCE / CURRENT</span>
                <strong>
                  {positions.source?.label ?? "Source Estate"}
                </strong>
                <p>
                  {sourceNode
                    ? `${metaNumber(sourceNode, "discoveredEntities")} entities discovered · ` +
                      `${metaNumber(sourceNode, "readyRecords")} ready · ` +
                      `${metaNumber(sourceNode, "blockedRecords")} blocked`
                    : "No discovery evidence yet."}
                </p>
              </section>
              <div className="dtgCompareArrow">→</div>
              <section>
                <span>TARGET / {temporalState}</span>
                <strong>
                  {positions.target?.label ?? "DEV Target Estate"}
                </strong>
                <p>
                  {targetNode
                    ? `${metaNumber(targetNode, "discoveredEntities")} entities · ` +
                      `${metaNumber(targetNode, "recordsInTarget")} record(s) in target · ` +
                      `state ${targetNode.state}`
                    : "No target projection yet."}
                </p>
              </section>
            </div>
          ) : (
            <div
              className={`dtgCanvas dtgCanvas-${analysisMode.toLowerCase()}`}
              data-testid="digital-twin-graph"
            >
              <svg
                viewBox="0 0 1000 590"
                role="img"
                aria-label="Enterprise digital twin dependency graph"
              >
                <defs>
                  <marker
                    id="dtgArrow"
                    markerWidth="8"
                    markerHeight="8"
                    refX="7"
                    refY="4"
                    orient="auto"
                  >
                    <path d="M0,0 L8,4 L0,8 Z" />
                  </marker>
                </defs>

                {visibleEdges.map((edge) => {
                  const source = positions[edge.source];
                  const target = positions[edge.target];
                  if (!source || !target) return null;

                  const highlighted =
                    highlightedEdges.has(edge.id);

                  return (
                    <g key={edge.id}>
                      <line
                        className={[
                          "dtgEdge",
                          `dtgEdge-${edge.type.toLowerCase()}`,
                          highlighted
                            ? "dtgEdge-highlighted"
                            : "",
                        ].join(" ")}
                        x1={source.x}
                        y1={source.y}
                        x2={target.x}
                        y2={target.y}
                        markerEnd="url(#dtgArrow)"
                      />
                      <text
                        className="dtgEdgeLabel"
                        x={(source.x + target.x) / 2}
                        y={(source.y + target.y) / 2 - 7}
                      >
                        {edge.type.replaceAll("_", " ")}
                      </text>
                    </g>
                  );
                })}

                {visibleNodes.map((node) => (
                  <g
                    key={node.id}
                    className={nodeClass(
                      node,
                      highlightedNodes.has(node.id),
                      selected?.id === node.id,
                    )}
                    transform={`translate(${node.x}, ${node.y})`}
                    onClick={() =>
                      setSelectedNodeId(node.id)
                    }
                    role="button"
                    tabIndex={0}
                    aria-label={`Select ${node.label}`}
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" ||
                        event.key === " "
                      ) {
                        setSelectedNodeId(node.id);
                      }
                    }}
                  >
                    <circle
                      r={node.id === "a000" ? 39 : 29}
                    />
                    <text
                      className="dtgNodeTitle"
                      y={4}
                    >
                      {node.id === "a000"
                        ? "A000"
                        : node.label.length > 18
                          ? `${node.label.slice(0, 17)}…`
                          : node.label}
                    </text>
                    <text
                      className="dtgNodeType"
                      y={49}
                    >
                      {node.layer.slice(0, 2)} · {node.type}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          )}

          <div className="dtgTimeline">
            <span className="dtgTimelineLabel">
              DIGITAL TWIN TIME
            </span>
            {temporalStates.map((state) => (
              <button
                type="button"
                key={state}
                className={
                  temporalState === state
                    ? "active"
                    : ""
                }
                onClick={() => setTemporalState(state)}
              >
                {state}
              </button>
            ))}
          </div>
        </main>

        <aside className="dtgInspector">
          <div className="dtgPanelTitle">
            <span>INSPECTOR</span>
            <strong data-testid="dtg-selected-name">
              {selected?.label ?? "No selection"}
            </strong>
          </div>

          {selected && (
            <>
              <div className="dtgInspectorGrid">
                <div>
                  <span>Layer</span>
                  <strong>{selected.layer}</strong>
                </div>
                <div>
                  <span>Type</span>
                  <strong>{selected.type}</strong>
                </div>
                <div>
                  <span>State</span>
                  <strong>{selected.state}</strong>
                </div>
                <div>
                  <span>Risk</span>
                  <strong>{selected.risk}%</strong>
                </div>
                <div>
                  <span>Confidence</span>
                  <strong>
                    {selected.confidence}%
                  </strong>
                </div>
                <div>
                  <span>Environment</span>
                  <strong>
                    {selected.environment}
                  </strong>
                </div>
              </div>

              <section className="dtgInspectorSection">
                <span>METADATA</span>
                {Object.entries(selected.metadata).map(
                  ([key, value]) => (
                    <div key={key}>
                      <small>{key}</small>
                      <strong>{String(value)}</strong>
                    </div>
                  ),
                )}
              </section>

              <section className="dtgInspectorSection">
                <span>EVIDENCE</span>
                {selected.evidenceIds.length ? (
                  selected.evidenceIds.map((id) => (
                    <div key={id}>
                      <small>Evidence ID</small>
                      <strong>{id}</strong>
                    </div>
                  ))
                ) : (
                  <p>No evidence attached yet.</p>
                )}
              </section>

              {analysisMode === "IMPACT" && impact && (
                <section
                  className="dtgAnalysisResult"
                  data-testid="dtg-impact-result"
                >
                  <span>BLAST RADIUS</span>
                  <strong>
                    {impact.impactedNodes.length} downstream
                    nodes
                  </strong>
                  <p>
                    Deterministic graph traversal from{" "}
                    {impact.sourceNodeId}.
                  </p>
                </section>
              )}

              {analysisMode === "RCA" && rca && (
                <section
                  className="dtgAnalysisResult"
                  data-testid="dtg-rca-result"
                >
                  <span>RCA PATH</span>
                  <strong>
                    {rca.pathNodeIds.join(" → ")}
                  </strong>
                  <p>
                    Reference path only; authoritative causal
                    claims require evidence validation.
                  </p>
                </section>
              )}

              {analysisMode === "SIMULATION" &&
                simulation && (
                  <section
                    className="dtgAnalysisResult"
                    data-testid="dtg-simulation-result"
                  >
                    <span>SIMULATION</span>
                    <strong>
                      {simulation.simulationTruth}
                    </strong>
                    <p>
                      Target write: false · production action:
                      false · cutover: false
                    </p>
                  </section>
                )}

              <button
                type="button"
                className="dtgExplainButton"
                onClick={() => void runImpact()}
              >
                <Sparkles size={15} />
                Explain impact with A000
                <ChevronRight size={15} />
              </button>
            </>
          )}
        </aside>
      </section>
    </div>
  );
}

