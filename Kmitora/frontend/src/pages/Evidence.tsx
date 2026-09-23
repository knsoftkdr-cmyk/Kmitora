import A000ScenarioContextBanner from "../components/A000ScenarioContextBanner";
import EvidencePremiumWorkspace from "../components/EvidencePremiumWorkspace";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  FileCheck2,
  GitBranch,
  Search,
  ShieldCheck,
  Workflow,
} from "lucide-react";

import KMITORACopilotOverview from "../components/KMITORACopilotOverview";
import { getEvidenceById } from "../services/api";

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

const LAST_EVIDENCE_KEY =
  "kmitora.dev.lastEvidence";

export default function Evidence() {
  const [evidence, setEvidence] =
    useState<EvidencePackage | null>(null);

  const [search, setSearch] =
    useState("");

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      try {
        const stored = localStorage.getItem(LAST_EVIDENCE_KEY);
        if (!stored) {
          if (!cancelled) setEvidence(null);
          return;
        }

        const parsed = JSON.parse(stored);
        const evidenceId = String(parsed?.evidence_id ?? "").trim();

        if (evidenceId) {
          try {
            const response = await getEvidenceById(evidenceId);
            const authoritative = response?.payload ?? response;
            if (!cancelled && authoritative) {
              setEvidence(authoritative);
              return;
            }
          } catch (lookupError) {
            console.warn("KMITORA Evidence authoritative lookup failed", lookupError);
          }
        }

        if (!cancelled) {
          const looksFull = Array.isArray(parsed?.business_rules) || Array.isArray(parsed?.transformation_evidence);
          setEvidence(looksFull ? parsed : null);
        }
      } catch {
        if (!cancelled) setEvidence(null);
      }
    };

    void hydrate();
    return () => { cancelled = true; };
  }, []);

  const rows = useMemo(() => {
    if (!evidence) {
      return [];
    }

    const data: Array<{
      id: string;
      category: string;
      object: string;
      rule: string;
      status: string;
    }> = [];

    for (
      const item of
        evidence.transformation_evidence ??
        []
    ) {
      data.push({
        id:
          `${item.source ?? "source"}->${item.target ?? "target"}`,

        category:
          item.action ??
          "TRANSFORMATION",

        object:
          `${item.source ?? "-"} → ${item.target ?? "-"}`,

        rule:
          Array.isArray(
            item.business_rules
          )
            ? item.business_rules.join(
                ", "
              )
            : "-",

        status:
          item.status ??
          "PLANNED",
      });
    }

    for (
      const rule of
        evidence.business_rules ?? []
    ) {
      data.push({
        id: rule.id ?? "-",

        category:
          "BUSINESS RULE",

        object:
          rule.rule ?? "-",

        rule:
          rule.id ?? "-",

        status:
          "EVIDENCED",
      });
    }

    return data;
  }, [evidence]);

  const filtered = useMemo(() => {
    const q =
      search.trim().toLowerCase();

    if (!q) {
      return rows;
    }

    return rows.filter((row) =>
      Object.values(row).some(
        (value) =>
          String(value)
            .toLowerCase()
            .includes(q)
      )
    );
  }, [rows, search]);

  if (!evidence) {
    return (
      <div className="page evidenceCenterPage">
      <A000ScenarioContextBanner />
      <EvidencePremiumWorkspace />

        <div className="evidenceHero">

          <div className="evidenceHeroCopy">

            <span className="eyebrow">
              STEP 08
            </span>

            <h1>
              Evidence & Audit Center
            </h1>

            <p>
              Audit-ready migration proof becomes
              available only after a successful
              reconciliation.
            </p>

          </div>


          <KMITORACopilotOverview
            status="WAITING"
            message="Evidence completeness, audit readiness and safety proof"
          />

        </div>


        <div className="panel evidenceEmptyState">

          <FileCheck2 size={26} />

          <div>

            <h3>
              Evidence not generated
            </h3>

            <p>
              Run DEV reconciliation first.
              KMITORA automatically generates
              and persists the evidence package
              after a PASS result.
            </p>

          </div>

        </div>

      </div>
    );
  }


  const discovery =
    evidence.discovery_summary ?? {};

  const execution =
    evidence.execution_summary ?? {};

  const reconciliation =
    evidence.reconciliation_summary ?? {};

  const discoveredSourceCount =
    Number(
      discovery.source_rows_matched ??
      discovery.source_rows_scanned ??
      discovery.rows_observed ??
      reconciliation.input_record_count ??
      0
    );

  const executedReadyCount =
    Number(
      reconciliation.input_record_count ??
      0
    );

  void executedReadyCount;
  const targetResultCount =
    Number(
      reconciliation.simulated_record_count ??
      reconciliation.loaded_record_count ??
      reconciliation.target_write_count ??
      0
    );

  const reviewHeldCount =
    Number(
      discovery.staging_review_count ??
      reconciliation.held_records?.review ??
      0
    );

  const matchedCount =
    Number(
      reconciliation.matched_records ??
      0
    );

  const variance =
    Number(
      reconciliation.count_variance ??
      0
    );

  const businessRuleCount =
    Number(
      discovery.business_rule_count ??
      evidence.business_rules?.length ??
      0
    );

  const targetWrites =
    evidence.safety
      ?.target_write_count ?? 0;

  const productionActions =
    evidence.safety
      ?.production_action_count ?? 0;

  const targetWriteExecuted =
    evidence.safety
      ?.target_write_executed ??
    false;

  const productionActionExecuted =
    evidence.safety
      ?.production_action_executed ??
    false;

  const productionExecuted =
    evidence.safety
      ?.production_executed ??
    false;

  const reconciliationMode =
    String(reconciliation.reconciliation_mode ?? "").toUpperCase();

  const isPostLoad = reconciliationMode === "POST_LOAD_DEV";

  const safetyPass =
    productionActions === 0 &&
    productionActionExecuted !== true &&
    productionExecuted !== true &&
    (isPostLoad
      ? targetWriteExecuted === true && targetWrites === matchedCount
      : targetWrites === 0 && targetWriteExecuted !== true);

  const evidenceComplete =
    Boolean(evidence.evidence_id) &&
    Boolean(evidence.migration_id) &&
    Boolean(evidence.execution_id) &&
    Boolean(evidence.reconciliation_id);

  const auditStatus =
    evidenceComplete && safetyPass
      ? "COMPLETE"
      : "REVIEW REQUIRED";

  return (
    <div className="page evidenceCenterPage">
      <EvidencePremiumWorkspace />

      <div className="evidenceHero">

        <div className="evidenceHeroCopy">

          <span className="eyebrow">
            STEP 08
          </span>

          <h1>
            Evidence & Audit Center
          </h1>

          <p>
            Review live traceability for discovery, approval, governed DEV execution, reconciliation, transformation, business-rule and safety evidence.
          </p>

          <div className="evidenceHeroMeta">

            <span className="evidenceAuditBadge">
              <FileCheck2 size={14} />
              Audit-ready evidence
            </span>

            <span className="evidenceAuditBadge">
              Safety:{" "}
              {
                safetyPass
                  ? "PROVEN"
                  : "REVIEW"
              }
            </span>

          </div>

        </div>


        <KMITORACopilotOverview
          status={auditStatus}
          message="Evidence completeness, audit readiness and safety proof"
        />

      </div>


      <section className="evidenceSection">

        <div className="evidenceSectionHeader">

          <div>

            <span className="evidenceSectionLabel">
              EVIDENCE HEALTH
            </span>

            <h2>
              Audit status at a glance
            </h2>

            <p>
              Current evidence metrics derived
              from the persisted runtime package.
            </p>

          </div>

          <span
            className={`statusPill ${
              auditStatus === "COMPLETE"
                ? "success"
                : "review"
            }`}
          >
            {auditStatus}
          </span>

        </div>


        <div className="evidenceMetrics">

          <div className="evidenceMetricCard">

            <Workflow size={18} />

            <span>
              Discovered Scope
            </span>

            <strong>
              {discoveredSourceCount}
            </strong>

            <small>
              Authoritative source scope
            </small>

          </div>


          <div className="evidenceMetricCard">

            <GitBranch size={18} />

            <span>
              {isPostLoad ? "Actual DEV Target" : "Simulated"}
            </span>

            <strong>
              {targetResultCount}
            </strong>

            <small>
              {isPostLoad ? "Governed DEV target records" : "Dry-run target records"}
            </small>

          </div>


          <div className="evidenceMetricCard safe">

            <CheckCircle2 size={18} />

            <span>
              Matched
            </span>

            <strong>
              {matchedCount}
            </strong>

            <small>
              Reconciled records
            </small>

          </div>


          <div className="evidenceMetricCard">

            <Workflow size={18} />

            <span>
              Review Held
            </span>

            <strong>
              {reviewHeldCount}
            </strong>

            <small>
              Governed records not loaded
            </small>

          </div>


          <div className="evidenceMetricCard">

            <FileCheck2 size={18} />

            <span>
              Business Rules
            </span>

            <strong>
              {businessRuleCount}
            </strong>

            <small>
              Evidenced rules
            </small>

          </div>


          <div className="evidenceMetricCard">

            <ShieldCheck size={18} />

            <span>
              Variance
            </span>

            <strong>
              {variance}
            </strong>

            <small>
              Reconciliation variance
            </small>

          </div>

        </div>

      </section>


      <section className="evidenceSection">

        <div className="evidenceSectionHeader">

          <div>

            <span className="evidenceSectionLabel">
              TRACEABILITY
            </span>

            <h2>
              Evidence identity chain
            </h2>

            <p>
              Complete runtime lineage from
              migration through reconciliation.
            </p>

          </div>

          <span className="statusPill success">
            {
              evidence.status ??
              "COMPLETE"
            }
          </span>

        </div>


        <div className="evidenceTraceGrid">

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
            <span>Reconciliation ID</span>
            <strong>
              {
                evidence.reconciliation_id ??
                "—"
              }
            </strong>
          </div>

          <div>
            <span>Execution Status</span>
            <strong>
              {
                String(
                  execution.status ??
                  "—"
                )
              }
            </strong>
          </div>

        </div>

      </section>


      <section className="evidenceSection">

        <div className="evidenceSectionHeader">

          <div>

            <span className="evidenceSectionLabel">
              TRACEABILITY CHAIN
            </span>

            <h2>
              Runtime decision lineage
            </h2>

          </div>

        </div>


        <div className="evidenceChain">

          {[
            ["Discovery", Boolean(
              evidence.discovery_summary
            )],

            ["Approval", Boolean(
              evidence.approval_id
            )],

            ["Execution", Boolean(
              evidence.execution_id
            )],

            ["Reconciliation", Boolean(
              evidence.reconciliation_id
            )],

            ["Evidence Package", Boolean(
              evidence.evidence_id
            )],
          ].map(
            ([label, available], index) => (

              <div
                className="evidenceChainItem"
                key={String(label)}
              >

                <div
                  className={`evidenceChainNode ${
                    available
                      ? "complete"
                      : "pending"
                  }`}
                >
                  {
                    available
                      ? (
                        <CheckCircle2
                          size={17}
                        />
                      )
                      : (
                        <span>
                          {index + 1}
                        </span>
                      )
                  }
                </div>

                <strong>
                  {label}
                </strong>

                <small>
                  {
                    available
                      ? "EVIDENCED"
                      : "NOT AVAILABLE"
                  }
                </small>

              </div>

            )
          )}

        </div>

      </section>


      <section className="evidenceSection">

        <div className="evidenceSectionHeader">

          <div>

            <span className="evidenceSectionLabel">
              SAFETY PROOF
            </span>

            <h2>
              Execution truth
            </h2>

            <p>
              Safety values are displayed directly
              from the generated evidence package.
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
                ? "SAFE"
                : "REVIEW"
            }
          </span>

        </div>


        <div className="panel evidenceSafetyPanel">

          <div className="evidenceSafetyRows">

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
                    targetWriteExecuted
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
                    productionActionExecuted
                  )
                }
              </strong>
            </div>


            <div>
              <span>
                Production Executed
              </span>

              <strong>
                {
                  String(
                    productionExecuted
                  )
                }
              </strong>
            </div>

          </div>

        </div>

      </section>


      <section className="evidenceSection">

        <div className="evidenceSectionHeader">

          <div>

            <span className="evidenceSectionLabel">
              EVIDENCE LEDGER
            </span>

            <h2>
              Transformation and rule evidence
            </h2>

            <p>
              Search runtime mapping,
              transformation and business-rule
              evidence.
            </p>

          </div>


          <div className="evidenceSearchWrap">

            <Search size={15} />

            <input
              className="searchBox"
              placeholder="Search evidence..."
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
            />

          </div>

        </div>


        <div className="panel evidenceLedgerPanel">

          <div className="evidenceLedgerHeader">

            <span>Category</span>
            <span>Object</span>
            <span>Rule</span>
            <span>Status</span>

          </div>


          {
            filtered.length > 0
              ? filtered.map(
                  (row, index) => (

                    <div
                      className="evidenceLedgerRow"
                      key={`${row.id}-${index}`}
                    >

                      <span>
                        {row.category}
                      </span>

                      <span>
                        {row.object}
                      </span>

                      <span>
                        {row.rule}
                      </span>

                      <span>
                        {row.status}
                      </span>

                    </div>

                  )
                )
              : (

                <div className="evidenceLedgerEmpty">
                  No evidence rows match the current search.
                </div>

              )
          }

        </div>

      </section>


      <div className="evidenceAuditNote">

        <ShieldCheck size={18} />

        <div>

          <strong>
            Audit package status: {auditStatus}
          </strong>

          <span>
            Runtime evidence remains read-only.
            Production migration and cutover remain disabled.
          </span>

        </div>

      </div>

    </div>
  );
}

