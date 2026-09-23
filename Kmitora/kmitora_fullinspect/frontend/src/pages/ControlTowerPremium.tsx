import { useEffect, useMemo, useState } from "react";
import "../styles/kmitora-premium.css";
import KMITORALifecycleRail from "../components/KMITORALifecycleRail";

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function formatCount(value: number): string {
  if (!Number.isFinite(value)) return "0";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function clockLabel(value: any): string {
  const parsed = value ? new Date(value) : null;

  if (!parsed || Number.isNaN(parsed.getTime())) {
    return "--:--";
  }

  return parsed.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

type ActivityRow = [string, string, string];

export default function ControlTowerPremium() {
  const [tick, setTick] = useState(0);

  // The lifecycle stages write their evidence to local storage as they run,
  // so re-reading on focus keeps this view aligned with the actual run
  // instead of whatever was current when the tab first mounted.
  useEffect(() => {
    const refresh = () => setTick((value) => value + 1);
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const state = useMemo(() => {
    void tick;

    const discovery = readJson<any>("kmitora.dev.discoveryResult", null);
    const execution = readJson<any>("kmitora.dev.executionResult", null);
    const test = readJson<any>("kmitora.dev.testResult", null);
    const reconciliation = readJson<any>("kmitora.dev.lastReconciliation", null);
    const evidencePackage = readJson<any>("kmitora.dev.lastEvidence", null);
    const learning = readJson<any>("kmitora.dev.verifiedLearning", null);
    const approval = readJson<any>("kmitora.dev.approvalRequest", null);

    const discoveredAt =
      discovery?.authoritative_evidence_synced_at ??
      discovery?.created_at ??
      discovery?.generated_at ??
      null;

    const summary = discovery?.summary ?? {};
    const staging = discovery?.target_staging_plan ?? {};

    const sourceEntities: any[] = Array.isArray(discovery?.source?.entities)
      ? discovery.source.entities
      : [];

    const findings: any[] = Array.isArray(discovery?.quality_findings)
      ? discovery.quality_findings
      : [];

    const relationships: any[] = Array.isArray(discovery?.relationships)
      ? discovery.relationships
      : [];

    const mappings: any[] = Array.isArray(discovery?.suggested_mappings)
      ? discovery.suggested_mappings
      : [];

    const transforms: any[] = Array.isArray(
      discovery?.transform_spec?.transforms
    )
      ? discovery.transform_spec.transforms
      : [];

    const rowsObserved = sourceEntities.reduce(
      (total, entity) => total + Number(entity?.row_count ?? 0),
      0
    );

    const ready = Number(summary.staging_ready_count ?? 0);
    const review = Number(summary.staging_review_count ?? 0);
    const rejected = Number(summary.staging_rejected_count ?? 0);
    const quarantine = Number(summary.staging_quarantine_count ?? 0);

    const criticalFindings = findings.filter(
      (item) => String(item?.severity ?? "").toUpperCase() === "ERROR"
    ).length;

    const mappingsNeedingReview = mappings.filter(
      (item) => String(item?.decision ?? "").toUpperCase() === "REVIEW"
    ).length;

    // Completion is stage-based: each lifecycle milestone that produced
    // real evidence counts once.
    const milestones = [
      Boolean(discovery),
      Boolean(approval),
      Boolean(execution?.execution_id),
      String(test?.test_gate ?? "").toUpperCase() === "PASS",
      String(reconciliation?.status ?? "").toUpperCase() === "PASS",
      String(evidencePackage?.status ?? "").toUpperCase() === "COMPLETE",
      String(learning?.promotion_gate ?? "").toUpperCase() === "PASS"
    ];

    const completed = milestones.filter(Boolean).length;
    const completion = Math.round((completed / milestones.length) * 100);

    const plannedTotal = ready + review + rejected + quarantine;

    const readiness = plannedTotal
      ? Math.round((ready / plannedTotal) * 1000) / 10
      : 0;

    const blockers = criticalFindings + review + rejected + quarantine;

    const health = !discovery
      ? "No run yet"
      : blockers
        ? "Blocked"
        : completed === milestones.length
          ? "Complete"
          : "Good";

    const healthNote = !discovery
      ? "Run Discover to populate control tower evidence"
      : blockers
        ? `${blockers} governed blocker(s) prevent execution`
        : "No active control gate blocks progression";

    const nextAction = !discovery
      ? { title: "Run discovery", detail: "No discovery evidence is present" }
      : blockers
        ? {
            title: "Review blocked records",
            detail: `${blockers} item(s) require disposition`
          }
        : !approval
          ? { title: "Request approval", detail: "Execution requires approval" }
          : !execution?.execution_id
            ? { title: "Execute dry run", detail: "Approval recorded" }
            : String(test?.test_gate ?? "").toUpperCase() !== "PASS"
              ? { title: "Run deterministic tests", detail: "Execution completed" }
              : String(reconciliation?.status ?? "").toUpperCase() !== "PASS"
                ? { title: "Reconcile execution", detail: "Tests passed" }
                : String(evidencePackage?.status ?? "").toUpperCase() !== "COMPLETE"
                  ? { title: "Generate evidence", detail: "Reconciliation passed" }
                  : { title: "Promote verified learning", detail: "Evidence complete" };

    // Activity is reconstructed from the timestamps each stage recorded.
    const activity: ActivityRow[] = [];

    if (discovery) {
      activity.push([
        clockLabel(discoveredAt),
        `${sourceEntities.length} source entities discovered · ${rowsObserved} rows`,
        "blue"
      ]);

      if (relationships.length) {
        activity.push([
          clockLabel(discoveredAt),
          `${relationships.length} relationship(s) inferred`,
          "green"
        ]);
      }

      if (transforms.length) {
        activity.push([
          clockLabel(discoveredAt),
          `${transforms.length} transform(s) compiled from business rules`,
          "green"
        ]);
      }

      if (findings.length) {
        activity.push([
          clockLabel(discoveredAt),
          `${findings.length} quality finding(s) detected`,
          criticalFindings ? "amber" : "blue"
        ]);
      }
    }

    if (approval) {
      activity.push([
        clockLabel(approval?.requested_at ?? approval?.created_at),
        `Approval ${String(approval?.status ?? "PENDING").toLowerCase()}`,
        "blue"
      ]);
    }

    if (execution?.execution_id) {
      activity.push([
        clockLabel(execution?.completed_at ?? execution?.started_at),
        `Dry run ${execution?.status} · ${execution?.success_count ?? 0}/${execution?.input_record_count ?? 0} simulated`,
        Number(execution?.failure_count ?? 0) ? "amber" : "green"
      ]);
    }

    if (test?.test_gate) {
      activity.push([
        clockLabel(test?.created_at),
        `Tests ${test.test_gate} · ${test?.passed_tests ?? 0}/${test?.total_tests ?? 0}`,
        String(test.test_gate).toUpperCase() === "PASS" ? "green" : "amber"
      ]);
    }

    if (reconciliation?.status) {
      activity.push([
        clockLabel(reconciliation?.reconciled_at),
        `Reconciliation ${reconciliation.status} · ${reconciliation?.matched_records ?? 0} matched`,
        String(reconciliation.status).toUpperCase() === "PASS" ? "green" : "amber"
      ]);
    }

    if (evidencePackage?.status) {
      activity.push([
        clockLabel(evidencePackage?.created_at),
        `Evidence package ${evidencePackage.status}`,
        "green"
      ]);
    }

    activity.reverse();

    return {
      hasRun: Boolean(discovery),
      migrationId: discovery?.migration_id ?? null,
      environment: String(execution?.environment ?? "DEV").toUpperCase(),
      sourceType: discovery?.source?.type ?? null,
      entityCount: sourceEntities.length,
      rowsObserved,
      relationshipCount: relationships.length,
      transformCount: transforms.length,
      mappingsNeedingReview,
      mappedCount: mappings.length - mappingsNeedingReview,
      criticalFindings,
      findingCount: findings.length,
      ready,
      review,
      rejected,
      quarantine,
      completion,
      completed,
      milestoneCount: milestones.length,
      readiness,
      blockers,
      health,
      healthNote,
      nextAction,
      activity: activity.slice(0, 7),
      targetWrites: Number(execution?.target_write_count ?? 0),
      executionStatus: execution?.status ?? null,
      testGate: test?.test_gate ?? null,
      reconciliationStatus: reconciliation?.status ?? null,
      evidenceStatus: evidencePackage?.status ?? null,
      learningGate: learning?.promotion_gate ?? null,
      staging
    };
  }, [tick]);

  const queue: Array<[string, string, string, string]> = [
    [
      "Discovery",
      state.hasRun ? "Completed" : "Pending",
      state.hasRun ? "100%" : "0%",
      state.hasRun ? "green" : "amber"
    ],
    [
      "Transformation plan",
      state.transformCount ? `${state.transformCount} compiled` : "None",
      state.transformCount ? "100%" : "0%",
      state.transformCount ? "green" : "amber"
    ],
    [
      "Validation",
      state.blockers ? `${state.blockers} blocked` : state.hasRun ? "Clear" : "Pending",
      state.hasRun ? `${state.readiness}%` : "0%",
      state.blockers ? "amber" : state.hasRun ? "green" : "amber"
    ],
    [
      "Execution",
      state.executionStatus ?? "Not started",
      state.executionStatus ? "100%" : "0%",
      state.executionStatus ? "green" : "amber"
    ],
    [
      "Evidence",
      state.evidenceStatus ?? "Awaiting",
      state.evidenceStatus === "COMPLETE" ? "100%" : "0%",
      state.evidenceStatus === "COMPLETE" ? "green" : "amber"
    ]
  ];

  return (
    <div className="km-page">
      <header className="km-topbar">
        <div>
          <span className="km-eyebrow">
            {state.environment} · READINESS
          </span>
          <h1>Migration Control Tower</h1>
          <p>
            {state.hasRun
              ? `Live evidence for ${state.migrationId ?? "current migration"}${
                  state.sourceType ? ` · source ${state.sourceType}` : ""
                }.`
              : "No migration evidence yet. Run Discover to populate this view."}
          </p>
        </div>
        <div className="km-top-actions">
          <div className="km-search">⌕&nbsp;&nbsp; Search anything...</div>
          <button
            className="km-icon-btn"
            onClick={() => setTick((value) => value + 1)}
            title="Refresh from current evidence"
          >
            ↻
          </button>
          <div className="km-avatar">KA</div>
        </div>
      </header>

      <section className="km-command-row">
        <button className="km-primary">Open Current Stage →</button>
        <span className="km-badge km-badge-safe">
          {state.targetWrites ? "Execution: Target writes recorded" : "Execution: Guarded"}
        </span>
        <span className="km-meta">
          {state.hasRun
            ? `${state.completed}/${state.milestoneCount} lifecycle milestones complete`
            : "Awaiting first run"}
        </span>
      </section>

      <section className="km-status-strip">
        <div>
          <span className="km-label">Workflow guidance</span>
          <strong>
            <i className={`dot ${state.blockers ? "amber" : state.hasRun ? "green" : "amber"}`} />
            {state.hasRun ? (state.blockers ? "ACTION REQUIRED" : "ON TRACK") : "NOT STARTED"}
          </strong>
        </div>
        <div>
          <span className="km-label">Readiness status</span>
          <strong>
            <i className={`dot ${state.blockers ? "amber" : "green"}`} />
            {state.hasRun
              ? state.blockers
                ? "READY WITH EXCEPTIONS"
                : "READY"
              : "NO EVIDENCE"}
          </strong>
        </div>
        <div>
          <span className="km-label">Environment</span>
          <strong>
            <i className="dot violet" />
            {state.environment}
          </strong>
        </div>
      </section>

      <section className="km-card km-health-card">
        <div className="km-health-item">
          <div className="km-health-icon">🛡</div>
          <div>
            <span className="km-label">Migration health</span>
            <h3>{state.health}</h3>
            <p>{state.healthNote}</p>
          </div>
        </div>
        <div className="km-health-item">
          <div className="km-ring">
            <span>{state.completion}%</span>
          </div>
          <div>
            <span className="km-label">Overall completion</span>
            <p>
              <b>{state.completion}%</b> of lifecycle evidence captured ·{" "}
              {state.completed}/{state.milestoneCount} stages
            </p>
          </div>
        </div>
        <div className="km-health-item">
          <div className="km-ring green-ring">
            <span>{Math.round(state.readiness)}</span>
          </div>
          <div>
            <span className="km-label">Record readiness</span>
            <h3>
              {state.hasRun
                ? `${state.ready} ready of ${
                    state.ready + state.review + state.rejected + state.quarantine
                  }`
                : "No records staged"}
            </h3>
          </div>
        </div>
        <div className="km-health-item">
          <div className="km-orb">⌁</div>
          <div>
            <span className="km-label">Key next action</span>
            <h3>{state.nextAction.title}</h3>
            <p>{state.nextAction.detail}</p>
          </div>
        </div>
      </section>

      <div className="km-grid-two">
        <section className="km-card">
          <div className="km-section-title">
            <h2>Operational indicators</h2>
          </div>
          <div className="km-indicators">
            <Metric
              icon="⌘"
              label="Source rows observed"
              value={formatCount(state.rowsObserved)}
              sub={`${state.entityCount} entities`}
            />
            <Metric
              icon="!"
              label="Blocking findings"
              value={String(state.criticalFindings)}
              sub={`${state.findingCount} total findings`}
              accent="amber"
            />
            <Metric
              icon="↗"
              label="Fields mapped"
              value={String(state.mappedCount < 0 ? 0 : state.mappedCount)}
              sub={`${state.mappingsNeedingReview} need review`}
            />
            <Metric
              icon="◇"
              label="Transforms compiled"
              value={String(state.transformCount)}
              sub="from business rules"
              accent="violet"
            />
            <Metric
              icon="◉"
              label="Record readiness"
              value={`${state.readiness}%`}
              sub={`${state.ready} ready`}
              accent="violet"
            />
            <Metric
              icon="♙"
              label="Relationships"
              value={String(state.relationshipCount)}
              sub="structural dependencies"
            />
          </div>
          <div className="km-card-footer">View all indicators →</div>
        </section>

        <section className="km-card">
          <div className="km-section-title">
            <div>
              <h2>End-to-end workflow progress</h2>
              <p>
                Understand → Discover → Detect → Diagnose → Predict → Recommend
                → Simulate → Execute → Test → Validate → Reconcile → Evidence →
                Learn.
              </p>
            </div>
          </div>
          <KMITORALifecycleRail />
          <div className="km-card-footer">View workflow details →</div>
        </section>
      </div>

      <div className="km-grid-two bottom">
        <section className="km-card">
          <div className="km-section-title">
            <h2>Recent migration activity</h2>
            <span className="km-live">
              <i className={`dot ${state.hasRun ? "green" : "amber"}`} />
              {state.hasRun ? "Live" : "Idle"}
            </span>
          </div>
          <div className="km-activity">
            {state.activity.length ? (
              state.activity.map(([time, text, color], index) => (
                <div className="km-activity-row" key={`${time}-${index}`}>
                  <i className={`dot ${color}`} />
                  <span className="time">{time}</span>
                  <strong>{text}</strong>
                </div>
              ))
            ) : (
              <div className="km-activity-row">
                <i className="dot amber" />
                <span className="time">--:--</span>
                <strong>No migration activity recorded yet</strong>
              </div>
            )}
          </div>
          <div className="km-card-footer">View all activity →</div>
        </section>

        <section className="km-card">
          <div className="km-section-title">
            <div>
              <span className="km-label">AUTOMATION</span>
              <h2>Automation Queue</h2>
              <p>Current orchestration activity and key upcoming work.</p>
            </div>
          </div>
          <div className="km-queue">
            {queue.map(([label, value, pct, tone]) => (
              <Queue
                key={label}
                label={label}
                value={value}
                pct={pct}
                tone={tone}
              />
            ))}
          </div>
          <div className="km-safety">
            <span>✓</span>
            <div>
              <strong>
                {state.targetWrites
                  ? `${state.targetWrites} target write(s) recorded`
                  : "Execution remains guarded"}
              </strong>
              <p>
                {state.targetWrites
                  ? "Target writes were performed by an explicit load action."
                  : "No production migration or cutover is enabled."}
              </p>
            </div>
          </div>
          <div className="km-card-footer">View automation →</div>
        </section>
      </div>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  sub,
  accent = "blue"
}: {
  icon: string;
  label: string;
  value: string;
  sub: string;
  accent?: string;
}) {
  return (
    <div className="km-metric">
      <div className={`km-metric-icon ${accent}`}>{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{sub}</small>
      </div>
    </div>
  );
}

function Queue({
  label,
  value,
  pct,
  tone
}: {
  key?: string;
  label: string;
  value: string;
  pct: string;
  tone: string;
}) {
  return (
    <div className="km-queue-item">
      <span>{label}</span>
      <strong className={tone}>{value}</strong>
      <b>{pct}</b>
    </div>
  );
}
