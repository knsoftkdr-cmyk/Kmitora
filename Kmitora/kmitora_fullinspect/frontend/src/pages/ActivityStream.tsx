import ActivityAuditPremiumWorkspace from "../components/ActivityAuditPremiumWorkspace";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Search,
  ShieldCheck,
} from "lucide-react";

import type {
  ActivityEvent,
} from "../types";

import KMITORACopilotOverview from "../components/KMITORACopilotOverview";

type RuntimeRecord =
  Record<string, unknown>;

type ActivityRecord =
  ActivityEvent & {
    id: string;
    category:
      | "DISCOVERY"
      | "APPROVAL"
      | "EXECUTION"
      | "EVIDENCE"
      | "INTELLIGENCE";
    reference?: string;
    timestamped: boolean;
  };

function readStoredRecord(
  key: string
): RuntimeRecord | null {
  try {
    const raw =
      localStorage.getItem(key);

    if (!raw) {
      return null;
    }

    const parsed =
      JSON.parse(raw);

    return parsed &&
      typeof parsed === "object"
      ? parsed as RuntimeRecord
      : null;
  } catch {
    return null;
  }
}

function text(
  value: unknown,
  fallback = ""
) {
  if (
    typeof value === "string" &&
    value.trim()
  ) {
    return value;
  }

  if (
    typeof value === "number"
  ) {
    return String(value);
  }

  return fallback;
}

function booleanValue(
  value: unknown
) {
  return value === true;
}

function firstTimestamp(
  record: RuntimeRecord,
  fields: string[]
) {
  for (const field of fields) {
    const value =
      record[field];

    if (
      typeof value === "string" &&
      value.trim()
    ) {
      return value;
    }
  }

  return "";
}

function displayTime(
  value: string
) {
  if (!value) {
    return "Timestamp unavailable";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return date.toLocaleString();
}

function buildActivities() {
  const events: ActivityRecord[] =
    [];

  const discovery =
    readStoredRecord(
      "kmitora.dev.discoveryResult"
    );

  const approval =
    readStoredRecord(
      "kmitora.dev.approvalRequest"
    );

  const execution =
    readStoredRecord(
      "kmitora.dev.executionResult"
    );

  const evidence =
    readStoredRecord(
      "kmitora.dev.lastEvidence"
    );

  const intelligence =
    readStoredRecord(
      "kmitora.dev.enterpriseIntelligence"
    );


  if (discovery) {
    const timestamp =
      firstTimestamp(
        discovery,
        [
          "created_at",
          "createdAt",
          "timestamp",
        ]
      );

    const migrationId =
      text(
        discovery.migration_id,
        "Migration reference unavailable"
      );

    const status =
      text(
        discovery.status,
        "RECORDED"
      );

    events.push({
      id: `discovery-${migrationId}`,
      category: "DISCOVERY",
      time:
        displayTime(timestamp),
      timestamped:
        Boolean(timestamp),
      title:
        "Discovery state recorded",
      detail:
        `${migrationId} · ${status}`,
      severity:
        status.toUpperCase() ===
        "PASS"
          ? "success"
          : "info",
      reference:
        migrationId,
    });
  }


  if (approval) {
    const approvalId =
      text(
        approval.id,
        "Approval reference unavailable"
      );

    const migrationId =
      text(
        approval.migration_id,
        text(
          (
            approval.input as
              | RuntimeRecord
              | undefined
          )?.migration_id
        )
      );

    const requestedAt =
      firstTimestamp(
        approval,
        [
          "requested_at",
          "created_at",
          "createdAt",
        ]
      );

    const status =
      text(
        approval.status,
        "PENDING"
      ).toUpperCase();

    events.push({
      id: `approval-request-${approvalId}`,
      category: "APPROVAL",
      time:
        displayTime(requestedAt),
      timestamped:
        Boolean(requestedAt),
      title:
        "Approval request recorded",
      detail:
        `${approvalId}${
          migrationId
            ? ` · ${migrationId}`
            : ""
        } · ${status}`,
      severity:
        status === "APPROVED"
          ? "success"
          : status === "REJECTED"
            ? "warning"
            : "info",
      reference:
        approvalId,
    });

    const decisionAt =
      firstTimestamp(
        approval,
        ["decision_at"]
      );

    if (
      approval.approved === true ||
      approval.rejected === true ||
      decisionAt
    ) {
      const decision =
        approval.approved === true
          ? "APPROVED"
          : approval.rejected === true
            ? "REJECTED"
            : status;

      events.push({
        id: `approval-decision-${approvalId}`,
        category: "APPROVAL",
        time:
          displayTime(decisionAt),
        timestamped:
          Boolean(decisionAt),
        title:
          "Authoritative decision recorded",
        detail:
          `${approvalId} · ${decision}${
            text(
              approval.decision_by
            )
              ? ` · ${text(
                  approval.decision_by
                )}`
              : ""
          }`,
        severity:
          decision === "APPROVED"
            ? "success"
            : "warning",
        reference:
          approvalId,
      });
    }
  }


  if (execution) {
    const executionId =
      text(
        execution.execution_id,
        text(
          execution.id,
          "Execution reference unavailable"
        )
      );

    const migrationId =
      text(
        execution.migration_id
      );

    const timestamp =
      firstTimestamp(
        execution,
        [
          "created_at",
          "createdAt",
          "timestamp",
        ]
      );

    const status =
      text(
        execution.status,
        "RECORDED"
      );

    events.push({
      id: `execution-${executionId}`,
      category: "EXECUTION",
      time:
        displayTime(timestamp),
      timestamped:
        Boolean(timestamp),
      title:
        "DEV execution evidence recorded",
      detail:
        `${executionId}${
          migrationId
            ? ` · ${migrationId}`
            : ""
        } · ${status}`,
      severity:
        booleanValue(
          execution
            .production_action_executed
        ) ||
        booleanValue(
          execution
            .target_write_executed
        )
          ? "warning"
          : "success",
      reference:
        executionId,
    });
  }


  if (evidence) {
    const evidenceId =
      text(
        evidence.evidence_id,
        text(
          evidence.id,
          "Evidence package"
        )
      );

    const reconciliationId =
      text(
        evidence.reconciliation_id
      );

    const timestamp =
      firstTimestamp(
        evidence,
        [
          "created_at",
          "createdAt",
          "timestamp",
        ]
      );

    events.push({
      id: `evidence-${evidenceId}`,
      category: "EVIDENCE",
      time:
        displayTime(timestamp),
      timestamped:
        Boolean(timestamp),
      title:
        "Evidence package recorded",
      detail:
        `${evidenceId}${
          reconciliationId
            ? ` · Reconciliation ${reconciliationId}`
            : ""
        }`,
      severity:
        "success",
      reference:
        evidenceId,
    });
  }


  if (intelligence) {
    const intelligenceId =
      text(
        intelligence.id,
        "Enterprise intelligence"
      );

    const timestamp =
      firstTimestamp(
        intelligence,
        [
          "createdAt",
          "created_at",
          "timestamp",
        ]
      );

    const primaryDomain =
      text(
        intelligence.primaryDomain,
        "Cross-domain / Enterprise"
      );

    const activatedAgents =
      Array.isArray(
        intelligence.activatedAgents
      )
        ? intelligence
            .activatedAgents.length
        : 0;

    events.push({
      id: `intelligence-${intelligenceId}`,
      category: "INTELLIGENCE",
      time:
        displayTime(timestamp),
      timestamped:
        Boolean(timestamp),
      title:
        "Enterprise intelligence analysis recorded",
      detail:
        `${primaryDomain} · ${activatedAgents} activated agent(s)`,
      severity:
        "info",
      reference:
        intelligenceId,
    });
  }


  return events;
}

export default function ActivityStream() {
  const [events, setEvents] =
    useState<ActivityRecord[]>([]);

  const [search, setSearch] =
    useState("");

  const [category, setCategory] =
    useState<
      ActivityRecord["category"] |
      "ALL"
    >("ALL");

  function refresh() {
    setEvents(
      buildActivities()
    );
  }

  useEffect(() => {
    refresh();
  }, []);

  const filtered =
    useMemo(() => {
      const q =
        search
          .trim()
          .toLowerCase();

      return events.filter(
        (event) => {
          if (
            category !== "ALL" &&
            event.category !==
              category
          ) {
            return false;
          }

          if (!q) {
            return true;
          }

          return [
            event.title,
            event.detail ?? "",
            event.reference ?? "",
            event.category,
            event.time,
          ].some((value) =>
            value
              .toLowerCase()
              .includes(q)
          );
        }
      );
    }, [
      events,
      search,
      category,
    ]);

  const timestampedCount =
    events.filter(
      (event) =>
        event.timestamped
    ).length;

  const successCount =
    events.filter(
      (event) =>
        event.severity ===
        "success"
    ).length;

  const warningCount =
    events.filter(
      (event) =>
        event.severity ===
        "warning" ||
        event.severity ===
        "error"
    ).length;

  return (
    <div className="page activityStreamPage">
      <ActivityAuditPremiumWorkspace />

      <div className="activityHero">

        <div className="activityHeroCopy">

          <span className="eyebrow">
            OBSERVABILITY
          </span>

          <h1>
            Activity & Audit Stream
          </h1>

          <p>
            Read-only operational chronology
            derived from persisted KMITORA
            discovery, approval, DEV execution,
            evidence and enterprise-intelligence
            state.
          </p>

          <div className="activityHeroMeta">

            <span className="activityBadge">
              <ShieldCheck size={14} />
              Read only
            </span>

            <span className="activityBadge">
              No fabricated runtime events
            </span>

          </div>

        </div>


        <KMITORACopilotOverview
          status={
            warningCount > 0
              ? "REVIEW"
              : events.length > 0
                ? "ACTIVE"
                : "READY"
          }
          message="Runtime chronology, traceability and persisted audit evidence"
        />

      </div>


      <section className="activitySection">

        <div className="activitySectionHeader">

          <div>

            <span className="activitySectionLabel">
              ACTIVITY HEALTH
            </span>

            <h2>
              Runtime audit overview
            </h2>

            <p>
              Events appear only when corresponding
              KMITORA runtime evidence exists.
            </p>

          </div>


          <button
            type="button"
            onClick={refresh}
          >
            Refresh
          </button>

        </div>


        <div className="activityMetrics">

          <div className="activityMetricCard">

            <Activity size={18} />

            <span>
              Recorded Events
            </span>

            <strong>
              {events.length}
            </strong>

            <small>
              Derived runtime records
            </small>

          </div>


          <div className="activityMetricCard">

            <Clock3 size={18} />

            <span>
              Timestamped
            </span>

            <strong>
              {timestampedCount}
            </strong>

            <small>
              Chronology available
            </small>

          </div>


          <div className="activityMetricCard safe">

            <CheckCircle2 size={18} />

            <span>
              Successful / Safe
            </span>

            <strong>
              {successCount}
            </strong>

            <small>
              Positive evidence
            </small>

          </div>


          <div className="activityMetricCard attention">

            <AlertTriangle size={18} />

            <span>
              Review Signals
            </span>

            <strong>
              {warningCount}
            </strong>

            <small>
              Requires attention
            </small>

          </div>


          <div className="activityMetricCard">

            <FileCheck2 size={18} />

            <span>
              Evidence Mode
            </span>

            <strong>
              READ ONLY
            </strong>

            <small>
              No state mutation
            </small>

          </div>

        </div>

      </section>


      <section className="activitySection">

        <div className="activityToolbar">

          <div className="activitySearch">

            <Search size={15} />

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search activity, IDs or categories..."
            />

          </div>


          <select
            value={category}
            onChange={(event) =>
              setCategory(
                event.target.value as
                  | ActivityRecord["category"]
                  | "ALL"
              )
            }
          >
            <option value="ALL">
              All activity
            </option>
            <option value="DISCOVERY">
              Discovery
            </option>
            <option value="APPROVAL">
              Approval
            </option>
            <option value="EXECUTION">
              Execution
            </option>
            <option value="EVIDENCE">
              Evidence
            </option>
            <option value="INTELLIGENCE">
              Intelligence
            </option>
          </select>

        </div>


        {filtered.length === 0 ? (

          <div className="panel activityEmpty">

            <Activity size={22} />

            <div>

              <h3>
                No matching activity
              </h3>

              <p>
                No persisted runtime evidence
                matches the current filter.
              </p>

            </div>

          </div>

        ) : (

          <div className="activityTimeline">

            {filtered.map(
              (event) => (

                <div
                  className={`activityTimelineItem ${
                    event.severity ??
                    "info"
                  }`}
                  key={event.id}
                >

                  <div className="activityTimelineRail">

                    <div className="activityTimelineDot" />

                    <div className="activityTimelineLine" />

                  </div>


                  <div className="activityTimelineCard">

                    <div className="activityTimelineHeader">

                      <div>

                        <span className="activityCategory">
                          {event.category}
                        </span>

                        <h3>
                          {event.title}
                        </h3>

                      </div>


                      <span className="activityTime">
                        {event.time}
                      </span>

                    </div>


                    {event.detail && (

                      <p>
                        {event.detail}
                      </p>

                    )}


                    <div className="activityTimelineMeta">

                      <span>
                        Severity:{" "}
                        {
                          (
                            event.severity ??
                            "info"
                          ).toUpperCase()
                        }
                      </span>

                      <span>
                        {
                          event.timestamped
                            ? "TIMESTAMP VERIFIED"
                            : "TIMESTAMP NOT PRESENT"
                        }
                      </span>

                      {event.reference && (
                        <span>
                          REF:{" "}
                          {event.reference}
                        </span>
                      )}

                    </div>

                  </div>

                </div>

              )
            )}

          </div>

        )}

      </section>


      <div className="activitySafetyNote">

        <ShieldCheck size={18} />

        <div>

          <strong>
            Observational audit workspace
          </strong>

          <span>
            Activity Stream reads persisted
            frontend runtime evidence only.
            It does not create approvals,
            execute migrations, perform target
            writes or trigger production actions.
          </span>

        </div>

      </div>

    </div>
  );
}

