import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileCheck2,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  UserCheck,
  XCircle,
} from "lucide-react";
import "../styles/approval-decision-premium.css";

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

type Props = {
  approvals: ApprovalRequest[];
  loading?: boolean;
  error?: string;
  onRefresh?: () => void;
};

type View =
  | "OVERVIEW"
  | "WORKBENCH"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "AUTHORITY"
  | "SAFETY"
  | "INTELLIGENCE";

function norm(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

function matchesStatus(item: ApprovalRequest, status: string) {
  if (status === "APPROVED") return item.approved === true || norm(item.status) === "APPROVED";
  if (status === "REJECTED") return item.rejected === true || norm(item.status) === "REJECTED";
  return norm(item.status) === status;
}

function requestedAction(item: ApprovalRequest) {
  return item.input?.requested_action ?? "Governed approval";
}

function phaseOf(item: ApprovalRequest) {
  const action = requestedAction(item).toLowerCase();
  if (action.includes("transform")) return "TRANSFORMATION";
  if (action.includes("validation")) return "VALIDATION";
  if (action.includes("evidence")) return "EVIDENCE";
  if (action.includes("migration") || action.includes("wave")) return "MIGRATION";
  return item.input?.environment ?? "DEV";
}

export default function ApprovalDecisionPremiumWorkspace({
  approvals,
  loading = false,
  error = "",
  onRefresh,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>("OVERVIEW");
  const [query, setQuery] = useState("");

  const snapshot = useMemo(() => {
    const pending = approvals.filter((item) => matchesStatus(item, "PENDING"));
    const approved = approvals.filter((item) => matchesStatus(item, "APPROVED"));
    const rejected = approvals.filter((item) => matchesStatus(item, "REJECTED"));
    const authority = approvals.filter((item) => item.requires_authoritative_approver === true);

    const validationBlocked = approvals.filter((item) => {
      const validation = item.input?.validation_snapshot;
      const staging = item.input?.staging_snapshot;
      return (
        validation?.validation_ready !== true ||
        Number(validation?.blocking_findings ?? 0) > 0 ||
        Number(staging?.blocked_records ?? 0) > 0
      );
    });

    const targetWritesExecuted = approvals.filter(
      (item) => item.target_write_executed === true
    ).length;
    const productionActionsExecuted = approvals.filter(
      (item) =>
        item.production_action_executed === true ||
        item.input?.safety?.production_action_executed === true
    ).length;

    const safe =
      targetWritesExecuted === 0 &&
      productionActionsExecuted === 0;

    const decided = approved.length + rejected.length;
    const governanceHealth = approvals.length
      ? Math.round(
          Math.max(
            0,
            Math.min(
              100,
              ((decided + pending.length) / approvals.length) * 100 -
                (safe ? 0 : 25)
            )
          )
        )
      : error
      ? 0
      : 100;

    return {
      total: approvals.length,
      pending,
      approved,
      rejected,
      authority,
      validationBlocked,
      targetWritesExecuted,
      productionActionsExecuted,
      safe,
      decided,
      governanceHealth,
    };
  }, [approvals, error]);

  useEffect(() => {
    const host = rootRef.current;
    const page = host?.closest(".page") as HTMLElement | null;
    if (!page || !host) return;

    const children = Array.from(page.children).filter(
      (element) => element !== host
    ) as HTMLElement[];

    const reset = () =>
      children.forEach((element) => {
        element.style.display = "";
      });

    if (view === "WORKBENCH") {
      reset();
      return reset;
    }

    if (view === "OVERVIEW" || view === "INTELLIGENCE") {
      children.forEach((element) => {
        element.style.display = "none";
      });
      return reset;
    }

    const terms: Record<
      Exclude<View, "OVERVIEW" | "WORKBENCH" | "INTELLIGENCE">,
      string[]
    > = {
      PENDING: ["pending", "awaiting decision", "decision reason"],
      APPROVED: ["approved", "authority accepted", "decision:"],
      REJECTED: ["rejected", "authority rejected", "decision:"],
      AUTHORITY: ["authoritative approver", "authority", "reviewer"],
      SAFETY: ["execution disabled", "target write", "production action", "validation ready"],
    };

    children.forEach((element) => {
      const text = (element.textContent ?? "").replace(/\s+/g, " ").toLowerCase();
      element.style.display = terms[view].some((term) => text.includes(term)) ? "" : "none";
    });

    if (!children.some((element) => element.style.display !== "none")) reset();
    return reset;
  }, [view]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return approvals;

    return approvals.filter((item) =>
      [
        item.id,
        item.status,
        item.decision_by,
        item.decision_reason,
        item.input?.migration_id,
        item.input?.requested_action,
        item.input?.environment,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [approvals, query]);

  const pendingDeg = snapshot.total ? (snapshot.pending.length / snapshot.total) * 360 : 0;
  const approvedDeg = snapshot.total ? (snapshot.approved.length / snapshot.total) * 360 : 0;
  const rejectedDeg = snapshot.total ? (snapshot.rejected.length / snapshot.total) * 360 : 0;

  return (
    <div className="approvalPremium" ref={rootRef}>
      <header className="apHeader">
        <div>
          <span className="apEyebrow">GOVERNANCE · AUTHORITATIVE DECISIONS</span>
          <div className="apTitleRow">
            <h1>Approval &amp; Decision Center</h1>
            <span className={`apStatus ${error ? "review" : "ready"}`}>
              {error ? "SERVICE REVIEW" : "READY"}
            </span>
          </div>
          <p>
            Authoritative review of migration requests, validation readiness,
            staging evidence and execution safety before governed DEV dry-run progression.
          </p>
          <div className="apSafetyRow">
            <span><ShieldCheck size={13}/>Authority gated</span>
            <span><XCircle size={13}/>Target writes: DISABLED</span>
            <span><XCircle size={13}/>Production actions: DISABLED</span>
            <span><CheckCircle2 size={13}/>Workspace: DEV</span>
          </div>
        </div>

        <div className="apHeaderActions">
          <div className="apWorkspace">
            <small>Workspace</small>
            <strong>DEV</strong>
          </div>
          <button type="button" onClick={() => setView("WORKBENCH")}>
            Existing Decision Controls
          </button>
        </div>
      </header>

      <section className="apKpis">
        <article><UserCheck size={19}/><span>Total Requests</span><strong>{snapshot.total}</strong><small>Authoritative queue</small></article>
        <article><Clock3 size={19}/><span>Pending</span><strong>{snapshot.pending.length}</strong><small>Awaiting decision</small></article>
        <article><CheckCircle2 size={19}/><span>Approved</span><strong>{snapshot.approved.length}</strong><small>Authority accepted</small></article>
        <article><XCircle size={19}/><span>Rejected</span><strong>{snapshot.rejected.length}</strong><small>Authority rejected</small></article>
        <article><ShieldCheck size={19}/><span>Authority Required</span><strong>{snapshot.authority.length}</strong><small>Governed requests</small></article>
        <article><Activity size={19}/><span>Governance Health</span><strong>{snapshot.governanceHealth}%</strong><small>{snapshot.safe ? "Safety controls preserved" : "Safety review required"}</small></article>
      </section>

      <nav className="apTabs">
        {([
          ["OVERVIEW", "Overview", Activity],
          ["PENDING", `Pending (${snapshot.pending.length})`, Clock3],
          ["APPROVED", `Approved (${snapshot.approved.length})`, CheckCircle2],
          ["REJECTED", `Rejected (${snapshot.rejected.length})`, XCircle],
          ["AUTHORITY", `Authority Required (${snapshot.authority.length})`, UserCheck],
          ["SAFETY", "Governance Safety", ShieldCheck],
          ["INTELLIGENCE", "Decision Intelligence", Sparkles],
        ] as Array<[View, string, typeof Activity]>).map(([id, label, Icon]) => (
          <button
            type="button"
            key={id}
            className={view === id ? "active" : ""}
            onClick={() => setView(id)}
          >
            <Icon size={14}/>{label}
          </button>
        ))}
        <button type="button" className="apRefresh" onClick={onRefresh}>
          <RefreshCw size={13}/>Refresh
        </button>
      </nav>

      {view === "OVERVIEW" && (
        <div className="apBody">
          <div className="apTopGrid">
            <section className="apQueueOverview">
              <div className="apPanelHead">
                <div>
                  <span>APPROVAL QUEUE OVERVIEW</span>
                  <h2>Current authoritative approval state</h2>
                </div>
                <button type="button" className="apMiniButton" onClick={onRefresh}>
                  <RefreshCw size={12}/>Refresh
                </button>
              </div>

              <div className="apQueueCore">
                <div
                  className="apDonut"
                  style={{
                    "--pending": `${pendingDeg}deg`,
                    "--approved": `${pendingDeg + approvedDeg}deg`,
                    "--rejected": `${pendingDeg + approvedDeg + rejectedDeg}deg`,
                  } as CSSProperties}
                >
                  <strong>{snapshot.pending.length}</strong>
                  <span>Pending</span>
                </div>

                <div className="apQueueMetrics">
                  <p><i className="blue"/><span>Registered approvals</span><strong>{snapshot.total}</strong></p>
                  <p><i className="amber"/><span>Pending decision</span><strong>{snapshot.pending.length}</strong></p>
                  <p><i className="green"/><span>Approved</span><strong>{snapshot.approved.length}</strong></p>
                  <p><i className="red"/><span>Rejected</span><strong>{snapshot.rejected.length}</strong></p>
                  <p><i className="purple"/><span>Authority required</span><strong>{snapshot.authority.length}</strong></p>
                </div>

                <div className="apService">
                  <div className="apPanelHead">
                    <div><span>APPROVAL SERVICE STATUS</span><h2>{error ? "Unavailable" : loading ? "Loading" : "Connected"}</h2></div>
                    <span className={`apBadge ${error ? "red" : "green"}`}>
                      {error ? "REVIEW" : loading ? "LOADING" : "CONNECTED"}
                    </span>
                  </div>
                  <p>
                    {error
                      ? `Approval service: ${error}`
                      : "Approval state is sourced from the existing DEV runtime approval service."}
                  </p>
                  <div><span>Total loaded</span><strong>{snapshot.total}</strong></div>
                  <div><span>Workspace</span><strong>DEV</strong></div>
                  <div><span>Decision authority</span><strong>GOVERNED</strong></div>
                </div>
              </div>

              <div className="apAuthorityBanner">
                <ShieldCheck size={14}/>
                <div>
                  <strong>Authoritative approval does not equal execution.</strong>
                  <span>
                    Decisions are recorded here; migration execution, target writes
                    and production actions remain controlled independently.
                  </span>
                </div>
              </div>
            </section>

            <section className="apRecent">
              <div className="apPanelHead">
                <div><span>RECENT AUTHORITATIVE DECISIONS</span><h2>Latest outcomes</h2></div>
              </div>
              <div className="apRecentRows">
                {approvals.slice(0, 6).map((item, index) => {
                  const status = item.approved
                    ? "APPROVED"
                    : item.rejected
                    ? "REJECTED"
                    : norm(item.status) || "PENDING";
                  return (
                    <div key={item.id ?? index}>
                      {status === "APPROVED" ? <CheckCircle2 size={14}/> : status === "REJECTED" ? <XCircle size={14}/> : <Clock3 size={14}/>}
                      <div>
                        <strong>{requestedAction(item)}</strong>
                        <small>
                          {item.decision_by
                            ? `Decision by ${item.decision_by}`
                            : "Awaiting authoritative decision"}
                        </small>
                      </div>
                      <span>{item.decision_at ?? item.requested_at ?? "—"}</span>
                    </div>
                  );
                })}
                {!approvals.length && (
                  <div className="apEmpty">
                    <Clock3 size={14}/>
                    <div><strong>No approval requests loaded</strong><small>{error || "Current authoritative queue is empty."}</small></div>
                    <span>—</span>
                  </div>
                )}
              </div>
            </section>
          </div>

          <div className="apBottomGrid">
            <section className="apRequests">
              <div className="apPanelHead">
                <div><span>GOVERNED APPROVAL REQUESTS</span><h2>Authoritative Review Queue</h2></div>
                <div className="apSearch">
                  <Search size={13}/>
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search requests..."/>
                </div>
              </div>

              <div className="apRequestTable">
                <div className="apTableHead">
                  <span>Request ID</span><span>Type</span><span>Phase</span><span>Authority</span><span>Status</span><span>Requested At</span>
                </div>
                {filtered.slice(0, 8).map((item, index) => {
                  const status = item.approved ? "APPROVED" : item.rejected ? "REJECTED" : norm(item.status) || "PENDING";
                  return (
                    <div className="apTableRow" key={item.id ?? index}>
                      <strong>{item.id ?? "Not available"}</strong>
                      <span>{requestedAction(item)}</span>
                      <span>{phaseOf(item)}</span>
                      <span>{item.requires_authoritative_approver ? "REQUIRED" : "STANDARD"}</span>
                      <em className={status.toLowerCase()}>{status}</em>
                      <span>{item.requested_at ?? "—"}</span>
                    </div>
                  );
                })}
                {!filtered.length && <div className="apNoRows">No requests match the current queue/filter.</div>}
              </div>
              <button type="button" className="apOutline" onClick={() => setView("WORKBENCH")}>
                Open Authoritative Decision Workbench
              </button>
            </section>

            <section>
              <div className="apPanelHead">
                <div><span>GOVERNANCE &amp; DECISION SAFETY</span><h2>Authoritative Control State</h2></div>
              </div>
              <div className="apSafetyRows">
                <div><ShieldCheck size={13}/><div><strong>Authority gated</strong><small>Approval paths are authority controlled</small></div><em className="ok">ENABLED</em></div>
                <div><XCircle size={13}/><div><strong>Target writes</strong><small>Approval does not grant target execution</small></div><em>DISABLED</em></div>
                <div><XCircle size={13}/><div><strong>Production actions</strong><small>Production remains independently guarded</small></div><em>DISABLED</em></div>
                <div><UserCheck size={13}/><div><strong>Validation gate</strong><small>{snapshot.validationBlocked.length} request(s) not currently approval-ready</small></div><em className={snapshot.validationBlocked.length ? "warn" : "ok"}>{snapshot.validationBlocked.length ? "REVIEW" : "ENABLED"}</em></div>
                <div><FileCheck2 size={13}/><div><strong>Decision audit</strong><small>Reviewer and reason required by authoritative workflow</small></div><em className="ok">ENABLED</em></div>
              </div>
              <div className={`apSafetyBanner ${snapshot.safe ? "safe" : "review"}`}>
                <ShieldCheck size={13}/>
                {snapshot.safe
                  ? "Approval records do not show executed target writes or production actions."
                  : "Current approval evidence requires safety review."}
              </div>
            </section>
          </div>
        </div>
      )}

      {view === "INTELLIGENCE" && (
        <div className="apIntelligence">
          <section className="apIntelHero">
            <div>
              <span className="apEyebrow">ADVANCED GOVERNANCE INTELLIGENCE</span>
              <h2>Approval Decision Twin</h2>
              <p>
                Read-only reasoning across request status, validation readiness,
                staging blockers, authority requirements and safety evidence.
                It does not approve, reject or execute a migration.
              </p>
            </div>
            <span className="apStatus ready"><ShieldCheck size={13}/>READ ONLY</span>
          </section>
          <div className="apIntelCards">
            <article><Sparkles size={18}/><span>Governance Health</span><strong>{snapshot.governanceHealth}%</strong><small>Current authoritative queue</small></article>
            <article><Clock3 size={18}/><span>Pending Decisions</span><strong>{snapshot.pending.length}</strong><small>Awaiting authoritative outcome</small></article>
            <article><AlertTriangle size={18}/><span>Validation-Gated</span><strong>{snapshot.validationBlocked.length}</strong><small>Not currently approval-ready</small></article>
            <article><ShieldCheck size={18}/><span>Execution Safety</span><strong>{snapshot.safe ? "PRESERVED" : "REVIEW"}</strong><small>Approval is not execution</small></article>
          </div>
          <div className="apIntelNote">
            <ShieldCheck size={14}/>
            Existing loadApprovals, decideApproval, reviewer/reason requirements,
            validation readiness and blocker checks remain authoritative.
          </div>
        </div>
      )}
    </div>
  );
}

