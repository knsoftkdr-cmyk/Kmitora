import { useEffect, useMemo, useState } from "react";

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



type StageInsight = {
  doing: string;
  purpose: string;
  inputs: string[];
  checks: string[];
  output: string;
};

const stageInsights: Partial<Record<KmitoraLifecycleStage["key"], StageInsight>> = {
  detect: {
    doing:
      "Inspect the discovered source population against saved business rules, source/target metadata and relationship evidence to surface proven data-quality and migration-risk conditions.",
    purpose:
      "Find invalid, incomplete, duplicate, temporally inconsistent, orphaned or ambiguous records before transformation or target execution.",
    inputs: [
      "Unified Discovery result and logical source entities",
      "Saved business rules and supporting artifacts",
      "Source/target schemas, keys, mappings and relationships",
    ],
    checks: [
      "Missing/invalid mandatory values and datatype violations",
      "Duplicate keys and normalized duplicate business records",
      "Referential/orphan conditions and relationship violations",
      "Temporal overlap, future/expired periods and conflicting candidates",
      "Source drift, unexpected values and silent-failure indicators",
    ],
    output:
      "Evidence-backed findings classified by severity, confidence, affected entity/field and governing rule.",
  },
  diagnose: {
    doing:
      "Trace each detected finding back through source values, rules, mappings, lineage and dependencies to determine the most defensible root cause.",
    purpose:
      "Separate symptoms from causes so remediation targets the actual defect without altering valid source history or business meaning.",
    inputs: [
      "Detected findings and evidence IDs",
      "Entity relationships, lineage and transformation candidates",
      "Business rules, source-system provenance and target expectations",
    ],
    checks: [
      "Source-system conflict versus malformed source data",
      "Rule, mapping, datatype or reference-data mismatch",
      "Temporal/precedence ambiguity and dependency propagation",
      "Affected records, entities and downstream blast radius",
    ],
    output:
      "Root-cause classification with impacted assets, supporting evidence, confidence and review/abstain status where causality is not proven.",
  },
  predict: {
    doing:
      "Project the downstream impact of unresolved findings using the discovered dependency graph, record counts, validation state and migration rules.",
    purpose:
      "Estimate likely migration risk before execution so teams can understand what may fail, diverge or require review.",
    inputs: [
      "Diagnosed findings and root causes",
      "Dependency/load-wave graph and affected record counts",
      "Validation, reconciliation and target constraints",
    ],
    checks: [
      "Potential rejected/quarantined records",
      "Referential-integrity and reconciliation risk",
      "Duplicate/incorrect target outcomes",
      "Likely downstream wave, SLA or business-impact propagation",
    ],
    output:
      "Risk projections with confidence and affected scope; projections remain advisory and do not replace deterministic validation.",
  },
  recommend: {
    doing:
      "Translate diagnosed causes into governed remediation and transformation candidates that are traceable to the original business rules.",
    purpose:
      "Prepare the safest deterministic way to correct, normalize, enrich, route or reject records before any state-changing action.",
    inputs: [
      "Diagnoses, predictions and governing business rules",
      "Transformation capability catalogue and target constraints",
      "Rollback, approval and environment policies",
    ],
    checks: [
      "Normalize/standardize/derive values",
      "Filter, rank, deduplicate, enrich or remap records",
      "Route ambiguous records to review/quarantine/reject",
      "Compare remediation options, dependencies and rollback cost",
    ],
    output:
      "A rule-linked remediation plan showing the proposed transformation/action, affected scope, rationale and governance status.",
  },
  simulate: {
    doing:
      "Execute the proposed logic as a DEV-safe dry run/digital twin to calculate expected outcomes without writing to the source or target.",
    purpose:
      "Prove that the recommended transformations, routing and load sequence produce an acceptable result before governed execution.",
    inputs: [
      "Recommended transformation/remediation plan",
      "Validated source records, mappings and load waves",
      "Target schema, constraints and reconciliation expectations",
    ],
    checks: [
      "Business-rule and transformation outcomes",
      "Ready/review/quarantine/reject classification",
      "Referential integrity and load-wave ordering",
      "Expected target counts and reconciliation variances",
      "Rollback readiness and safety invariants",
    ],
    output:
      "Dry-run evidence showing expected target state, exceptions, reconciliation results and blockers while source/target writes remain disabled.",
  },
};

function readStageContext() {
  if (typeof window === "undefined") {
    return { sourceEntities: 0, targetEntities: 0, rules: 0, rows: 0, relationships: 0, findings: 0 };
  }
  const read = (key: string) => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };
  const discovery = read("kmitora.dev.discoveryResult");
  const requirement = read("kmitora.business.requirements.v1");
  const sourceEntities = Array.isArray(discovery?.source?.entities)
    ? discovery.source.entities.length
    : Array.isArray(discovery?.source_entities)
      ? discovery.source_entities.length
      : Number(discovery?.summary?.source_entity_count ?? discovery?.source_entity_count ?? 0);
  const targetEntities = Array.isArray(discovery?.target?.entities)
    ? discovery.target.entities.length
    : Array.isArray(discovery?.target_entities)
      ? discovery.target_entities.length
      : Number(discovery?.summary?.target_entity_count ?? discovery?.target_entity_count ?? 0);
  const rules = Array.isArray(requirement?.rules)
    ? requirement.rules.length
    : Array.isArray(discovery?.business_rules)
      ? discovery.business_rules.length
      : Number(discovery?.summary?.business_rule_count ?? 0);
  const relationships = Array.isArray(discovery?.relationships)
    ? discovery.relationships.length
    : Number(discovery?.summary?.relationship_count ?? 0);
  const rows = Number(
    discovery?.summary?.rows_observed ??
      discovery?.summary?.source_rows_observed ??
      discovery?.summary?.source_rows_matched ??
      discovery?.summary?.source_rows_scanned ??
      discovery?.rows_observed ??
      0
  );
  const findings = Array.isArray(discovery?.quality_findings)
    ? discovery.quality_findings.length
    : 0;
  return { sourceEntities, targetEntities, rules, rows, relationships, findings };
}

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

async function readJsonResponse(response: Response, label: string) {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error(`${label} returned an empty HTTP ${response.status} response`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} returned non-JSON HTTP ${response.status}: ${text.slice(0, 240)}`);
  }
}

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
  const insight = stageInsights[stageKey];
  const initialStageContext = useMemo(() => readStageContext(), [stageKey]);
  const [stageContext, setStageContext] = useState(initialStageContext);
  const [stageExecution, setStageExecution] = useState<any>(null);
  const [stageExecutionError, setStageExecutionError] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!insight) return () => { cancelled = true; };

    const runStage = async () => {
      setStageExecutionError("");
      try {
        const contextResponse = await fetch("/api/v1/lifecycle-context");
        const contextBody = await readJsonResponse(contextResponse, "Lifecycle context");
        if (!contextResponse.ok) throw new Error(contextBody?.payload?.message || "Lifecycle context unavailable");
        const payload = contextBody?.payload ?? contextBody;
        const context = payload?.context ?? {};
        const migrationId = String(context?.migration_id || localStorage.getItem("kmitora.dev.migrationId") || "").trim();
        if (!migrationId) throw new Error("No active migration context. Run Unified Discovery first.");

        let response = await fetch(`/api/v1/lifecycle/stages/${stageKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ migration_id: migrationId }),
        });
        let body = await readJsonResponse(response, `${stage.label} stage`);

        // LIFECYCLE-CONTEXT-002: compatibility fallback for older/dev route
        // registrations. A 404 must not silently zero the lifecycle context.
        if (response.status === 404 && /not found/i.test(String(body?.payload?.message || body?.message || ""))) {
          response = await fetch("/api/v1/lifecycle-stage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ migration_id: migrationId, stage: stageKey }),
          });
          body = await readJsonResponse(response, `${stage.label} stage fallback`);
        }
        if (!response.ok) throw new Error(body?.payload?.message || body?.message || `${stage.label} evaluation failed`);
        const result = body?.payload ?? body;
        if (cancelled) return;
        const ctx = result?.context ?? context;
        setStageExecution(result);
        setStageContext({
          sourceEntities: Number(ctx?.source_entity_count ?? 0),
          targetEntities: Number(ctx?.target_entity_count ?? 0),
          rules: Number(ctx?.business_rule_count ?? 0),
          rows: Number(ctx?.rows_observed ?? 0),
          relationships: Number(ctx?.relationship_count ?? 0),
          findings: Number(ctx?.quality_finding_count ?? 0),
        });
        localStorage.setItem("kmitora.dev.migrationId", migrationId);
      } catch (error) {
        if (!cancelled) setStageExecutionError(error instanceof Error ? error.message : String(error));
      }
    };

    void runStage();
    return () => { cancelled = true; };
  }, [stageKey]);

  const effectiveProgress = insight ? Number(stageExecution?.progress ?? 0) : stage.progress;
  const effectiveStatus = insight
    ? (stageExecution?.status === "DONE" ? "done" : stageExecutionError ? "blocked" : "active")
    : stage.status;

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

        <div className={`kmStageState ${effectiveStatus}`}>
          {String(effectiveStatus).toUpperCase()}
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
              <i style={{ width: `${effectiveProgress}%` }} />
            </span>
            <strong>{effectiveProgress}%</strong>
          </div>
        </article>
      </section>

      {insight && (
        <section className="kmStageInsight">
          <div className="kmStageInsightHeader">
            <div>
              <span>STAGE EXPLANATION</span>
              <h2>What KMITORA is doing and why</h2>
            </div>
            <div className="kmStageInsightMode">DEV · READ ONLY / DRY RUN</div>
          </div>

          <div className="kmStageInsightColumns">
            <article>
              <h3>What KMITORA is doing</h3>
              <p>{insight.doing}</p>
            </article>
            <article>
              <h3>Purpose of this stage</h3>
              <p>{insight.purpose}</p>
            </article>
          </div>

          <div className="kmStageInsightColumns">
            <article>
              <h3>Inputs being analyzed</h3>
              <ul>{insight.inputs.map((item) => <li key={item}>{item}</li>)}</ul>
            </article>
            <article>
              <h3>Checks performed</h3>
              <ul>{insight.checks.map((item) => <li key={item}>{item}</li>)}</ul>
            </article>
          </div>

          {stageExecutionError && (
            <div className="kmStageExpectedOutput">
              <strong>Stage blocked</strong>
              <span>{stageExecutionError}</span>
            </div>
          )}

          {stageExecution?.message && (
            <div className="kmStageExpectedOutput">
              <strong>Actual stage result</strong>
              <span>{stageExecution.message}</span>
            </div>
          )}

          <div className="kmStageMetricStrip">
            <div><strong>{stageContext.rows.toLocaleString()}</strong><span>Records in discovered scope</span></div>
            <div><strong>{stageContext.rules}</strong><span>Business rules</span></div>
            <div><strong>{stageContext.sourceEntities}</strong><span>Source entities</span></div>
            <div><strong>{stageContext.targetEntities}</strong><span>Target entities</span></div>
            <div><strong>{stageContext.relationships}</strong><span>Relationships</span></div>
            <div><strong>{stageContext.findings}</strong><span>Discovery findings</span></div>
          </div>

          <div className="kmStageExpectedOutput">
            <strong>Expected stage output</strong>
            <span>{insight.output}</span>
          </div>
        </section>
      )}

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
          <button
            type="button"
            onClick={() => onNavigate?.(next.key)}
            disabled={Boolean(insight) && stageExecution?.status !== "DONE"}
            title={Boolean(insight) && stageExecution?.status !== "DONE" ? `Complete ${stage.label} before continuing` : undefined}
          >
            Continue to {next.label}
            <ArrowRight size={16} />
          </button>
        </section>
      )}
    </div>
  );
}

