import { Bot, Send, Sparkles , PanelRight} from "lucide-react";
import { useEffect, useState } from "react";
import { resolveSafeRemediation } from "../services/api";
import A000AdvancedLivePanel from "./A000AdvancedLivePanel";
import type { AdvancedRuntime } from "../types/advancedRuntime";

type RemediationPayload = {
  id?: string;
  migration_id?: string;
  status?: string;
  mode?: string;
  safe_action_count?: number;
  preserved_action_count?: number;
  validation_state_modified?: boolean;
  source_write_executed?: boolean;
  target_write_executed?: boolean;
  production_action_executed?: boolean;
  migration_execution_started?: boolean;
};

type Props = {
  onAdvancedRuntime?: (runtime: AdvancedRuntime | null) => void;
};

export default function A000Panel({
  onAdvancedRuntime,
}: Props) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("kmitora.copilot.collapsed") === "1");
  const toggleCollapsed = () => setCollapsed(v => { localStorage.setItem("kmitora.copilot.collapsed", v ? "0" : "1"); return !v; });

  useEffect(() => {
    const shell = document.querySelector(".appShell");
    if (shell) shell.classList.toggle("appShell--copilotCollapsed", collapsed);
  }, [collapsed]);

  const [value, setValue] = useState("");

  const [resolving, setResolving] = useState(false);

  const [remediation, setRemediation] =
    useState<RemediationPayload | null>(null);

  const [remediationError, setRemediationError] = useState("");

  const handleResolveSafe = async () => {
    setResolving(true);
    setRemediationError("");

    try {
      const migrationId =
        localStorage.getItem("kmitora.dev.migrationId") ??
        "DEV-EXCEL-DISCOVERY-001";

      const response =
        await resolveSafeRemediation(migrationId);

      const result =
        response?.payload ?? response;

      setRemediation(result);

      localStorage.setItem(
        "kmitora.dev.safeRemediation",
        JSON.stringify(result)
      );
    } catch (err) {
      setRemediationError(
        err instanceof Error
          ? err.message
          : "Safe remediation failed."
      );
    } finally {
      setResolving(false);
    }
  };




  return (
    <aside className={"copilot" + (collapsed ? " is-collapsed" : "")}>
      <div className="copilotHeader">
        <button className="copilotToggle" onClick={toggleCollapsed} title={collapsed ? "Expand assistant" : "Collapse assistant"} aria-label={collapsed ? "Expand assistant" : "Collapse assistant"}>
          <PanelRight size={19} />
        </button>
        <Bot size={20} />
        <div>
          <strong>KMITORA Assistant</strong>
          <span>Chat, recommendations & next actions</span>
        </div>
      </div>

      <div className="copilotCard">
        <div className="aiBadge">
          <Sparkles size={14} /> Recommendation
        </div>

        {!remediation && (
          <p>
            Review current migration findings and simulate
            policy-approved safe remediation without modifying
            source or target data.
          </p>
        )}

        {remediation && (
          <>
            <p>
              Safe simulation completed:
              {" "}
              <strong>
                {remediation.safe_action_count ?? 0}
              </strong>
              {" "}safe actions identified,
              {" "}
              <strong>
                {remediation.preserved_action_count ?? 0}
              </strong>
              {" "}governed actions preserved.
            </p>

            <p className="muted">
              Validation state changed:{" "}
              {remediation.validation_state_modified
                ? "YES"
                : "NO"}
              <br />
              Source write:{" "}
              {remediation.source_write_executed
                ? "YES"
                : "NO"}
              <br />
              Target write:{" "}
              {remediation.target_write_executed
                ? "YES"
                : "NO"}
              <br />
              Production action:{" "}
              {remediation.production_action_executed
                ? "YES"
                : "NO"}
            </p>
          </>
        )}

        {remediationError && (
          <p className="muted">
            {remediationError}
          </p>
        )}

        <div className="buttonRow">
          <button
            onClick={() => {
              const raw =
                localStorage.getItem(
                  "kmitora.dev.discoveryResult"
                );

              if (raw) {
                console.log(
                  "KMITORA discovery result",
                  JSON.parse(raw)
                );
              }
            }}
          >
            Show Current
          </button>

          <button
            className="primary"
            onClick={handleResolveSafe}
            disabled={resolving}
          >
            {resolving
              ? "Resolving..."
              : "Resolve Safe"}
          </button>
        </div>
      </div>

      <div className="copilotCard">
        <strong>Try asking</strong>
        <p className="muted">
          "Show everything below 90% confidence."
        </p>
        <p className="muted">
          "Why is this record blocked?"
        </p>
        <p className="muted">
          "Preview the next migration wave."
        </p>
      </div>

      <div className="chatInput">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ask KMITORA Assistant..."
        />
        <button aria-label="Send">
          <Send size={17} />
        </button>
      </div>
    
      <div
        data-kmitora="advanced-a000-runtime"
        style={{ marginTop: 16 }}
      >
        <A000AdvancedLivePanel
          onAdvancedRuntime={onAdvancedRuntime}
        />
      </div>
</aside>
  );
}



