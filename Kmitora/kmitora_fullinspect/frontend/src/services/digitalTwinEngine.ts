import { digitalTwinRegistry } from "../config/digitalTwinRegistry";
import type {
  DigitalThreadEvent,
  DigitalTwin,
  DigitalTwinInput,
  DigitalTwinState,
  DigitalTwinType,
  TwinQuality,
  TwinRecommendation,
  TwinScenario,
} from "../models/DigitalTwin";
import type { MigrationSystem } from "../models/MigrationTopology";

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 9)}`;
}

function bounded(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function textOf(input: DigitalTwinInput) {
  return [
    input.problemPrompt ?? "",
    input.migrationPrompt ?? "",
    ...input.knowledgeItems.map((item) => `${item.title} ${item.text ?? ""}`),
    ...input.sources.map((s) => `${s.name} ${s.connector} ${s.category}`),
    ...input.targets.map((s) => `${s.name} ${s.connector} ${s.category}`),
  ].join("\n").toLowerCase();
}

function systemEvidence(systems: MigrationSystem[]) {
  return systems.map((s) => `${s.role}:${s.name}:${s.connector}:${s.status}`);
}

function qualityFor(input: DigitalTwinInput, systems: MigrationSystem[], type: DigitalTwinType): TwinQuality {
  const validated = systems.filter((s) => s.status === "VALIDATED").length;
  const ratio = systems.length ? validated / systems.length : 0;
  const knowledgeBoost = Math.min(18, input.knowledgeItems.length * 2);
  const base = 52 + ratio * 30 + knowledgeBoost;
  const adapterPenalty = ["INFRASTRUCTURE", "NETWORK", "SECURITY", "ASSET", "FACILITY"].includes(type) ? 10 : 0;
  return {
    accuracy: bounded(base - adapterPenalty),
    completeness: bounded(base - 4 - adapterPenalty),
    timeliness: bounded(70 + ratio * 20),
    consistency: bounded(base - 2),
    fidelity: bounded(base - adapterPenalty),
    synchronizationAccuracy: bounded(type === "MIGRATION" || type === "TARGET_PREVIEW" ? 75 + ratio * 15 : 62 + ratio * 20 - adapterPenalty),
    confidence: bounded(base - 3 - adapterPenalty),
  };
}

function nodesForSystems(systems: MigrationSystem[]) {
  return systems.map((system) => ({
    id: system.id,
    label: system.name,
    kind: system.category,
    sourceSystemId: system.role === "SOURCE" ? system.id : undefined,
    targetSystemId: system.role === "TARGET" ? system.id : undefined,
    state: system.status,
    metadata: {
      connector: system.connector,
      metadataAccessible: system.metadataAccessible,
      readPermissionValidated: system.readPermissionValidated,
      writePermissionValidated: system.writePermissionValidated,
    },
  }));
}

function twinStatus(type: DigitalTwinType, signalText: string, systems: MigrationSystem[]) {
  const definition = digitalTwinRegistry.find((d) => d.type === type);
  if (!definition) return "PLANNED" as const;
  const signal = definition.alwaysAvailable || definition.activationSignals.some((s) => signalText.includes(s));
  if (!signal) return "NOT_APPLICABLE" as const;
  if (["INFRASTRUCTURE", "NETWORK", "SECURITY", "ASSET", "FACILITY"].includes(type)) {
    return systems.some((s) => s.status === "VALIDATED") ? "ADAPTER_REQUIRED" as const : "PLANNED" as const;
  }
  return systems.some((s) => s.status === "VALIDATED") || definition.alwaysAvailable ? "ACTIVE" as const : "PLANNED" as const;
}

function makeTwin(
  input: DigitalTwinInput,
  type: DigitalTwinType,
  role: DigitalTwin["role"],
  name: string,
  systems: MigrationSystem[],
  purpose: string,
  signalText: string
): DigitalTwin {
  const nodes = nodesForSystems(systems);
  return {
    id: uid(`TWIN-${type}`),
    name,
    type,
    role,
    status: twinStatus(type, signalText, systems),
    purpose,
    systems: systems.map((s) => s.id),
    nodes,
    relationships: nodes.slice(1).map((node) => ({
      id: uid("TREL"),
      from: nodes[0]?.id ?? node.id,
      to: node.id,
      type: "DEPENDS_ON",
      confidence: 70 + Math.min(25, input.knowledgeItems.length),
    })),
    quality: qualityFor(input, systems, type),
    evidence: [
      ...systemEvidence(systems).slice(0, 8),
      ...input.knowledgeItems.slice(-4).map((k) => `Knowledge:${k.title}`),
    ],
    lastSynchronizedAt: new Date().toISOString(),
    readOnly: true,
  };
}

function buildThread(input: DigitalTwinInput): DigitalThreadEvent[] {
  const events: DigitalThreadEvent[] = [];
  const push = (stage: DigitalThreadEvent["stage"], label: string, status: DigitalThreadEvent["status"], confidence: number, evidence: string[]) =>
    events.push({ id: uid("THREAD"), stage, label, status, confidence, evidence });

  if (input.knowledgeItems.length || input.problemPrompt || input.migrationPrompt) {
    push("REQUIREMENT", "Business intent / architecture context captured", "OBSERVED", 92, input.knowledgeItems.slice(-4).map((x) => x.title));
  }
  push("SOURCE", `${input.sources.length} source system(s) represented in F1`, input.sources.some((s) => s.status === "VALIDATED") ? "OBSERVED" : "PLANNED", 90, systemEvidence(input.sources));
  push("RULE", "Business-rule candidates linked to governed knowledge", input.knowledgeItems.length ? "INFERRED" : "PLANNED", input.knowledgeItems.length ? 82 : 55, input.knowledgeItems.slice(-4).map((x) => x.title));
  push("MAPPING", "Source-to-target semantic mapping stage", "PLANNED", 75, []);
  push("TRANSFORMATION", "Cleansing / transformation / enrichment stage", "PLANNED", 76, []);
  push("VALIDATION", "Business + data + target validation stage", "PLANNED", 78, []);
  push("TARGET_PREVIEW", `${input.targets.length} target system(s) represented in F2`, input.targets.some((t) => t.status === "VALIDATED") ? "INFERRED" : "PLANNED", 84, systemEvidence(input.targets));
  push("EXECUTION", "Governed migration execution", "PENDING", 100, ["Target writes are not executed by twin modeling"]);
  push("RECONCILIATION", "Source/target business and technical reconciliation", "PLANNED", 80, []);
  push("EVIDENCE", "Traceable evidence and lineage package", "PLANNED", 90, []);
  return events;
}

function buildScenarios(input: DigitalTwinInput): TwinScenario[] {
  const hasValidatedTopology = input.sources.every((s) => s.status === "VALIDATED") && input.targets.every((t) => t.status === "VALIDATED");
  const status = hasValidatedTopology ? "READY" as const : "ADAPTER_REQUIRED" as const;
  return [
    { id: uid("SCN"), name: "Digital Migration Rehearsal", type: "DIGITAL_REHEARSAL", description: "Rehearse mappings, transformations, validation and expected target outcomes without target writes.", status, expectedChecks: ["Record disposition", "Rule coverage", "Target compatibility", "Reconciliation readiness"], targetWriteRequested: false, productionActionExecuted: false },
    { id: uid("SCN"), name: "Target Capacity Stress", type: "CAPACITY", description: "Estimate sensitivity to volume, concurrency and target throughput constraints.", status: "ADAPTER_REQUIRED", expectedChecks: ["Throughput", "Latency", "Batch size", "Back-pressure"], targetWriteRequested: false, productionActionExecuted: false },
    { id: uid("SCN"), name: "Dependency Failure", type: "FAILURE", description: "Model the effect of source, integration, network or target dependency failures.", status: "ADAPTER_REQUIRED", expectedChecks: ["Retry behavior", "Idempotency", "Recovery", "Data integrity"], targetWriteRequested: false, productionActionExecuted: false },
    { id: uid("SCN"), name: "Business Rule What-If", type: "WHAT_IF", description: "Evaluate how a proposed business-rule change affects eligibility, transformation, exceptions and target preview.", status: input.knowledgeItems.length ? "READY" : "ADAPTER_REQUIRED", expectedChecks: ["Rule impact", "Changed dispositions", "Target preview delta", "Governance"], targetWriteRequested: false, productionActionExecuted: false },
  ];
}

function buildRecommendations(input: DigitalTwinInput): TwinRecommendation[] {
  const text = textOf(input);
  const out: TwinRecommendation[] = [
    { id: uid("REC"), category: "SIMULATE", title: "Rehearse before execution", rationale: "Use the Migration Twin and Future Target Twin to validate expected outcomes before any target write.", confidence: 98, governed: false },
  ];
  if (/duplicate|invalid|missing|null|quality|clean/i.test(text)) out.push({ id: uid("REC"), category: "CLEANSE", title: "Cleanse defects in governed staging", rationale: "Preserve the source and resolve deterministic data-quality issues in the migration working state.", confidence: 91, governed: false });
  if (/legacy|obsolete|technical debt|redesign|modern/i.test(text)) out.push({ id: uid("REC"), category: "REDESIGN", title: "Do not carry obsolete behavior into F2", rationale: "Use F1/F2 comparison to separate business intent from legacy implementation defects.", confidence: 88, governed: true });
  if (/error|defect|issue|failure|problem/i.test(text)) out.push({ id: uid("REC"), category: "FIX", title: "Create a Defect Twin and validate root cause", rationale: "Model symptom, dependencies, root-cause hypotheses, business impact and regression evidence before applying a fix.", confidence: 90, governed: true });
  return out;
}

export function buildEnterpriseDigitalTwin(input: DigitalTwinInput): DigitalTwinState {
  const signalText = textOf(input);
  const allSystems = [...input.sources, ...input.targets];
  const twins: DigitalTwin[] = [];

  const f1 = makeTwin(input, "ENTERPRISE", "AS_IS", "F1 — Current Enterprise Twin", input.sources, "Current-state business and technology representation", signalText);
  const f2 = makeTwin(input, "ENTERPRISE", "TO_BE", "F2 — Future Enterprise Twin", input.targets, "Future-state target representation", signalText);
  const migration = makeTwin(input, "MIGRATION", "TRANSITION", "Migration Twin", allSystems, "Virtual transition model for preview-first migration rehearsal", signalText);
  twins.push(f1, f2, migration);
  twins.push(makeTwin(input, "TARGET_PREVIEW", "TO_BE", "Future Target Preview Twin", input.targets, "Expected target state after governed transformations", signalText));

  for (const definition of digitalTwinRegistry) {
    if (["ENTERPRISE", "MIGRATION", "TARGET_PREVIEW"].includes(definition.type)) continue;
    const role = definition.type === "DEFECT" ? "OPERATIONAL" : "TRANSITION";
    const systems = definition.type === "BUSINESS_PROCESS" || definition.type === "ENVIRONMENT" ? allSystems : allSystems;
    const twin = makeTwin(input, definition.type, role, definition.label, systems, definition.purpose, signalText);
    if (twin.status !== "NOT_APPLICABLE") twins.push(twin);
  }

  return {
    id: uid("DT-STATE"),
    generatedAt: new Date().toISOString(),
    asIsTwinId: f1.id,
    toBeTwinId: f2.id,
    migrationTwinId: migration.id,
    twins,
    digitalThread: buildThread(input),
    scenarios: buildScenarios(input),
    recommendations: buildRecommendations(input),
    intelligenceLoop: ["CONNECT", "DISCOVER", "UNDERSTAND", "TWIN", "DIAGNOSE", "SIMULATE", "PREDICT", "OPTIMIZE", "PLAN", "TRANSFORM", "VALIDATE", "EXECUTE", "OBSERVE", "RECONCILE", "LEARN", "UPDATE_TWIN"],
    safety: {
      readOnlyModeling: true,
      sourceWriteExecuted: false,
      targetWriteExecuted: false,
      productionActionExecuted: false,
      controlActionsGoverned: true,
    },
  };
}


