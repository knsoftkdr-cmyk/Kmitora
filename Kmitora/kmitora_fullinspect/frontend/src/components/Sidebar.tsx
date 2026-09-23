import {
  Activity,
  AlertTriangle,
  Bot,
  BrainCircuit,
  CheckCircle2,
  FileCheck2,
  FlaskConical,
  Gauge,
  GitBranch,
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

const operationsNav = [
  ["overview", "Control Tower", Gauge],
  ["transform", "Transform Studio", WandSparkles],
  ["prove", "Prove / Evidence", FileCheck2],
  ["megaDemo", "Mega Demo Control Room", PlayCircle],
  ["agents", "Agents", Bot],
  ["capabilities1m", "1M Capability Universe", BrainCircuit],
  ["domainIntelligence", "Domain Intelligence", Sparkles],
  ["digitalTwinGraph", "Digital Twin Graph", GitBranch],
  ["approvals", "Approvals", ShieldCheck],
  ["activity", "Activity", Activity],
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

