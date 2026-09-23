import { useState } from "react";
import { Activity, Gauge, GitBranch, Network, ShieldCheck, Workflow } from "lucide-react";
import ControlTowerPremium from "./ControlTowerPremium";
import DigitalTwinGraph from "./DigitalTwinGraph";
import "../styles/controlTower010c.css";

// KMITORA_CONTROL_TOWER_DIGITAL_TWIN_010C

type ControlTowerTab =
  | "overview"
  | "runtime"
  | "topology"
  | "dependencies"
  | "impact"
  | "safety";

const tabs: Array<{ id: ControlTowerTab; label: string; icon: typeof Gauge }> = [
  { id: "overview", label: "Overview", icon: Gauge },
  { id: "runtime", label: "Runtime", icon: Activity },
  { id: "topology", label: "Topology & Digital Twin", icon: GitBranch },
  { id: "dependencies", label: "Dependencies", icon: Network },
  { id: "impact", label: "Impact Analysis", icon: Workflow },
  { id: "safety", label: "Safety & Governance", icon: ShieldCheck },
];

const integratedViews: Record<Exclude<ControlTowerTab, "overview" | "topology">, { title: string; description: string; points: string[] }> = {
  runtime: {
    title: "Authoritative Runtime",
    description: "Runtime truth remains owned by the existing Control Tower. This integrated view avoids creating a second state store.",
    points: ["Lifecycle status", "Current execution identity", "DEV target writes", "Validation and reconciliation state"],
  },
  dependencies: {
    title: "Dependency Intelligence",
    description: "Dependency analysis is projected from discovery and Digital Twin evidence rather than independently inferred here.",
    points: ["Entity relationships", "Load-order dependencies", "Transformation dependencies", "Source-to-target lineage"],
  },
  impact: {
    title: "Impact Analysis",
    description: "Impact views are grounded in the same topology and evidence chain used by the Digital Twin.",
    points: ["Affected entities", "Downstream paths", "Blast-radius context", "Migration-wave impact"],
  },
  safety: {
    title: "Safety & Governance",
    description: "Safety remains evidence-backed and production actions stay guarded.",
    points: ["Approval boundaries", "Production actions", "Cutover guard", "Evidence and audit state"],
  },
};

function IntegratedProjection({ tab }: { tab: Exclude<ControlTowerTab, "overview" | "topology"> }) {
  const item = integratedViews[tab];
  return (
    <section className="ct010cProjection" data-testid={`control-tower-${tab}`}>
      <div className="ct010cProjectionHead">
        <span>CONTROL TOWER INTEGRATED VIEW</span>
        <h2>{item.title}</h2>
        <p>{item.description}</p>
      </div>
      <div className="ct010cProjectionGrid">
        {item.points.map((point) => (
          <article key={point}>
            <strong>{point}</strong>
            <small>Uses existing authoritative Control Tower / Digital Twin evidence; no duplicate persistence.</small>
          </article>
        ))}
      </div>
      <div className="ct010cProjectionNote">
        Detailed operational metrics remain in <b>Overview</b>; structural and lineage evidence remains in <b>Topology & Digital Twin</b>.
      </div>
    </section>
  );
}

export default function ControlTowerWorkspace() {
  const [tab, setTab] = useState<ControlTowerTab>("overview");

  return (
    <div className="ct010cWorkspace">
      <header className="ct010cHeader">
        <div>
          <span className="ct010cEyebrow">KMITORA CONTROL TOWER</span>
          <h1>Control Tower</h1>
          <p>One operational command center for authoritative runtime truth, topology, dependency context, impact and governance.</p>
        </div>
        <div className="ct010cStatus">
          <span>DEV</span>
          <strong>AUTHORITATIVE</strong>
        </div>
      </header>

      <nav className="ct010cTabs" aria-label="Control Tower views">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            <Icon size={15} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <main className="ct010cBody">
        {tab === "overview" && <ControlTowerPremium />}
        {tab === "topology" && (
          <section className="ct010cTwin" data-testid="control-tower-digital-twin">
            <div className="ct010cTwinIntro">
              <span>INTEGRATED DIGITAL TWIN</span>
              <h2>Topology & Digital Twin</h2>
              <p>Existing Digital Twin functionality is embedded here without changing its underlying route or implementation.</p>
            </div>
            <DigitalTwinGraph />
          </section>
        )}
        {tab !== "overview" && tab !== "topology" && <IntegratedProjection tab={tab} />}
      </main>
    </div>
  );
}
