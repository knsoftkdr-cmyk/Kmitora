import A000ScenarioContextBanner from "../components/A000ScenarioContextBanner";
import { runRealDevValidation } from "../services/devValidation";
import ValidatePremiumWorkspaceR2 from "../components/ValidatePremiumWorkspaceR2";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FileCheck2,
  GitBranch,
  SearchCheck,
  ShieldCheck,
  Workflow,
  XCircle,
} from "lucide-react";

import KMITORACopilotOverview from "../components/KMITORACopilotOverview";
import { getLatestExecutionForMigration } from "../services/api";

type QualityFinding = {
  finding_type?: string;
  severity?: string;
  entity?: string;
  field?: string;
  row?: number;
  value?: unknown;
  reason?: string;
  message?: string;
  business_rules?: string[];
};

type RecordDisposition = {
  entity?: string;
  row?: number;
  disposition?: string;
  status?: string;
  reason?: string;
  business_rules?: string[];
};

type StagingRecord = {
  entity?: string;
  row?: number;
  status?: string;
  execution_state?: string;
  target_write?: boolean;
};

type ReferentialDependency = {
  source?: string;
  target?: string;
  entity?: string;
  field?: string;
  row?: number;
  value?: unknown;
  status?: string;
  execution_state?: string;
  target_write?: boolean;
  business_rules?: string[];
  orphan_values?: unknown[];
};

type TransformationPlanItem = {
  action?: string;
  entity?: string;
  field?: string;
  row?: number;
  finding_type?: string;
  severity?: string;
  business_rules?: string[];
  status?: string;
  execution_state?: string;
};

type DiscoveryResult = {
  migration_id?: string;
  status?: string;
  mode?: string;
  production_action_executed?: boolean;
  relationships?: Array<{
    child_entity?: string;
    child_field?: string;
    parent_entity?: string;
    parent_field?: string;
    orphan_values?: unknown[];
    business_rule?: string;
    business_rules?: string[];
  }>;
  quality_findings?: QualityFinding[];
  transformation_plan?: TransformationPlanItem[];
  record_dispositions?: RecordDisposition[];
  target_staging_plan?: {
    ready_records?: StagingRecord[];
    review_records?: StagingRecord[];
    quarantine_records?: StagingRecord[];
    rejected_records?: StagingRecord[];
    referential_dependencies?: ReferentialDependency[];
  };
  summary?: {
    quality_finding_count?: number;
    transformation_plan_count?: number;
    record_disposition_count?: number;
    staging_ready_count?: number;
    staging_review_count?: number;
    staging_quarantine_count?: number;
    staging_rejected_count?: number;
    staging_referential_dependency_count?: number;
    source_rows_scanned?: number;
    source_rows_matched?: number;
    validation_mode?: string;
    validation_execution_status?: string;
    validation_execution_id?: string;
  };
  validation_execution?: {
    mode?: string;
    execution_status?: string;
    execution_id?: string;
    source_record_count?: number;
    loaded_record_count?: number;
    referential_dependencies?: number;
    transformation_checks?: number;
  };
};

type PostLoadExecution = {
  execution_id?: string;
  migration_id?: string;
  status?: string;
  execution_mode?: string;
  loaded_record_count?: number;
  target_write_executed?: boolean;
  production_action_executed?: boolean;
};

type TestEvidence = {
  execution_id?: string;
  status?: string;
  test_gate?: string;
  promotion_allowed?: boolean;
};

export default function Validate() {
  const [discovery, setDiscovery] =
    useState<DiscoveryResult | null>(null);
  const [postLoadExecution, setPostLoadExecution] = useState<PostLoadExecution | null>(null);
  const [testEvidence, setTestEvidence] = useState<TestEvidence | null>(null);

  const [validationNotice, setValidationNotice] =
    useState("DEV validation controls are ready. No production execution is permitted.");

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      const raw = localStorage.getItem("kmitora.dev.discoveryResult");
      const rawTest = localStorage.getItem("kmitora.dev.testResult");
      let parsedDiscovery: DiscoveryResult | null = null;
      try { parsedDiscovery = raw ? (JSON.parse(raw) as DiscoveryResult) : null; } catch {}
      if (cancelled) return;
      setDiscovery(parsedDiscovery);
      try { setTestEvidence(rawTest ? (JSON.parse(rawTest) as TestEvidence) : null); } catch { setTestEvidence(null); }

      const migrationId = String(parsedDiscovery?.migration_id ?? "").trim();
      let authoritativeExecution: PostLoadExecution | null = null;
      if (migrationId) {
        try {
          authoritativeExecution = await getLatestExecutionForMigration(migrationId) as PostLoadExecution | null;
        } catch (executionLookupError) {
          console.warn("KMITORA Validate authoritative execution lookup failed", executionLookupError);
        }
      }
      if (cancelled) return;
      setPostLoadExecution(authoritativeExecution);
    };

    void hydrate();
    return () => { cancelled = true; };
  }, []);

  const findings =
    Array.isArray(discovery?.quality_findings)
      ? discovery!.quality_findings!
      : [];

  const dispositions =
    Array.isArray(discovery?.record_dispositions)
      ? discovery!.record_dispositions!
      : [];

  const plan =
    Array.isArray(discovery?.transformation_plan)
      ? discovery!.transformation_plan!
      : [];

  const staging =
    discovery?.target_staging_plan ?? {};

  const ready =
    Array.isArray(staging.ready_records)
      ? staging.ready_records
      : [];

  const review =
    Array.isArray(staging.review_records)
      ? staging.review_records
      : [];

  const quarantine =
    Array.isArray(staging.quarantine_records)
      ? staging.quarantine_records
      : [];

  const rejected =
    Array.isArray(staging.rejected_records)
      ? staging.rejected_records
      : [];

  const referential = useMemo(() => {
    const staged = Array.isArray(staging.referential_dependencies)
      ? staging.referential_dependencies
      : [];
    if (staged.length) return staged;

    const relationships = Array.isArray(discovery?.relationships)
      ? discovery!.relationships!
      : [];

    // VALIDATION_CONTEXT_002: preserve discovered relationship evidence even
    // when an older staging snapshot omitted referential_dependencies.
    return relationships.map((relation) => ({
      source: [relation.child_entity, relation.child_field].filter(Boolean).join('.'),
      target: [relation.parent_entity, relation.parent_field].filter(Boolean).join('.'),
      entity: relation.child_entity,
      field: relation.child_field,
      orphan_values: Array.isArray(relation.orphan_values) ? relation.orphan_values : [],
      business_rules: relation.business_rule
        ? [String(relation.business_rule)]
        : (relation.business_rules ?? []),
      status: Array.isArray(relation.orphan_values) && relation.orphan_values.length
        ? 'BLOCKED'
        : 'PASS',
      execution_state: 'VALIDATED',
      target_write: false
    }));
  }, [staging.referential_dependencies, discovery?.relationships]);

  const validationRows = useMemo(() => {
    const qualityRows =
      findings.map((finding, index) => ({
        id:
          `QF-${String(index + 1)
            .padStart(3, "0")}`,

        category:
          "QUALITY FINDING",

        subject:
          [finding.entity, finding.field]
            .filter(Boolean)
            .join(".") || "â€”",

        result:
          String(
            finding.severity ?? ""
          ).toUpperCase() === "ERROR"
            ? "BLOCKED"
            : "REVIEW",

        detail:
          finding.reason ??
          finding.message ??
          finding.finding_type ??
          "Discovery quality finding",

        rules:
          finding.business_rules ?? [],
      }));

    const referentialRows =
      referential.map(
        (dependency, index) => {
          const hasOrphanValues =
            (
              dependency.orphan_values
                ?.length ?? 0
            ) > 0;

          const isRecordLevelException =
            Boolean(dependency.entity) &&
            Boolean(dependency.field) &&
            dependency.row !== undefined &&
            dependency.row !== null &&
            dependency.value !== undefined &&
            dependency.value !== null;

          const blocked =
            hasOrphanValues ||
            isRecordLevelException;

          const subject =
            isRecordLevelException
              ? `${dependency.entity}.${dependency.field}`
              : [
                  dependency.source,
                  dependency.target,
                ]
                  .filter(Boolean)
                  .join(" â†’ ") ||
                "Relationship";

          const detail =
            isRecordLevelException
              ? `Row ${dependency.row} · orphan value ${String(
                  dependency.value
                )}`
              : hasOrphanValues
                ? `${dependency.orphan_values!.length} unresolved orphan value(s)`
                : "Referential dependency validated; no unresolved references were found";

          return {
            id:
              `RI-${String(index + 1)
                .padStart(3, "0")}`,

            category:
              isRecordLevelException
                ? "REFERENTIAL EXCEPTION"
                : "REFERENTIAL INTEGRITY",

            subject,

            result:
              blocked
                ? "BLOCKED"
                : "PASS",

            detail,

            rules:
              dependency.business_rules ??
              [],
          };
        }
      );

    return [
      ...qualityRows,
      ...referentialRows,
    ];
  }, [findings, referential]);

  const blockedValidationRows =
    validationRows.filter(
      (row) =>
        row.result === "BLOCKED"
    );

  const reviewValidationRows =
    validationRows.filter(
      (row) =>
        row.result === "REVIEW"
    );

  const blockingCount =
    quarantine.length +
    rejected.length +
    blockedValidationRows.length;

  const qualityGate =
    !discovery
      ? "NO DATA"
      : blockingCount > 0
        ? "REVIEW REQUIRED"
        : "READY FOR REVIEW";

  const noTargetWrites =
    discovery?.production_action_executed !==
      true &&
    [
      ...ready,
      ...review,
      ...quarantine,
      ...rejected,
    ].every(
      (record) =>
        record.target_write !== true
    );

  const stagingTotal =
    ready.length +
    review.length +
    quarantine.length +
    rejected.length;

  const readiness =
    stagingTotal > 0
      ? Math.round(
          (ready.length /
            stagingTotal) *
            100
        )
      : 0;

  const attentionRows =
    validationRows.filter(
      (row) =>
        row.result === "BLOCKED" ||
        row.result === "REVIEW"
    );

  const postLoadQualified =
    String(postLoadExecution?.status ?? "").toUpperCase() === "POST_LOAD_COMPLETED" &&
    String(postLoadExecution?.execution_mode ?? "").toUpperCase() === "DEV_REPLACE_LOAD" &&
    postLoadExecution?.target_write_executed === true &&
    postLoadExecution?.production_action_executed !== true &&
    Boolean(postLoadExecution?.execution_id) &&
    testEvidence?.execution_id === postLoadExecution?.execution_id &&
    String(testEvidence?.status ?? "").toUpperCase() === "PASSED" &&
    String(testEvidence?.test_gate ?? "").toUpperCase() === "PASS" &&
    testEvidence?.promotion_allowed === true;

  const recordSafeValidationInteraction = async (
    action: "RUN_IMPACTED_TESTS" | "VIEW_EVIDENCE" | "EXPLAIN"
  ) => {
    const status = discovery ? "DEV_SIMULATED" : "NO_DISCOVERY";

    localStorage.setItem(
      "kmitora.dev.validationInteraction",
      JSON.stringify({
        action,
        status,
        mode: "DEV_ONLY",
        discovery_available: Boolean(discovery),
        target_write_requested: false,
        production_action_executed: false,
        production_migration: "DISABLED",
        cutover: "DISABLED",
      })
    );

    if (action === "RUN_IMPACTED_TESTS") {
      if (!postLoadQualified) {
        setValidationNotice("Validation blocked: authoritative POST_LOAD_COMPLETED execution and PASSED Test evidence for the same execution are required.");
        return;
      }
      try {
        setValidationNotice(
          "Running real DEV read-only validation against current source evidence..."
        );

        const updated =
          await runRealDevValidation(discovery, postLoadExecution);

        setDiscovery(updated as DiscoveryResult);

        const run =
          updated?.validation_execution ?? {};

        setValidationNotice(
          `DEV validation completed from ${run.source_record_count ?? 0} source records. ` +
          `Ready ${run.ready_records ?? 0}, review ${run.review_records ?? 0}, ` +
          `rejected ${run.rejected_records ?? 0}. ` +
          `Post-load execution ${postLoadExecution?.execution_id ?? ""} confirmed ${postLoadExecution?.loaded_record_count ?? 0} DEV target records. ` +
          "Validation itself performs no writes. Production actions remain disabled."
        );
      } catch (error) {
        setValidationNotice(
          error instanceof Error
            ? `Validation blocked: ${error.message}`
            : `Validation blocked: ${String(error)}`
        );
      }

      return;
    }

    if (action === "VIEW_EVIDENCE") {
      setValidationNotice(
        discovery
          ? "Read-only validation evidence is available from the current discovery result."
          : "Evidence is pending discovery. This view remains read-only and does not fabricate results."
      );
      return;
    }

    setValidationNotice(
      discovery
        ? "KMITORA explanation is based on the current validation evidence and does not change execution state."
        : "KMITORA explanation: run Discovery first to produce validation evidence. No execution state changed."
    );
  };

  const validationCards =
    validationRows.length > 0
      ? validationRows.slice(0, 3).map((row) => ({
          id: row.id,
          title: row.subject,
          status:
            row.result === "BLOCKED"
              ? "BLOCKED"
              : row.result === "REVIEW"
                ? "REVIEW_REQUIRED"
                : "VALIDATED",
          severity:
            row.result === "BLOCKED"
              ? "HIGH"
              : row.result === "REVIEW"
                ? "MEDIUM"
                : "LOW",
          evidence: row.detail,
        }))
      : [
          {
            id: "VAL-PREREQ-001",
            title: "Discovery evidence prerequisite",
            status: "REVIEW_REQUIRED",
            severity: "MEDIUM",
            evidence:
              "Evidence pending discovery. No validation result is fabricated while source discovery is unavailable.",
          },
        ];

  const validationWorkbench = (
    <section className="validateSection">
      <div className="panel">
        <div className="validateSectionHeader">
          <div>
            <span className="validateSectionLabel">
              DEV VALIDATION WORKBENCH
            </span>
            <h2>Validation execution and evidence</h2>
            <p>
              Tests, defects, remediation, regression and evidence are coordinated here using safe DEV-only controls.
            </p>
          </div>

          <button
            type="button"
            className="primary"
            onClick={() =>
              recordSafeValidationInteraction("RUN_IMPACTED_TESTS")
            }
          >
            Run Impacted Tests
          </button>
        </div>

        <p className="validateInteractionNotice">
          {validationNotice}
        </p>

        <div className="validationCardGrid">
          {validationCards.map((card) => (
            <article className="validationCard" key={card.id}>
              <div className="validateSectionHeader">
                <div>
                  <span className="validateSectionLabel">{card.id}</span>
                  <h3>{card.title}</h3>
                </div>
                <span className="statusPill review">{card.status}</span>
              </div>

              <div className="validateDecisionMeta">
                <span>
                  Severity
                  <strong>{card.severity}</strong>
                </span>
                <span>
                  Evidence
                  <strong>READ ONLY</strong>
                </span>
              </div>

              <p>{card.evidence}</p>

              <div className="buttonRow">
                <button
                  type="button"
                  onClick={() =>
                    recordSafeValidationInteraction("VIEW_EVIDENCE")
                  }
                >
                  View Evidence
                </button>
                <button
                  type="button"
                  onClick={() =>
                    recordSafeValidationInteraction("EXPLAIN")
                  }
                >
                  Explain
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );

  if (!discovery) {
    return (
      <div className="page validateCenterPage">
      <A000ScenarioContextBanner />
      <ValidatePremiumWorkspaceR2 />

        <div className="validateHero">

          <div className="validateHeroCopy">

            <span className="eyebrow">
              STEP 05
            </span>

            <h1>
              Validation Control Center
            </h1>

            <p>
              Verify quality, business-rule,
              staging and referential-integrity
              evidence before advancing the
              migration.
            </p>

          </div>

          <KMITORACopilotOverview
            status="WAITING"
            message="Validation health, blockers and migration readiness"
          />

        </div>

        {validationWorkbench}

        <div className="panel validateEmptyState">

          <SearchCheck size={26} />

          <div>
            <h3>
              No Discovery Result Available
            </h3>

            <p>
              Run STEP 02 Discovery first.
              Validation will not fabricate
              or substitute mock results.
            </p>
          </div>

        </div>

      </div>
    );
  }

  return (
    <div className="page validateCenterPage">
      <ValidatePremiumWorkspaceR2 />

      <div className="validateHero">

        <div className="validateHeroCopy">

          <span className="eyebrow">
            STEP 05
          </span>

          <h1>
            Validation Control Center
          </h1>

          <p>
            Verify data quality, record
            dispositions, transformation
            evidence and referential integrity
            before KMITORA allows the workflow
            to progress.
          </p>

          <div className="validateHeroMeta">

            <span className="validateReadOnlyBadge">
              <ShieldCheck size={14} />
              Read-only validation
            </span>

            <span className="validateReadOnlyBadge">
              Target writes:{" "}
              {noTargetWrites
                ? "NONE"
                : "DETECTED"}
            </span>

          </div>

        </div>


        <KMITORACopilotOverview
          status={
            blockingCount > 0
              ? "REVIEW"
              : "READY"
          }
          message="Validation health, blockers and migration readiness"
        />

      </div>

      {validationWorkbench}

      <section className="validateSection">

        <div className="validateSectionHeader">

          <div>
            <span className="validateSectionLabel">
              VALIDATION HEALTH
            </span>

            <h2>
              Readiness at a glance
            </h2>

            <p>
              Current validation state based
              only on real discovery,
              staging and referential evidence.
            </p>
          </div>

          <span
            className={`statusPill ${
              blockingCount > 0
                ? "review"
                : "success"
            }`}
          >
            {qualityGate}
          </span>

        </div>


        <div className="validateMetrics">

          <div className="validateMetricCard">

            <FileCheck2 size={18} />

            <span>
              Validation Evidence
            </span>

            <strong>
              {validationRows.length}
            </strong>

            <small>
              Quality + referential checks
            </small>

          </div>


          <div className="validateMetricCard safe">

            <CheckCircle2 size={18} />

            <span>Ready</span>

            <strong>
              {ready.length}
            </strong>

            <small>
              Staging-ready records
            </small>

          </div>


          <div className="validateMetricCard review">

            <AlertTriangle size={18} />

            <span>Review</span>

            <strong>
              {
                review.length +
                reviewValidationRows.length
              }
            </strong>

            <small>
              Requires attention
            </small>

          </div>


          <div className="validateMetricCard blocked">

            <XCircle size={18} />

            <span>Blocked</span>

            <strong>
              {blockingCount}
            </strong>

            <small>
              Quarantine / reject / block
            </small>

          </div>


          <div className="validateMetricCard">

            <Database size={18} />

            <span>Readiness</span>

            <strong>
              {readiness}%
            </strong>

            <small>
              Ready staging share
            </small>

          </div>

        </div>

      </section>


      <section className="validateSection">

        <div className="validateSectionHeader">

          <div>
            <span className="validateSectionLabel">
              VALIDATION DOMAINS
            </span>

            <h2>
              What KMITORA is validating
            </h2>
          </div>

        </div>


        <div className="validateDomainGrid">

          <div className="validateDomainCard">

            <Workflow size={18} />

            <strong>
              Transformation Plan
            </strong>

            <span>
              {plan.length} planned actions
            </span>

            <small>
              {postLoadQualified
                ? `Validated after ${postLoadExecution?.status ?? "POST_LOAD_COMPLETED"}`
                : "Execution evidence pending"}
            </small>

          </div>


          <div className="validateDomainCard">

            <Database size={18} />

            <strong>
              Record Dispositions
            </strong>

            <span>
              {dispositions.length} decisions
            </span>

            <small>
              Ready / review / quarantine /
              reject classification
            </small>

          </div>


          <div className="validateDomainCard">

            <GitBranch size={18} />

            <strong>
              Referential Integrity
            </strong>

            <span>
              {referential.length} dependencies
            </span>

            <small>
              Relationship and orphan controls
            </small>

          </div>


          <div className="validateDomainCard">

            <ShieldCheck size={18} />

            <strong>
              Execution Safety
            </strong>

            <span>
              {
                noTargetWrites
                  ? "No target writes"
                  : "Review required"
              }
            </span>

            <small>
              Production action:{" "}
              {
                discovery
                  .production_action_executed
                  ? "DETECTED"
                  : "NONE"
              }
            </small>

          </div>

        </div>

      </section>


      <section className="validateSection">

        <div className="validateSectionHeader">

          <div>
            <span className="validateSectionLabel">
              VALIDATION RESULTS
            </span>

            <h2>
              Evidence and findings
            </h2>

            <p>
              Quality findings and referential
              controls derived from the current
              migration evidence.
            </p>
          </div>

          <span className="validateMigrationBadge">
            {
              discovery.migration_id ??
              "â€”"
            }
          </span>

        </div>


        <div className="panel validateResultsPanel">

          <div className="validateResultHeader">
            <span>ID</span>
            <span>Domain</span>
            <span>Subject</span>
            <span>Status</span>
            <span>Evidence / Rule</span>
          </div>


          {validationRows.length > 0 ? (
            validationRows.map((row) => (

              <div
                className="validateResultRow"
                key={row.id}
              >

                <code>{row.id}</code>

                <span>
                  {row.category}
                </span>

                <code>
                  {row.subject}
                </code>

                <span
                  className={`statusPill ${
                    row.result === "BLOCKED"
                      ? "review"
                      : row.result === "REVIEW"
                        ? "review"
                        : "success"
                  }`}
                >
                  {row.result}
                </span>

                <div className="validateEvidenceCell">

                  <span>
                    {row.detail}
                  </span>

                  {row.rules.length > 0 && (
                    <small>
                      Business rules:{" "}
                      {
                        row.rules.join(
                          ", "
                        )
                      }
                    </small>
                  )}

                </div>

              </div>

            ))
          ) : (

            <div className="validateNoRows">
              No quality or referential
              validation exceptions were
              returned.
            </div>

          )}

        </div>

      </section>


      {attentionRows.length > 0 && (

        <section className="validateSection">

          <div className="validateAttentionPanel">

            <div className="validateAttentionIcon">

              <AlertTriangle size={21} />

            </div>


            <div>

              <div className="validateAttentionHeader">

                <div>
                  <span className="validateSectionLabel">
                    ATTENTION REQUIRED
                  </span>

                  <h3>
                    Validation review required
                  </h3>
                </div>

                <span className="statusPill review">
                  {
                    attentionRows.length
                  } FINDINGS
                </span>

              </div>


              <p>
                KMITORA has detected quality or
                referential evidence requiring
                review before the workflow can
                be considered ready.
              </p>


              <div className="validateAttentionStats">

                <span>
                  Blocked evidence:{" "}
                  <strong>
                    {
                      blockedValidationRows.length
                    }
                  </strong>
                </span>

                <span>
                  Review evidence:{" "}
                  <strong>
                    {
                      reviewValidationRows.length
                    }
                  </strong>
                </span>

                <span>
                  Quarantine:{" "}
                  <strong>
                    {quarantine.length}
                  </strong>
                </span>

                <span>
                  Rejected:{" "}
                  <strong>
                    {rejected.length}
                  </strong>
                </span>

              </div>

            </div>

          </div>

        </section>

      )}


      <section className="validateSection">

        <div className="validateDecisionGrid">

          <div className="panel validateDecisionCard">

            <span className="validateSectionLabel">
              READINESS DECISION
            </span>

            <h2>
              {qualityGate}
            </h2>

            <p>
              {
                blockingCount > 0
                  ? "Blocking evidence exists. Review and governed resolution are required before progressing."
                  : "No blocking evidence is present in the current validation result. The workflow is ready for review."
              }
            </p>


            <div className="validateDecisionMeta">

              <span>
                Migration
                <strong>
                  {
                    discovery.migration_id ??
                    "â€”"
                  }
                </strong>
              </span>

              <span>
                Mode
                <strong>
                  {
                    discovery.validation_execution?.mode ??
                    discovery.summary?.validation_mode ??
                    (postLoadQualified ? "POST_LOAD_READ_ONLY" : discovery.mode) ??
                    "DISCOVERY_ONLY"
                  }
                </strong>
              </span>

              <span>
                Planned checks
                <strong>
                  {
                    discovery.validation_execution?.transformation_checks ??
                    plan.length
                  }
                </strong>
              </span>

            </div>

          </div>


          <div className="panel validateSafetyCard">

            <span className="validateSectionLabel">
              EXECUTION SAFETY
            </span>

            <div className="validateSafetyRows">

              <div>
                <span>
                  Source write
                </span>
                <strong>NONE</strong>
              </div>

              <div>
                <span>
                  Target write
                </span>
                <strong>
                  {
                    noTargetWrites
                      ? "NONE"
                      : "DETECTED"
                  }
                </strong>
              </div>

              <div>
                <span>
                  Production action
                </span>
                <strong>
                  {
                    discovery
                      .production_action_executed
                      ? "DETECTED"
                      : "NONE"
                  }
                </strong>
              </div>

              <div>
                <span>
                  Validation mode
                </span>
                <strong>
                  READ ONLY
                </strong>
              </div>

              <div>
                <span>
                  Production migration
                </span>
                <strong>
                  DISABLED
                </strong>
              </div>

              <div>
                <span>
                  Cutover
                </span>
                <strong>
                  DISABLED
                </strong>
              </div>

            </div>

          </div>

        </div>

      </section>

    </div>
  );
}


