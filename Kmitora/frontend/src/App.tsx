import { useEffect, useState } from "react";
import type { AdvancedRuntime } from "./types/advancedRuntime";
import Sidebar from "./components/Sidebar";
import A000Panel from "./components/A000Panel";
import ControlTowerPremium from "./pages/ControlTowerPremium";
import ControlTowerWorkspace from "./pages/ControlTowerWorkspace";
import Discover from "./pages/Discover";
import Validate from "./pages/Validate";
import Migrate from "./pages/Migrate";
import Test from "./pages/Test";
import Learn from "./pages/Learn";
import Reconcile from "./pages/Reconcile";
import Evidence from "./pages/Evidence";
import Transform from "./pages/Transform";
import SystemExplorer from "./pages/SystemExplorer";
import AgentsCapabilitiesWorkspace from "./pages/AgentsCapabilitiesWorkspace";
import ApprovalCenter from "./pages/ApprovalCenter";
import ActivityStream from "./pages/ActivityStream";
import PlatformSettings from "./pages/PlatformSettings";
import KMITORAUnifiedConnect from "./pages/KMITORAUnifiedConnect";
import ProfessionalLifecycleStageWorkspace from "./components/ProfessionalLifecycleStageWorkspace";
import A000CapabilityUniverse from "./pages/A000CapabilityUniverse";
import DigitalTwinGraph from "./pages/DigitalTwinGraph";
import DomainIntelligence from "./pages/DomainIntelligence";
import MegaDemoControlRoom from "./pages/MegaDemoControlRoom";
import CinematicExecutiveDemo from "./pages/CinematicExecutiveDemo";
import DemoOperations from "./pages/DemoOperations";

import WorkflowAutomationCenter from "./pages/WorkflowAutomationCenter";
import NeuralIntelligenceCenter from "./pages/NeuralIntelligenceCenter";
export default function App() {
  const initialPage =
    new URLSearchParams(window.location.search).get("page") ?? "overview";
  const [active,setActive] = useState(initialPage);
  const [advancedRuntime, setAdvancedRuntime] =
    useState<AdvancedRuntime | null>(null);

  // KMITORA_ASSISTANT_PAGE_CONTEXT_BRIDGE_V1
  useEffect(() => {
    localStorage.setItem("kmitora.ui.activePage", active);
    window.dispatchEvent(
      new CustomEvent("kmitora:page-context", {
        detail: { page: active },
      }),
    );
  }, [active]);

  useEffect(() => {
    const handleAssistantNavigation = (event: Event) => {
      const detail = (event as CustomEvent<{ page?: string }>).detail;
      const requestedPage = String(detail?.page ?? "").trim();
      if (requestedPage) {
        setActive(requestedPage);
      }
    };

    window.addEventListener("kmitora:navigate", handleAssistantNavigation as EventListener);
    return () => {
      window.removeEventListener("kmitora:navigate", handleAssistantNavigation as EventListener);
    };
  }, []);

  const page = (() => {
    switch(active) {
      case "overview": return <ControlTowerWorkspace />;
      case "understand": return (
        <KMITORAUnifiedConnect
          onNavigate={setActive}
          advancedRuntime={advancedRuntime}
        />
      );
      case "discover": return (
        <Discover
          onNavigate={setActive}
          advancedRuntime={advancedRuntime}
        />
      );
      case "detect": return <ProfessionalLifecycleStageWorkspace stageKey="detect" onNavigate={setActive}/>;
      case "diagnose": return <ProfessionalLifecycleStageWorkspace stageKey="diagnose" onNavigate={setActive}/>;
      case "predict": return <ProfessionalLifecycleStageWorkspace stageKey="predict" onNavigate={setActive}/>;
      case "recommend": return <ProfessionalLifecycleStageWorkspace stageKey="recommend" onNavigate={setActive}/>;
      case "simulate": return <ProfessionalLifecycleStageWorkspace stageKey="simulate" onNavigate={setActive}/>;
      case "execute": return <Migrate/>;
      case "test": return <Test onNavigate={setActive}/>;
      case "validate": return <Validate/>;
      case "reconcile": return <Reconcile/>;
      case "evidence": return <Evidence/>;
      case "transform": return <Transform/>;
      case "prove": return <Evidence/>;
      case "learn": return <Learn/>;
      case "system": return <SystemExplorer/>;
      case "agents": return <AgentsCapabilitiesWorkspace onNavigate={setActive}/>;
      case "approvals": return <ApprovalCenter/>;
      case "activity": return <ActivityStream/>;
      case "capabilities1m": return <A000CapabilityUniverse onNavigate={setActive}/>;
      case "digitalTwinGraph": return <DigitalTwinGraph/>;
      case "domainIntelligence": return <DomainIntelligence onNavigate={setActive}/>;
      case "megaDemo": return <MegaDemoControlRoom/>;
      case "cinematicDemo": return <CinematicExecutiveDemo/>;
      case "demoOperations": return <DemoOperations/>;
      case "settings": return <PlatformSettings/>;
      case "workflowAutomation": return <WorkflowAutomationCenter/>;
      case "neuralIntelligence": return <NeuralIntelligenceCenter/>;
      default: return <ControlTowerPremium />;
    }
  })();

  return <div className="appShell">
    <Sidebar active={active} onSelect={setActive}/>
    <main className="mainArea">{page}</main>
    <A000Panel activePage={active} onNavigate={setActive} onAdvancedRuntime={setAdvancedRuntime}/>
  </div>
}









