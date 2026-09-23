import { Brain, CheckCircle2, LoaderCircle, ShieldCheck, Wrench } from "lucide-react";
import { capabilityRegistry } from "../config/capabilityRegistry";

function statusClass(status: string) {
  if (status === "ACTIVE") return "success";
  if (status === "GOVERNED") return "review";
  if (status === "ADAPTER_REQUIRED") return "reject";
  return "review";
}

export default function A000CapabilityCoveragePanel() {
  const foundation = capabilityRegistry.filter((item) => item.status === "FOUNDATION").length;
  const adapters = capabilityRegistry.filter((item) => item.status === "ADAPTER_REQUIRED").length;
  const governed = capabilityRegistry.filter((item) => item.status === "GOVERNED").length;

  return (
    <div className="panel" style={{ marginTop: 18 }}>
      <div className="panelHeader">
        <div>
          <span className="eyebrow">KMITORA CAPABILITY COVERAGE</span>
          <h3>Capability Coverage & Execution Truth</h3>
          <p>
            KMITORA distinguishes intelligence that is available from live discovery that still requires an authorized adapter.
            Nothing is reported as scanned, remediated or executed without evidence.
          </p>
        </div>
        <span className="statusPill review">FOUNDATION READY</span>
      </div>

      <div className="metricStrip">
        <div><Brain /><span>Capabilities</span><strong>{capabilityRegistry.length}</strong></div>
        <div><CheckCircle2 /><span>Backend Foundations</span><strong>{foundation}</strong></div>
        <div><Wrench /><span>Adapters Required</span><strong>{adapters}</strong></div>
        <div><ShieldCheck /><span>Governed Actions</span><strong>{governed}</strong></div>
      </div>

      <div className="checkList" style={{ marginTop: 14 }}>
        {capabilityRegistry.map((capability) => (
          <div className="checkRow" key={capability.id}>
            {capability.status === "ADAPTER_REQUIRED" ? <LoaderCircle size={16} /> : <CheckCircle2 size={16} />}
            <span>{capability.name}<small style={{ display: "block" }}>{capability.purpose}</small></span>
            <small className={`statusPill ${statusClass(capability.status)}`}>{capability.status.replaceAll("_", " ")}</small>
          </div>
        ))}
      </div>
    </div>
  );
}


