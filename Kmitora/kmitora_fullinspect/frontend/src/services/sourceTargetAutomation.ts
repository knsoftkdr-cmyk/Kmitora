import type { MigrationSystem } from "../models/MigrationTopology";
import type { ModuleSummary, SourceTargetObject } from "../models/SourceTargetAutomation";

const MODULE_RULES: Array<{ module: string; terms: string[] }> = [
  { module: "CUSTOMER", terms: ["customer", "client", "party", "kyc", "address", "contact"] },
  { module: "ACCOUNTS", terms: ["account", "balance", "holder", "ledger"] },
  { module: "PAYMENTS", terms: ["payment", "beneficiary", "swift", "iso20022", "transfer"] },
  { module: "TRANSACTIONS", terms: ["transaction", "txn", "journal"] },
  { module: "CARDS", terms: ["card", "authorization", "merchant", "settlement"] },
  { module: "LOANS", terms: ["loan", "mortgage", "collateral", "schedule"] },
  { module: "TREASURY", terms: ["treasury", "fx", "security", "liquidity"] },
  { module: "RISK", terms: ["risk", "aml", "fraud", "sanction"] },
  { module: "FINANCE", terms: ["finance", "gl", "general ledger", "invoice"] },
];

function inferModule(system: MigrationSystem) {
  const text = `${system.name} ${system.pattern ?? ""} ${system.path ?? ""}`.toLowerCase();
  for (const rule of MODULE_RULES) {
    if (rule.terms.some((term) => text.includes(term))) return rule.module;
  }
  return system.role === "SOURCE" ? "SOURCE OTHER" : "TARGET OTHER";
}

function inferSchema(system: MigrationSystem) {
  if (system.category === "DATABASE") return "DEFAULT";
  if (system.category === "FILE") return system.path?.split("\\").filter(Boolean).slice(-1)[0] || "FILES";
  return system.category || "GENERAL";
}

function inferKind(system: MigrationSystem): SourceTargetObject["kind"] {
  if (system.pattern) return "FILE";
  if (system.category === "DATABASE") return "TABLE";
  if (system.category === "API") return "API";
  return "OBJECT";
}

function inferStatus(system: MigrationSystem): SourceTargetObject["status"] {
  if (system.status === "VALIDATED") return "READY";
  if (system.status === "FAILED") return "BLOCKED";
  if (system.status === "CONFIGURED") return "REVIEW";
  return "UNANALYZED";
}

export function buildAutomationObjects(
  sources: MigrationSystem[],
  targets: MigrationSystem[]
): SourceTargetObject[] {
  return [...sources, ...targets].map((system) => {
    const status = inferStatus(system);
    const name = system.pattern || system.name;
    const text = `${name} ${system.name}`.toLowerCase();

    return {
      id: `${system.id}::${name}`,
      systemId: system.id,
      role: system.role,
      module: inferModule(system),
      schema: inferSchema(system),
      name,
      kind: inferKind(system),
      connector: system.connector,
      status,
      selected: false,
      imported: status === "READY",
      qualityScore: status === "READY" ? 95 : undefined,
      readinessScore: status === "READY" ? 96 : status === "BLOCKED" ? 0 : 55,
      suggestedReadMode:
        system.role === "SOURCE"
          ? (system.category === "DATABASE" ? "CDC" : /transaction|payment/.test(text) ? "INCREMENTAL" : "FULL")
          : undefined,
      suggestedWriteMode:
        system.role === "TARGET"
          ? (/transaction|fact/.test(text) ? "APPEND" : /customer|account|dimension/.test(text) ? "UPSERT" : "INSERT")
          : undefined,
      confidence: status === "READY" ? 0.96 : 0.72,
    };
  });
}

export function summarizeModules(objects: SourceTargetObject[]): ModuleSummary[] {
  const map = new Map<string, ModuleSummary>();
  for (const object of objects) {
    const current = map.get(object.module) ?? {
      name: object.module,
      sourceObjects: 0,
      targetObjects: 0,
      ready: 0,
      review: 0,
      blocked: 0,
    };
    if (object.role === "SOURCE") current.sourceObjects += 1;
    if (object.role === "TARGET") current.targetObjects += 1;
    if (object.status === "READY") current.ready += 1;
    if (object.status === "REVIEW" || object.status === "UNANALYZED") current.review += 1;
    if (object.status === "BLOCKED") current.blocked += 1;
    map.set(object.module, current);
  }
  return [...map.values()].sort((a,b) =>
    (b.sourceObjects + b.targetObjects) - (a.sourceObjects + a.targetObjects)
  );
}

