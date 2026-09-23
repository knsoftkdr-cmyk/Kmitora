import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  loadAuthoritativeControlTowerSnapshot,
  type ControlTowerSnapshot,
} from "../services/controlTowerAuthoritativeState";

const palette = {
  ink: "#0f172a",
  muted: "#64748b",
  faint: "#94a3b8",
  line: "#e2e8f0",
  panel: "#ffffff",
  canvas: "#f8fafc",
  blue: "#2563eb",
  blueSoft: "#eff6ff",
  green: "#15803d",
  greenSoft: "#f0fdf4",
  amber: "#b45309",
  amberSoft: "#fffbeb",
  red: "#b91c1c",
  redSoft: "#fef2f2",
  violet: "#7c3aed",
  violetSoft: "#f5f3ff",
};

const panel: CSSProperties = {
  background: palette.panel,
  border: `1px solid ${palette.line}`,
  borderRadius: 16,
  boxShadow: "0 8px 24px rgba(15,23,42,0.05)",
};

const sectionTitle: CSSProperties = {
  margin: 0,
  color: palette.ink,
  fontSize: 16,
  lineHeight: 1.25,
  fontWeight: 800,
};

const helperText: CSSProperties = {
  marginTop: 4,
  color: palette.muted,
  fontSize: 12,
  lineHeight: 1.5,
};

function toneFor(value: string) {
  const v = String(value || "").toUpperCase();
  if (v.includes("PASS") || v.includes("COMPLETE") || v.includes("PRESERVED") || v.includes("VERIFIED")) {
    return { fg: palette.green, bg: palette.greenSoft, border: "#bbf7d0" };
  }
  if (v.includes("REVIEW") || v.includes("PENDING") || v.includes("HELD")) {
    return { fg: palette.amber, bg: palette.amberSoft, border: "#fde68a" };
  }
  if (v.includes("BLOCK") || v.includes("FAIL") || v.includes("REJECT")) {
    return { fg: palette.red, bg: palette.redSoft, border: "#fecaca" };
  }
  return { fg: palette.blue, bg: palette.blueSoft, border: "#bfdbfe" };
}

function StatusPill({ value }: { value: string }) {
  const tone = toneFor(value);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 9px",
        borderRadius: 999,
        border: `1px solid ${tone.border}`,
        color: tone.fg,
        background: tone.bg,
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: ".02em",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 999, background: tone.fg }} />
      {value}
    </span>
  );
}

function Kpi({
  label,
  value,
  sub,
  emphasis,
}: {
  label: string;
  value: string | number;
  sub?: string;
  emphasis?: "success" | "review" | "danger" | "info";
}) {
  const tone =
    emphasis === "success"
      ? { fg: palette.green, soft: palette.greenSoft }
      : emphasis === "review"
        ? { fg: palette.amber, soft: palette.amberSoft }
        : emphasis === "danger"
          ? { fg: palette.red, soft: palette.redSoft }
          : { fg: palette.blue, soft: palette.blueSoft };

  return (
    <div
      style={{
        ...panel,
        padding: 16,
        minHeight: 112,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: "0 auto 0 0",
          width: 4,
          background: tone.fg,
        }}
      />
      <div style={{ color: palette.muted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".055em" }}>
        {label}
      </div>
      <div style={{ marginTop: 7, color: palette.ink, fontSize: 24, lineHeight: 1.1, fontWeight: 850, overflowWrap: "anywhere" }}>
        {value}
      </div>
      {sub ? <div style={{ ...helperText, marginTop: 8 }}>{sub}</div> : null}
    </div>
  );
}

function CompactMetric({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{ padding: "13px 14px", border: `1px solid ${palette.line}`, borderRadius: 12, background: "#fff" }}>
      <div style={{ color: palette.muted, fontSize: 11, fontWeight: 700 }}>{label}</div>
      <div style={{ marginTop: 5, color: palette.ink, fontSize: 18, fontWeight: 850, overflowWrap: "anywhere" }}>{value}</div>
      {sub ? <div style={{ ...helperText, marginTop: 5 }}>{sub}</div> : null}
    </div>
  );
}

function ProgressBar({ value, tone = "blue" }: { value: number; tone?: "blue" | "green" | "amber" }) {
  const pct = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const fill = tone === "green" ? palette.green : tone === "amber" ? palette.amber : palette.blue;
  return (
    <div style={{ height: 7, borderRadius: 999, background: "#eaf0f6", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, borderRadius: 999, background: fill, transition: "width 220ms ease" }} />
    </div>
  );
}

function SectionHeader({ title, description, right }: { title: string; description?: string; right?: ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 14 }}>
      <div>
        <h2 style={sectionTitle}>{title}</h2>
        {description ? <div style={helperText}>{description}</div> : null}
      </div>
      {right}
    </div>
  );
}

export default function ControlTowerPremium() {
  const [snapshot, setSnapshot] = useState<ControlTowerSnapshot | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      setSnapshot(await loadAuthoritativeControlTowerSnapshot());
    } catch (e: any) {
      setError(e?.message ?? "Unable to load authoritative control-tower state.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const computed = useMemo(() => {
    if (!snapshot) return { completion: 0, readiness: 0, cleanReconciliation: false, lifecycleComplete: false };
    const completion = snapshot.lifecycleTotal > 0 ? Math.round((snapshot.lifecycleCompleted / snapshot.lifecycleTotal) * 100) : 0;
    const readiness = snapshot.discoveredRecords > 0 ? Math.round((snapshot.readyRecords / snapshot.discoveredRecords) * 100) : 0;
    const cleanReconciliation = snapshot.reconciliationPass && snapshot.missingRecords === 0 && snapshot.extraRecords === 0 && snapshot.variance === 0;
    const lifecycleComplete = snapshot.lifecycleCompleted === snapshot.lifecycleTotal && snapshot.lifecycleTotal > 0;
    return { completion, readiness, cleanReconciliation, lifecycleComplete };
  }, [snapshot]);

  if (loading && !snapshot) {
    return (
      <div className="page" style={{ minHeight: "70vh", display: "grid", placeItems: "center", color: palette.muted }}>
        Loading authoritative KMITORA operational state…
      </div>
    );
  }

  if (!snapshot) {
    return <div className="page" style={{ padding: 24 }}>Control Tower unavailable. {error}</div>;
  }

  const executionLabel = snapshot.executionStatus || "NOT EXECUTED";
  const overallState = snapshot.blockedRecords > 0 ? "ACTION REQUIRED" : snapshot.reviewHeld > 0 ? "COMPLETED WITH GOVERNED REVIEW" : "COMPLETED";

  return (
    <div
      className="page"
      style={{
        minHeight: "100%",
        background: palette.canvas,
        padding: "24px clamp(18px, 3vw, 42px) 48px",
        color: palette.ink,
      }}
    >
      <div style={{ maxWidth: 1420, margin: "0 auto", display: "grid", gap: 18 }}>
        <section
          style={{
            ...panel,
            padding: "22px 24px",
            background: "linear-gradient(135deg, #ffffff 0%, #f8fbff 58%, #f1f5ff 100%)",
            borderColor: "#d8e4f3",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ minWidth: 280, flex: "1 1 620px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ color: palette.blue, fontSize: 11, fontWeight: 850, letterSpacing: ".08em" }}>DEV · AUTHORITATIVE OPERATIONS</span>
                <StatusPill value={overallState} />
              </div>
              <h1 style={{ margin: "8px 0 6px", fontSize: "clamp(26px, 3vw, 38px)", lineHeight: 1.08, letterSpacing: "-.025em" }}>
                Migration Control Tower
              </h1>
              <div style={{ color: palette.muted, fontSize: 13, lineHeight: 1.55, maxWidth: 820 }}>
                Executive-operational view of the current governed DEV lifecycle. Runtime execution, reconciliation and evidence are server-authoritative; browser state is display fallback only.
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                <StatusPill value={executionLabel} />
                <StatusPill value={snapshot.reconciliationPass ? "RECONCILIATION PASS" : "RECONCILIATION PENDING"} />
                <StatusPill value={snapshot.evidenceComplete ? "EVIDENCE COMPLETE" : "EVIDENCE PENDING"} />
                <StatusPill value={snapshot.learningComplete ? "LEARNING COMPLETE" : "LEARNING PENDING"} />
              </div>
            </div>

            <div style={{ minWidth: 250, textAlign: "right" }}>
              <button
                onClick={refresh}
                disabled={loading}
                style={{
                  padding: "10px 15px",
                  border: `1px solid ${palette.line}`,
                  borderRadius: 10,
                  background: "#fff",
                  color: palette.ink,
                  fontWeight: 750,
                  cursor: loading ? "wait" : "pointer",
                  boxShadow: "0 4px 12px rgba(15,23,42,0.05)",
                }}
              >
                {loading ? "Refreshing…" : "Refresh authoritative state"}
              </button>
              <div style={{ ...helperText, marginTop: 9 }}>Migration: {snapshot.migrationId || "current governed DEV run"}</div>
            </div>
          </div>
        </section>

        {error ? (
          <div style={{ ...panel, padding: 13, borderColor: "#fde68a", background: palette.amberSoft, color: palette.amber }}>
            Refresh warning: {error}
          </div>
        ) : null}

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
          <Kpi label="DEV Run Health" value={snapshot.healthLabel} sub={snapshot.healthDetail} emphasis={snapshot.blockedRecords > 0 ? "danger" : snapshot.reviewHeld > 0 ? "review" : "success"} />
          <Kpi label="Lifecycle Completion" value={`${computed.completion}%`} sub={`${snapshot.lifecycleCompleted}/${snapshot.lifecycleTotal} stages complete`} emphasis={computed.lifecycleComplete ? "success" : "info"} />
          <Kpi label="Record Readiness" value={`${computed.readiness}%`} sub={`${snapshot.readyRecords} ready of ${snapshot.discoveredRecords}`} emphasis="info" />
          <Kpi label="Governed Next Action" value={snapshot.nextAction} sub={`${snapshot.reviewHeld} review-held · ${snapshot.blockedRecords} blocked`} emphasis={snapshot.blockedRecords > 0 ? "danger" : snapshot.reviewHeld > 0 ? "review" : "success"} />
        </section>

        <section style={{ ...panel, padding: 20 }}>
          <SectionHeader title="Lifecycle command status" description="Authoritative completion and readiness signals across the governed 13-stage lifecycle." right={<StatusPill value={`${snapshot.lifecycleCompleted}/${snapshot.lifecycleTotal} STAGES`} />} />
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 18 }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 7 }}><span style={{ color: palette.muted }}>Lifecycle completion</span><strong>{computed.completion}%</strong></div>
              <ProgressBar value={computed.completion} tone="green" />
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 7 }}><span style={{ color: palette.muted }}>Record readiness</span><strong>{computed.readiness}%</strong></div>
              <ProgressBar value={computed.readiness} tone={snapshot.reviewHeld > 0 ? "amber" : "green"} />
            </div>
          </div>
        </section>

        <section style={{ ...panel, padding: 20 }}>
          <SectionHeader title="Operational indicators" description="Current source scope, structural dependencies, transformation evidence and governed dispositions." />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(155px,1fr))", gap: 10 }}>
            <CompactMetric label="Source rows observed" value={snapshot.discoveredRecords} sub={`${snapshot.sourceEntities} source entities`} />
            <CompactMetric label="Target entities" value={snapshot.targetEntities} />
            <CompactMetric label="Relationships" value={snapshot.relationships} sub="authoritative dependencies" />
            <CompactMetric label="Transformation evidence" value={snapshot.transformationEvidence} sub={`${snapshot.businessRules} business rules`} />
            <CompactMetric label="Ready / executed" value={snapshot.readyRecords} />
            <CompactMetric label="Review-held" value={snapshot.reviewHeld} sub="governed hold · not blocked" />
            <CompactMetric label="Blocked" value={snapshot.blockedRecords} />
            <CompactMetric label="Quarantine / rejected" value={`${snapshot.quarantineRecords} / ${snapshot.rejectedRecords}`} />
          </div>
        </section>

        <section style={{ ...panel, padding: 20 }}>
          <SectionHeader title="Governed execution truth" description="One runtime chain from approved DEV execution through qualification, validation, reconciliation, evidence and learning." right={<StatusPill value={executionLabel} />} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10 }}>
            <CompactMetric label="Execution mode" value={snapshot.executionMode || "DEV"} sub={executionLabel} />
            <CompactMetric label="Actual DEV target" value={snapshot.loadedRecords} sub="authoritative loaded population" />
            <CompactMetric label="Reconciled matched" value={snapshot.matchedRecords} sub={`Missing ${snapshot.missingRecords} · Extra ${snapshot.extraRecords}`} />
            <CompactMetric label="Count variance" value={snapshot.variance} />
            <CompactMetric label="Deterministic test" value={snapshot.testPass ? "PASS" : "PENDING"} />
            <CompactMetric label="Validation mode" value={snapshot.validationMode || "UNKNOWN"} />
            <CompactMetric label="Reconciliation" value={snapshot.reconciliationPass ? "PASS" : "PENDING"} />
            <CompactMetric label="Evidence / Learn" value={`${snapshot.evidenceComplete ? "COMPLETE" : "PENDING"} / ${snapshot.learningComplete ? "COMPLETE" : "PENDING"}`} />
          </div>

          <div
            style={{
              marginTop: 14,
              padding: "12px 14px",
              borderRadius: 12,
              border: `1px solid ${computed.cleanReconciliation ? "#bbf7d0" : "#fde68a"}`,
              background: computed.cleanReconciliation ? palette.greenSoft : palette.amberSoft,
              color: computed.cleanReconciliation ? palette.green : palette.amber,
              fontWeight: 750,
              fontSize: 12,
            }}
          >
            {computed.cleanReconciliation
              ? `Reconciliation is exact: ${snapshot.matchedRecords} matched, 0 missing, 0 extra and 0 variance.`
              : `Reconciliation requires attention: missing ${snapshot.missingRecords}, extra ${snapshot.extraRecords}, variance ${snapshot.variance}.`}
          </div>
        </section>

        <section style={{ ...panel, padding: 20 }}>
          <SectionHeader title="Safety & governance boundary" description="DEV target writes are explicit and auditable; production actions remain independently prohibited." right={<StatusPill value={snapshot.productionActions === 0 ? "PRODUCTION PROTECTED" : "PRODUCTION REVIEW"} />} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10 }}>
            <CompactMetric label="DEV target writes" value={snapshot.devTargetWrites} />
            <CompactMetric label="Production actions" value={snapshot.productionActions} />
            <CompactMetric label="Production migration" value={snapshot.productionMigration} />
            <CompactMetric label="Cutover" value={snapshot.cutover} />
          </div>
          <div style={{ marginTop: 14, padding: "12px 14px", background: palette.greenSoft, border: "1px solid #bbf7d0", borderRadius: 12, color: palette.green, fontWeight: 750, fontSize: 12, lineHeight: 1.45 }}>
            Review-held records never become blockers by inference. Only explicit BLOCKED / QUARANTINE / REJECTED dispositions or failed governed gates can block the run.
          </div>
        </section>

        <section style={{ ...panel, padding: 20 }}>
          <SectionHeader title="Recent governed activity" description="Milestone evidence from the current authoritative execution chain." />
          <div style={{ display: "grid", gap: 0 }}>
            {snapshot.activity.map((item, index) => (
              <div
                key={`${item.label}-${index}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "18px minmax(0,1fr) auto",
                  alignItems: "center",
                  gap: 10,
                  padding: "11px 2px",
                  borderBottom: index === snapshot.activity.length - 1 ? "none" : `1px solid ${palette.line}`,
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: 999, background: toneFor(item.status).fg, justifySelf: "center" }} />
                <span style={{ color: palette.ink, fontSize: 12 }}>{item.label}</span>
                <StatusPill value={item.status} />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
