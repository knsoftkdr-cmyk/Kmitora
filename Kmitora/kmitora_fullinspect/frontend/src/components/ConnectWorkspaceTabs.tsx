import {
  Activity,
  Cable,
  Database,
  FileText,
  GitBranch,
  Network,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

type TabDef = {
  label: string;
  search: string[];
  icon: typeof Activity;
};

const tabs: TabDef[] = [
  { label: "Overview", search: ["Migration Topology Studio"], icon: Activity },
  { label: "Connections", search: ["Connections", "Connection Studio"], icon: Cable },
  { label: "Source & Target", search: ["SOURCE & TARGET WORKSPACE", "Connected Systems"], icon: Database },
  { label: "Topology", search: ["MIGRATION TOPOLOGY"], icon: GitBranch },
  { label: "Business Context", search: ["BUSINESS & ARCHITECTURE CONTEXT"], icon: FileText },
  { label: "KMITORA Capability Coverage", search: ["KMITORA CAPABILITY COVERAGE", "Capability Coverage"], icon: ShieldCheck },
  { label: "KMITORA Intelligence", search: ["KMITORA INTELLIGENCE", "ENTERPRISE INTELLIGENCE"], icon: Network },
  { label: "Migration Intent", search: ["PROMPT-DRIVEN MIGRATION", "Migration Intent"], icon: Sparkles },
  { label: "Readiness", search: ["READINESS", "Connection Readiness"], icon: ShieldCheck },
];

function scrollToSection(searchTerms: string[]) {
  const elements = Array.from(
    document.querySelectorAll<HTMLElement>(
      "h1,h2,h3,.eyebrow,.sectionTitle,.panelHeader"
    )
  );

  const target = elements.find((element) => {
    const text = (element.textContent || "").toLowerCase();
    return searchTerms.some((term) => text.includes(term.toLowerCase()));
  });

  const section =
    target?.closest<HTMLElement>(".panel,section,.km-st-dashboard,.pageTitle") ??
    target;

  section?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

export default function ConnectWorkspaceTabs() {
  return (
    <nav className="km-connect-tabs" aria-label="Connect workspace sections">
      {tabs.map(({ label, search, icon: Icon }) => (
        <button
          type="button"
          key={label}
          onClick={() => scrollToSection(search)}
        >
          <Icon size={14} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

