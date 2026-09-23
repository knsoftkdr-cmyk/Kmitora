import type { MigrationSystem } from "../models/MigrationTopology";
import type {
  DiscoveryCoverage,
  EnterpriseDefect,
  EnterpriseIntelligenceInput,
  EnterpriseIntelligenceState,
  EnterpriseLayer,
  SolutionOption,
} from "../models/EnterpriseIntelligence";
import { activateAgentsForProblem, detectEnterpriseDomains } from "./domainIntelligence";

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 9)}`;
}

const layers: EnterpriseLayer[] = [
  "BUSINESS","APPLICATION","DATA","DATABASE","FILE","API_INTEGRATION","INFRASTRUCTURE","SERVER_OS","NETWORK","SECURITY_IAM","HARDWARE_STORAGE","CLOUD_PLATFORM","OBSERVABILITY","CODE_CONFIGURATION","OPERATIONS_SUPPORT","SOURCE_ARCHITECTURE","TARGET_ARCHITECTURE",
];

function systemEvidence(systems: MigrationSystem[]) {
  return systems.map((s) => `${s.role}:${s.name}:${s.connector}:${s.status}`);
}

function buildCoverage(input: EnterpriseIntelligenceInput): DiscoveryCoverage[] {
  const text = [input.problemPrompt, ...input.knowledgeItems.map((x) => `${x.sourceType} ${x.title} ${x.text ?? ""}`)].join("\n");
  const hasDocs = input.knowledgeItems.length > 0;
  const hasValidatedSystems = [...input.sources, ...input.targets].some((s) => s.status === "VALIDATED");
  return layers.map((layer) => {
    const direct =
      (layer === "BUSINESS" && (hasDocs || input.problemPrompt.trim().length > 0)) ||
      (["DATA","DATABASE","FILE","SOURCE_ARCHITECTURE","TARGET_ARCHITECTURE"].includes(layer) && hasValidatedSystems) ||
      (layer === "APPLICATION" && /application|erp|crm|sap|salesforce|system/i.test(text));
    const mentioned = new RegExp(layer.toLowerCase().replaceAll("_", "|"), "i").test(text);
    const status = direct ? "AVAILABLE" : mentioned ? "PLANNED" : "ADAPTER_REQUIRED";
    return {
      layer,
      status,
      evidence: direct ? systemEvidence([...input.sources, ...input.targets]).slice(0, 4) : mentioned ? ["User/document context mentions this layer"] : ["Requires authorized discovery adapter / connector"],
      confidence: direct ? 88 : mentioned ? 72 : 35,
    };
  });
}

function inferDefects(input: EnterpriseIntelligenceInput): EnterpriseDefect[] {
  const text = [input.problemPrompt, ...input.knowledgeItems.map((x) => x.text ?? x.title)].join("\n");
  const defects: EnterpriseDefect[] = [];
  const add = (d: Omit<EnterpriseDefect,"id">) => defects.push({ id: id("DEF"), ...d });

  if (/duplicate|duplicat/i.test(text)) add({ title: "Duplicate business records", layer: "DATA", priority: "P1_HIGH", symptom: "Duplicate records are reported or implied in business data.", probableRootCause: "Mastering, retry, matching, or upstream synchronization logic requires validation.", businessImpact: "Can cause duplicate customers, invoices, transactions or inconsistent reporting.", disposition: "AUTO_SAFE", confidence: 86, evidence: ["Prompt/document mentions duplicates"], recommendedAction: "Profile duplicate keys, simulate deterministic survivorship rules, revalidate relationships, and preserve before/after evidence.", sourceWriteRequired: false, targetWriteRequired: false, productionChangeRequired: false });
  if (/null|missing|mandatory|empty/i.test(text)) add({ title: "Missing mandatory business data", layer: "DATA", priority: "P1_HIGH", symptom: "Required values are missing.", probableRootCause: "Upstream capture, transformation, mapping or source process may be incomplete.", businessImpact: "Records may fail validation or create incomplete target business objects.", disposition: "GOVERNED", confidence: 84, evidence: ["Prompt/document mentions missing data"], recommendedAction: "Trace field lineage, identify authoritative source, enrich only from approved evidence, otherwise quarantine.", sourceWriteRequired: false, targetWriteRequired: false, productionChangeRequired: false });
  if (/slow|latency|timeout|performance|bottleneck/i.test(text)) add({ title: "Performance / latency defect", layer: /network|dns|firewall/i.test(text) ? "NETWORK" : "INFRASTRUCTURE", priority: "P1_HIGH", symptom: "System response or processing latency is affecting business flow.", probableRootCause: "Could originate in queries, application logic, infrastructure, integration retries or network path.", businessImpact: "SLA breach, failed jobs, retries, duplicate processing or user impact.", disposition: "ADVISORY", confidence: 78, evidence: ["Prompt/document mentions performance or timeout"], recommendedAction: "Correlate logs/metrics/traces across application, database, infrastructure and network layers before applying changes.", sourceWriteRequired: false, targetWriteRequired: false, productionChangeRequired: true });
  if (/security|permission|access|certificate|secret|iam|vulnerab/i.test(text)) add({ title: "Security / access-control issue", layer: "SECURITY_IAM", priority: "P0_CRITICAL", symptom: "Security or authorization issue requires review.", probableRootCause: "Identity, policy, certificate, secret or access configuration may be incorrect or outdated.", businessImpact: "Potential confidentiality, integrity, availability or compliance impact.", disposition: "GOVERNED", confidence: 82, evidence: ["Prompt/document mentions security/access"], recommendedAction: "Perform read-only control analysis, identify least-privilege remediation and require authorized security approval before changes.", sourceWriteRequired: false, targetWriteRequired: false, productionChangeRequired: true });
  if (/orphan|referential|foreign key|relationship/i.test(text)) add({ title: "Referential integrity defect", layer: "DATABASE", priority: "P1_HIGH", symptom: "Child records may reference missing/invalid parent business objects.", probableRootCause: "Migration sequencing, source defects, eligibility filtering or master-data synchronization may be inconsistent.", businessImpact: "Broken business flows and invalid target relationships.", disposition: "GOVERNED", confidence: 91, evidence: ["Prompt/document mentions referential relationship"], recommendedAction: "Trace parent/child lineage, preserve blocked records, repair only with authoritative master data, then revalidate.", sourceWriteRequired: false, targetWriteRequired: false, productionChangeRequired: false });
  if (!defects.length && /issue|problem|defect|failure|error|fix|solve/i.test(text)) add({ title: "Enterprise issue requires cross-layer diagnosis", layer: "BUSINESS", priority: "P2_MEDIUM", symptom: input.problemPrompt || "User reported an enterprise-system issue.", probableRootCause: "Not enough evidence yet; deep discovery is required across business, application, data, integration and platform layers.", businessImpact: "Impact must be quantified from business process and operational evidence.", disposition: "ADVISORY", confidence: 60, evidence: ["User requested diagnosis"], recommendedAction: "Run authorized deep discovery, correlate evidence, rank root-cause hypotheses, simulate safe fixes, and escalate governed changes.", sourceWriteRequired: false, targetWriteRequired: false, productionChangeRequired: false });
  return defects;
}

function solutionOptions(defects: EnterpriseDefect[]): SolutionOption[] {
  if (!defects.length) return [{ id: id("SOL"), title: "Continue deep discovery", approach: "FIX_CURRENT", risk: "LOW", speed: "FAST", recommended: true, rationale: "No defect can be proven from the available evidence yet." }];
  return [
    { id: id("SOL"), title: "Correct the current system safely", approach: "FIX_CURRENT", risk: "LOW", speed: "FAST", recommended: true, rationale: "Fix deterministic defects where evidence is strong and changes are reversible/testable." },
    { id: id("SOL"), title: "Apply governed migration transformation", approach: "TRANSFORM_DURING_MIGRATION", risk: "LOW", speed: "MEDIUM", recommended: false, rationale: "Avoid carrying known source defects into the target when the source cannot be changed safely." },
    { id: id("SOL"), title: "Redesign the future-state target", approach: "REDESIGN_TARGET", risk: "MEDIUM", speed: "LONGER_TERM", recommended: false, rationale: "Use modernization where the defect is architectural or the existing pattern should not survive migration." },
  ];
}

export function analyzeEnterpriseIntelligence(input: EnterpriseIntelligenceInput): EnterpriseIntelligenceState {
  const combined = [input.problemPrompt, ...input.knowledgeItems.map((x) => `${x.title} ${x.text ?? ""}`), ...systemEvidence([...input.sources, ...input.targets])].join("\n");
  const domainMatches = detectEnterpriseDomains(combined);
  const defects = inferDefects(input);
  const coverage = buildCoverage(input);
  const agents = activateAgentsForProblem(combined, domainMatches);
  return {
    id: id("A000-ENT"),
    problemPrompt: input.problemPrompt,
    domainMatches,
    primaryDomain: domainMatches[0]?.name ?? "Cross-domain / Enterprise",
    coverage,
    activatedAgents: agents,
    defects,
    solutionOptions: solutionOptions(defects),
    canonicalFlow: ["Entity","Relationship","Business Rule","Transformation","Target Entity","Validation","Reconciliation"],
    businessUnderstandingConfidence: Math.min(97, 58 + Math.min(20, input.knowledgeItems.length * 3) + Math.min(15, [...input.sources, ...input.targets].filter((s) => s.status === "VALIDATED").length * 4)),
    safety: {
      readOnlyDiscovery: true,
      sourceWriteExecuted: false,
      targetWriteExecuted: false,
      productionActionExecuted: false,
      governedChangesRequired: defects.some((d) => d.disposition === "GOVERNED" || d.productionChangeRequired),
    },
    createdAt: new Date().toISOString(),
  };
}

