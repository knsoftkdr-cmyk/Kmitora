import { a000KnowledgePacks } from "../config/knowledgePackRegistry";
import { coreAgentRegistry } from "../config/agentRegistry";
import type {
  AutonomousDefectCycle,
  AutonomousDefectObservation,
  AutonomousRequirement,
} from "../models/AutonomousDefect";

const REPORT_KEY = "kmitora.dev.autonomousDefectCycle";
const REQUIREMENT_KEYS = [
  "kmitora.dev.knowledgeItems",
  "kmitora.dev.workflowState",
  "kmitora.dev.discoveryResult",
  "kmitora.dev.enterpriseIntelligence",
  "kmitora.dev.approvalRequest",
  "kmitora.dev.executionResult",
  "kmitora.dev.lastEvidence",
] as const;

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 9)}`;
}

function readJson<T>(key: string): T | null {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}

function textOf(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function requirement(id: string, text: string, source: AutonomousRequirement["source"]): AutonomousRequirement {
  return { id, text, source };
}

function defect(input: Omit<AutonomousDefectObservation, "id" | "sourceWriteRequired" | "targetWriteRequired">): AutonomousDefectObservation {
  return {
    id: uid("DEF"),
    sourceWriteRequired: false,
    targetWriteRequired: false,
    ...input,
  };
}

export function runAutonomousDefectCycle(): AutonomousDefectCycle {
  const requirements: AutonomousRequirement[] = [
    requirement("REQ-SAFETY-001", "DEV analysis and remediation must not write to production targets.", "SAFETY_POLICY"),
    requirement("REQ-SAFETY-002", "Production migration and cutover remain disabled without explicit authorization.", "SAFETY_POLICY"),
    requirement("REQ-AUTO-001", "Observe business context, requirements, defects, evidence and workflow state before remediation.", "BUSINESS_PROMPT"),
    requirement("REQ-AUTO-002", "Auto-fix only deterministic reversible DEV-safe issues; governed changes require review.", "SAFETY_POLICY"),
  ];

  const observedText = REQUIREMENT_KEYS.map((key) => {
    const value = readJson<unknown>(key);
    if (value != null) {
      requirements.push(requirement(`REQ-${requirements.length + 1}`, `${key}: ${textOf(value).slice(0, 700)}`, key.includes("knowledge") ? "KNOWLEDGE_ITEM" : "WORKFLOW_STATE"));
    }
    return textOf(value);
  }).join("\n");

  const defects: AutonomousDefectObservation[] = [];

  const workflow = readJson<Record<string, unknown>>("kmitora.dev.workflowState");
  const enterprise = readJson<Record<string, unknown>>("kmitora.dev.enterpriseIntelligence");
  const execution = readJson<Record<string, unknown>>("kmitora.dev.executionResult");
  const evidence = readJson<Record<string, unknown>>("kmitora.dev.lastEvidence");

  if (!workflow) {
    defects.push(defect({
      title: "Workflow evidence is not available",
      area: "ORCHESTRATION",
      severity: "P2_MEDIUM",
      status: "RETEST_REQUIRED",
      symptom: "No current workflow state is available to the autonomous observer.",
      probableRootCause: "Connection/discovery may not have been completed in this browser session.",
      businessImpact: "KMITORA cannot prove end-to-end readiness from current evidence.",
      evidence: ["kmitora.dev.workflowState is absent"],
      assignedAgents: ["A000", "A114", "A116"],
      knowledgePacks: ["GLOBAL_BUSINESS_DOMAINS", "TRANSFORMATIONS"],
      safeAutoFix: false,
      recommendedAction: "Complete governed Understand and Discover stages, then rerun the defect cycle.",
      productionActionRequired: false,
    }));
  }

  if (/PARTIAL_AUTOMATION_WAITING_FOR_ADAPTERS|ADAPTER_REQUIRED/i.test(observedText)) {
    defects.push(defect({
      title: "Required discovery adapter is unavailable",
      area: "CONNECTIVITY",
      severity: "P1_HIGH",
      status: "GOVERNED_REVIEW",
      symptom: "Automation evidence reports one or more connector/adapter gaps.",
      probableRootCause: "A required source/target technology does not yet have an authorized live adapter.",
      businessImpact: "Discovery coverage is incomplete and downstream mappings may be provisional.",
      evidence: ["Workflow/enterprise evidence contains ADAPTER_REQUIRED or PARTIAL_AUTOMATION_WAITING_FOR_ADAPTERS"],
      assignedAgents: ["A000", "A103", "A109", "A110", "A111"],
      knowledgePacks: ["GLOBAL_BUSINESS_DOMAINS", "DIGITAL_TWINS"],
      safeAutoFix: false,
      recommendedAction: "Generate an adapter implementation task, validate read-only connectivity, then rerun discovery.",
      productionActionRequired: false,
    }));
  }

  const blockingPattern = /"(?:blocking_count|blockingFindings|blocked_records)"\s*:\s*([1-9]\d*)/i;
  if (blockingPattern.test(observedText)) {
    defects.push(defect({
      title: "Blocking validation evidence exists",
      area: "VALIDATION",
      severity: "P1_HIGH",
      status: "DIAGNOSED",
      symptom: "Validation evidence contains one or more blocking findings.",
      probableRootCause: "Data quality, referential, mapping, transformation or business-rule validation failed.",
      businessImpact: "Approval and migration readiness must remain blocked.",
      evidence: ["Blocking validation count is greater than zero"],
      assignedAgents: ["A104", "A106", "A107", "A108", "A115", "A116"],
      knowledgePacks: ["TRANSFORMATIONS", "NEURAL_NETWORKS", "GLOBAL_BUSINESS_DOMAINS"],
      safeAutoFix: true,
      recommendedAction: "Create deterministic DEV-safe remediation candidates, run impacted tests, revalidate, and retain before/after evidence.",
      productionActionRequired: false,
    }));
  }

  const targetWriteExecuted = textOf(execution).match(/"targetWriteExecuted"\s*:\s*true/i) || textOf(enterprise).match(/"targetWriteExecuted"\s*:\s*true/i);
  const productionActionExecuted = textOf(execution).match(/"productionActionExecuted"\s*:\s*true/i) || textOf(enterprise).match(/"productionActionExecuted"\s*:\s*true/i);
  if (targetWriteExecuted || productionActionExecuted) {
    defects.push(defect({
      title: "Safety invariant violation detected",
      area: "SECURITY_GOVERNANCE",
      severity: "P0_CRITICAL",
      status: "GOVERNED_REVIEW",
      symptom: "Current evidence indicates a target write or production action occurred while DEV-safe mode is expected.",
      probableRootCause: "Execution guardrail or evidence contract may have been bypassed or misreported.",
      businessImpact: "Potential unauthorized production change.",
      evidence: [textOf(execution).slice(0, 500), textOf(evidence).slice(0, 500)].filter(Boolean),
      assignedAgents: ["A000", "A112", "A116"],
      knowledgePacks: ["GLOBAL_BUSINESS_DOMAINS", "QUANTUM_COMPUTING"],
      safeAutoFix: false,
      recommendedAction: "Stop execution, preserve evidence, require security/governance review, and keep production migration disabled.",
      productionActionRequired: true,
    }));
  }

  if (/defect|failure|error|timeout|missing|invalid|duplicate|orphan|referential/i.test(observedText) && defects.length === 0) {
    defects.push(defect({
      title: "Cross-layer defect evidence requires diagnosis",
      area: "ENTERPRISE",
      severity: "P2_MEDIUM",
      status: "DIAGNOSED",
      symptom: "Current business/workflow evidence contains defect-oriented signals.",
      probableRootCause: "Root cause must be ranked across business, application, data, integration, infrastructure, network and security layers.",
      businessImpact: "Readiness or business correctness may be affected.",
      evidence: ["Current governed browser evidence contains defect/failure/error signals"],
      assignedAgents: ["A000", "A102", "A103", "A104", "A108", "A109", "A110", "A111", "A112", "A113"],
      knowledgePacks: a000KnowledgePacks.map((pack) => pack.id),
      safeAutoFix: true,
      recommendedAction: "Generate safe remediation candidates, run impacted tests, compare evidence, and escalate only changes that require authorization.",
      productionActionRequired: false,
    }));
  }

  const activatedAgents = coreAgentRegistry.map((agent) => agent.id);
  const report: AutonomousDefectCycle = {
    id: uid("KMITORA-DEFECT-CYCLE"),
    createdAt: new Date().toISOString(),
    mode: "DEV_SAFE_AUTONOMOUS",
    knowledgePacks: a000KnowledgePacks.map((pack) => ({
      id: pack.id,
      name: pack.name,
      topicCount: pack.topicCount,
      status: pack.status,
      purpose: pack.purpose,
    })),
    totalKnowledgeTopics: a000KnowledgePacks.reduce((total, pack) => total + pack.topicCount, 0),
    requirements,
    defects,
    activatedAgents,
    nextActions: defects.length
      ? [
          "Rank defects by severity, confidence and business impact.",
          "Assign A101-A117 specialists according to capability.",
          "Apply only DEV-safe deterministic remediations automatically.",
          "Run impacted tests and full regression after each repair batch.",
          "Attach defect, root cause, patch evidence and retest evidence.",
        ]
      : ["No current browser-state defect is proven. Continue observation and regression testing."],
    safety: {
      sourceWrites: 0,
      targetProductionWrites: 0,
      productionActions: 0,
      productionMigration: "DISABLED",
      cutover: "DISABLED",
    },
  };

  localStorage.setItem(REPORT_KEY, JSON.stringify(report));
  return report;
}

export function loadAutonomousDefectCycle(): AutonomousDefectCycle | null {
  return readJson<AutonomousDefectCycle>(REPORT_KEY);
}

