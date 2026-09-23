import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";

type Status = {
  program?: string;
  connection_registry?: { persistent?: boolean; secret_protection?: string };
  formal_gates?: { computed?: Record<string, string> };
  production_authorized?: boolean;
  cutover_authorized?: boolean;
};

export default function Closure20StatusPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  useEffect(() => {
    fetch("/api/v1/a000/closure20/status")
      .then((r) => r.json())
      .then((b) => setStatus(b?.payload ?? b))
      .catch(() => setStatus(null));
  }, []);
  if (!status) return null;
  return (
    <section className="migrateSection" data-testid="closure20-status-panel">
      <div className="migrateSectionHeader">
        <div><span className="migrateSectionLabel">A000 CLOSURE-20</span><h2>Autonomy, assurance & readiness</h2></div>
        <ShieldCheck size={24} />
      </div>
      <div className="migrateDispositionGrid">
        <div><span>Persistent Connections</span><strong>{status.connection_registry?.persistent ? "ACTIVE" : "HOLD"}</strong></div>
        <div><span>Secret Protection</span><strong>{status.connection_registry?.secret_protection ?? "-"}</strong></div>
        <div><span>Production Authority</span><strong>{status.production_authorized ? "ENABLED" : "FALSE"}</strong></div>
        <div><span>Cutover Authority</span><strong>{status.cutover_authorized ? "ENABLED" : "FALSE"}</strong></div>
      </div>
      <div className="checkList">
        {Object.entries(status.formal_gates?.computed ?? {}).map(([gate, value]) => (
          <div className={value === "PASS" ? "checkRow active" : "checkRow"} key={gate}><span className={value === "PASS" ? "dot success" : "dot warning"} />{gate}: {value}</div>
        ))}
      </div>
    </section>
  );
}
