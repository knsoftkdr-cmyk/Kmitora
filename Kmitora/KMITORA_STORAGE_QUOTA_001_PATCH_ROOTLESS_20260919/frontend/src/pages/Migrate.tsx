import A000ScenarioContextBanner from "../components/A000ScenarioContextBanner";
import MigratePremiumWorkspace from "../components/MigratePremiumWorkspace";
import DevE2ECertificationPanel from "../components/DevE2ECertificationPanel";
import Closure20StatusPanel from "../components/Closure20StatusPanel";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Eye,
  FileCheck2,
  LockKeyhole,
  PlayCircle,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import {
  postApprovalRequest,
  postMigration,
} from "../services/api";

import KMITORACopilotOverview from "../components/KMITORACopilotOverview";

type Mapping = {
  status?: string;
  decision?: string;
  confidence?: number;
};

type TransformationPlanItem = {
  action?: string;
  status?: string;
  execution_state?: string;
};

type ReferentialDependency = {
  entity?: string;
  field?: string;
  row?: number;
  value?: unknown;
  source?: string;
  target?: string;
  target_write?: boolean;
};

type StagingRecord = {
  entity?: string;
  row?: number;
  target_write?: boolean;
};

type DiscoveryResult = {
  migration_id?: string;
  status?: string;
  mode?: string;
  production_action_executed?: boolean;

  suggested_mappings?: Mapping[];
  transformation_plan?: TransformationPlanItem[];

  quality_findings?: Array<{
    severity?: string;
  }>;

  target_staging_plan?: {
    ready_records?: StagingRecord[];
    review_records?: StagingRecord[];
    quarantine_records?: StagingRecord[];
    rejected_records?: StagingRecord[];
    referential_dependencies?: ReferentialDependency[];
  };

  summary?: {
    source_entity_count?: number;
    target_entity_count?: number;
    business_rule_count?: number;
    relationship_count?: number;
    quality_finding_count?: number;
    transformation_plan_count?: number;
    staging_ready_count?: number;
    staging_review_count?: number;
    staging_quarantine_count?: number;
    staging_rejected_count?: number;
    staging_referential_dependency_count?: number;
  };
};

export default function Migrate() {
  const [discovery, setDiscovery] =
    useState<DiscoveryResult | null>(null);

  const [showWavePreview, setShowWavePreview] =
    useState(false);

  const [approvalRequest, setApprovalRequest] =
    useState<any>(null);

  const [approvalLoading, setApprovalLoading] =
    useState(false);

  const [approvalError, setApprovalError] =
    useState("");

  const [execution, setExecution] =
    useState<any>(null);

  const [executionLoading, setExecutionLoading] =
    useState(false);

  const [executionError, setExecutionError] =
    useState("");

  useEffect(() => {
    const raw = localStorage.getItem(
      "kmitora.dev.discoveryResult"
    );

    if (!raw) {
      setDiscovery(null);
      return;
    }

    try {
      setDiscovery(
        JSON.parse(raw) as DiscoveryResult
      );
    } catch {
      setDiscovery(null);
    }
  }, []);

  useEffect(() => {
    const rawApproval =
      localStorage.getItem(
        "kmitora.dev.approvalRequest"
      );

    if (rawApproval) {
      try {
        setApprovalRequest(
          JSON.parse(rawApproval)
        );
      } catch {
        setApprovalRequest(null);
      }
    }

    const rawExecution =
      localStorage.getItem(
        "kmitora.dev.executionResult"
      );

    if (rawExecution) {
      try {
        setExecution(
          JSON.parse(rawExecution)
        );
      } catch {
        setExecution(null);
      }
    }
  }, []);

  const mappings =
    Array.isArray(
      discovery?.suggested_mappings
    )
      ? discovery!.suggested_mappings!
      : [];

  const transformations =
    Array.isArray(
      discovery?.transformation_plan
    )
      ? discovery!.transformation_plan!
      : [];

  const findings =
    Array.isArray(
      discovery?.quality_findings
    )
      ? discovery!.quality_findings!
      : [];

  const staging =
    discovery?.target_staging_plan ??
    {};

  const ready =
    Array.isArray(
      staging.ready_records
    )
      ? staging.ready_records
      : [];

  const review =
    Array.isArray(
      staging.review_records
    )
      ? staging.review_records
      : [];

  const quarantine =
    Array.isArray(
      staging.quarantine_records
    )
      ? staging.quarantine_records
      : [];

  const rejected =
    Array.isArray(
      staging.rejected_records
    )
      ? staging.rejected_records
      : [];

  const referential =
    Array.isArray(
      staging.referential_dependencies
    )
      ? staging.referential_dependencies
      : [];

  const blockedReferential =
    referential.filter(
      (item) =>
        Boolean(item.entity) &&
        Boolean(item.field) &&
        item.row !== undefined &&
        item.row !== null &&
        item.value !== undefined &&
        item.value !== null
    );

  const blockingFindings =
    findings.filter(
      (item) =>
        String(
          item.severity ?? ""
        ).toUpperCase() === "ERROR"
    );

  const totalPlannedRecords =
    ready.length +
    review.length +
    quarantine.length +
    rejected.length +
    blockedReferential.length;

  // EXEC-STAGE-001: approvals are immutable evidence snapshots. If current
  // authoritative staging no longer matches the locally stored approval, do
  // not let an old zero-record (or otherwise stale) decision govern a newer
  // migration plan. Preserve the server audit record, but require a fresh
  // approval request for the current staging evidence.
  useEffect(() => {
    if (!approvalRequest) return;

    const snapshot =
      approvalRequest?.input?.staging_snapshot ?? null;

    if (!snapshot) return;

    const snapshotMatches =
      Number(snapshot.total_planned_records ?? 0) === totalPlannedRecords &&
      Number(snapshot.ready_records ?? 0) === ready.length &&
      Number(snapshot.blocked_records ?? 0) === blockedReferential.length &&
      Number(snapshot.review_records ?? 0) === review.length &&
      Number(snapshot.quarantine_records ?? 0) === quarantine.length &&
      Number(snapshot.rejected_records ?? 0) === rejected.length;

    if (snapshotMatches) return;

    setApprovalRequest(null);
    setExecution(null);
    localStorage.removeItem("kmitora.dev.approvalRequest");
    localStorage.removeItem("kmitora.dev.executionResult");
    localStorage.removeItem("kmitora.dev.executionId");
    setApprovalError(
      "Previous approval was tied to stale staging evidence and was cleared locally. " +
      "Request a new authoritative approval for the current governed staging plan."
    );
  }, [
    approvalRequest,
    totalPlannedRecords,
    ready.length,
    blockedReferential.length,
    review.length,
    quarantine.length,
    rejected.length,
  ]);

  const safeMappings =
    mappings.filter((m) => {
      const confidence =
        typeof m.confidence === "number"
          ? m.confidence <= 1
            ? m.confidence * 100
            : m.confidence
          : 0;

      return confidence >= 90;
    });

  const validationReady =
    blockingFindings.length === 0 &&
    quarantine.length === 0 &&
    rejected.length === 0 &&
    blockedReferential.length === 0;

  const noTargetWrites =
    discovery?.production_action_executed !== true &&
    [
      ...ready,
      ...review,
      ...quarantine,
      ...rejected,
    ].every(
      (record) =>
        record.target_write !== true
    ) &&
    referential.every(
      (record) =>
        record.target_write !== true
    );

  const stagePercent =
    totalPlannedRecords > 0
      ? Math.round(
          (
            ready.length /
            totalPlannedRecords
          ) * 100
        )
      : 0;

  const mappingPercent =
    mappings.length > 0
      ? Math.round(
          (
            safeMappings.length /
            mappings.length
          ) * 100
        )
      : 0;

  const transformationPercent =
    transformations.length > 0
      ? 100
      : 0;

  const validationPercent =
    findings.length === 0
      ? 100
      : Math.max(
          0,
          Math.round(
            (
              (
                findings.length -
                blockingFindings.length
              ) /
              findings.length
            ) * 100
          )
        );

  async function handleRequestApproval() {
    if (
      !discovery ||
      approvalLoading ||
      approvalRequest
    ) {
      return;
    }

    setApprovalLoading(true);
    setApprovalError("");

    try {
      const response =
        await postApprovalRequest({
          migration_id:
            discovery.migration_id ??
            "DEV-EXCEL-DISCOVERY-001",

          requested_action:
            "MIGRATION_APPROVAL",

          environment:
            "DEV",

          execution_requested:
            false,

          target_write_requested:
            false,

          staging_snapshot: {
            total_planned_records:
              totalPlannedRecords,

            ready_records:
              ready.length,

            blocked_records:
              blockedReferential.length,

            review_records:
              review.length,

            quarantine_records:
              quarantine.length,

            rejected_records:
              rejected.length,
          },

          validation_snapshot: {
            quality_findings:
              findings.length,

            blocking_findings:
              blockingFindings.length,

            validation_ready:
              validationReady,
          },

          safety: {
            production_action_executed:
              discovery.production_action_executed ===
              true,

            target_write_detected:
              !noTargetWrites,
          },
        });

      const request =
        response?.payload ??
        response;

      setApprovalRequest(request);

      localStorage.setItem(
        "kmitora.dev.approvalRequest",
        JSON.stringify(request)
      );
    } catch (error) {
      setApprovalError(
        error instanceof Error
          ? error.message
          : "Approval request failed."
      );
    } finally {
      setApprovalLoading(false);
    }
  }

  // --- LIVE target write (explicit, separate from the DEV dry run above).
  // Only ever called from the dedicated button below, after a successful
  // dry run. Performs real INSERTs into the connected Postgres/MySQL/etc
  // target using the ready_records this run already validated. ---
  const [writeStatus, setWriteStatus] = useState<
    "idle" | "loading" | "done" | "error"
  >("idle");
  const [writeResults, setWriteResults] = useState<
    Array<{ table: string; inserted: number; attempted: number; skipped_no_matching_columns: number }>
  >([]);
  const [writeError, setWriteError] = useState("");

  function normalizeKey(k: string) {
    return k.toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function tableNameFromEntity(entity: string) {
    const base = entity.split(/[\\/]/).pop() || entity;
    const name = base.replace(/\.csv$/i, "").toLowerCase();
    return name.startsWith("target_") ? name : "target_" + name;
  }

  async function writeReadyRecordsToTarget() {
    setWriteStatus("loading");
    setWriteError("");
    setWriteResults([]);

    try {
      const targetsResp = await fetch("/target-api/v1/targets");
      const targetsBody = await targetsResp.json();

      if (!targetsResp.ok) {
        throw new Error(
          targetsBody?.error || `Could not list targets: ${targetsResp.status}`
        );
      }

      const targets = Array.isArray(targetsBody)
        ? targetsBody
        : Array.isArray(targetsBody?.payload)
          ? targetsBody.payload
          : Array.isArray(targetsBody?.targets)
            ? targetsBody.targets
            : [];

      const target = targets.find(
        (t: any) =>
          String(t.status || "").toLowerCase() === "connected" &&
          String(t.environment || "").toUpperCase() === "DEV"
      );

      if (!target) {
        throw new Error("No connected DEV target found.");
      }

      const migrationId = String(discovery?.migration_id ?? "").trim();
      if (!migrationId) {
        throw new Error("Migration id is missing from the governed discovery evidence.");
      }

      const discoveryResp = await fetch(
        `/api/v1/a000/discoveries/${encodeURIComponent(migrationId)}`
      );
      const discoveryBody = await discoveryResp.json();
      if (!discoveryResp.ok) {
        throw new Error(
          discoveryBody?.payload?.message ||
          discoveryBody?.error ||
          `Could not load authoritative staging: ${discoveryResp.status}`
        );
      }
      const authoritativeDiscovery =
        discoveryBody?.payload ?? discoveryBody;
      const readyRecords: any[] = Array.isArray(
        authoritativeDiscovery?.target_staging_plan?.ready_records
      )
        ? authoritativeDiscovery.target_staging_plan.ready_records
        : [];

      if (!readyRecords.length) {
        throw new Error("No authoritative ready records are available for DEV replace-load.");
      }

      const grouped: Record<string, any[]> = {};

      for (const rec of readyRecords) {
        const entity = String(rec.entity || "");
        const table = tableNameFromEntity(entity);

        if (!grouped[table]) grouped[table] = [];

        const rowPayload =
          rec.transformed_record ??
          rec.source_record ??
          rec.record ??
          rec.data ??
          rec.row_data ??
          {};

        grouped[table].push(rowPayload);
      }

      // ready_records already arrive parent-first: discovery orders
      // entities by its dependency graph. Preserving first-seen order here
      // keeps that ordering instead of assuming a fixed set of tables.
      const dependencyOrder: string[] = [];

      for (const rec of readyRecords) {
        const table = tableNameFromEntity(String(rec.entity || ""));
        if (!dependencyOrder.includes(table)) dependencyOrder.push(table);
      }

      if (!dependencyOrder.length) {
        throw new Error("No target tables resolved from ready records.");
      }

      const tables: Record<string, any[]> = {};

      for (const table of dependencyOrder) {
        const sourceRows = grouped[table] || [];

        if (!sourceRows.length) {
          throw new Error(
            `Required ready-record group is missing: ${table}`
          );
        }

        const structResp = await fetch(
          `/target-api/v1/targets/${encodeURIComponent(target.id)}` +
          `/structure?schema=public&object=${encodeURIComponent(table)}`
        );

        const struct = await structResp.json();

        if (!structResp.ok) {
          throw new Error(
            `Could not read target structure for "${table}": ` +
            `${struct?.error || structResp.status}`
          );
        }

        const targetCols: string[] =
          (struct.columns || []).map((c: any) => c.name);

        const targetColByNorm: Record<string, string> = {};

        for (const col of targetCols) {
          targetColByNorm[normalizeKey(col)] = col;
        }

        tables[table] = sourceRows.map((sourceRow) => {
          const out: Record<string, unknown> = {};

          for (const [srcKey, srcVal] of Object.entries(sourceRow)) {
            const match = targetColByNorm[normalizeKey(srcKey)];

            if (match) {
              out[match] = srcVal;
            }
          }

          return out;
        });
      }

      const replaceResp = await fetch(
        `/target-api/v1/targets/${encodeURIComponent(target.id)}/replace-load`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            schema: "public",
            tables,
          }),
        }
      );

      const replaceBody = await replaceResp.json();

      if (!replaceResp.ok) {
        throw new Error(
          `DEV replace-load failed: ${replaceBody?.error || replaceResp.status}`
        );
      }

      const results = Array.isArray(replaceBody?.results)
        ? replaceBody.results
        : [];

      setWriteResults(results);
      setWriteStatus("done");

    } catch (error) {
      setWriteError(
        error instanceof Error
          ? error.message
          : "DEV replace-load failed."
      );
      setWriteStatus("error");
    }
  }
  async function handleExecuteMigration() {
    if (
      !discovery ||
      executionLoading ||
      execution
    ) {
      return;
    }

    const storedApprovalRaw =
      localStorage.getItem(
        "kmitora.dev.approvalRequest"
      );

    if (!storedApprovalRaw) {
      setExecutionError(
        "Authoritative approval is required before DEV dry-run execution."
      );
      return;
    }

    let storedApproval: any;

    try {
      storedApproval =
        JSON.parse(storedApprovalRaw);
    } catch {
      setExecutionError(
        "Stored approval evidence is invalid."
      );
      return;
    }

    const approvalId =
      storedApproval?.id;

    const approvalStatus =
      String(
        storedApproval?.status ?? ""
      ).toUpperCase();

    if (!approvalId) {
      setExecutionError(
        "Approval ID is missing."
      );
      return;
    }

    if (
      approvalStatus !== "APPROVED"
    ) {
      setExecutionError(
        "Approval must be APPROVED before DEV dry-run execution."
      );
      return;
    }

    setExecutionLoading(true);
    setExecutionError("");

    try {
      const response =
        await postMigration(
          discovery.migration_id ??
          "DEV-EXCEL-DISCOVERY-001",
          approvalId
        );

      const result =
        response?.payload ??
        response;

      setExecution(result);

      localStorage.setItem(
        "kmitora.dev.executionResult",
        JSON.stringify(result)
      );

      if (result?.execution_id) {
        localStorage.setItem(
          "kmitora.dev.executionId",
          String(
            result.execution_id
          )
        );
      }
    } catch (error) {
      setExecutionError(
        error instanceof Error
          ? error.message
          : "DEV dry-run execution failed."
      );
    } finally {
      setExecutionLoading(false);
    }
  }

  const preflightChecks =
    useMemo(
      () => [
        {
          name: "Connections",
          ready:
            Boolean(discovery),
          detail:
            discovery
              ? "ready"
              : "not available",
        },

        {
          name: "Mapping",
          ready:
            mappings.length > 0,
          detail:
            mappings.length > 0
              ? `${safeMappings.length}/${mappings.length} high confidence`
              : "not available",
        },

        {
          name: "Transformation",
          ready:
            transformations.length >
            0,
          detail:
            transformations.length >
            0
              ? `${transformations.length} planned`
              : "not available",
        },

        {
          name: "Validation",
          ready:
            validationReady,
          detail:
            validationReady
              ? "ready"
              : `${blockedReferential.length} blocked record(s) · ${blockingFindings.length} error finding(s)`,
        },

        {
          name: "Staging",
          ready:
            ready.length > 0 &&
            blockedReferential.length === 0 &&
            quarantine.length === 0 &&
            rejected.length === 0,

          detail:
            `${ready.length} ready · ${blockedReferential.length} blocked`,
        },

        {
          name:
            "Target Write Guard",

          ready:
            noTargetWrites,

          detail:
            noTargetWrites
              ? "no target writes"
              : "target-write evidence detected",
        },
      ],
      [
        discovery,
        mappings.length,
        safeMappings.length,
        transformations.length,
        validationReady,
        blockingFindings.length,
        blockedReferential.length,
        ready.length,
        quarantine.length,
        rejected.length,
        noTargetWrites,
      ]
    );

  const readyChecks =
    preflightChecks.filter(
      (check) =>
        check.ready
    ).length;

  const preflightPercent =
    preflightChecks.length > 0
      ? Math.round(
          (
            readyChecks /
            preflightChecks.length
          ) * 100
        )
      : 0;

  const executionAllowed =
    Boolean(discovery) &&
    String(approvalRequest?.status ?? "").toUpperCase() === "APPROVED" &&
    approvalRequest?.approved === true &&
    validationReady &&
    ready.length > 0 &&
    review.length === 0 &&
    quarantine.length === 0 &&
    rejected.length === 0 &&
    blockedReferential.length === 0 &&
    blockingFindings.length === 0 &&
    noTargetWrites &&
    String(approvalRequest?.input?.migration_id ?? "") ===
      String(discovery?.migration_id ?? "") &&
    approvalRequest?.input?.environment === "DEV" &&
    approvalRequest?.input?.execution_requested !== true &&
    approvalRequest?.input?.target_write_requested !== true &&
    execution == null;

  if (!discovery) {
    return (
      <div className="page migrateCommandPage">
      <A000ScenarioContextBanner />
      <MigratePremiumWorkspace />

        <div className="migrateHero">

          <div className="migrateHeroCopy">

            <span className="eyebrow">
              STEP 06
            </span>

            <h1>
              Migration Command Center
            </h1>

            <p>
              Migration planning requires
              completed discovery,
              transformation and validation
              evidence.
            </p>

          </div>

          <KMITORACopilotOverview
            status="GUARDED"
            message="Migration readiness, wave planning and execution safety"
          />

        </div>

        <div className="panel migrateEmptyState">

          <Database size={26} />

          <div>
            <h3>
              No Discovery Result Available
            </h3>

            <p>
              Return to Connect and Discovery
              before preparing a migration
              wave.
            </p>
          </div>

        </div>

      </div>
    );
  }

  return (
    <div className="page migrateCommandPage">
      <MigratePremiumWorkspace />
      <DevE2ECertificationPanel />
      <Closure20StatusPanel />

      <div className="migrateHero">

        <div className="migrateHeroCopy">

          <span className="eyebrow">
            STEP 06
          </span>

          <h1>
            Migration Command Center
          </h1>

          <p>
            Prepare, inspect and govern the
            current migration wave using
            KMITORA discovery,
            transformation, validation and
            staging evidence.
          </p>

          <div className="migrateHeroMeta">

            <span className="migrateGuardedBadge">
              <LockKeyhole size={14} />
              Execution guarded
            </span>

            <span className="migrateGuardedBadge">
              Target writes:{" "}
              {
                noTargetWrites
                  ? "NONE"
                  : "DETECTED"
              }
            </span>

          </div>

        </div>


        <KMITORACopilotOverview
          status={
            validationReady &&
            noTargetWrites
              ? "READY FOR REVIEW"
              : "GUARDED"
          }
          message="Migration readiness, wave planning and execution safety"
        />

      </div>


      {executionError && (
        <div className="migrateAlert error">

          <XCircle size={18} />

          <span>
            {executionError}
          </span>

        </div>
      )}


      {approvalError && (
        <div className="migrateAlert warning">

          <AlertTriangle size={18} />

          <span>
            {approvalError}
          </span>

        </div>
      )}


      {execution && (
        <section className="migrateSection">

          <div className="migrateSectionHeader">

            <div>
              <span className="migrateSectionLabel">
                DRY-RUN RESULT
              </span>

              <h2>
                DEV simulation evidence
              </h2>

              <p>
                Approved dry-run result with
                no target write.
              </p>
            </div>

            <span className="statusPill success">
              {
                execution.status ??
                "COMPLETED"
              }
            </span>

          </div>


          <div className="migrateExecutionGrid">

            <div>
              <span>Execution ID</span>
              <strong>
                {
                  execution.execution_id ??
                  "—"
                }
              </strong>
            </div>

            <div>
              <span>Input Records</span>
              <strong>
                {
                  execution.input_record_count ??
                  0
                }
              </strong>
            </div>

            <div>
              <span>Simulated Records</span>
              <strong>
                {
                  execution.simulated_record_count ??
                  0
                }
              </strong>
            </div>

            <div>
              <span>Failures</span>
              <strong>
                {
                  execution.failure_count ??
                  0
                }
              </strong>
            </div>

          </div>

        </section>
      )}


      <section className="migrateSection">

        <div className="migrateSectionHeader">

          <div>
            <span className="migrateSectionLabel">
              MIGRATION READINESS
            </span>

            <h2>
              Pre-flight status
            </h2>

            <p>
              Every prerequisite remains
              visible before any governed
              execution path can progress.
            </p>
          </div>

          <div className="migrateReadinessScore">

            <strong>
              {preflightPercent}%
            </strong>

            <span>
              {
                readyChecks
              }/{preflightChecks.length} checks
            </span>

          </div>

        </div>


        <div className="migrateMetrics">

          <div className="migrateMetricCard safe">

            <CheckCircle2 size={18} />

            <span>
              Ready Records
            </span>

            <strong>
              {ready.length}
            </strong>

            <small>
              Eligible for future wave
            </small>

          </div>


          <div className="migrateMetricCard review">

            <AlertTriangle size={18} />

            <span>
              Review
            </span>

            <strong>
              {review.length}
            </strong>

            <small>
              Needs governance
            </small>

          </div>


          <div className="migrateMetricCard blocked">

            <XCircle size={18} />

            <span>
              Blocked
            </span>

            <strong>
              {
                blockedReferential.length
              }
            </strong>

            <small>
              Referential blockers
            </small>

          </div>


          <div className="migrateMetricCard">

            <Database size={18} />

            <span>
              Quarantine
            </span>

            <strong>
              {quarantine.length}
            </strong>

            <small>
              Isolated records
            </small>

          </div>


          <div className="migrateMetricCard">

            <ShieldCheck size={18} />

            <span>
              Rejected
            </span>

            <strong>
              {rejected.length}
            </strong>

            <small>
              Excluded records
            </small>

          </div>

        </div>

      </section>


      <section className="migrateSection">

        <div className="migrateSectionHeader">

          <div>
            <span className="migrateSectionLabel">
              PRE-FLIGHT CHECKS
            </span>

            <h2>
              Readiness gates
            </h2>
          </div>

        </div>


        <div className="migratePreflightGrid">

          {preflightChecks.map(
            (check) => (

              <div
                className={`migratePreflightCard ${
                  check.ready
                    ? "ready"
                    : "attention"
                }`}
                key={check.name}
              >

                <div className="migratePreflightIcon">

                  {
                    check.ready
                      ? (
                        <CheckCircle2
                          size={18}
                        />
                      )
                      : (
                        <AlertTriangle
                          size={18}
                        />
                      )
                  }

                </div>

                <div>

                  <strong>
                    {check.name}
                  </strong>

                  <span>
                    {check.detail}
                  </span>

                </div>

              </div>

            )
          )}


          <div
            className={`migratePreflightCard ${
              approvalRequest
                ? "ready"
                : "attention"
            }`}
          >

            <div className="migratePreflightIcon">

              {
                approvalRequest
                  ? (
                    <CheckCircle2
                      size={18}
                    />
                  )
                  : (
                    <LockKeyhole
                      size={18}
                    />
                  )
              }

            </div>


            <div>

              <strong>
                Approval
              </strong>

              <span>
                {
                  approvalLoading
                    ? "requesting..."
                    : approvalRequest
                      ? (
                        approvalRequest.status
                          ? String(
                              approvalRequest.status
                            )
                          : "authoritative approval requested"
                      )
                      : approvalError ||
                        "not requested"
                }
              </span>

            </div>

          </div>

        </div>

      </section>


      <section className="migrateSection">

        <div className="migrateSectionHeader">

          <div>
            <span className="migrateSectionLabel">
              MIGRATION WAVE
            </span>

            <h2>
              Wave preparation and controls
            </h2>

            <p>
              Preview the staging population,
              request governed approval and
              review execution state.
            </p>
          </div>

        </div>


        <div className="panel migrateControlPanel">

          <div className="migrateControlActions">

            <button
              type="button"
              onClick={() =>
                setShowWavePreview(
                  (current) =>
                    !current
                )
              }
            >

              <Eye size={16} />

              {
                showWavePreview
                  ? "Hide Wave Preview"
                  : "Preview Wave"
              }

            </button>


            <button
              type="button"
              onClick={
                handleRequestApproval
              }
              disabled={
                approvalLoading ||
                Boolean(
                  approvalRequest
                ) ||
                !discovery ||
                !noTargetWrites
              }
            >

              <FileCheck2 size={16} />

              {
                approvalLoading
                  ? "Requesting..."
                  : approvalRequest
                    ? "Approval Requested"
                    : "Request Approval"
              }

            </button>


            <button
              className="primary"
              type="button"
              onClick={
                handleExecuteMigration
              }
              disabled={
                !executionAllowed ||
                executionLoading ||
                Boolean(execution)
              }
            >

              <PlayCircle size={16} />

              {
                executionLoading
                  ? "Executing..."
                  : execution
                    ? "Dry Run Completed"
                    : "Execute Migration"
              }

            </button>

          </div>


          <div className="migrateControlTruth">

            <ShieldCheck size={18} />

            <div>

              <strong>
                Execution remains disabled
              </strong>

              <span>
                Approval requests do not
                request execution or target
                writes. The migration execution
                button remains disabled by the
                current DEV safety gate.
              </span>

            </div>

          </div>

          {execution && (
            <div style={{
              marginTop: 16,
              padding: "14px 16px",
              border: "1px solid #fca5a5",
              borderRadius: 8,
              background: "#fef2f2",
            }}>
              <strong style={{ color: "#991b1b" }}>
                Write ready records to target (LIVE â€” real database writes)
              </strong>
              <p style={{ margin: "6px 0 10px", fontSize: 13, color: "#7f1d1d" }}>
                This is separate from the DEV dry run above. It performs real
                INSERTs into your connected target database for the{" "}
                {ready.length} record(s) currently marked ready. This is not
                reversible from this screen.
              </p>

              <button
                type="button"
                onClick={writeReadyRecordsToTarget}
                disabled={writeStatus === "loading" || ready.length === 0}
                style={{
                  padding: "8px 14px",
                  background: "#dc2626",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  cursor: writeStatus === "loading" ? "default" : "pointer",
                }}
              >
                {writeStatus === "loading"
                  ? "Writing..."
                  : "Write Ready Records to Target"}
              </button>

              {writeError && (
                <p style={{ color: "#b91c1c", marginTop: 8, fontSize: 13 }}>
                  {writeError}
                </p>
              )}

              {writeStatus === "done" && (
                <div style={{ marginTop: 10 }}>
                  {writeResults.map((r) => (
                    <p key={r.table} style={{ margin: "4px 0", fontSize: 13, color: "#166534" }}>
                      <strong>{r.table}</strong>: inserted {r.inserted} of {r.attempted}
                      {r.skipped_no_matching_columns > 0
                        ? ` (${r.skipped_no_matching_columns} skipped â€” no matching columns)`
                        : ""}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

      </section>


      <section className="migrateSection">

        <div className="migrateSectionHeader">

          <div>
            <span className="migrateSectionLabel">
              MIGRATION PATH
            </span>

            <h2>
              Wave progress
            </h2>

            <p>
              Current readiness through the
              controlled migration lifecycle.
            </p>
          </div>

          <span className="migrateMigrationBadge">
            {
              discovery.migration_id ??
              "—"
            }
          </span>

        </div>


        <div className="migrateStageRibbon">

          {[
            ["Extract", 100],
            ["Map", mappingPercent],
            [
              "Transform",
              transformationPercent,
            ],
            [
              "Validate",
              validationPercent,
            ],
            ["Stage", stagePercent],
            ["Load", 0],
            ["Reconcile", 0],
          ].map(
            ([name, percent]) => (

              <div
                className="migrateStage"
                key={String(name)}
              >

                <div>

                  <span>
                    {name}
                  </span>

                  <strong>
                    {percent}%
                  </strong>

                </div>


                <div className="migrateStageBar">

                  <span
                    style={{
                      width:
                        `${percent}%`,
                    }}
                  />

                </div>

              </div>

            )
          )}

        </div>

      </section>


      {showWavePreview && (

        <section className="migrateSection">

          <div className="migrateSectionHeader">

            <div>

              <span className="migrateSectionLabel">
                WAVE PREVIEW
              </span>

              <h2>
                Migration wave record preview
              </h2>

              <p>
                Read-only staging population.
                No migration execution or
                target write occurs.
              </p>

            </div>

            <span className="statusPill success">
              READ ONLY
            </span>

          </div>


          <div className="migrateWaveMetrics">

            <div>
              <span>Total Planned</span>
              <strong>
                {totalPlannedRecords}
              </strong>
            </div>

            <div>
              <span>Ready</span>
              <strong>
                {ready.length}
              </strong>
            </div>

            <div>
              <span>Blocked</span>
              <strong>
                {
                  blockedReferential.length
                }
              </strong>
            </div>

            <div>
              <span>Review</span>
              <strong>
                {review.length}
              </strong>
            </div>

            <div>
              <span>Quarantine</span>
              <strong>
                {quarantine.length}
              </strong>
            </div>

            <div>
              <span>Rejected</span>
              <strong>
                {rejected.length}
              </strong>
            </div>

          </div>


          <div className="migrateWaveGrid">

            <div className="panel">

              <div className="panelHeader">

                <div>
                  <h3>
                    Ready Records
                  </h3>

                  <p>
                    Eligible for a future
                    authorized migration wave.
                  </p>
                </div>

                <span className="statusPill success">
                  {ready.length}
                </span>

              </div>


              <div className="checkList">

                {ready.length > 0 ? (
                  ready.map(
                    (
                      record,
                      index
                    ) => (

                      <div
                        className="checkRow"
                        key={`ready-${record.entity}-${record.row}-${index}`}
                      >

                        <span className="dot success" />

                        <span>
                          {
                            record.entity ??
                            "—"
                          }
                          {" · Row "}
                          {
                            record.row ??
                            "—"
                          }
                        </span>

                        <small>
                          READY
                        </small>

                      </div>

                    )
                  )
                ) : (

                  <div className="migrateListEmpty">
                    No ready records.
                  </div>

                )}

              </div>

            </div>


            <div className="panel">

              <div className="panelHeader">

                <div>
                  <h3>
                    Blocked Records
                  </h3>

                  <p>
                    Excluded by current
                    validation controls.
                  </p>
                </div>

                <span className="statusPill review">
                  {
                    blockedReferential.length
                  }
                </span>

              </div>


              <div className="checkList">

                {
                  blockedReferential.length >
                  0
                    ? blockedReferential.map(
                        (
                          item,
                          index
                        ) => (

                          <div
                            className="checkRow active"
                            key={`blocked-${item.entity}-${item.field}-${item.row}-${index}`}
                          >

                            <span className="dot warning" />

                            <span>

                              <strong>
                                {
                                  item.entity ??
                                  "—"
                                }.
                                {
                                  item.field ??
                                  "—"
                                }
                              </strong>

                              <small className="migrateBlockedDetail">
                                Row{" "}
                                {
                                  item.row ??
                                  "—"
                                }
                                {" · Value "}
                                {
                                  item.value ===
                                    undefined ||
                                  item.value ===
                                    null
                                    ? "—"
                                    : String(
                                        item.value
                                      )
                                }
                              </small>

                            </span>

                            <small>
                              BLOCKED
                            </small>

                          </div>

                        )
                      )
                    : (

                      <div className="migrateListEmpty">
                        No blocked records.
                      </div>

                    )
                }

              </div>

            </div>

          </div>

        </section>

      )}


      <section className="migrateSection">

        <div className="migrateSectionHeader">

          <div>
            <span className="migrateSectionLabel">
              STAGING EVIDENCE
            </span>

            <h2>
              Record disposition and safety
            </h2>

            <p>
              Current record-level planning
              state from the DEV runtime.
            </p>
          </div>

        </div>


        <div className="migrateDispositionGrid">

          <div>
            <span>Ready</span>
            <strong>
              {ready.length}
            </strong>
          </div>

          <div>
            <span>Blocked</span>
            <strong>
              {
                blockedReferential.length
              }
            </strong>
          </div>

          <div>
            <span>Review</span>
            <strong>
              {review.length}
            </strong>
          </div>

          <div>
            <span>Quarantine</span>
            <strong>
              {quarantine.length}
            </strong>
          </div>

          <div>
            <span>Rejected</span>
            <strong>
              {rejected.length}
            </strong>
          </div>

          <div>
            <span>Target Writes</span>
            <strong>
              {
                noTargetWrites
                  ? "NONE"
                  : "DETECTED"
              }
            </strong>
          </div>

        </div>


        {
          blockedReferential.length >
          0 && (

            <div className="migrateBlockedEvidence">

              {
                blockedReferential.map(
                  (
                    item,
                    index
                  ) => (

                    <div
                      key={`${item.entity}-${item.field}-${item.row}-${index}`}
                    >

                      <AlertTriangle
                        size={16}
                      />

                      <div>

                        <strong>
                          Blocked source record
                        </strong>

                        <span>
                          Entity:{" "}
                          {
                            item.entity ??
                            "—"
                          }
                          {" · Row: "}
                          {
                            item.row ??
                            "—"
                          }
                          {" · Field: "}
                          {
                            item.field ??
                            "—"
                          }
                          {" · Value: "}
                          {
                            item.value ===
                              undefined ||
                            item.value ===
                              null
                              ? "—"
                              : String(
                                  item.value
                                )
                          }
                        </span>

                        <small>
                          Target write: NO
                        </small>

                      </div>

                    </div>

                  )
                )
              }

            </div>

          )
        }

      </section>


      <div className="migrateSafetyNote">

        <ShieldCheck size={18} />

        <div>

          <strong>
            Migration remains guarded
          </strong>

          <span>
            Current mode:{" "}
            {
              discovery.mode ??
              "DISCOVERY_ONLY"
            }.
            No target write is authorized.
            Production migration and cutover
            remain disabled.
          </span>

        </div>

      </div>

    </div>
  );
}



