import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bot,
  BrainCircuit,
  CheckCircle2,
  Circle,
  FileCheck2,
  GitBranch,
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
  type MegaDemoCheck,
  type MegaDemoReport,
  type MegaDemoStatus,
} from "../services/megaDemoApi";

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

function phaseToLifecycleIndex(phase: string): number {
  const exact = lifecycle.findIndex(
    (item) => item.toLowerCase() === phase.toLowerCase(),
  );
  if (exact >= 0) return exact;

  const aliases: Record<string, string> = {
    Platform: "Understand",
    Governance: "Recommend",
    DigitalTwin: "Simulate",
    "1M Universe": "Test",
    Approval: "Execute",
  };
  const mapped = aliases[phase];
  return mapped ? lifecycle.indexOf(mapped) : 0;
}

function groupChecks(checks: MegaDemoCheck[]) {
  const result = new Map<string, MegaDemoCheck[]>();
  checks.forEach((check) => {
    const items = result.get(check.phase) ?? [];
    items.push(check);
    result.set(check.phase, items);
  });
  return Array.from(result.entries());
}

export default function MegaDemoControlRoom() {
  const [status, setStatus] = useState<MegaDemoStatus | null>(null);
  const [report, setReport] = useState<MegaDemoReport | null>(null);
  const [mode, setMode] = useState<"LIVE" | "REPLAY">("REPLAY");
  const [replayCount, setReplayCount] = useState(0);
  const [replayRunning, setReplayRunning] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    try {
      const current = await getMegaDemoStatus();
      setStatus(current);

      if (current.report_exists || current.status === "PASS" || current.status === "FAIL") {
        try {
          setReport(await getMegaDemoReport());
        } catch {
          // A run may be finishing between status and report persistence.
        }
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 1200);
    return () => window.clearInterval(timer);
  }, []);

  async function startLive() {
    setError("");
    setMode("LIVE");
    setReplayRunning(false);
    try {
      setStatus(await startMegaDemo());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  async function replayLatest() {
    setError("");
    setMode("REPLAY");
    try {
      const latest = await getMegaDemoReport();
      setReport(latest);
      setReplayCount(0);
      setReplayRunning(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  useEffect(() => {
    if (!replayRunning || !report) return;
    if (replayCount >= report.checks.length) {
      setReplayRunning(false);
      return;
    }
    const timer = window.setTimeout(
      () => setReplayCount((value) => Math.min(value + 1, report.checks.length)),
      45,
    );
    return () => window.clearTimeout(timer);
  }, [replayRunning, replayCount, report]);

  const visibleChecks = useMemo(() => {
    if (mode === "LIVE" && status?.status === "RUNNING") {
      return status.live_checks ?? [];
    }
    if (!report) return [];
    return mode === "REPLAY" && replayRunning
      ? report.checks.slice(0, replayCount)
      : report.checks;
  }, [report, mode, replayRunning, replayCount, status]);

  const latestCheck = visibleChecks.at(-1) ?? null;
  const activeLifecycleIndex = latestCheck
    ? phaseToLifecycleIndex(latestCheck.phase)
    : 0;

  const groups = useMemo(() => groupChecks(visibleChecks), [visibleChecks]);
  const passedVisible = visibleChecks.filter((check) => check.passed).length;
  const failedVisible = visibleChecks.filter((check) => !check.passed).length;

  const agents =
    report?.artifacts.agent_allocation?.agents?.slice(0, 8) ?? [];
  const domain =
    report?.artifacts.client_context?.domain ?? "Enterprise";
  const dynamicScenarios =
    Number(report?.artifacts.dynamic_scenario_count ?? 0);
  const representativeCapabilities =
    Number(report?.artifacts.representative_capability_executions ?? 0);

  return (
    <div className="page megaPage">
      <section className="megaHero">
        <div>
          <span className="eyebrow">KMITORA CLIENT LIVE DEMO</span>
          <h1>Mega Enterprise Control Room</h1>
          <p>
            One governed view of domain understanding, A000 orchestration,
            Digital Twin intelligence, the 13-stage lifecycle, capability
            execution, migration assurance, reconciliation and evidence.
          </p>
        </div>

        <div className="megaHeroActions">
          <button
            type="button"
            className="primary"
            onClick={() => void startLive()}
            data-testid="mega-start-live"
            disabled={status?.status === "RUNNING"}
          >
            <Play size={16} />
            {status?.status === "RUNNING" ? "Backend Running" : "Run Live Backend Demo"}
          </button>
          <button
            type="button"
            onClick={() => void replayLatest()}
            data-testid="mega-replay"
          >
            <TimerReset size={16} />
            Replay Latest Evidence
          </button>
        </div>
      </section>

      {error && <div className="a1mAlert" role="alert">{error}</div>}

      <section className="megaTopline">
        <div>
          <span>BACKEND STATUS</span>
          <strong data-testid="mega-status">
            {status?.status ?? "CONNECTING"}
          </strong>
          <small>{status?.message ?? "Connecting to A000..."}</small>
        </div>
        <div>
          <span>CHECKS</span>
          <strong data-testid="mega-check-count">
            {visibleChecks.length}/{report?.total_checks ?? 121}
          </strong>
          <small>
            {mode === "LIVE" && status?.status === "RUNNING"
              ? `${status.progress_passed ?? passedVisible} passed · ${status.progress_failed ?? failedVisible} failed`
              : `${passedVisible} passed · ${failedVisible} failed`}
          </small>
        </div>
        <div>
          <span>DOMAIN</span>
          <strong>{domain}</strong>
          <small>{report?.artifacts.client_context?.context_id ?? "A000 context"}</small>
        </div>
        <div>
          <span>DYNAMIC SCENARIOS</span>
          <strong>{dynamicScenarios || "—"}</strong>
          <small>Context-driven lifecycle scenarios</small>
        </div>
        <div className="megaSafety">
          <ShieldCheck size={20} />
          <strong>PROD DENIED</strong>
          <small>Writes · Cutover · Destructive · Bypass</small>
        </div>
      </section>

      <section className="megaLifecycle panel">
        <div className="panelHeader">
          <div>
            <span className="eyebrow">13-STAGE TRANSFORMATION LIFECYCLE</span>
            <h3>Live execution path</h3>
          </div>
          <span className="statusPill success">
            {latestCheck ? latestCheck.phase : "READY"}
          </span>
        </div>

        <div className="megaStageRail">
          {lifecycle.map((stage, index) => {
            const completed = index < activeLifecycleIndex;
            const active = index === activeLifecycleIndex && visibleChecks.length > 0;
            return (
              <div
                key={stage}
                className={[
                  "megaStage",
                  completed ? "complete" : "",
                  active ? "active" : "",
                ].join(" ")}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{stage}</strong>
                {completed ? <CheckCircle2 size={14} /> : <Circle size={10} />}
              </div>
            );
          })}
        </div>
      </section>

      <section className="megaGrid">
        <div className="panel megaTimelinePanel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">EVIDENCE TIMELINE</span>
              <h3>Backend checks</h3>
            </div>
            <button type="button" onClick={() => void refresh()}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          <div className="megaCheckGroups" data-testid="mega-check-groups">
            {groups.map(([phase, checks]) => (
              <div key={phase} className="megaCheckGroup">
                <div className="megaCheckPhase">
                  <Activity size={14} />
                  <strong>{phase}</strong>
                  <span>
                    {checks.filter((item) => item.passed).length}/{checks.length}
                  </span>
                </div>
                {checks.map((check) => (
                  <div key={`${check.phase}-${check.name}`} className="megaCheck">
                    {check.passed ? (
                      <CheckCircle2 size={14} />
                    ) : (
                      <Circle size={14} />
                    )}
                    <div>
                      <strong>{check.name}</strong>
                      <small>
                        {check.method} {check.path}
                      </small>
                    </div>
                    <span>{check.actual_status}</span>
                    <em>{check.elapsed_ms} ms</em>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <aside className="megaRight">
          <section className="panel">
            <div className="megaCardTitle">
              <BrainCircuit size={17} />
              <div>
                <span>A000 ORCHESTRATION</span>
                <strong>Dynamic Agent Team</strong>
              </div>
            </div>
            <div className="megaAgents">
              {agents.length ? (
                agents.map((agent) => (
                  <div key={agent.agent_id}>
                    <Bot size={14} />
                    <div>
                      <strong>{agent.agent_id}</strong>
                      <small>{agent.title}</small>
                    </div>
                  </div>
                ))
              ) : (
                <p>Run or replay the Mega E2E to load allocation evidence.</p>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="megaCardTitle">
              <GitBranch size={17} />
              <div>
                <span>DIGITAL TWIN</span>
                <strong>Impact & Causal Intelligence</strong>
              </div>
            </div>
            <div className="megaTwin">
              <div>A000</div>
              <span>→</span>
              <div>Data</div>
              <span>→</span>
              <div>Risk</div>
              <span>→</span>
              <div>Simulation</div>
              <span>→</span>
              <div>Evidence</div>
            </div>
            <small>
              Graph · blast radius · RCA · simulated future state
            </small>
          </section>

          <section className="panel megaProof">
            <div className="megaCardTitle">
              <Sparkles size={17} />
              <div>
                <span>CAPABILITY UNIVERSE</span>
                <strong>Representative Assurance</strong>
              </div>
            </div>
            <div className="megaProofGrid">
              <div>
                <span>1M</span>
                <small>Capability catalog</small>
              </div>
              <div>
                <span>{representativeCapabilities || "—"}</span>
                <small>Boundary executions</small>
              </div>
              <div>
                <span>7</span>
                <small>Safe sample batches</small>
              </div>
              <div>
                <span>KQA</span>
                <small>QA continuation covered</small>
              </div>
            </div>
          </section>

          <section className="panel megaEvidence">
            <div className="megaCardTitle">
              <FileCheck2 size={17} />
              <div>
                <span>FINAL ASSURANCE</span>
                <strong>Evidence Chain</strong>
              </div>
            </div>
            <dl>
              <div>
                <dt>Migration</dt>
                <dd>{report?.artifacts.migration_id ?? "—"}</dd>
              </div>
              <div>
                <dt>Approval</dt>
                <dd>{report?.artifacts.approval_id ?? "—"}</dd>
              </div>
              <div>
                <dt>Execution</dt>
                <dd>{report?.artifacts.execution_id ?? "—"}</dd>
              </div>
              <div>
                <dt>Reconciliation</dt>
                <dd>{report?.artifacts.reconciliation_id ?? "—"}</dd>
              </div>
              <div>
                <dt>Evidence</dt>
                <dd>{report?.artifacts.evidence_id ?? "—"}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </section>

      {report && (
        <section className="megaFooterProof panel">
          <div>
            <span>SCENARIO</span>
            <strong>{report.scenario_name}</strong>
            <small>{report.scenario_id}</small>
          </div>
          <div>
            <span>RESULT</span>
            <strong>{report.passed}/{report.total_checks} PASS</strong>
            <small>{report.pass_rate}% reference-runtime check pass rate</small>
          </div>
          <div>
            <span>REPORT SHA-256</span>
            <code>{report.report_sha256}</code>
          </div>
        </section>
      )}
    </div>
  );
}

