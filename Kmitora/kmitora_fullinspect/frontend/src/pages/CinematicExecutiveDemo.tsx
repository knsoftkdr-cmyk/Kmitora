import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  BrainCircuit,
  CheckCircle2,
  FileCheck2,
  Gauge,
  GitBranch,
  Maximize2,
  Pause,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TimerReset,
} from "lucide-react";

import {
  getMegaDemoReport,
  getMegaDemoStatus,
  startMegaDemo,
  type MegaDemoReport,
  type MegaDemoStatus,
} from "../services/megaDemoApi";
import {
  clientDemoScenarios,
  defaultClientDemoScenario,
  type ClientDemoScenario,
} from "../data/clientDemoScenarios";

type Scene = {
  id: string;
  title: string;
  kicker: string;
  body: string;
  stage?: string;
  icon: typeof Sparkles;
};

const scenes: Scene[] = [
  {
    id: "opening",
    title: "Enterprise transformation, under control",
    kicker: "KMITORA",
    body: "Understand the estate. Simulate change. Orchestrate specialists. Validate every outcome. Prove what happened.",
    icon: Sparkles,
  },
  {
    id: "context",
    title: "Start with the client context",
    kicker: "UNIVERSAL DOMAIN INTELLIGENCE",
    body: "KMITORA combines industry, business functions, systems, processes, risks and technologies before composing the transformation path.",
    stage: "Understand",
    icon: BrainCircuit,
  },
  {
    id: "agents",
    title: "A000 composes the specialist team",
    kicker: "A000 ORCHESTRATION",
    body: "Domain, process, data, application, security, migration, reliability, QA and evidence specialists are coordinated through one governed control plane.",
    stage: "Understand",
    icon: Bot,
  },
  {
    id: "twin",
    title: "See the enterprise as a living Digital Twin",
    kicker: "DIGITAL TWIN GRAPH",
    body: "Applications, data, APIs, processes, controls and evidence are connected so KMITORA can trace dependencies, blast radius and causal paths.",
    stage: "Discover",
    icon: GitBranch,
  },
  {
    id: "lifecycle",
    title: "One context across all 13 lifecycle stages",
    kicker: "END-TO-END LIFECYCLE",
    body: "Understand → Discover → Detect → Diagnose → Predict → Recommend → Simulate → Execute → Test → Validate → Reconcile → Evidence → Learn.",
    stage: "Simulate",
    icon: Gauge,
  },
  {
    id: "governance",
    title: "Autonomy without loss of control",
    kicker: "GOVERNANCE GATES",
    body: "The reference demo proves that invalid, oversized and unauthorized production requests are blocked while safe analytical and DEV dry-run operations continue.",
    stage: "Recommend",
    icon: ShieldCheck,
  },
  {
    id: "capabilities",
    title: "A large reusable capability universe",
    kicker: "A000 + KQA ASSURANCE",
    body: "Representative boundaries across the 1M capability catalog and KQA continuation are executed as reference-runtime checks, not as claims of universal model accuracy.",
    stage: "Test",
    icon: CheckCircle2,
  },
  {
    id: "migration",
    title: "Transformation follows an evidence-backed chain",
    kicker: "GOVERNED DEV DRY-RUN",
    body: "Discover → Validate → Authoritative Approval → Execute → Reconcile → Evidence. The demo performs no production or target writes.",
    stage: "Reconcile",
    icon: RefreshCw,
  },
  {
    id: "proof",
    title: "Finish with proof, not promises",
    kicker: "EXECUTIVE ASSURANCE",
    body: "The certified Mega E2E report records check results, timings, identifiers and a SHA-256 fingerprint for the reference runtime.",
    stage: "Evidence",
    icon: FileCheck2,
  },
];

const lifecycle = [
  "Understand",
  "Discover",
  "Detect",
  "Diagnose",
  "Predict",
  "Recommend",
  "Simulate",
  "Execute",
  "Test",
  "Validate",
  "Reconcile",
  "Evidence",
  "Learn",
];

const speedOptions = [
  { label: "0.75×", ms: 6500 },
  { label: "1×", ms: 4800 },
  { label: "1.5×", ms: 3200 },
  { label: "2×", ms: 2200 },
];

function scenarioKpi(
  scenario: ClientDemoScenario,
  index: number,
) {
  return scenario.kpis[index % scenario.kpis.length];
}

export default function CinematicExecutiveDemo() {
  const [scenarioId, setScenarioId] = useState(defaultClientDemoScenario.id);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState(4800);
  const [report, setReport] = useState<MegaDemoReport | null>(null);
  const [status, setStatus] = useState<MegaDemoStatus | null>(null);
  const [liveRunning, setLiveRunning] = useState(false);
  const [error, setError] = useState("");
  const stageRef = useRef<HTMLDivElement>(null);

  const scenario =
    clientDemoScenarios.find((item) => item.id === scenarioId) ??
    defaultClientDemoScenario;
  const scene = scenes[sceneIndex];

  useEffect(() => {
    void loadEvidence();
  }, []);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      setSceneIndex((current) => {
        if (current >= scenes.length - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, speedMs);
    return () => window.clearTimeout(timer);
  }, [playing, sceneIndex, speedMs]);

  useEffect(() => {
    if (!liveRunning) return;
    const timer = window.setInterval(async () => {
      try {
        const current = await getMegaDemoStatus();
        setStatus(current);
        if (current.status === "PASS" || current.status === "FAIL") {
          setLiveRunning(false);
          setReport(await getMegaDemoReport());
        }
      } catch {
        // Keep presentation running if one polling interval fails.
      }
    }, 1200);
    return () => window.clearInterval(timer);
  }, [liveRunning]);

  async function loadEvidence() {
    try {
      setError("");
      setStatus(await getMegaDemoStatus());
      setReport(await getMegaDemoReport());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  async function runLive() {
    try {
      setError("");
      setStatus(await startMegaDemo());
      setLiveRunning(true);
      setPlaying(true);
      setSceneIndex(0);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  function nextScene() {
    setSceneIndex((current) => Math.min(current + 1, scenes.length - 1));
  }

  function previousScene() {
    setSceneIndex((current) => Math.max(current - 1, 0));
  }

  function restart() {
    setSceneIndex(0);
    setPlaying(true);
  }

  async function toggleFullscreen() {
    if (!document.fullscreenElement) {
      await stageRef.current?.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  }

  const activeStageIndex = scene.stage
    ? lifecycle.indexOf(scene.stage)
    : -1;
  const Icon = scene.icon;
  const kpi = scenarioKpi(scenario, sceneIndex);
  const progress = ((sceneIndex + 1) / scenes.length) * 100;
  const evidencePass = report
    ? `${report.passed}/${report.total_checks}`
    : "—";

  const sceneEvidence = useMemo(() => {
    if (!report) return [];
    const stage = scene.stage?.toLowerCase();
    if (!stage) return report.checks.slice(0, 4);
    return report.checks
      .filter((check) => {
        const phase = check.phase.toLowerCase();
        if (phase === stage) return true;
        if (stage === "test" && phase === "1m universe") return true;
        if (stage === "evidence" && phase === "learn") return true;
        return false;
      })
      .slice(0, 6);
  }, [report, scene]);

  return (
    <div className="cinematicPage" ref={stageRef}>
      <header className="cinematicToolbar">
        <div>
          <span className="eyebrow">KMITORA EXECUTIVE EXPERIENCE</span>
          <strong>Cinematic Demo Mode</strong>
        </div>

        <div className="cinematicToolbarControls">
          <select
            aria-label="Client demo scenario"
            value={scenarioId}
            onChange={(event) => {
              setScenarioId(event.target.value);
              setSceneIndex(0);
              setPlaying(false);
            }}
            data-testid="cinematic-scenario"
          >
            {clientDemoScenarios.map((item) => (
              <option key={item.id} value={item.id}>
                {item.industry}
              </option>
            ))}
          </select>

          <select
            aria-label="Presentation speed"
            value={speedMs}
            onChange={(event) => setSpeedMs(Number(event.target.value))}
          >
            {speedOptions.map((item) => (
              <option key={item.label} value={item.ms}>
                {item.label}
              </option>
            ))}
          </select>

          <button type="button" onClick={previousScene} aria-label="Previous scene">
            <ArrowLeft size={16} />
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => setPlaying((value) => !value)}
            data-testid="cinematic-play"
          >
            {playing ? <Pause size={16} /> : <Play size={16} />}
            {playing ? "Pause" : "Play"}
          </button>
          <button type="button" onClick={nextScene} aria-label="Next scene">
            <ArrowRight size={16} />
          </button>
          <button type="button" onClick={restart} aria-label="Restart demo">
            <TimerReset size={16} />
          </button>
          <button type="button" onClick={() => void toggleFullscreen()} aria-label="Fullscreen">
            <Maximize2 size={16} />
          </button>
        </div>
      </header>

      {error && <div className="a1mAlert" role="alert">{error}</div>}

      <section className="cinematicStage" data-testid="cinematic-stage">
        <div className="cinematicBackdrop">
          <div className="cinematicOrb orbOne" />
          <div className="cinematicOrb orbTwo" />
          <div className="cinematicGridLines" />
        </div>

        <div className="cinematicTopMeta">
          <div>
            <span>CLIENT SCENARIO</span>
            <strong data-testid="cinematic-industry">{scenario.industry}</strong>
          </div>
          <div>
            <span>REFERENCE EVIDENCE</span>
            <strong>{evidencePass} PASS</strong>
          </div>
          <div>
            <span>SAFETY</span>
            <strong className="cinematicSafe">PROD DENIED</strong>
          </div>
          <div>
            <span>BACKEND</span>
            <strong>{status?.status ?? "REFERENCE"}</strong>
          </div>
        </div>

        <div className="cinematicScene">
          <div className="cinematicSceneCopy">
            <div className="cinematicIcon">
              <Icon size={30} />
            </div>
            <span className="cinematicKicker">{scene.kicker}</span>
            <h1>{scene.title}</h1>
            <p>{scene.body}</p>

            <div className="cinematicOutcome">
              <span>CLIENT OUTCOME</span>
              <strong>{scenario.primaryOutcome}</strong>
            </div>
          </div>

          <div className="cinematicVisual">
            <div className="cinematicTwinCore">
              <BrainCircuit size={34} />
              <strong>A000</strong>
              <small>Control Plane</small>
            </div>

            <div className="cinematicOrbit orbitA">
              {scenario.digitalTwinFocus.slice(0, 3).map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <div className="cinematicOrbit orbitB">
              {scenario.digitalTwinFocus.slice(3, 6).map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>

            <div className="cinematicAgentStrip">
              {scenario.specialistAgents.map((agent) => (
                <div key={agent}>
                  <Bot size={12} />
                  <span>{agent}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="cinematicStageRail">
          {lifecycle.map((stage, index) => (
            <div
              key={stage}
              className={[
                "cinematicStageItem",
                index < activeStageIndex ? "done" : "",
                index === activeStageIndex ? "active" : "",
              ].join(" ")}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{stage}</strong>
            </div>
          ))}
        </div>

        <div className="cinematicProofRow">
          <article>
            <span>SCENE KPI</span>
            <strong>{kpi.label}</strong>
            <div>
              <em>{kpi.before}</em>
              <ArrowRight size={14} />
              <b>{kpi.after}</b>
            </div>
            <small>{kpi.note}</small>
          </article>

          <article>
            <span>LIVE / SAVED EVIDENCE</span>
            <strong>{sceneEvidence.length || "—"} relevant checks</strong>
            <div className="cinematicEvidenceDots">
              {sceneEvidence.map((check) => (
                <i
                  key={`${check.phase}-${check.name}`}
                  className={check.passed ? "pass" : "fail"}
                  title={check.name}
                />
              ))}
            </div>
            <small>
              {report?.report_sha256
                ? `SHA ${report.report_sha256.slice(0, 16)}…`
                : "Reference report unavailable"}
            </small>
          </article>

          <article>
            <span>DEMO BOUNDARY</span>
            <strong>Reference runtime</strong>
            <div className="cinematicBoundary">
              <ShieldCheck size={17} />
              <b>No production authority</b>
            </div>
            <small>{scenario.safetyStatement}</small>
          </article>
        </div>

        <div className="cinematicNarrative">
          <span>PRESENTER CUE</span>
          <strong>
            {scenario.demoNarrative[
              Math.min(sceneIndex, scenario.demoNarrative.length - 1)
            ]}
          </strong>
        </div>

        <div className="cinematicProgress">
          <div style={{ width: `${progress}%` }} />
        </div>

        <footer className="cinematicFooter">
          <span>
            Scene {sceneIndex + 1} / {scenes.length}
          </span>
          <span>{scenario.name}</span>
          <div>
            <button
              type="button"
              onClick={() => void loadEvidence()}
              aria-label="Reload evidence"
            >
              <RefreshCw size={14} />
              Evidence
            </button>
            <button
              type="button"
              onClick={() => void runLive()}
              disabled={liveRunning}
              data-testid="cinematic-live"
            >
              <Play size={14} />
              {liveRunning ? "Live E2E Running" : "Run Live Backend"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

