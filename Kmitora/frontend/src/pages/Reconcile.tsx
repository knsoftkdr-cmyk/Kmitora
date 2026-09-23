import A000ScenarioContextBanner from "../components/A000ScenarioContextBanner";
import ReconcilePremiumWorkspace from "../components/ReconcilePremiumWorkspace";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Eye,
  GitBranch,
  Network,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import {
  getLatestExecutionForMigration,
  getEvidenceById,
  postReconciliation,
  postEvidence,
} from "../services/api";

import KMITORACopilotOverview from "../components/KMITORACopilotOverview";

type ViewMode =
  | "SOURCE"
  | "MAPPING"
  | "TARGET"
  | "RECONCILE"
  | "EVIDENCE";

type ReconciliationResult = {
  reconciliation_id?: string;
  execution_id?: string;
  migration_id?: string;
  approval_id?: string;
  status?: string;
  input_record_count?: number;
  simulated_record_count?: number;
  matched_records?: number;
  unmatched_source?: number;
  unexpected_simulated?: number;
  failed_records?: number;
  count_variance?: number;
  target_write_count?: number;
  production_action_count?: number;
  production_action_executed?: boolean;
  target_write_executed?: boolean;
  reconciliation_mode?: string;
  held_records?: Record<string, number>;
};

type EvidenceCertificate = {
  evidence_id?: string;
  created_at?: string;
  migration_id?: string;
  approval_id?: string;
  execution_id?: string;
  reconciliation_id?: string;
  status?: string;
  record_result_count?: number;
  transformation_evidence_count?: number;
  business_rule_count?: number;
  target_write_count?: number;
  production_action_count?: number;
  persistence?: string;
};

type EvidencePackage = {
  evidence_id?: string;
  created_at?: string;
  migration_id?: string;
  approval_id?: string;
  execution_id?: string;
  reconciliation_id?: string;
  status?: string;

  discovery_summary?: Record<string, unknown>;
  approval_summary?: Record<string, unknown>;
  execution_summary?: Record<string, unknown>;
  reconciliation_summary?: Record<string, unknown>;

  record_results?: Array<any>;
  transformation_evidence?: Array<any>;
  business_rules?: Array<any>;

  safety?: {
    production_executed?: boolean;
    production_action_executed?: boolean;
    target_write_executed?: boolean;
    target_write_count?: number;
    production_action_count?: number;
  };
};

const LAST_EXECUTION_KEY =
  "kmitora.dev.lastExecutionId";

const LAST_RECONCILIATION_KEY =
  "kmitora.dev.lastReconciliation";

const LAST_EVIDENCE_KEY =
  "kmitora.dev.lastEvidence";

function readStoredJson<T>(
  key: string
): T | null {
  try {
    const value =
      localStorage.getItem(key);

    return value
      ? (JSON.parse(value) as T)
      : null;
  } catch {
    return null;
  }
}

export default function Reconcile() {
  const [executionId, setExecutionId] =
    useState("");

  const [result, setResult] =
    useState<ReconciliationResult | null>(
      null
    );

  const [evidence, setEvidence] =
    useState<EvidencePackage | null>(
      null
    );

  const [view, setView] =
    useState<ViewMode>("RECONCILE");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      const storedRecon = readStoredJson<ReconciliationResult>(LAST_RECONCILIATION_KEY);
      const storedEvidenceCertificate = readStoredJson<EvidenceCertificate>(LAST_EVIDENCE_KEY);
      let migrationId = "";
      try {
        const rawDiscovery = localStorage.getItem("kmitora.dev.discoveryResult");
        const discovery = rawDiscovery ? JSON.parse(rawDiscovery) : null;
        migrationId = String(discovery?.migration_id ?? "").trim();
      } catch {}

      let authoritativeExecution: any = null;
      if (migrationId) {
        try {
          authoritativeExecution = await getLatestExecutionForMigration(migrationId);
        } catch (executionLookupError) {
          console.warn("KMITORA Reconcile authoritative execution lookup failed", executionLookupError);
        }
      }

      if (cancelled) return;
      if (String(authoritativeExecution?.status ?? "").toUpperCase() === "POST_LOAD_COMPLETED" && authoritativeExecution?.execution_id) {
        setExecutionId(String(authoritativeExecution.execution_id));
        localStorage.setItem(LAST_EXECUTION_KEY, String(authoritativeExecution.execution_id));
      } else {
        setExecutionId("");
      }

      if (storedRecon && (!authoritativeExecution?.execution_id || storedRecon.execution_id === authoritativeExecution.execution_id)) {
        setResult(storedRecon);
      } else {
        setResult(null);
      }
      if (storedEvidenceCertificate?.evidence_id) {
        try {
          const evidenceResponse = await getEvidenceById(storedEvidenceCertificate.evidence_id);
          const authoritativeEvidence = evidenceResponse?.payload ?? evidenceResponse;
          if (!cancelled && authoritativeEvidence) setEvidence(authoritativeEvidence);
        } catch (evidenceLookupError) {
          console.warn("KMITORA Reconcile authoritative evidence lookup failed", evidenceLookupError);
          if (!cancelled) setEvidence(null);
        }
      } else {
        setEvidence(null);
      }
    };

    void hydrate();
    return () => { cancelled = true; };
  }, []);

  const passed =
    result?.status === "PASS";

  const recordResults =
    evidence?.record_results ?? [];

  const transformationEvidence =
    evidence?.transformation_evidence ??
    [];

  const sourceRecords = useMemo(
    () =>
      recordResults.map((record) => ({
        sequence: record.sequence,
        entity: record.entity,
        row: record.row,
        status: record.status,
        source_record:
          record.source_record,
      })),
    [recordResults]
  );

  const targetSimulation = useMemo(
    () =>
      recordResults.map((record) => ({
        sequence: record.sequence,
        entity: record.entity,
        row: record.row,
        status: record.status,
        transformations:
          record.transformations ?? [],
        target_write_executed:
          record.target_write_executed ??
          false,
        production_action_executed:
          record.production_action_executed ??
          false,
      })),
    [recordResults]
  );

  const inputCount =
    result?.input_record_count ?? 0;

  const simulatedCount =
    result?.simulated_record_count ?? 0;

  const matchedCount =
    result?.matched_records ?? 0;

  const failedCount =
    result?.failed_records ?? 0;

  const variance =
    result?.count_variance ?? 0;

  const unmatched =
    result?.unmatched_source ?? 0;

  const unexpected =
    result?.unexpected_simulated ?? 0;

  const targetWrites =
    result?.target_write_count ?? 0;

  const productionActions =
    result?.production_action_count ?? 0;

  const matchRate =
    inputCount > 0
      ? Math.round(
          (matchedCount / inputCount) *
            100
        )
      : 0;

  const isPostLoad = String(result?.reconciliation_mode ?? "").toUpperCase() === "POST_LOAD_DEV";
  const safetyPass =
    productionActions === 0 &&
    result?.production_action_executed !== true &&
    (isPostLoad
      ? result?.target_write_executed === true && targetWrites === matchedCount
      : result?.target_write_executed !== true && targetWrites === 0);

  async function runReconciliation() {
    const id =
      executionId.trim();

    if (!id) {
      setError(
        "A governed DEV execution ID is required."
      );
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response =
        await postReconciliation(id);

      const reconciliation =
        response?.payload ??
        response;

      if (!reconciliation) {
        throw new Error(
          "No reconciliation payload returned."
        );
      }

      setResult(reconciliation);

      localStorage.setItem(
        LAST_EXECUTION_KEY,
        id
      );

      localStorage.setItem(
        LAST_RECONCILIATION_KEY,
        JSON.stringify(
          reconciliation
        )
      );

      if (
        reconciliation.status !==
        "PASS"
      ) {
        setEvidence(null);
        setView("RECONCILE");
        return;
      }

      const reconciliationId =
        reconciliation.reconciliation_id;

      if (!reconciliationId) {
        throw new Error(
          "PASS reconciliation did not return reconciliation_id."
        );
      }

      const evidenceResponse =
        await postEvidence(
          reconciliationId
        );

      const evidencePayload =
        evidenceResponse?.payload ??
        evidenceResponse;

      if (!evidencePayload) {
        throw new Error(
          "Evidence package was not returned."
        );
      }

      setEvidence(
        evidencePayload
      );

      const evidenceCertificate: EvidenceCertificate = {
        evidence_id: evidencePayload.evidence_id,
        created_at: evidencePayload.created_at,
        migration_id: evidencePayload.migration_id,
        approval_id: evidencePayload.approval_id,
        execution_id: evidencePayload.execution_id,
        reconciliation_id: evidencePayload.reconciliation_id,
        status: evidencePayload.status,
        record_result_count: Array.isArray(evidencePayload.record_results)
          ? evidencePayload.record_results.length
          : 0,
        transformation_evidence_count: Array.isArray(evidencePayload.transformation_evidence)
          ? evidencePayload.transformation_evidence.length
          : 0,
        business_rule_count: Array.isArray(evidencePayload.business_rules)
          ? evidencePayload.business_rules.length
          : 0,
        target_write_count: Number(evidencePayload?.safety?.target_write_count ?? 0),
        production_action_count: Number(evidencePayload?.safety?.production_action_count ?? 0),
        persistence: "SERVER_AUTHORITATIVE",
      };

      try {
        localStorage.removeItem(LAST_EVIDENCE_KEY);
        localStorage.setItem(LAST_EVIDENCE_KEY, JSON.stringify(evidenceCertificate));
      } catch (storageError) {
        console.warn("KMITORA compact evidence certificate could not be cached", storageError);
      }

      setView("RECONCILE");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Reconciliation failed."
      );
    } finally {
      setLoading(false);
    }
  }

  function ViewButton({
    id,
    label,
    disabled = false,
  }: {
    id: ViewMode;
    label: string;
    disabled?: boolean;
  }) {
    return (
      <button
        type="button"
        onClick={() => setView(id)}
        disabled={disabled}
        className={
          view === id ? "primary" : ""
        }
      >
        {label}
      </button>
    );
  }

  return (
    <div className="page reconcileWorkspacePage">
      <A000ScenarioContextBanner />
      <ReconcilePremiumWorkspace />

      <div className="reconcileHero">

        <div className="reconcileHeroCopy">

          <span className="eyebrow">
            STEP 07
          </span>

          <h1>
            Reconciliation & Verification Center
          </h1>

          <p>
            Compare authoritative source-ready records with the actual DEV target result, mapping and transformation evidence from the same governed KMITORA DEV execution.
          </p>

          <div className="reconcileHeroMeta">

            <span className="reconcileSafetyBadge">
              <ShieldCheck size={14} />
              DEV execution verification
            </span>

            <span className="reconcileSafetyBadge">
              Target writes:{" "}
              {targetWrites}
            </span>

          </div>

        </div>

        <KMITORACopilotOverview
          status={
            passed
              ? "RECONCILED"
              : result
                ? "REVIEW"
                : "WAITING"
          }
          message="Reconciliation health, variance and evidence readiness"
        />

      </div>


      <section className="reconcileSection">

        <div className="reconcileSectionHeader">

          <div>
            <span className="reconcileSectionLabel">
              EXECUTION INPUT
            </span>

            <h2>
              Reconcile governed DEV execution
            </h2>

            <p>
              PASS automatically generates
              the evidence package.
            </p>
          </div>

        </div>


        <div className="panel reconcileRunPanel">

          <input
            value={executionId}
            onChange={(event) =>
              setExecutionId(
                event.target.value
              )
            }
            placeholder="Governed DEV execution ID"
          />

          <button
            type="button"
            className="primary"
            onClick={
              runReconciliation
            }
            disabled={loading}
          >
            <Network size={16} />

            {
              loading
                ? "Processing..."
                : "Reconcile + Generate Evidence"
            }
          </button>

        </div>


        {error && (
          <div className="reconcileAlert">
            <AlertTriangle size={17} />
            <span>{error}</span>
          </div>
        )}

      </section>


      <section className="reconcileSection">

        <div className="reconcileSectionHeader">

          <div>
            <span className="reconcileSectionLabel">
              DATA VIEWS
            </span>

            <h2>
              Open only what you need
            </h2>

            <p>
              Source, mapping, simulated
              target, reconciliation and
              runtime evidence remain
              independently viewable.
            </p>
          </div>

        </div>


        <div className="reconcileViewBar">

          <ViewButton
            id="SOURCE"
            label="Source"
            disabled={!evidence}
          />

          <ViewButton
            id="MAPPING"
            label="Mapping"
            disabled={!evidence}
          />

          <ViewButton
            id="TARGET"
            label="Target Simulation"
            disabled={!evidence}
          />

          <ViewButton
            id="RECONCILE"
            label="Reconcile"
            disabled={!result}
          />

          <ViewButton
            id="EVIDENCE"
            label="Evidence"
            disabled={!evidence}
          />

          <button
            type="button"
            onClick={() =>
              setView("RECONCILE")
            }
          >
            Close View
          </button>

        </div>

      </section>


      {!result && (
        <div className="panel reconcileEmptyState">

          <Network size={26} />

          <div>
            <h3>
              Awaiting Execution
            </h3>

            <p>
              KMITORA does not fabricate
              reconciliation or target data.
              Provide a valid DEV execution ID.
            </p>
          </div>

          <span className="statusPill">
            WAITING
          </span>

        </div>
      )}


      {view === "RECONCILE" &&
        result && (
          <>

            <section className="reconcileSection">

              <div className="reconcileSectionHeader">

                <div>
                  <span className="reconcileSectionLabel">
                    RECONCILIATION HEALTH
                  </span>

                  <h2>
                    Source-to-simulation result
                  </h2>

                  <p>
                    Counts, variance and safety
                    from the current runtime
                    reconciliation.
                  </p>
                </div>

                <span
                  className={`statusPill ${
                    passed
                      ? "success"
                      : "review"
                  }`}
                >
                  {
                    result.status ??
                    "REVIEW"
                  }
                </span>

              </div>


              <div className="reconcileMetrics">

                <div className="reconcileMetricCard">

                  <Database size={18} />

                  <span>Input</span>

                  <strong>
                    {inputCount}
                  </strong>

                  <small>
                    Source records
                  </small>

                </div>


                <div className="reconcileMetricCard">

                  <Eye size={18} />

                  <span>Simulated</span>

                  <strong>
                    {simulatedCount}
                  </strong>

                  <small>
                    Target simulation
                  </small>

                </div>


                <div className="reconcileMetricCard safe">

                  <CheckCircle2 size={18} />

                  <span>Matched</span>

                  <strong>
                    {matchedCount}
                  </strong>

                  <small>
                    {matchRate}% match rate
                  </small>

                </div>


                <div className="reconcileMetricCard review">

                  <AlertTriangle size={18} />

                  <span>Variance</span>

                  <strong>
                    {variance}
                  </strong>

                  <small>
                    Count variance
                  </small>

                </div>


                <div className="reconcileMetricCard blocked">

                  <XCircle size={18} />

                  <span>Failures</span>

                  <strong>
                    {failedCount}
                  </strong>

                  <small>
                    Failed records
                  </small>

                </div>

              </div>

            </section>


            <section className="reconcileSection">

              <div className="reconcileMainGrid">

                <div className="panel">

                  <div className="panelHeader">

                    <div>
                      <h3>
                        Variance Analysis
                      </h3>

                      <p>
                        Any differences between
                        source and simulation.
                      </p>
                    </div>

                  </div>


                  <div className="reconcileDetailRows">

                    <div>
                      <span>
                        Unmatched Source
                      </span>

                      <strong>
                        {unmatched}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Unexpected Simulation
                      </span>

                      <strong>
                        {unexpected}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Count Variance
                      </span>

                      <strong>
                        {variance}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Failed Records
                      </span>

                      <strong>
                        {failedCount}
                      </strong>
                    </div>

                  </div>

                </div>


                <div className="panel">

                  <div className="panelHeader">

                    <div>
                      <h3>
                        Execution Safety
                      </h3>

                      <p>
                        Governed DEV execution safety truth.
                      </p>
                    </div>

                    <span
                      className={`statusPill ${
                        safetyPass
                          ? "success"
                          : "review"
                      }`}
                    >
                      {
                        safetyPass
                          ? "PASS"
                          : "REVIEW"
                      }
                    </span>

                  </div>


                  <div className="reconcileDetailRows">

                    <div>
                      <span>
                        Target Writes
                      </span>

                      <strong>
                        {targetWrites}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Production Actions
                      </span>

                      <strong>
                        {productionActions}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Target Write Executed
                      </span>

                      <strong>
                        {
                          String(
                            result
                              .target_write_executed ??
                            false
                          )
                        }
                      </strong>
                    </div>

                    <div>
                      <span>
                        Production Action Executed
                      </span>

                      <strong>
                        {
                          String(
                            result
                              .production_action_executed ??
                            false
                          )
                        }
                      </strong>
                    </div>

                  </div>

                </div>

              </div>

            </section>


            <section className="reconcileSection">

              <div className="panel reconcileDecisionCard">

                <div>

                  <span className="reconcileSectionLabel">
                    RECONCILIATION RESULT
                  </span>

                  <h2>
                    {
                      passed
                        ? "PASS"
                        : "REVIEW REQUIRED"
                    }
                  </h2>

                  <p>
                    {
                      passed
                        ? "Source and simulated target evidence reconcile within the current runtime result."
                        : "Reconciliation differences remain and require review before workflow progression."
                    }
                  </p>

                </div>


                <div className="reconcileDecisionStats">

                  <span>
                    Match Rate
                    <strong>
                      {matchRate}%
                    </strong>
                  </span>

                  <span>
                    Variance
                    <strong>
                      {variance}
                    </strong>
                  </span>

                  <span>
                    Safety
                    <strong>
                      {
                        safetyPass
                          ? "PASS"
                          : "REVIEW"
                      }
                    </strong>
                  </span>

                </div>

              </div>

            </section>


            <section className="reconcileSection">

              <div className="panel">

                <div className="panelHeader">

                  <div>
                    <h3>
                      Runtime Traceability
                    </h3>

                    <p>
                      End-to-end identity chain
                      for audit and evidence.
                    </p>
                  </div>

                </div>


                <div className="reconcileTraceGrid">

                  <div>
                    <span>Migration ID</span>
                    <strong>
                      {
                        result.migration_id ??
                        "—"
                      }
                    </strong>
                  </div>

                  <div>
                    <span>Approval ID</span>
                    <strong>
                      {
                        result.approval_id ??
                        "—"
                      }
                    </strong>
                  </div>

                  <div>
                    <span>Execution ID</span>
                    <strong>
                      {
                        result.execution_id ??
                        "—"
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      Reconciliation ID
                    </span>
                    <strong>
                      {
                        result
                          .reconciliation_id ??
                        "—"
                      }
                    </strong>
                  </div>

                </div>

              </div>

            </section>

          </>
        )}


      {view === "SOURCE" &&
        evidence && (
          <section className="reconcileSection">

            <div className="reconcileSectionHeader">

              <div>
                <span className="reconcileSectionLabel">
                  SOURCE VIEW
                </span>

                <h2>
                  Source records
                </h2>

                <p>
                  Read-only source-ready records captured by the authoritative reconciliation evidence package.
                </p>
              </div>

              <span className="statusPill success">
                {sourceRecords.length} RECORDS
              </span>

            </div>


            <div className="reconcileRecordList">

              {sourceRecords.map(
                (record) => (

                  <div
                    key={`${record.entity}-${record.row}`}
                    className="panel reconcileRecordCard"
                  >

                    <strong>
                      {record.sequence}.{" "}
                      {record.entity}
                      {" · Row "}
                      {record.row}
                    </strong>

                    <pre>
                      {
                        JSON.stringify(
                          record.source_record,
                          null,
                          2
                        )
                      }
                    </pre>

                  </div>

                )
              )}

            </div>

          </section>
        )}


      {view === "MAPPING" &&
        evidence && (
          <section className="reconcileSection">

            <div className="reconcileSectionHeader">

              <div>
                <span className="reconcileSectionLabel">
                  MAPPING VIEW
                </span>

                <h2>
                  Mapping & Transformation
                </h2>

                <p>
                  Source-to-target mapping,
                  business-rule linkage and
                  transformation intent.
                </p>
              </div>

              <span className="statusPill success">
                {
                  transformationEvidence.length
                } RULES
              </span>

            </div>


            <div className="panel reconcileEvidenceTable">

              {transformationEvidence.map(
                (item, index) => (

                  <div
                    key={`${item.source}-${item.target}-${index}`}
                  >

                    <span>
                      {item.action}
                    </span>

                    <span>
                      {item.source}
                    </span>

                    <span>
                      {item.target}
                    </span>

                    <span>
                      {
                        Array.isArray(
                          item.business_rules
                        )
                          ? item.business_rules.join(
                              ", "
                            )
                          : "—"
                      }
                    </span>

                    <span>
                      {item.status}
                    </span>

                  </div>

                )
              )}

            </div>

          </section>
        )}


      {view === "TARGET" &&
        evidence && (
          <section className="reconcileSection">

            <div className="reconcileSectionHeader">

              <div>
                <span className="reconcileSectionLabel">
                  TARGET SIMULATION
                </span>

                <h2>
                  Simulated target view
                </h2>

                <p>
                  Predicted transformations
                  only. No target database
                  write has occurred.
                </p>
              </div>

              <span className="statusPill success">
                DRY RUN
              </span>

            </div>


            <div className="reconcileRecordList">

              {targetSimulation.map(
                (record) => (

                  <div
                    key={`${record.entity}-${record.row}`}
                    className="panel reconcileRecordCard"
                  >

                    <div className="reconcileRecordHeader">

                      <strong>
                        {record.sequence}.{" "}
                        {record.entity}
                        {" · Row "}
                        {record.row}
                      </strong>

                      <span>
                        {record.status}
                      </span>

                    </div>


                    <div className="reconcileTransformList">

                      {record.transformations.map(
                        (
                          transformation: any,
                          index: number
                        ) => (

                          <div
                            key={`${transformation.source}-${index}`}
                          >

                            <strong>
                              {
                                transformation.action
                              }
                            </strong>

                            <span>
                              {
                                transformation.source
                              }
                              {" → "}
                              {
                                transformation.target
                              }
                            </span>

                            <small>
                              target write ={" "}
                              {
                                String(
                                  transformation
                                    .target_write ??
                                  false
                                )
                              }
                            </small>

                          </div>

                        )
                      )}

                    </div>


                    <div className="reconcileRecordSafety">

                      <span>
                        Target write executed:{" "}
                        <strong>
                          {
                            String(
                              record
                                .target_write_executed
                            )
                          }
                        </strong>
                      </span>

                      <span>
                        Production action executed:{" "}
                        <strong>
                          {
                            String(
                              record
                                .production_action_executed
                            )
                          }
                        </strong>
                      </span>

                    </div>

                  </div>

                )
              )}

            </div>

          </section>
        )}


      {view === "EVIDENCE" &&
        evidence && (
          <section className="reconcileSection">

            <div className="reconcileSectionHeader">

              <div>
                <span className="reconcileSectionLabel">
                  EVIDENCE PACKAGE
                </span>

                <h2>
                  Runtime verification evidence
                </h2>

                <p>
                  Proof for discovery,
                  approval, execution,
                  reconciliation and safety.
                </p>
              </div>

              <span className="statusPill success">
                {evidence.status}
              </span>

            </div>


            <div className="reconcileTraceGrid">

              <div>
                <span>Evidence ID</span>
                <strong>
                  {
                    evidence.evidence_id ??
                    "—"
                  }
                </strong>
              </div>

              <div>
                <span>Migration ID</span>
                <strong>
                  {
                    evidence.migration_id ??
                    "—"
                  }
                </strong>
              </div>

              <div>
                <span>Approval ID</span>
                <strong>
                  {
                    evidence.approval_id ??
                    "—"
                  }
                </strong>
              </div>

              <div>
                <span>Execution ID</span>
                <strong>
                  {
                    evidence.execution_id ??
                    "—"
                  }
                </strong>
              </div>

              <div>
                <span>
                  Reconciliation ID
                </span>
                <strong>
                  {
                    evidence
                      .reconciliation_id ??
                    "—"
                  }
                </strong>
              </div>

              <div>
                <span>Created</span>
                <strong>
                  {
                    evidence.created_at ??
                    "—"
                  }
                </strong>
              </div>

            </div>


            <div className="panel reconcileSafetyProof">

              <div className="panelHeader">

                <div>
                  <h3>
                    Safety Proof
                  </h3>

                  <p>
                    Evidence-backed governed DEV execution truth.
                  </p>
                </div>

                <ShieldCheck size={19} />

              </div>


              <div className="reconcileDetailRows">

                <div>
                  <span>
                    Target Writes
                  </span>

                  <strong>
                    {
                      evidence.safety
                        ?.target_write_count ??
                      0
                    }
                  </strong>
                </div>

                <div>
                  <span>
                    Production Actions
                  </span>

                  <strong>
                    {
                      evidence.safety
                        ?.production_action_count ??
                      0
                    }
                  </strong>
                </div>

                <div>
                  <span>
                    Target Write Executed
                  </span>

                  <strong>
                    {
                      String(
                        evidence.safety
                          ?.target_write_executed ??
                        false
                      )
                    }
                  </strong>
                </div>

                <div>
                  <span>
                    Production Action Executed
                  </span>

                  <strong>
                    {
                      String(
                        evidence.safety
                          ?.production_action_executed ??
                        false
                      )
                    }
                  </strong>
                </div>

              </div>

            </div>


            <div className="panel">

              <div className="panelHeader">

                <div>
                  <h3>
                    Business Rules
                  </h3>

                  <p>
                    Rule evidence linked to
                    the migration result.
                  </p>
                </div>

                <GitBranch size={18} />

              </div>


              <div className="reconcileRuleList">

                {(evidence.business_rules ??
                  []).map(
                  (rule: any) => (

                    <div key={rule.id}>

                      <span>
                        {rule.id}
                      </span>

                      <strong>
                        {rule.rule}
                      </strong>

                      <small>
                        {rule.source}
                      </small>

                    </div>

                  )
                )}

              </div>

            </div>

          </section>
        )}


      <div className="reconcileSafetyNote">

        <ShieldCheck size={18} />

        <div>

          <strong>
            DEV write boundary preserved
          </strong>

          <span>
            POST_LOAD_DEV verifies the approved DEV target load while production writes/actions remain 0. Production migration and cutover remain disabled.
          </span>

        </div>

      </div>

    </div>
  );
}


