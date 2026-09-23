import type { MigrationSystem } from "../models/MigrationTopology";
import type {
  A000IntentPlan,
  BusinessRuleCandidate,
  KnowledgeItem,
  KnowledgeSourceType,
} from "../models/KnowledgeContext";

const DOMAIN_PATTERNS: Array<[string, RegExp]> = [
  ["Banking / BFSI", /bank|account|transaction|loan|deposit|card|kyc|aml|ledger/i],
  ["Telecom", /telecom|subscriber|sim|cdr|billing|recharge|network/i],
  ["Construction / EPC", /construction|epc|boq|procurement|vendor|material|project|work order/i],
  ["Healthcare", /patient|hospital|clinical|claim|diagnosis|healthcare/i],
  ["Manufacturing", /manufactur|plant|bom|production order|inventory|shop floor/i],
  ["Retail", /retail|sku|store|cart|order|customer|inventory/i],
  ["Energy / Utilities", /energy|utility|meter|power|oil|gas|grid/i],
  ["Government", /government|citizen|department|scheme|public sector/i],
];

const OPERATION_PATTERNS: Array<[string, RegExp]> = [
  ["DISCOVER", /discover|understand|analy[sz]e|profile/i],
  ["MAP", /map|mapping|match source|target field/i],
  ["CLEANSE", /clean|cleanse|standardize|normaliz|deduplic|trim|invalid/i],
  ["TRANSFORM", /transform|convert|derive|split|merge|aggregate|lookup|enrich/i],
  ["DATA_QUALITY", /quality|completeness|uniqueness|accuracy|consistency/i],
  ["VALIDATE", /validate|validation|verify|check|referential/i],
  ["MIGRATE", /migrate|migration|load|move|write target/i],
  ["RECONCILE", /reconcile|reconciliation|compare|count|checksum|control total/i],
  ["EVIDENCE", /evidence|audit|trace|lineage|proof/i],
  ["OPTIMIZE", /optimi[sz]e|moderni[sz]e|future state|improve/i],
];

function uuid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function detectDomain(text: string) {
  return DOMAIN_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0] ?? "Cross-domain / Enterprise";
}

export function extractOperations(text: string) {
  const found = OPERATION_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
  return found.length ? found : ["DISCOVER", "MAP", "CLEANSE", "TRANSFORM", "VALIDATE", "RECONCILE", "EVIDENCE"];
}

export function extractRuleCandidates(text: string, sourceItemId: string): BusinessRuleCandidate[] {
  const sentences = text
    .split(/\r?\n|(?<=[.!?])\s+/)
    .map((x) => x.trim())
    .filter((x) => x.length >= 12);
  return sentences.slice(0, 50).map((statement, index) => ({
    id: `BR-CAND-${String(index + 1).padStart(3, "0")}`,
    statement,
    sourceItemId,
    confidence: /must|shall|required|reject|quarantine|normalize|validate/i.test(statement) ? 95 : 80,
    status: /must|shall|required/i.test(statement) ? "CANDIDATE" : "REVIEW_REQUIRED",
  }));
}

export function createPromptKnowledgeItem(text: string): KnowledgeItem {
  const id = uuid("KNOW-PROMPT");
  return {
    id,
    sourceType: "PROMPT",
    title: text.slice(0, 80) || "Business prompt",
    text,
    status: "UNDERSTOOD",
    addedAt: new Date().toISOString(),
    confidence: 90,
    extractedRuleCount: extractRuleCandidates(text, id).length,
  };
}

export function classifyKnowledgeFile(file: File): KnowledgeSourceType {
  const name = file.name.toLowerCase();
  if (/business.?rule|requirement|brd|frd/.test(name)) return "BUSINESS_RULES";
  if (/architect|hld|lld|solution/.test(name)) return "ARCHITECTURE_DOCUMENT";
  if (/flow|process|bpmn/.test(name)) return "PROCESS_FLOW";
  if (/mapping|source.?target/.test(name)) return "MAPPING_SPEC";
  if (/transform|etl/.test(name)) return "TRANSFORMATION_SPEC";
  if (/test|uat|case/.test(name)) return "TEST_CASE";
  if (/schema|erd|ddl|model/.test(name)) return "DATA_MODEL";
  if (file.type.startsWith("image/")) return "IMAGE_OR_DIAGRAM";
  if (/swagger|openapi|api/.test(name)) return "API_SPEC";
  if (/\.sql$|\.py$|\.java$|\.cbl$|\.cob$|\.js$|\.ts$/.test(name)) return "CODE";
  return "BUSINESS_DOCUMENT";
}

export async function registerKnowledgeFile(file: File): Promise<KnowledgeItem> {
  const sourceType = classifyKnowledgeFile(file);
  const textLike = file.type.startsWith("text/") || /\.(txt|md|csv|json|xml|sql|yaml|yml)$/i.test(file.name);
  let text: string | undefined;
  if (textLike) {
    text = await file.text();
  }
  return {
    id: uuid("KNOW-FILE"),
    sourceType,
    title: file.name,
    fileName: file.name,
    mimeType: file.type,
    size: file.size,
    text,
    status: text ? "UNDERSTOOD" : "BACKEND_INGESTION_REQUIRED",
    addedAt: new Date().toISOString(),
    confidence: text ? 85 : undefined,
    extractedRuleCount: text ? extractRuleCandidates(text, file.name).length : 0,
  };
}

export function buildMigrationIntentPlan(args: {
  prompt: string;
  sources: MigrationSystem[];
  targets: MigrationSystem[];
  knowledgeItems: KnowledgeItem[];
}): A000IntentPlan {
  const { prompt, sources, targets, knowledgeItems } = args;
  const combined = [prompt, ...knowledgeItems.map((item) => item.text ?? item.title)].join("\n");
  const promptItem = createPromptKnowledgeItem(prompt);
  return {
    id: uuid("A000-PLAN"),
    prompt,
    detectedDomain: detectDomain(combined),
    operations: extractOperations(combined),
    sources: sources.map(({ id, name, connector }) => ({ id, name, connector })),
    targets: targets.map(({ id, name, connector }) => ({ id, name, connector })),
    ruleCandidates: extractRuleCandidates(combined, promptItem.id),
    knowledgeItemCount: knowledgeItems.length,
    confidence: knowledgeItems.length > 0 ? 94 : 82,
    executionPolicy: "PREVIEW_FIRST_GOVERNED",
    targetWriteRequested: false,
    productionActionExecuted: false,
    createdAt: new Date().toISOString(),
  };
}

