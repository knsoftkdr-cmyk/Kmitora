import {
  Activity,
  AlertTriangle,
  Bot,
  BrainCircuit,
  CheckCircle2,
  FileCheck2,
  FlaskConical,
  Gauge,
  Lightbulb,
  Microscope,
  PlayCircle,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sparkles,
  TestTube2,
  WandSparkles,
} from "lucide-react";

const lifecycleNav = [
  ["understand", "Understand", BrainCircuit],
  ["discover", "Discover", Microscope],
  ["detect", "Detect", AlertTriangle],
  ["diagnose", "Diagnose", Activity],
  ["predict", "Predict", Gauge],
  ["recommend", "Recommend", Lightbulb],
  ["simulate", "Simulate", FlaskConical],
  ["execute", "Execute", PlayCircle],
  ["test", "Test", TestTube2],
  ["validate", "Validate", CheckCircle2],
  ["reconcile", "Reconcile", RefreshCw],
  ["evidence", "Evidence", FileCheck2],
  ["learn", "Learn", BrainCircuit],
] as const;

// NAVIGATION_CONSOLIDATION_010A
// Operations contains only distinct day-to-day operational workspaces.
// Legacy/demo routes remain preserved in App.tsx for backward compatibility
// and will be surfaced under a dedicated Demo & Presentation section in 010E.
const operationsNav = [
  ["overview", "Control Tower", Gauge],
  ["transform", "Transform Studio", WandSparkles],
  ["prove", "Evidence & Audit", FileCheck2],
  ["agents", "Agents & Capabilities", Bot],
  ["neuralIntelligence", "Neural Intelligence", BrainCircuit],
  ["domainIntelligence", "Domain Intelligence", Sparkles],
  ["workflowAutomation", "Workflow & Automation", Settings],
  ["approvals", "Approvals", ShieldCheck],
  ["activity", "Activity & Audit Log", Activity],
  ["settings", "Settings", Settings],
] as const;

type Props = {
  active: string;
  onSelect: (value: string) => void;
};

function NavigationGroup({
  title,
  items,
  active,
  onSelect,
}: {
  title: string;
  items: readonly (readonly [string, string, typeof Gauge])[];
  active: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="kmSidebarGroup">
      <div className="kmSidebarGroupTitle">{title}</div>
      {items.map(([key, label, Icon], index) => (
        <button
          key={key}
          className={`navItem ${active === key ? "active" : ""}`}
          onClick={() => onSelect(key)}
        >
          {title === "Lifecycle" && (
            <span className="kmSidebarStageNo">
              {String(index + 1).padStart(2, "0")}
            </span>
          )}
          <Icon size={17} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

export default function Sidebar({ active, onSelect }: Props) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brandMark">K</div>
        <div>
          <div className="brandName">KMITORA</div>
          <div className="brandSub">Autonomous Engineering Control Plane</div>
        </div>
      </div>

      <nav>
        <NavigationGroup
          title="Lifecycle"
          items={lifecycleNav}
          active={active}
          onSelect={onSelect}
        />

        <NavigationGroup
          title="Operations"
          items={operationsNav}
          active={active}
          onSelect={onSelect}
        />
      </nav>
    </aside>
  );
}


