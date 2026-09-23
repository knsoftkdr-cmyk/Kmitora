import { useEffect, useState } from "react";
import { Bot, Brain, Bug, CheckCircle2, RefreshCcw, ShieldCheck } from "lucide-react";
import type { AutonomousDefectCycle } from "../models/AutonomousDefect";
import { loadAutonomousDefectCycle, runAutonomousDefectCycle } from "../services/autonomousDefectEngine";

export default function KMITORAAutonomousQualityPanel() {
  const [report, setReport] = useState<AutonomousDefectCycle | null>(null);

  useEffect(() => {
    setReport(loadAutonomousDefectCycle() ?? runAutonomousDefectCycle());
  }, []);

  const rerun = () => setReport(runAutonomousDefectCycle());
  const p0 = report?.defects.filter((item) => item.severity === "P0_CRITICAL").length ?? 0;
  const safe = report?.defects.filter((item) => item.safeAutoFix).length ?? 0;

  return (
    <section className="panel" style={{ marginTop: 18 }}>
      <div className="panelHeader">
        <div>
          <span className="eyebrow">KMITORA AUTONOMOUS QUALITY LOOP</span>
          <h3>Observe → Diagnose → Remediate → Retest → Evidence</h3>
          <p>All registered knowledge packs and core agents participate in DEV-safe defect intelligence. Governed or production-impacting changes remain blocked for approval.</p>
        </div>
        <button type="button" onClick={rerun}><RefreshCcw size={16} /> Run Observation Cycle</button>
      </div>

      <div className="metricStrip">
        <div><Brain size={16} /><span>Knowledge Topics</span><strong>{report?.totalKnowledgeTopics ?? 0}</strong></div>
        <div><Bot size={16} /><span>Activated Agents</span><strong>{report?.activatedAgents.length ?? 0}</strong></div>
        <div><Bug size={16} /><span>Observed Defects</span><strong>{report?.defects.length ?? 0}</strong></div>
        <div><CheckCircle2 size={16} /><span>DEV-Safe Candidates</span><strong>{safe}</strong></div>
      </div>

      <div className="checkList" style={{ marginTop: 14 }}>
        {report?.knowledgePacks.map((pack) => (
          <div className="checkRow" key={pack.id}>
            <Brain size={16} />
            <span>{pack.name}</span>
            <small>{pack.topicCount} TOPICS · {pack.status}</small>
          </div>
        ))}
      </div>

      <div className="checkList" style={{ marginTop: 14 }}>
        {report?.defects.length ? report.defects.map((item) => (
          <div className="checkRow" key={item.id}>
            <Bug size={16} />
            <span>{item.title} — {item.recommendedAction}</span>
            <small>{item.severity} · {item.status}</small>
          </div>
        )) : (
          <div className="checkRow"><CheckCircle2 size={16} /><span>No defect is currently proven from browser-state evidence.</span><small>OBSERVING</small></div>
        )}
      </div>

      <div className="checkRow" style={{ marginTop: 14 }}>
        <ShieldCheck size={16} />
        <span>Safety invariant</span>
        <small>{p0 ? "CRITICAL REVIEW" : "SOURCE WRITES 0 · TARGET PROD WRITES 0 · PROD ACTIONS 0 · CUTOVER DISABLED"}</small>
      </div>
    </section>
  );
}

