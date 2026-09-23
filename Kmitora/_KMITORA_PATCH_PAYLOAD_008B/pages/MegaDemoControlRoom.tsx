import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  CheckCircle2,
  FileCheck2,
  GraduationCap,
  RefreshCw,
  ShieldCheck,
  Target,
} from "lucide-react";
import MegaDemoControlRoomLegacy from "./MegaDemoControlRoomLegacy";
import {
  loadAuthoritativeRunProjection,
  type AuthoritativeRunProjection,
} from "../services/authoritativeRunProjection";
import "../styles/mega-demo-authoritative-replay.css";

const stages = [
  "Understand",
  "Discover",
  "Detect",
  "Diagnose",
  "Predict",
  "Recommend",
  "Simulate",
  "Execute",
  "Test",
  "Validate",
  "Reconcile",
  "Evidence",
  "Learn",
];

function value(value: string | number | undefined, fallback = "-") {
  return value === undefined || value === null || value === "" ? fallback : String(value);
}

export default function MegaDemoControlRoom() {
  const [run, setRun] = useState<AuthoritativeRunProjection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await loadAuthoritativeRunProjection();
      setRun(next);
      if (!next) setError("No authoritative A000 evidence package is available for the current run.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load authoritative A000 run state.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runHealth = useMemo(() => {
    if (!run) return "AWAITING AUTHORITATIVE RUN";
    if (!run.identityAligned) return "IDENTITY REVIEW REQUIRED";
    if (run.lifecycleComplete && run.reviewHeld > 0) return "COMPLETE WITH GOVERNED REVIEW";
    if (run.lifecycleComplete) return "COMPLETE";
    return "IN PROGRESS";
  }, [run]);

  return (
    <div className="megaAuthoritativePage">
      <section className="megaAuthoritativeHero">
        <div>
          <span className="megaEyebrow">A000 AUTHORITATIVE OPERATIONS</span>
          <h1>Mega Enterprise Control Room</h1>
          <p>
            Current migration truth is projected from the same A000 evidence chain used by
            Execute, Test, Validate, Reconcile, Evidence and Learn. Reference demo qualification
            remains available below and is never mixed with current-run truth.
          </p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw size={15} /> {loading ? "Refreshing..." : "Replay Authoritative Run"}
        </button>
      </section>

      {error && <div className="megaAuthoritativeWarning">{error}</div>}

      {run && (
        <>
          <section className="megaRunStatusGrid">
            <article className="megaRunStatusPrimary">
              <span>CURRENT RUN</span>
              <strong>{runHealth}</strong>
              <small>{run.migrationId || "Migration identity unavailable"}</small>
            </article>
            <article><span>LIFECYCLE</span><strong>{run.lifecycleCompletedStages}/{run.lifecycleTotalStages}</strong><small>{run.lifecycleComplete ? "All governed stages complete" : "Authoritative progress"}</small></article>
            <article><span>DISCOVERED</span><strong>{run.discoveredRecords}</strong><small>{run.sourceEntities} source entities</small></article>
            <article><span>READY / EXECUTED</span><strong>{run.readyRecords}</strong><small>Authoritative ready population</small></article>
            <article className="megaRunReview"><span>REVIEW HELD</span><strong>{run.reviewHeld}</strong><small>Governed review, not blocked</small></article>
            <article><span>BLOCKED</span><strong>{run.blockedRecords}</strong><small>Quarantine {run.quarantineRecords} · Rejected {run.rejectedRecords}</small></article>
          </section>

          <section className="megaLifecycleCard">
            <div className="megaSectionHead">
              <div>
                <span>13-STAGE AUTHORITATIVE LIFECYCLE</span>
                <h2>Current governed execution path</h2>
              </div>
              <strong>{run.lifecycleComplete ? "13/13 COMPLETE" : `${run.lifecycleCompletedStages}/13`}</strong>
            </div>
            <div className="megaLifecycleRail">
              {stages.map((stage, index) => {
                const complete = index < run.lifecycleCompletedStages;
                return (
                  <div key={stage} className={complete ? "complete" : "pending"}>
                    <small>{String(index + 1).padStart(2, "0")}</small>
                    <strong>{stage}</strong>
                    {complete ? <CheckCircle2 size={14} /> : <span className="megaStageDot" />}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="megaTruthGrid">
            <article>
              <div className="megaTruthIcon"><Activity size={18} /></div>
              <span>EXECUTION</span>
              <strong>{run.executionStatus}</strong>
              <small>{run.executionMode}</small>
            </article>
            <article>
              <div className="megaTruthIcon"><Target size={18} /></div>
              <span>ACTUAL DEV TARGET</span>
              <strong>{run.devTargetWrites}</strong>
              <small>Approved DEV writes</small>
            </article>
            <article>
              <div className="megaTruthIcon"><CheckCircle2 size={18} /></div>
              <span>TEST</span>
              <strong>{run.testStatus}</strong>
              <small>Deterministic qualification</small>
            </article>
            <article>
              <div className="megaTruthIcon"><ShieldCheck size={18} /></div>
              <span>VALIDATION</span>
              <strong>{run.validationMode}</strong>
              <small>Post-load read-only</small>
            </article>
            <article>
              <div className="megaTruthIcon"><CheckCircle2 size={18} /></div>
              <span>RECONCILIATION</span>
              <strong>{run.reconciliationStatus}</strong>
              <small>{run.matchedRecords} matched · variance {run.countVariance}</small>
            </article>
            <article>
              <div className="megaTruthIcon"><FileCheck2 size={18} /></div>
              <span>EVIDENCE</span>
              <strong>{run.evidenceStatus}</strong>
              <small>{run.evidenceArtifacts} authoritative artifacts</small>
            </article>
            <article>
              <div className="megaTruthIcon"><GraduationCap size={18} /></div>
              <span>VERIFIED LEARNING</span>
              <strong>{run.learningStatus}</strong>
              <small>{run.learningId || "No learning identity"}</small>
            </article>
          </section>

          <section className="megaIdentitySafety">
            <div>
              <span>AUTHORITATIVE IDENTITY CHAIN</span>
              <div className="megaIdentityGrid">
                <p><b>Migration</b>{value(run.migrationId)}</p>
                <p><b>Approval</b>{value(run.approvalId)}</p>
                <p><b>Execution</b>{value(run.executionId)}</p>
                <p><b>Reconciliation</b>{value(run.reconciliationId)}</p>
                <p><b>Evidence</b>{value(run.evidenceId)}</p>
                <p><b>Learning</b>{value(run.learningId)}</p>
              </div>
            </div>
            <div className="megaSafetyCard">
              <ShieldCheck size={20} />
              <div>
                <span>SAFETY BOUNDARY</span>
                <strong>{run.productionActions === 0 ? "PRODUCTION PROTECTED" : "REVIEW REQUIRED"}</strong>
                <small>
                  DEV writes {run.devTargetWrites} · Production actions {run.productionActions} ·
                  Production migration {run.productionMigration} · Cutover {run.cutover}
                </small>
              </div>
            </div>
          </section>
        </>
      )}

      <section className="megaReferenceBoundary">
        <div>
          <span>REFERENCE RUNTIME QUALIFICATION</span>
          <h2>Backend Mega Demo & capability showcase</h2>
          <p>
            The content below is retained as the independent Mega Demo qualification and capability
            showcase. Values such as 121/121 checks and 104 scenarios describe the reference demo,
            not the current migration population.
          </p>
        </div>
        <span className="megaReferenceBadge">SEPARATE FROM CURRENT RUN</span>
      </section>

      <div className="megaLegacyBoundary">
        <MegaDemoControlRoomLegacy />
      </div>
    </div>
  );
}
