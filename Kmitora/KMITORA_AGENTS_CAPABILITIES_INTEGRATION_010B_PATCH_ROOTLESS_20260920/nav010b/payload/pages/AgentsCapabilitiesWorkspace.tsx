// KMITORA AGENTS_CAPABILITIES_INTEGRATION_010B
import { useState } from "react";
import { Bot, BrainCircuit, Network, ShieldCheck } from "lucide-react";
import AgentOperations from "./AgentOperations";
import A000CapabilityUniverse from "./A000CapabilityUniverse";
import "../styles/agentsCapabilities010b.css";

type Props = {
  onNavigate?: (key: string) => void;
};

type WorkspaceTab = "operations" | "capabilities";

export default function AgentsCapabilitiesWorkspace({ onNavigate }: Props) {
  const [tab, setTab] = useState<WorkspaceTab>("operations");

  return (
    <div className="ac010b-shell" data-kmitora-patch="AGENTS_CAPABILITIES_INTEGRATION_010B">
      <section className="ac010b-header">
        <div>
          <span className="ac010b-eyebrow">KMITORA AGENTIC OPERATIONS</span>
          <h1>Agents &amp; Capabilities</h1>
          <p>
            Operate A000 and specialist agents from one workspace while preserving the full
            capability universe as a governed, reusable catalog.
          </p>
        </div>
        <div className="ac010b-principles">
          <span><Bot size={15} /> A000 orchestrated</span>
          <span><BrainCircuit size={15} /> Capability catalog preserved</span>
          <span><ShieldCheck size={15} /> Execution authority remains governed</span>
        </div>
      </section>

      <section className="ac010b-tabs" aria-label="Agents and capabilities workspace tabs">
        <button
          type="button"
          className={tab === "operations" ? "active" : ""}
          onClick={() => setTab("operations")}
        >
          <Bot size={16} /> Agent Operations
        </button>
        <button
          type="button"
          className={tab === "capabilities" ? "active" : ""}
          onClick={() => setTab("capabilities")}
        >
          <Network size={16} /> Capability Universe
        </button>
      </section>

      <section className="ac010b-context">
        <strong>{tab === "operations" ? "Runtime agent operations" : "Reusable capability universe"}</strong>
        <span>
          {tab === "operations"
            ? "Monitor orchestrator, specialists, assignments, performance and runtime safety."
            : "Browse and exercise the existing governed KMITORA capability universe without creating a duplicate Operations page."}
        </span>
      </section>

      <div className="ac010b-content">
        {tab === "operations" ? (
          <AgentOperations />
        ) : (
          <A000CapabilityUniverse onNavigate={onNavigate ?? (() => undefined)} />
        )}
      </div>
    </div>
  );
}
