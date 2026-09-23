import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, FlaskConical, PlayCircle, ShieldCheck, XCircle } from "lucide-react";

type Scenario = {
  id: string;
  name: string;
  folder: string;
  features?: string[];
};

type CertificationResult = {
  status?: string;
  trace_id?: string;
  evidence_path?: string;
  source?: { row_counts?: Record<string, number> };
  self_healing?: { repair_count?: number; ambiguous_repairs_performed?: boolean };
  target?: { id?: string; environment?: string; replace_load?: { counts?: Record<string, number>; total_loaded?: number } };
  post_load_reconciliation?: Array<{ entity?: string; expected_count?: number; actual_count?: number; matched?: boolean; actual_sha256?: string }>;
  safety?: { target_production_writes_after?: number; cutover_after?: string; production_authorized?: boolean; cutover_authorized?: boolean };
};

export default function DevE2ECertificationPanel() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selected, setSelected] = useState("failure_storm");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CertificationResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/a000/dev-e2e/scenarios")
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body?.payload?.message || `Scenario catalog failed: ${response.status}`);
        return body?.payload?.scenarios ?? [];
      })
      .then((items) => {
        if (!cancelled && Array.isArray(items)) setScenarios(items);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not load DEV E2E scenarios.");
      });
    return () => { cancelled = true; };
  }, []);

  const activeScenario = useMemo(
    () => scenarios.find((scenario) => scenario.folder === selected) ?? scenarios[0],
    [scenarios, selected],
  );

  async function runCertification() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/v1/a000/dev-e2e/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario: selected }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.payload?.message || `DEV E2E certification failed: ${response.status}`);
      setResult(body?.payload ?? body);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "DEV E2E certification failed.");
    } finally {
      setLoading(false);
    }
  }

  const reconciled = result?.post_load_reconciliation?.every((item) => item.matched === true) ?? false;
  const safe = result?.safety?.target_production_writes_after === 0 && result?.safety?.cutover_after === "DISABLED";

  return (
    <section className="migrateSection" data-testid="dev-e2e-certification-panel">
      <div className="migrateSectionHeader">
        <div>
          <span className="migrateSectionLabel">A000 UNIVERSAL DEV CERTIFICATION</span>
          <h2>Complicated source → self-heal → target replace-load → exact reconciliation</h2>
          <p>
            Runs deterministic DEV-only scenario data through Source API, A000 repair rules, PostgreSQL DEV replace-load,
            target read-back, SHA-256 reconciliation and production-safety checks.
          </p>
        </div>
        <FlaskConical size={24} />
      </div>

      <div className="migrateControlPanel panel">
        <div className="migrateControlActions">
          <label>
            Scenario{" "}
            <select value={selected} onChange={(event) => setSelected(event.target.value)} disabled={loading}>
              {(scenarios.length ? scenarios : [{ folder: "failure_storm", id: "UNIVERSAL_FAILURE_STORM_001", name: "Universal Deterministic Failure Storm" }]).map((scenario) => (
                <option key={scenario.folder} value={scenario.folder}>{scenario.name}</option>
              ))}
            </select>
          </label>
          <button className="primary" type="button" onClick={() => void runCertification()} disabled={loading} data-testid="run-dev-e2e-certification">
            <PlayCircle size={16} />
            {loading ? "Running DEV certification..." : "Run Universal DEV E2E"}
          </button>
        </div>

        {activeScenario?.features?.length ? (
          <div className="checkList">
            {activeScenario.features.map((feature) => (
              <div className="checkRow active" key={feature}><span className="dot success" />{feature}</div>
            ))}
          </div>
        ) : null}

        {error ? (
          <div className="migrateAlert error" data-testid="dev-e2e-error"><XCircle size={18} /><span>{error}</span></div>
        ) : null}

        {result ? (
          <div data-testid="dev-e2e-result">
            <div className="migrateDispositionGrid">
              <div><span>Status</span><strong>{result.status ?? "UNKNOWN"}</strong></div>
              <div><span>Repairs</span><strong>{result.self_healing?.repair_count ?? 0}</strong></div>
              <div><span>Target Loaded</span><strong>{result.target?.replace_load?.total_loaded ?? 0}</strong></div>
              <div><span>Reconciliation</span><strong>{reconciled ? "PASS" : "FAIL"}</strong></div>
              <div><span>Production Writes</span><strong>{result.safety?.target_production_writes_after ?? "-"}</strong></div>
              <div><span>Cutover</span><strong>{result.safety?.cutover_after ?? "-"}</strong></div>
            </div>

            <div className="migrateSafetyNote">
              {result.status === "PASS" && reconciled && safe ? <CheckCircle2 size={18} /> : <ShieldCheck size={18} />}
              <div>
                <strong>{result.status === "PASS" && reconciled && safe ? "DEV E2E certification passed" : "Certification evidence requires review"}</strong>
                <span>Trace: {result.trace_id ?? "-"} · Evidence: {result.evidence_path ?? "-"}</span>
              </div>
            </div>

            <div className="checkList">
              {(result.post_load_reconciliation ?? []).map((item) => (
                <div className={item.matched ? "checkRow active" : "checkRow"} key={item.entity}>
                  <span className={item.matched ? "dot success" : "dot warning"} />
                  {item.entity}: {item.actual_count}/{item.expected_count} rows · {item.matched ? "exact match" : "mismatch"}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
