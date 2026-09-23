import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  FileCheck2,
  FlaskConical,
  Gauge,
  Lightbulb,
  Microscope,
  PlayCircle,
  RefreshCw,
  ShieldCheck,
  TestTube2,
} from "lucide-react";

import A000ScenarioContextBanner from "./A000ScenarioContextBanner";

import {
  KMITORA_LIFECYCLE,
  type KmitoraLifecycleStage,
} from "../config/kmitoraLifecycle";
import type { AdvancedRuntime } from "../types/advancedRuntime";
import { PredictIntelligencePanel } from "./PredictIntelligencePanel";
import { DiagnoseIntelligencePanel } from "./DiagnoseIntelligencePanel";
import { RecommendIntelligencePanel } from "./RecommendIntelligencePanel";
import { SimulateIntelligencePanel } from "./SimulateIntelligencePanel";

type Props = {
  stageKey: KmitoraLifecycleStage["key"];
  onNavigate?: (key: string) => void;
  advancedRuntime?: AdvancedRuntime | null;
};

const iconByStage = {
  understand: BrainCircuit,
  discover: Microscope,
  detect: AlertTriangle,
  diagnose: Activity,
  predict: Gauge,
  recommend: Lightbulb,
  simulate: FlaskConical,
  execute: PlayCircle,
  test: TestTube2,
  validate: ShieldCheck,
  reconcile: RefreshCw,
  evidence: FileCheck2,
  learn: BrainCircuit,
} as const;

const details: Record<
  KmitoraLifecycleStage["key"],
  {
    eyebrow: string;
    objective: string;
    actions: string[];
    gate: string;
  }
> = {
  understand: {
    eyebrow: "Intent & Context",
    objective:
      "Establish the business objective, source/target scope, constraints, permissions and success criteria.",
    actions: [
      "Capture business requirements and operating context",
      "Verify source and target connectivity",
      "Resolve missing scope and conflicting assumptions",
    ],
    gate: "Scope and context must be sufficiently grounded before discovery.",
  },
  discover: {
    eyebrow: "Inventory & Topology",
    objective:
      "Discover systems, schemas, data, dependencies, rules and runtime context using evidence-backed inspection.",
    actions: [
      "Inventory source and target assets",
      "Build dependency and lineage context",
      "Persist discovery evidence for downstream stages",
    ],
    gate: "Discovery evidence must exist before detection and diagnosis.",
  },
  detect: {
    eyebrow: "Errors, Drift & Silent Failure",
    objective:
      "Detect explicit errors, anomalies, data-quality gaps, drift and silent failures without fabricating findings.",
    actions: [
      "Run deterministic checks and anomaly detection",
      "Compare expected versus observed state",
      "Classify severity, confidence and affected assets",
    ],
    gate: "Critical detections require evidence IDs and deterministic confirmation where available.",
  },
  diagnose: {
    eyebrow: "Root Cause & Impact",
    objective:
      "Localize the fault, correlate evidence and determine root cause, blast radius and business impact.",
    actions: [
      "Correlate logs, schema, lineage and change history",
      "Run dependency-aware root-cause analysis",
      "Separate cause, symptom and downstream impact",
    ],
    gate: "Unsupported causal claims must remain REVIEW or ABSTAIN.",
  },
  predict: {
    eyebrow: "Failure & Risk Forecast",
    objective:
      "Estimate likely failure, downstream impact and risk using evidence-backed predictive reasoning.",
    actions: [
      "Score risk and confidence",
      "Evaluate dependency propagation",
      "Flag likely future failure or degradation",
    ],
    gate: "Prediction never replaces deterministic verification of current facts.",
  },
  recommend: {
    eyebrow: "Design & Remediation",
    objective:
      "Produce ranked, evidence-backed recommendations, mappings, transformations and remediation options.",
    actions: [
      "Generate bounded remediation candidates",
      "Compare options, dependencies and rollback cost",
      "Prepare the governed execution plan",
    ],
    gate: "Recommendations are advisory until simulated, validated and approved.",
  },
  simulate: {
    eyebrow: "Digital Twin & Dry Run",
    objective:
      "Evaluate planned changes in a sandbox/digital-twin context before state-changing execution.",
    actions: [
      "Run dry-run and what-if simulations",
      "Evaluate blast radius and rollback path",
      "Capture expected versus simulated outcomes",
    ],
    gate: "Critical changes require successful simulation and rollback readiness.",
  },
  execute: {
    eyebrow: "Governed Action",
    objective:
      "Execute only explicitly permitted actions with checkpoints, approval, action budgets and rollback protection.",
    actions: [
      "Verify environment and authorization",
      "Checkpoint pre-change state",
      "Apply bounded action and monitor outcome",
    ],
    gate: "Production eligibility is not production authorization.",
  },
  test: {
    eyebrow: "Deterministic Qualification",
    objective:
      "Run unit, integration, contract, regression, security, performance and business-rule tests.",
    actions: [
      "Execute deterministic test suites",
      "Run negative and adversarial cases",
      "Record reproducible test evidence",
    ],
    gate: "Mandatory critical tests must pass; blockers cannot be averaged away.",
  },
  validate: {
    eyebrow: "Outcome Verification",
    objective:
      "Validate technical, business, security, policy and migration outcomes against defined acceptance criteria.",
    actions: [
      "Validate schemas, rules and permissions",
      "Verify intended outcome rather than API success",
      "Confirm acceptance criteria and release gates",
    ],
    gate: "Validation requires evidence-backed PASS/FAIL/REVIEW status.",
  },
  reconcile: {
    eyebrow: "Expected vs Actual",
    objective:
      "Reconcile source, target and expected state using counts, hashes, keys, rules and exception analysis.",
    actions: [
      "Compare counts, checksums and key integrity",
      "Resolve mismatches and exceptions",
      "Verify migration and business reconciliation",
    ],
    gate: "Unexplained critical mismatches block promotion.",
  },
  evidence: {
    eyebrow: "Audit & Provenance",
    objective:
      "Assemble auditable evidence for inputs, decisions, tools, tests, approvals, rollback and final state.",
    actions: [
      "Capture evidence IDs and provenance",
      "Validate evidence completeness and integrity",
      "Prepare release and audit package",
    ],
    gate: "Critical evidence completeness target is 100%.",
  },
  learn: {
    eyebrow: "Verified Continuous Learning",
    objective:
      "Promote only verified outcomes into reusable knowledge, regression suites, prompts, policies and skill improvements.",
    actions: [
      "Separate verified outcomes from failed hypotheses",
      "Create regression protection from failures",
      "Update governed knowledge with provenance",
    ],
    gate: "Unverified outcomes must never be promoted as learned truth.",
  },
};

export default function LifecycleStageWorkspace({
  stageKey,
  onNavigate,
  advancedRuntime,
}: Props) {
  const index = KMITORA_LIFECYCLE.findIndex((stage) => stage.key === stageKey);
  const stage = KMITORA_LIFECYCLE[index];
  const next = KMITORA_LIFECYCLE[index + 1];
  const Icon = iconByStage[stageKey];
  const detail = details[stageKey];

  return (
    <div className="page kmStagePage">
      <A000ScenarioContextBanner />
      <section className="kmStageHero">
        <div className="kmStageHeroIcon">
          <Icon size={24} />
        </div>

        <div>
          <span>{detail.eyebrow}</span>
          <h1>
            {String(index + 1).padStart(2, "0")} · {stage.label}
          </h1>
          <p>{detail.objective}</p>
        </div>

        <div className={`kmStageState ${stage.status}`}>
          {stage.status.toUpperCase()}
        </div>
      </section>

      <section className="kmStageGrid">
        <article className="kmStageCard">
          <div className="kmStageCardTitle">
            <CheckCircle2 size={17} />
            <h2>Stage responsibilities</h2>
          </div>
          <div className="kmStageActionList">
            {detail.actions.map((action) => (
              <div key={action}>
                <CheckCircle2 size={14} />
                <span>{action}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="kmStageCard">
          <div className="kmStageCardTitle">
            <ShieldCheck size={17} />
            <h2>Promotion gate</h2>
          </div>
          <p>{detail.gate}</p>
          <div className="kmStageProgress">
            <span>
              <i style={{ width: `${stage.progress}%` }} />
            </span>
            <strong>{stage.progress}%</strong>
          </div>
        </article>
      </section>

      {stageKey === "predict" && advancedRuntime && (
        <PredictIntelligencePanel
          runtime={advancedRuntime}
          stage="Predict"
        />
      )}

      {stageKey === "simulate" && advancedRuntime && (
        <SimulateIntelligencePanel
          runtime={advancedRuntime}
          stage="Simulate"
        />
      )}

      {stageKey === "diagnose" && advancedRuntime && (
        <DiagnoseIntelligencePanel
          runtime={advancedRuntime}
          stage="Diagnose"
        />
      )}

      {stageKey === "recommend" && advancedRuntime && (
        <RecommendIntelligencePanel
          runtime={advancedRuntime}
          stage="Recommend"
        />
      )}

      {next && (
        <section className="kmStageNext">
          <div>
            <span>NEXT GOVERNED STAGE</span>
            <h2>{next.label}</h2>
            <p>{next.summary}</p>
          </div>
          <button type="button" onClick={() => onNavigate?.(next.key)}>
            Continue to {next.label}
            <ArrowRight size={16} />
          </button>
        </section>
      )}
    </div>
  );
}

