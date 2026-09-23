import { useEffect, useMemo, useState } from "react";
import {
  BrainCircuit,
  CheckCircle2,
  Database,
  PlayCircle,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import {
  getLearningDecision,
  getMasterCatalog,
  getMasterScenario,
  runMasterBatch,
  runMasterScenario,
  type MasterCatalogSummary,
  type MasterScenario,
  type ScenarioOutcome,
} from "../services/a000OneMillionApi";
import {
  saveSelectedOutcome,
  saveSelectedScenario,
} from "../services/a000ScenarioContext";

type Props = {
  onNavigate?: (page: string) => void;
};

export default function A000CapabilityUniverse({
  onNavigate,
}: Props) {
  const [catalog, setCatalog] =
    useState<MasterCatalogSummary | null>(null);
  const [serialText, setSerialText] =
    useState("825251");
  const [scenario, setScenario] =
    useState<MasterScenario | null>(null);
  const [outcome, setOutcome] =
    useState<ScenarioOutcome | null>(null);
  const [learning, setLearning] =
    useState<Record<string, unknown> | null>(null);
  const [batchStart, setBatchStart] =
    useState("825251");
  const [batchEnd, setBatchEnd] =
    useState("825260");
  const [batchResult, setBatchResult] =
    useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    getMasterCatalog()
      .then(setCatalog)
      .catch((reason) =>
        setError(
          reason instanceof Error
            ? reason.message
            : String(reason),
        ),
      );
  }, []);

  const safe = useMemo(
    () =>
      outcome !== null &&
      outcome.status === "PASS" &&
      !outcome.production_write_executed &&
      !outcome.production_cutover_executed &&
      !outcome.destructive_action_executed &&
      !outcome.policy_bypass_executed &&
      !outcome.approval_bypass_executed &&
      !outcome.tenant_or_context_leak_detected,
    [outcome],
  );

  async function lookup(): Promise<void> {
    const serial = Number(serialText);

    if (!Number.isInteger(serial)) {
      setError("Enter an integer serial between 1 and 1,000,000.");
      return;
    }

    setBusy("lookup");
    setError("");
    setOutcome(null);
    setLearning(null);

    try {
      const item = await getMasterScenario(serial);
      setScenario(item);
      saveSelectedScenario(item);
    } catch (reason) {
      setScenario(null);
      setError(
        reason instanceof Error
          ? reason.message
          : String(reason),
      );
    } finally {
      setBusy("");
    }
  }

  async function runOne(): Promise<void> {
    if (!scenario) {
      setError("Lookup a scenario before activation.");
      return;
    }

    setBusy("run");
    setError("");

    try {
      const result = await runMasterScenario(
        scenario.serial,
      );
      setOutcome(result);
      saveSelectedOutcome(result);

      const learningDecision =
        await getLearningDecision(result);
      setLearning(learningDecision);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : String(reason),
      );
    } finally {
      setBusy("");
    }
  }

  async function runBatch(): Promise<void> {
    const start = Number(batchStart);
    const end = Number(batchEnd);

    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 1 ||
      end > 1_000_000 ||
      start > end
    ) {
      setError("Enter a valid serial range.");
      return;
    }

    if (end - start + 1 > 10_000) {
      setError(
        "Frontend batch activation is limited to 10,000 scenarios per run.",
      );
      return;
    }

    setBusy("batch");
    setError("");

    try {
      setBatchResult(
        await runMasterBatch(start, end),
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : String(reason),
      );
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="page a1mPage">
      <section className="a1mHero">
        <div>
          <span className="eyebrow">
            A000 MASTER CAPABILITY UNIVERSE
          </span>
          <h1>1,000,000 governed capability scenarios</h1>
          <p>
            Search, activate and carry a governed A000
            scenario through KMITORA's 13-stage lifecycle.
            Production write, cutover, destructive actions
            and policy bypass remain denied by default.
          </p>
        </div>
        <div className="a1mHeroStatus">
          <ShieldCheck size={24} />
          <strong>DEFAULT DENY</strong>
          <span>DEV simulation only</span>
        </div>
      </section>

      <section className="a1mMetrics">
        <div>
          <BrainCircuit size={18} />
          <span>Master scenarios</span>
          <strong>
            {catalog?.total_scenarios.toLocaleString() ??
              "1,000,000"}
          </strong>
        </div>
        <div>
          <Sparkles size={18} />
          <span>KQA scenarios</span>
          <strong>
            {catalog?.kqa_count.toLocaleString() ??
              "174,750"}
          </strong>
        </div>
        <div>
          <Database size={18} />
          <span>Master layers</span>
          <strong>
            {catalog?.master_layers.length ?? 11}
          </strong>
        </div>
        <div>
          <ShieldCheck size={18} />
          <span>Unsupported critical actions</span>
          <strong>0</strong>
        </div>
      </section>

      {error && (
        <div className="a1mAlert" role="alert">
          {error}
        </div>
      )}

      <section className="a1mGrid">
        <article className="panel a1mLookupPanel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">
                SCENARIO LOOKUP
              </span>
              <h3>Find a master serial</h3>
              <p>
                Example: 825251 maps to KQA-000001.
              </p>
            </div>
          </div>

          <div className="a1mInlineForm">
            <input
              aria-label="Master serial"
              data-testid="a000-serial-input"
              value={serialText}
              onChange={(event) =>
                setSerialText(event.target.value)
              }
              inputMode="numeric"
            />
            <button
              type="button"
              onClick={() => void lookup()}
              disabled={busy !== ""}
              data-testid="a000-lookup"
            >
              <Search size={16} />
              Lookup
            </button>
          </div>

          {scenario && (
            <div
              className="a1mScenarioCard"
              data-testid="a000-scenario-card"
            >
              <div className="a1mScenarioHead">
                <div>
                  <span>SELECTED</span>
                  <strong>
                    {scenario.scenario_id}
                  </strong>
                </div>
                <b>{scenario.kqa_id ?? "MASTER"}</b>
              </div>

              <dl>
                <div>
                  <dt>Layer</dt>
                  <dd>{scenario.layer}</dd>
                </div>
                <div>
                  <dt>KQA category</dt>
                  <dd>
                    {scenario.kqa_category ?? "Not applicable"}
                  </dd>
                </div>
                <div>
                  <dt>Environment</dt>
                  <dd>{scenario.environment}</dd>
                </div>
              </dl>

              <div className="a1mSafetyRow">
                <span>Production write: DENIED</span>
                <span>Cutover: DENIED</span>
                <span>Destructive: DENIED</span>
                <span>Policy bypass: DENIED</span>
              </div>

              <div className="buttonRow">
                <button
                  type="button"
                  className="primary"
                  onClick={() => void runOne()}
                  disabled={busy !== ""}
                  data-testid="a000-run-one"
                >
                  <PlayCircle size={16} />
                  {busy === "run"
                    ? "Running..."
                    : "Activate Safe Scenario"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onNavigate?.("understand")
                  }
                  data-testid="a000-carry-lifecycle"
                >
                  Carry into 13-Stage Lifecycle
                </button>
              </div>
            </div>
          )}
        </article>

        <article className="panel a1mResultPanel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">
                DETERMINISTIC EVIDENCE
              </span>
              <h3>Activation result</h3>
            </div>
          </div>

          {!outcome ? (
            <div className="a1mEmpty">
              Activate a scenario to generate evidence.
            </div>
          ) : (
            <div data-testid="a000-outcome">
              <div
                className={`a1mOutcome ${safe ? "pass" : "fail"}`}
              >
                {safe ? (
                  <CheckCircle2 size={22} />
                ) : (
                  <ShieldCheck size={22} />
                )}
                <div>
                  <span>STATUS</span>
                  <strong>{outcome.status}</strong>
                </div>
              </div>

              <div className="a1mTruthGrid">
                <span>
                  Production write
                  <strong>
                    {String(
                      outcome.production_write_executed,
                    )}
                  </strong>
                </span>
                <span>
                  Cutover
                  <strong>
                    {String(
                      outcome.production_cutover_executed,
                    )}
                  </strong>
                </span>
                <span>
                  Policy bypass
                  <strong>
                    {String(
                      outcome.policy_bypass_executed,
                    )}
                  </strong>
                </span>
                <span>
                  Rollback/evidence
                  <strong>
                    {String(
                      outcome.rollback_evidence_complete,
                    )}
                  </strong>
                </span>
              </div>

              <div className="a1mHash">
                <span>Evidence SHA-256</span>
                <code>{outcome.evidence_sha256}</code>
              </div>

              {learning && (
                <div
                  className="a1mLearning"
                  data-testid="a000-learning"
                >
                  <span>LEARNING DECISION</span>
                  <strong>
                    {String(
                      learning.learning_state ??
                        "UNAVAILABLE",
                    )}
                  </strong>
                  <p>
                    {String(learning.reason ?? "")}
                  </p>
                </div>
              )}
            </div>
          )}
        </article>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <span className="eyebrow">
              SAFE BATCH ACTIVATION
            </span>
            <h3>Run up to 10,000 scenarios per UI batch</h3>
            <p>
              Large one-million runs remain available through
              the supplied PowerShell runner.
            </p>
          </div>
        </div>

        <div className="a1mBatchForm">
          <label>
            <span>Start serial</span>
            <input
              value={batchStart}
              onChange={(event) =>
                setBatchStart(event.target.value)
              }
            />
          </label>
          <label>
            <span>End serial</span>
            <input
              value={batchEnd}
              onChange={(event) =>
                setBatchEnd(event.target.value)
              }
            />
          </label>
          <button
            type="button"
            className="primary"
            onClick={() => void runBatch()}
            disabled={busy !== ""}
          >
            Run Governed Batch
          </button>
        </div>

        {batchResult && (
          <pre
            className="a1mBatchResult"
            data-testid="a000-batch-result"
          >
            {JSON.stringify(batchResult, null, 2)}
          </pre>
        )}
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <span className="eyebrow">
              KQA 174,750 TAXONOMY
            </span>
            <h3>Next-generation assurance categories</h3>
          </div>
        </div>

        <div className="a1mTable">
          <div className="a1mTableHead">
            <span>Serial range</span>
            <span>Capability</span>
            <span>Count</span>
            <span>Purpose</span>
          </div>
          {(catalog?.kqa_categories ?? []).map(
            (category) => (
              <div
                className="a1mTableRow"
                key={category.start}
              >
                <span>
                  {category.start.toLocaleString()}–
                  {category.end.toLocaleString()}
                </span>
                <strong>{category.name}</strong>
                <span>
                  {category.count.toLocaleString()}
                </span>
                <span>{category.purpose}</span>
              </div>
            ),
          )}
        </div>
      </section>
    </div>
  );
}

