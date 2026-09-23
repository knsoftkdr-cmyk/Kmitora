import ApprovalDecisionPremiumWorkspace from "../components/ApprovalDecisionPremiumWorkspace";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileCheck2,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import {
  decideApproval,
  getApprovals,
} from "../services/api";

import KMITORACopilotOverview from "../components/KMITORACopilotOverview";

type ApprovalInput = {
  migration_id?: string;
  requested_action?: string;
  environment?: string;
  execution_requested?: boolean;
  target_write_requested?: boolean;

  staging_snapshot?: {
    total_planned_records?: number;
    ready_records?: number;
    blocked_records?: number;
    review_records?: number;
    quarantine_records?: number;
    rejected_records?: number;
  };

  validation_snapshot?: {
    quality_findings?: number;
    blocking_findings?: number;
    validation_ready?: boolean;
  };

  safety?: {
    production_action_executed?: boolean;
    target_write_detected?: boolean;
  };
};

type ApprovalRequest = {
  id?: string;
  status?: string;
  approved?: boolean;
  rejected?: boolean;
  requires_authoritative_approver?: boolean;
  requested_at?: string;
  decision_at?: string | null;
  decision_by?: string | null;
  decision_reason?: string | null;
  production_action_executed?: boolean;
  target_write_executed?: boolean;
  input?: ApprovalInput;
};

export default function ApprovalCenter() {
  const [approvals, setApprovals] =
    useState<ApprovalRequest[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [decisionBy, setDecisionBy] =
    useState("DEV_AUTHORIZED_REVIEWER");

  const [decisionReason, setDecisionReason] =
    useState("");

  const [decidingId, setDecidingId] =
    useState<string | null>(null);

  const [decisionError, setDecisionError] =
    useState("");

  async function loadApprovals() {
    try {
      setLoading(true);
      setError("");

      const response =
        await getApprovals();

      const items =
        Array.isArray(
          response?.payload?.items
        )
          ? response.payload.items
          : [];

      setApprovals(items);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load approval requests"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleDecision(
    approvalId: string,
    decision: "APPROVE" | "REJECT"
  ) {
    if (!decisionBy.trim()) {
      setDecisionError(
        "Authoritative reviewer is required."
      );
      return;
    }

    if (!decisionReason.trim()) {
      setDecisionError(
        "Decision reason is required."
      );
      return;
    }

    try {
      setDecidingId(approvalId);
      setDecisionError("");

      const response =
        await decideApproval(
          approvalId,
          decision,
          decisionBy.trim(),
          decisionReason.trim()
        );

      const decidedApproval =
        response?.payload ??
        response;

      if (decidedApproval?.id) {
        localStorage.setItem(
          "kmitora.dev.approvalRequest",
          JSON.stringify(
            decidedApproval
          )
        );
      }

      setDecisionReason("");

      await loadApprovals();
    } catch (err) {
      setDecisionError(
        err instanceof Error
          ? err.message
          : "Unable to record approval decision."
      );
    } finally {
      setDecidingId(null);
    }
  }

  useEffect(() => {
    void loadApprovals();
  }, []);

  const pending =
    approvals.filter(
      (item) =>
        String(
          item.status ?? ""
        ).toUpperCase() ===
        "PENDING"
    );

  const approved =
    approvals.filter(
      (item) =>
        item.approved === true
    );

  const rejected =
    approvals.filter(
      (item) =>
        item.rejected === true
    );

  const authoritativeRequired =
    approvals.filter(
      (item) =>
        item.requires_authoritative_approver ===
        true
    ).length;

  return (
    <div className="page approvalCenterPage">
      <ApprovalDecisionPremiumWorkspace
        approvals={approvals}
        loading={loading}
        error={error}
        onRefresh={() => void loadApprovals()}
      />

      <div className="approvalHero">

        <div className="approvalHeroCopy">

          <span className="eyebrow">
            GOVERNANCE
          </span>

          <h1>
            Approval & Decision Center
          </h1>

          <p>
            Authoritative review of migration
            requests, validation readiness,
            staging evidence and execution
            safety before any governed
            DEV dry-run progression.
          </p>

          <div className="approvalHeroMeta">

            <span className="approvalGovernanceBadge">
              <ShieldCheck size={14} />
              Authority gated
            </span>

            <span className="approvalGovernanceBadge">
              Target writes disabled
            </span>

          </div>

        </div>


        <KMITORACopilotOverview
          status={
            pending.length > 0
              ? "REVIEW"
              : "READY"
          }
          message="Approval readiness, blockers and authoritative decision status"
        />

      </div>


      <section className="approvalSection">

        <div className="approvalSectionHeader">

          <div>

            <span className="approvalSectionLabel">
              GOVERNANCE HEALTH
            </span>

            <h2>
              Approval queue overview
            </h2>

            <p>
              Current authoritative approval
              state retrieved from the DEV
              runtime approval service.
            </p>

          </div>


          <button
            type="button"
            onClick={() =>
              void loadApprovals()
            }
            disabled={loading}
          >
            <RefreshCw size={15} />
            {
              loading
                ? "Refreshing..."
                : "Refresh"
            }
          </button>

        </div>


        <div className="approvalMetrics">

          <div className="approvalMetricCard">

            <FileCheck2 size={18} />

            <span>
              Total Requests
            </span>

            <strong>
              {approvals.length}
            </strong>

            <small>
              Registered approvals
            </small>

          </div>


          <div className="approvalMetricCard attention">

            <Clock3 size={18} />

            <span>
              Pending
            </span>

            <strong>
              {pending.length}
            </strong>

            <small>
              Awaiting decision
            </small>

          </div>


          <div className="approvalMetricCard safe">

            <CheckCircle2 size={18} />

            <span>
              Approved
            </span>

            <strong>
              {approved.length}
            </strong>

            <small>
              Authority accepted
            </small>

          </div>


          <div className="approvalMetricCard blocked">

            <XCircle size={18} />

            <span>
              Rejected
            </span>

            <strong>
              {rejected.length}
            </strong>

            <small>
              Authority rejected
            </small>

          </div>


          <div className="approvalMetricCard">

            <ShieldCheck size={18} />

            <span>
              Authority Required
            </span>

            <strong>
              {authoritativeRequired}
            </strong>

            <small>
              Governed requests
            </small>

          </div>

        </div>

      </section>


      {error && (

        <div className="approvalAlert error">

          <AlertTriangle size={18} />

          <div>
            <strong>
              Approval service error
            </strong>

            <span>
              {error}
            </span>
          </div>

        </div>

      )}


      {loading &&
        approvals.length === 0 && (

        <div className="panel approvalEmptyState">

          <RefreshCw size={22} />

          <div>
            <h3>
              Loading approval requests
            </h3>

            <p>
              Reading current approval
              state from the DEV runtime.
            </p>
          </div>

        </div>

      )}


      {!loading &&
        approvals.length === 0 &&
        !error && (

        <div className="panel approvalEmptyState">

          <FileCheck2 size={22} />

          <div>
            <h3>
              No approval requests
            </h3>

            <p>
              No migration approval requests
              are currently registered in
              this runtime session.
            </p>
          </div>

        </div>

      )}


      {approvals.map(
        (approval) => {

          const input =
            approval.input ?? {};

          const staging =
            input.staging_snapshot ??
            {};

          const validation =
            input.validation_snapshot ??
            {};

          const safety =
            input.safety ?? {};

          const approvalStatus =
            String(
              approval.status ??
              "UNKNOWN"
            ).toUpperCase();

          const blockedRecords =
            staging.blocked_records ??
            0;

          const blockingFindings =
            validation.blocking_findings ??
            0;

          const validationReady =
            validation.validation_ready ===
            true;

          const approvalReady =
            validationReady &&
            blockedRecords === 0 &&
            blockingFindings === 0;

          const executionRequested =
            input.execution_requested ===
            true;

          const targetWriteRequested =
            input.target_write_requested ===
            true;

          const productionExecuted =
            approval.production_action_executed ===
            true;

          const targetWriteExecuted =
            approval.target_write_executed ===
            true;

          const targetWriteDetected =
            safety.target_write_detected ===
            true;

          const safeRequest =
            executionRequested === false &&
            targetWriteRequested === false &&
            productionExecuted === false &&
            targetWriteExecuted === false &&
            targetWriteDetected === false;

          return (
            <section
              className="approvalSection"
              key={
                approval.id ??
                `${input.migration_id}-${approval.requested_at}`
              }
            >

              <div className="panel approvalRequestCard">

                <div className="approvalRequestHeader">

                  <div>

                    <span className="approvalEnvironment">
                      {
                        input.environment ??
                        "DEV"
                      }
                    </span>

                    <h2>
                      {
                        input.migration_id ??
                        "Unknown Migration"
                      }
                    </h2>

                    <p>
                      {
                        input.requested_action ??
                        "MIGRATION_APPROVAL"
                      }
                    </p>

                  </div>


                  <span
                    className={`statusPill ${
                      approvalStatus ===
                      "APPROVED"
                        ? "success"
                        : approvalStatus ===
                          "REJECTED"
                          ? ""
                          : "review"
                    }`}
                  >
                    {approvalStatus}
                  </span>

                </div>


                <div className="approvalReadinessStrip">

                  <div>
                    <span>
                      Total Planned
                    </span>
                    <strong>
                      {
                        staging
                          .total_planned_records ??
                        0
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      Ready
                    </span>
                    <strong>
                      {
                        staging
                          .ready_records ??
                        0
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      Blocked
                    </span>
                    <strong>
                      {blockedRecords}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Review
                    </span>
                    <strong>
                      {
                        staging
                          .review_records ??
                        0
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      Quarantine
                    </span>
                    <strong>
                      {
                        staging
                          .quarantine_records ??
                        0
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      Rejected
                    </span>
                    <strong>
                      {
                        staging
                          .rejected_records ??
                        0
                      }
                    </strong>
                  </div>

                </div>


                <div className="approvalEvidenceGrid">

                  <div className="approvalEvidenceBlock">

                    <span className="approvalSectionLabel">
                      VALIDATION EVIDENCE
                    </span>

                    <div className="approvalEvidenceRows">

                      <div>
                        <span>
                          Validation Ready
                        </span>
                        <strong>
                          {
                            validationReady
                              ? "YES"
                              : "NO"
                          }
                        </strong>
                      </div>

                      <div>
                        <span>
                          Quality Findings
                        </span>
                        <strong>
                          {
                            validation
                              .quality_findings ??
                            0
                          }
                        </strong>
                      </div>

                      <div>
                        <span>
                          Blocking Findings
                        </span>
                        <strong>
                          {
                            blockingFindings
                          }
                        </strong>
                      </div>

                      <div>
                        <span>
                          Approval Gate
                        </span>
                        <strong>
                          {
                            approvalReady
                              ? "READY"
                              : "BLOCKED"
                          }
                        </strong>
                      </div>

                    </div>

                  </div>


                  <div className="approvalEvidenceBlock">

                    <span className="approvalSectionLabel">
                      SAFETY ASSERTIONS
                    </span>

                    <div className="approvalEvidenceRows">

                      <div>
                        <span>
                          Execution Requested
                        </span>
                        <strong>
                          {
                            executionRequested
                              ? "YES"
                              : "NO"
                          }
                        </strong>
                      </div>

                      <div>
                        <span>
                          Target Write Requested
                        </span>
                        <strong>
                          {
                            targetWriteRequested
                              ? "YES"
                              : "NO"
                          }
                        </strong>
                      </div>

                      <div>
                        <span>
                          Production Action
                        </span>
                        <strong>
                          {
                            productionExecuted
                              ? "EXECUTED"
                              : "NOT EXECUTED"
                          }
                        </strong>
                      </div>

                      <div>
                        <span>
                          Target Write
                        </span>
                        <strong>
                          {
                            targetWriteExecuted
                              ? "EXECUTED"
                              : "NOT EXECUTED"
                          }
                        </strong>
                      </div>

                      <div>
                        <span>
                          Target Write Detected
                        </span>
                        <strong>
                          {
                            targetWriteDetected
                              ? "YES"
                              : "NO"
                          }
                        </strong>
                      </div>

                      <div>
                        <span>
                          Request Safety
                        </span>
                        <strong>
                          {
                            safeRequest
                              ? "SAFE"
                              : "REVIEW"
                          }
                        </strong>
                      </div>

                    </div>

                  </div>

                </div>


                <div className="approvalTraceability">

                  <div>
                    <span>
                      Approval ID
                    </span>
                    <strong>
                      {
                        approval.id ??
                        "—"
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      Requested At
                    </span>
                    <strong>
                      {
                        approval.requested_at ??
                        "—"
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      Authoritative Approval
                    </span>
                    <strong>
                      {
                        approval
                          .requires_authoritative_approver
                          ? "REQUIRED"
                          : "NOT REQUIRED"
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      Decision By
                    </span>
                    <strong>
                      {
                        approval.decision_by ??
                        "—"
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      Decision At
                    </span>
                    <strong>
                      {
                        approval.decision_at ??
                        "—"
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      Decision
                    </span>
                    <strong>
                      {
                        approval.approved
                          ? "APPROVED"
                          : approval.rejected
                            ? "REJECTED"
                            : "PENDING"
                      }
                    </strong>
                  </div>

                </div>


                {approval.decision_reason && (

                  <div className="approvalDecisionReason">

                    <span className="approvalSectionLabel">
                      DECISION REASON
                    </span>

                    <p>
                      {
                        approval.decision_reason
                      }
                    </p>

                  </div>

                )}


                {approvalStatus ===
                  "PENDING" &&
                  approval.id && (

                  <div className="approvalDecisionPanel">

                    <div className="approvalDecisionHeader">

                      <div>
                        <span className="approvalSectionLabel">
                          AUTHORITATIVE DECISION
                        </span>

                        <h3>
                          Review and record decision
                        </h3>

                        <p>
                          Decision recording does
                          not execute migration or
                          perform target writes.
                        </p>
                      </div>

                      <span
                        className={`statusPill ${
                          approvalReady
                            ? "success"
                            : "review"
                        }`}
                      >
                        {
                          approvalReady
                            ? "READY TO DECIDE"
                            : "BLOCKED"
                        }
                      </span>

                    </div>


                    <div className="approvalDecisionFields">

                      <label>
                        <span>
                          Authoritative Reviewer
                        </span>

                        <input
                          type="text"
                          value={decisionBy}
                          onChange={
                            (event) =>
                              setDecisionBy(
                                event
                                  .target
                                  .value
                              )
                          }
                          placeholder="Authorized reviewer"
                        />
                      </label>


                      <label>
                        <span>
                          Decision Reason
                        </span>

                        <textarea
                          value={
                            decisionReason
                          }
                          onChange={
                            (event) =>
                              setDecisionReason(
                                event
                                  .target
                                  .value
                              )
                          }
                          placeholder="Enter the authoritative decision reason"
                          rows={4}
                        />
                      </label>

                    </div>


                    {decisionError && (

                      <div className="approvalAlert error">

                        <AlertTriangle size={17} />

                        <span>
                          {decisionError}
                        </span>

                      </div>

                    )}


                    {!approvalReady && (

                      <div className="approvalAlert warning">

                        <AlertTriangle size={17} />

                        <span>
                          Approval is blocked until
                          validation is ready,
                          blocked records are zero,
                          and blocking findings are zero.
                        </span>

                      </div>

                    )}


                    <div className="approvalDecisionActions">

                      <button
                        type="button"
                        disabled={
                          decidingId ===
                            approval.id ||
                          !decisionReason.trim()
                        }
                        onClick={() =>
                          void handleDecision(
                            approval.id!,
                            "REJECT"
                          )
                        }
                      >
                        <XCircle size={15} />
                        {
                          decidingId ===
                          approval.id
                            ? "Recording..."
                            : "Reject"
                        }
                      </button>


                      <button
                        type="button"
                        className="primary"
                        disabled={
                          decidingId ===
                            approval.id ||
                          !decisionReason.trim() ||
                          !approvalReady
                        }
                        onClick={() =>
                          void handleDecision(
                            approval.id!,
                            "APPROVE"
                          )
                        }
                      >
                        <CheckCircle2 size={15} />
                        Approve
                      </button>

                    </div>

                  </div>

                )}


                <div className="approvalFooterState">

                  <span>
                    DECISION:{" "}
                    {
                      approval.approved
                        ? "APPROVED"
                        : approval.rejected
                          ? "REJECTED"
                          : "PENDING"
                    }
                  </span>

                  <span>
                    EXECUTION DISABLED · NO TARGET WRITE
                  </span>

                </div>

              </div>

            </section>
          );
        }
      )}


      <div className="approvalSafetyNote">

        <ShieldCheck size={18} />

        <div>

          <strong>
            Authoritative approval does not equal execution
          </strong>

          <span>
            This workspace records governed
            decisions only. Migration execution,
            target writes and production actions
            remain controlled independently by
            downstream safety gates.
          </span>

        </div>

      </div>

    </div>
  );
}

