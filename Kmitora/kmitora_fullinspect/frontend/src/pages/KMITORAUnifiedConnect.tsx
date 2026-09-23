import React, { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import A000ScenarioContextBanner from "../components/A000ScenarioContextBanner";
import { UnderstandIntelligencePanel } from "../components/UnderstandIntelligencePanel";
import KMITORASourceConnectLive from "../features/source-connect/KMITORASourceConnectLive";
import KMITORATargetConnectLive from "../features/target-connect/KMITORATargetConnectLive";
import KMITORABusinessRequirementsWorkspace from "../features/business-requirements/KMITORABusinessRequirementsWorkspace";
import "../features/target-connect/connect-unified.css";
import "../features/target-connect/connect-topbar-stepper.css";

type Props = {
  onNavigate?: (page: string) => void;
  advancedRuntime?: unknown;
};

const CHECK = "\u2713";
const MIDDOT = "\u00B7";

export default function KMITORAUnifiedConnect({
  onNavigate,
  advancedRuntime,
}: Props) {
  const [sourceConnected, setSourceConnected] = useState(false);
  const [targetConnected, setTargetConnected] = useState(false);
  const [requirementsOpen, setRequirementsOpen] = useState(false);
  const [requirementsReady, setRequirementsReady] = useState(() => Boolean(localStorage.getItem("kmitora.business.requirements.v1")));

  const refreshState = async () => {
    try {
      const [s, t] = await Promise.all([
        fetch("/source-api/v1/sources").then((r) => r.ok ? r.json() : []),
        fetch("/target-api/v1/targets").then((r) => r.ok ? r.json() : []),
      ]);
      setSourceConnected(Array.isArray(s) && s.some((x: any) => x.status === "connected"));
      setTargetConnected(Array.isArray(t) && t.some((x: any) => x.status === "connected"));
    } catch { /* preserve state during sidecar restart */ }
  };

  useEffect(() => {
    void refreshState();
    const sourceListener = (e: Event) => setSourceConnected(Boolean((e as CustomEvent)?.detail?.connected));
    const targetListener = (e: Event) => setTargetConnected(Boolean((e as CustomEvent)?.detail?.connected));
    const requirementListener = (e: Event) => setRequirementsReady(Boolean((e as CustomEvent)?.detail?.ready));
    window.addEventListener("kmitora:source-state", sourceListener as EventListener);
    window.addEventListener("kmitora:target-state", targetListener as EventListener);
    window.addEventListener("kmitora:business-requirement-state", requirementListener as EventListener);
    const timer = window.setInterval(() => void refreshState(), 4000);
    return () => {
      window.removeEventListener("kmitora:source-state", sourceListener as EventListener);
      window.removeEventListener("kmitora:target-state", targetListener as EventListener);
      window.removeEventListener("kmitora:business-requirement-state", requirementListener as EventListener);
      window.clearInterval(timer);
    };
  }, []);

  const ready = sourceConnected && targetConnected;

  return <div className="ku-page">
      <A000ScenarioContextBanner />
    <header className="ku-header"><div className="ku-eyebrow">KMITORA CONNECT</div><h1>Source &amp; Target Systems</h1><p>Connect both sides, inspect actual data, then capture business requirements before governed discovery and migration planning.</p></header>

    {advancedRuntime && (
      <UnderstandIntelligencePanel
        runtime={advancedRuntime}
        stage="Understand"
      />
    )}
    <section className="ku-strip">
      <div><strong>1</strong><span>Connect Source {sourceConnected ? CHECK : ""}</span></div>
      <ChevronRight size={17} className="ku-arrow" />
      <div><strong>2</strong><span>Connect Target {targetConnected ? CHECK : ""}</span></div>
      <ChevronRight size={17} className="ku-arrow" />
      <div className={requirementsReady ? "ku-done" : requirementsOpen ? "ku-active" : ""}><strong>3</strong><span>Business Requirement {requirementsReady ? CHECK : ""}</span></div>
      <ChevronRight size={17} className="ku-arrow" />
      <div><strong>4</strong><span>Discover &amp; Understand</span></div>
    </section>
    {!requirementsOpen && <>
      <div className="ku-section"><div className="ku-section-title"><span>SOURCE SYSTEM</span><strong>F1 {MIDDOT} Current State</strong></div><KMITORASourceConnectLive /></div>
      <div className="ku-section"><div className="ku-section-title target"><span>TARGET SYSTEM</span><strong>F2 {MIDDOT} Desired State</strong></div><KMITORATargetConnectLive /></div>
      <section className="ku-next">
        <div><span>{ready ? "READY" : "CONNECTIONS REQUIRED"}</span><h2>Business Requirements &amp; Rules</h2><p>{ready ? "Source and Target are connected. Open UI-005 to capture the migration objective and governed business rules." : "Connect both Source and Target before continuing to business requirements."}</p></div>
        <button disabled={!ready} onClick={() => setRequirementsOpen(true)}>Continue to Business Requirements</button>
      </section>
    </>}
    {requirementsOpen && <KMITORABusinessRequirementsWorkspace onClose={() => setRequirementsOpen(false)} onContinue={() => onNavigate?.("discover")} />}
  </div>;
}