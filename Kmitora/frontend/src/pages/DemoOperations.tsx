import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Play,
  Power,
  RefreshCcw,
  RotateCcw,
  Server,
  ShieldCheck,
  Stethoscope,
  TriangleAlert,
} from "lucide-react";

import {
  getDemoStatus,
  restartBackend,
  restartDemo,
  restartFrontend,
  runPreflight,
  startDemo,
  stopDemo,
  waitForFrontend,
  type DemoPreflight,
  type DemoServiceStatus,
} from "../services/demoSupervisorApi";

type ActionState =
  | "idle"
  | "preflight"
  | "start"
  | "stop"
  | "restart"
  | "backend"
  | "frontend";

function StatusBadge({
  label,
  active,
}: {
  label: string;
  active: boolean;
}) {
  return (
    <span className={`demoOpsBadge ${active ? "ok" : "off"}`}>
      {active ? <CheckCircle2 size={13} /> : <Circle size={13} />}
      {label}
    </span>
  );
}

export default function DemoOperations() {
  const [status, setStatus] = useState<DemoServiceStatus | null>(null);
  const [preflight, setPreflight] = useState<DemoPreflight | null>(null);
  const [action, setAction] = useState<ActionState>("idle");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      setStatus(await getDemoStatus());
      setError("");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Demo Supervisor is not reachable on port 8090.",
      );
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 1500);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function execute(
    name: ActionState,
    operation: () => Promise<DemoServiceStatus>,
  ) {
    setAction(name);
    setError("");
    try {
      setStatus(await operation());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setAction("idle");
    }
  }

  async function handlePreflight() {
    setAction("preflight");
    setError("");
    try {
      setPreflight(await runPreflight());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setAction("idle");
    }
  }

  async function handleFrontendRestart() {
    setAction("frontend");
    setError("");
    try {
      await restartFrontend();
      const ready = await waitForFrontend();
      if (!ready) {
        throw new Error("Frontend did not return within 60 seconds.");
      }
      window.location.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setAction("idle");
    }
  }

  async function handleFullRestart() {
    setAction("restart");
    setError("");
    try {
      await restartDemo();
      const ready = await waitForFrontend();
      if (!ready) {
        throw new Error("Frontend did not return within 60 seconds.");
      }
      window.location.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setAction("idle");
    }
  }

  const safetyItems = useMemo(() => {
    if (!status) return [];
    return [
      ["Production writes", !status.safety.production_write_allowed],
      ["Production cutover", !status.safety.production_cutover_allowed],
      ["Destructive actions", !status.safety.destructive_action_allowed],
      ["Policy bypass", !status.safety.policy_bypass_allowed],
    ] as const;
  }, [status]);

  return (
    <div className="page demoOpsPage">
      <section className="demoOpsHero">
        <div>
          <span className="eyebrow">KMITORA DEMO OPERATIONS</span>
          <h1>Frontend-Controlled Demo Operations</h1>
          <p>
            Preflight, start, stop and restart the certified KMITORA demo from
            one browser workspace. The persistent local supervisor remains
            available while backend or frontend services restart.
          </p>
        </div>
        <div className={`demoOpsReady ${status?.demo_ready ? "ready" : ""}`}>
          <Server size={22} />
          <span>DEMO STATUS</span>
          <strong data-testid="demo-ready">
            {status?.demo_ready ? "READY" : "NOT READY"}
          </strong>
        </div>
      </section>

      {error && (
        <div className="a1mAlert" role="alert">
          <TriangleAlert size={16} />
          {error}
        </div>
      )}

      <section className="demoOpsToolbar panel">
        <button
          type="button"
          onClick={() => void handlePreflight()}
          disabled={action !== "idle"}
          data-testid="demo-preflight"
        >
          <Stethoscope size={16} />
          Preflight
        </button>
        <button
          type="button"
          className="primary"
          onClick={() => void execute("start", startDemo)}
          disabled={action !== "idle"}
          data-testid="demo-start"
        >
          <Play size={16} />
          Start Demo
        </button>
        <button
          type="button"
          onClick={() => void execute("backend", restartBackend)}
          disabled={action !== "idle"}
          data-testid="demo-restart-backend"
        >
          <RotateCcw size={16} />
          Restart Backend
        </button>
        <button
          type="button"
          onClick={() => void handleFrontendRestart()}
          disabled={action !== "idle"}
          data-testid="demo-restart-frontend"
        >
          <RefreshCcw size={16} />
          Restart Frontend
        </button>
        <button
          type="button"
          onClick={() => void handleFullRestart()}
          disabled={action !== "idle"}
          data-testid="demo-restart-all"
        >
          <RefreshCcw size={16} />
          Restart All
        </button>
        <button
          type="button"
          onClick={() => void execute("stop", stopDemo)}
          disabled={action !== "idle"}
          data-testid="demo-stop"
        >
          <Power size={16} />
          Stop Demo
        </button>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={action !== "idle"}
        >
          Refresh Status
        </button>
      </section>

      <section className="demoOpsGrid">
        <article className="panel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">SERVICE STATUS</span>
              <h3>Runtime</h3>
            </div>
            <StatusBadge
              label="Supervisor 8090"
              active={status?.supervisor.status === "RUNNING"}
            />
          </div>

          <div className="demoOpsServiceRows">
            <div>
              <span>Backend</span>
              <strong>{status?.backend.status ?? "UNKNOWN"}</strong>
              <small>
                8080 · health {status?.backend.health_ok ? "PASS" : "—"} ·
                {status?.backend.owned ? " supervisor-owned" : " external/unowned"}
              </small>
            </div>
            <div>
              <span>Frontend</span>
              <strong>{status?.frontend.status ?? "UNKNOWN"}</strong>
              <small>
                5173 ·
                {status?.frontend.owned ? " supervisor-owned" : " external/unowned"}
              </small>
            </div>
            <div>
              <span>Mega Demo</span>
              <strong>{status?.mega_demo_status ?? "UNKNOWN"}</strong>
              <small>
                Evidence report {status?.report_exists ? "available" : "not available"}
              </small>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">SAFETY</span>
              <h3>Default-deny controls</h3>
            </div>
            <ShieldCheck size={18} />
          </div>

          <div className="demoOpsSafety">
            {safetyItems.map(([label, safe]) => (
              <span key={String(label)}>
  <StatusBadge
    label={`${label}: ${safe ? "DENIED" : "ENABLED"}`}
    active={safe}
  />
</span>
            ))}
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <span className="eyebrow">CLIENT-MEETING PREFLIGHT</span>
            <h3>
              {preflight
                ? `${preflight.passed}/${preflight.total} checks passed`
                : "Run preflight before every demo"}
            </h3>
          </div>
          {preflight && (
            <StatusBadge
              label={preflight.ready ? "READY" : "ACTION REQUIRED"}
              active={preflight.ready}
            />
          )}
        </div>

        <div className="demoOpsPreflight" data-testid="demo-preflight-results">
          {preflight ? (
            preflight.checks.map((check) => (
              <div key={check.name}>
                {check.passed ? (
                  <CheckCircle2 size={15} />
                ) : (
                  <TriangleAlert size={15} />
                )}
                <strong>{check.name}</strong>
                <small>{check.detail}</small>
              </div>
            ))
          ) : (
            <p>
              Preflight validates the frozen release, certified build SHA-256,
              Python, Node/npm, runtime entrypoints, Mega scenario and saved
              evidence before a client meeting.
            </p>
          )}
        </div>
      </section>

      <section className="demoOpsNote">
        <ShieldCheck size={16} />
        <span>
          The supervisor can restart backend/frontend from this page because it
          runs independently on port 8090. A one-time bootstrap is still
          required after Windows starts; after that, demo operations are
          browser-controlled.
        </span>
      </section>
    </div>
  );
}


