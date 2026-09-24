import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, LoaderCircle, RefreshCw, TriangleAlert } from "lucide-react";

import { routeUnifiedAssistantRequest } from "../services/kmitoraUnifiedAssistant";
import { runScenarioCommand } from "../services/kmitoraAssistantScenarioLab";
type ChatTurn = {
  id: string;
  role: "USER" | "ASSISTANT" | "ERROR";
  text: string;
};

type UnknownRecord = Record<string, unknown>;

const A000_BASE = import.meta.env.VITE_API_BASE || "";
const ASSISTANT_RUNTIME = import.meta.env.VITE_ASSISTANT_API_URL || "http://127.0.0.1:8083";
const PAGE_LABELS: Record<string, string> = {
  overview: "Control Tower",
  understand: "Understand",
  discover: "Discover",
  detect: "Detect",
  diagnose: "Diagnose",
  predict: "Predict",
  recommend: "Recommend",
  simulate: "Simulate",
  execute: "Execute",
  test: "Test",
  validate: "Validate",
  reconcile: "Reconcile",
  evidence: "Evidence",
  learn: "Learn",
  transform: "Transform Studio",
  workflowAutomation: "Workflow & Automation",
  neuralIntelligence: "Neural Intelligence",
  domainIntelligence: "Domain Intelligence",
  system: "System Explorer",
  agents: "Agents",
  approvals: "Approvals",
  activity: "Activity",
  digitalTwinGraph: "Digital Twin Graph",
  settings: "Settings",
};

const PAGE_ALIASES: Array<[RegExp, string]> = [
  [/\bunderstand\b/i, "understand"],
  [/\bdiscover\b/i, "discover"],
  [/\bdetect\b/i, "detect"],
  [/\bdiagnose\b/i, "diagnose"],
  [/\bpredict\b/i, "predict"],
  [/\brecommend\b/i, "recommend"],
  [/\bsimulate\b/i, "simulate"],
  [/\bexecute\b|\bmigrate\b/i, "execute"],
  [/\btest\b/i, "test"],
  [/\bvalidate\b/i, "validate"],
  [/\breconcile\b/i, "reconcile"],
  [/\bevidence\b/i, "evidence"],
  [/\blearn\b/i, "learn"],
  [/\btransform\b/i, "transform"],
  [/\bworkflow(?:\s*&\s*automation)?\b/i, "workflowAutomation"],
  [/\bneural(?:\s+intelligence)?\b/i, "neuralIntelligence"],
  [/\bdomain(?:\s+intelligence)?\b/i, "domainIntelligence"],
  [/\bsystem(?:\s+explorer)?\b/i, "system"],
  [/\bagents?\b/i, "agents"],
  [/\bapprovals?\b/i, "approvals"],
  [/\bactivity\b/i, "activity"],
  [/\bdigital\s+twin\b/i, "digitalTwinGraph"],
  [/\bsettings?\b/i, "settings"],
  [/\bcontrol\s+tower\b|\boverview\b/i, "overview"],
];

function pageLabel(page: string | undefined): string {
  const key = text(page) || "overview";
  return PAGE_LABELS[key] ?? key.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function requestedNavigation(message: string): string | null {
  const normalized = text(message);
  if (!/\b(navigate|go|open|take me|switch|move)\b/i.test(normalized)) return null;
  for (const [pattern, page] of PAGE_ALIASES) {
    if (pattern.test(normalized)) return page;
  }
  return null;
}

function isCurrentPageQuestion(message: string): boolean {
  return /\bwhere\s+am\s+i\b/i.test(message)
    || /\bcurrent\s+(page|stage|screen|section)\b/i.test(message)
    || /\bwhat\s+(page|stage|screen|section)\s+am\s+i\b/i.test(message)
    || /\bwhich\s+(page|stage|screen|section)\b/i.test(message);
}

function invalidConversationalReply(value: string): boolean {
  const v = text(value).toLowerCase();
  return !v
    || v === "kmitora"
    || v === "assistant"
    || v === "ok"
    || v === "ready"
    || v === "success"
    || v === "completed";
}

function text(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const candidate = text(value);
    if (candidate) return candidate;
  }
  return "";
}

function extractAssistantReply(value: unknown, depth = 0): string {
  if (depth > 8 || value == null) return "";
  if (typeof value === "string") return text(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = extractAssistantReply(item, depth + 1);
      if (found) return found;
    }
    return "";
  }
  if (typeof value !== "object") return "";

  const obj = value as UnknownRecord;

  // KMITORA A000 responses are envelope based. Always inspect payload first so
  // envelope metadata such as product="KMITORA" is never mistaken for a reply.
  const payload = obj.payload;
  if (payload && typeof payload === "object") {
    const payloadObj = payload as UnknownRecord;
    for (const key of ["reply", "answer", "message", "text", "content", "voice_reply", "summary", "detail"]) {
      const found = extractAssistantReply(payloadObj[key], depth + 1);
      if (found) return found;
    }
    for (const key of ["assistant", "response", "result", "data", "output"]) {
      const found = extractAssistantReply(payloadObj[key], depth + 1);
      if (found) return found;
    }
  }

  // Support non-envelope responses, but only through explicit conversational
  // fields. Do not scan arbitrary object values because product/version/status
  // metadata is not an Assistant answer.
  for (const key of ["reply", "answer", "message", "text", "content", "voice_reply", "summary", "detail"]) {
    const found = extractAssistantReply(obj[key], depth + 1);
    if (found) return found;
  }

  for (const key of ["assistant", "response", "result", "data", "output"]) {
    const found = extractAssistantReply(obj[key], depth + 1);
    if (found) return found;
  }

  return "";
}

function isTelemetryOnly(value: string): boolean {
  const v = text(value).toLowerCase();
  return (
    v.startsWith("current stage:") &&
    v.includes("status:") &&
    v.includes("ready=") &&
    v.includes("total=") &&
    v.includes("confidence=")
  );
}

async function postA000Message(message: string, activePage: string): Promise<string> {
  const response = await fetch(`${A000_BASE}/v1/a000/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, context: { active_page: activePage, lifecycle_stage: activePage, environment: "DEV" } }),
  });
  const body = (await response.json().catch(() => ({}))) as UnknownRecord;
  if (!response.ok) {
    throw new Error(firstText((body.payload as UnknownRecord | undefined)?.message, body.message) || `A000 request failed: ${response.status}`);
  }
  const reply = extractAssistantReply(body);
  if (!reply || reply.toLowerCase() === "kmitora") {
    throw new Error("A000 returned no usable assistant reply payload.");
  }
  return reply;
}

/* KMITORA_GROUNDED_GENERAL_CONVERSATION_V1 */

function relatedQuestionsForPage(activePage: string): string[] {
  const page = pageLabel(activePage);

  const catalog: Record<string, string[]> = {
    understand: [
      "What source and target systems are currently in scope?",
      "What business requirements and rules are active for this migration?",
      "What domain context should KMITORA use before discovery begins?",
    ],
    discover: [
      "What data structures, relationships and dependencies were discovered?",
      "Which records or objects require review before Detect?",
      "What evidence supports the current discovery scope?",
    ],
    detect: [
      "What anomalies, risks or rule violations were detected?",
      "Which findings are blocking lifecycle progression?",
      "What evidence should be inspected before Diagnose?",
    ],
    diagnose: [
      "What are the probable root causes of the detected issues?",
      "What business and technical impact does each issue create?",
      "Which dependencies should be traced before Predict?",
    ],
    predict: [
      "What failures or downstream impacts are predicted?",
      "Which scenarios have the highest migration risk?",
      "What evidence supports each prediction?",
    ],
    recommend: [
      "What governed remediation options are available?",
      "Which recommendations require approval or simulation?",
      "What evidence supports each recommendation?",
    ],
    simulate: [
      "What changed in the simulated outcome?",
      "Did any simulated action introduce new risks?",
      "What must pass before Execute becomes eligible?",
    ],
    execute: [
      "What execution mode is currently active?",
      "Were any target writes performed in this run?",
      "What execution evidence is available for Test and Validate?",
    ],
    test: [
      "Which test suites passed or failed?",
      "What defects remain before validation?",
      "What regression evidence is linked to this execution?",
    ],
    validate: [
      "What records are Ready, Review, Quarantine or Rejected?",
      "What validation rules are currently blocking promotion?",
      "What authoritative evidence supports the readiness result?",
    ],
    reconcile: [
      "Do source and target control totals match?",
      "Which records are mismatched or missing?",
      "What reconciliation evidence is linked to the active execution?",
    ],
    evidence: [
      "What evidence package is available for this migration?",
      "Which approvals, tests and reconciliations are linked?",
      "What trace IDs should be reviewed for auditability?",
    ],
    learn: [
      "What verified outcomes were learned from this run?",
      "Which regression guards were created from validated evidence?",
      "What knowledge can safely be reused in future migrations?",
    ],
  };

  return catalog[activePage] ?? [
    `What is the current objective of the ${page} page?`,
    `What evidence is available on the ${page} page?`,
    `What is the next governed action from ${page}?`,
  ];
}

function groundedProjectExplanation(activePage: string): string {
  const page = pageLabel(activePage);

  return [
    "KMITORA is an autonomous engineering and migration control plane.",
    "Its governed lifecycle is Understand â†’ Discover â†’ Detect â†’ Diagnose â†’ Predict â†’ Recommend â†’ Simulate â†’ Execute â†’ Test â†’ Validate â†’ Reconcile â†’ Evidence â†’ Learn.",
    "A000 acts as the master orchestrator, while specialist intelligence, workflow automation, domain intelligence, neural intelligence, digital-twin evidence and governed tools support each stage.",
    "The current environment is DEV, production mutation remains disabled, and actions that can change state are expected to remain policy- and approval-gated.",
    `You are currently on the ${page} page.`,
  ].join(" ");
}

/* KMITORA_BUSINESS_REQUIREMENT_ASSISTANT_V1 */

function isBusinessRequirementRequest(message: string): boolean {
  return /\b(provide|give|create|draft|generate|show|prepare|write)\b.*\b(business\s+requirement|business\s+requirements|migration\s+requirement|requirements)\b/i.test(message)
    || /^\s*business\s+requirement(s)?\s*$/i.test(message);
}

function businessRequirementTemplate(activePage: string): string {
  const page = pageLabel(activePage);

  return [
    `Business Requirement Template for KMITORA (${page} context):`,
    "1) Business objective: define what must be migrated or transformed and the expected business outcome.",
    "2) Source scope: identify source systems, files, databases, schemas, tables, APIs and data owners.",
    "3) Target scope: identify target platform, schema, entities and required target-state behavior.",
    "4) In-scope entities: list customers, addresses, orders, payments, reference data and any dependent objects.",
    "5) Business rules: define mappings, derivations, effective dating, deduplication, status/reference validation and exception handling.",
    "6) Data-quality rules: mandatory fields, uniqueness, referential integrity, datatype/format rules, valid ranges and allowed values.",
    "7) Historical-data rules: define retention, current-versus-history semantics, valid_from/valid_to and is_current behavior where applicable.",
    "8) Migration behavior: define full load, incremental load, replace-load, sequencing, batching, checkpoints and rerun/idempotency expectations.",
    "9) Exception disposition: define Ready, Review, Quarantine and Rejected handling.",
    "10) Validation criteria: define record counts, business totals, field-level validation, relationship checks and target-state invariants.",
    "11) Reconciliation criteria: define source-to-target counts, keys, aggregates, hashes and mismatch evidence.",
    "12) Governance: DEV-only execution unless explicitly authorized; production mutation and cutover remain disabled by default.",
    "13) Approval requirements: identify which changes or execution levels need human approval.",
    "14) Rollback/recovery: define restart, retry, rollback and partial-write recovery expectations.",
    "15) Evidence requirements: capture migration ID, execution ID, test evidence, validation, reconciliation, approvals and audit trail.",
    "16) Acceptance criteria: specify measurable PASS conditions and explicitly state what constitutes BLOCKED or FAIL.",
    "Example objective: Migrate customer, address, order and payment data from approved source systems to the DEV target while preserving history, preventing duplicates, enforcing business rules, executing only governed READY records, validating and reconciling outcomes, and capturing complete evidence with no production mutation.",
  ].join(" ");
}

function businessRequirementGuidance(message: string, activePage: string): string | null {
  if (!isBusinessRequirementRequest(message)) return null;
  return businessRequirementTemplate(activePage);
}
/* KMITORA_DOMAIN_CONTEXT_AND_PROCESS_EXPLANATION_V1 */

const KMITORA_DOMAIN_CONTEXT_KEY = "kmitora.assistant.domainContext";

type KmitoraDomainContext = {
  domain: string;
  subdomain: string;
  workload: string;
  updatedAt: string;
};

function readAssistantDomainContext(): KmitoraDomainContext | null {
  try {
    const raw = localStorage.getItem(KMITORA_DOMAIN_CONTEXT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<KmitoraDomainContext>;
    const domain = String(parsed.domain ?? "").trim();
    const subdomain = String(parsed.subdomain ?? "").trim();
    const workload = String(parsed.workload ?? "").trim();
    if (!domain && !subdomain && !workload) return null;
    return {
      domain,
      subdomain,
      workload,
      updatedAt: String(parsed.updatedAt ?? ""),
    };
  } catch {
    return null;
  }
}

function saveAssistantDomainContext(context: KmitoraDomainContext): void {
  try {
    localStorage.setItem(KMITORA_DOMAIN_CONTEXT_KEY, JSON.stringify(context));
  } catch {
    // Domain context is useful but must never break the Assistant if browser
    // storage is unavailable.
  }
}

function detectDomainContextStatement(message: string): KmitoraDomainContext | null {
  const q = message.trim().replace(/[â€œâ€"]/g, "").toLowerCase();

  if (
    /\b(this\s+is|domain\s+is|use|context\s+is)\b.*\bbanking\b.*\bkyc\b/.test(q) ||
    /\bbanking\s+kyc\s+(migration|modernization|transformation)\b/.test(q)
  ) {
    return {
      domain: "Banking",
      subdomain: "KYC / AML & Financial Crime",
      workload: "KYC migration",
      updatedAt: new Date().toISOString(),
    };
  }

  if (/\b(this\s+is|domain\s+is|use|context\s+is)\b.*\bbanking\b/.test(q)) {
    return {
      domain: "Banking",
      subdomain: "",
      workload: /\bmigration\b/.test(q) ? "Banking migration" : "Banking",
      updatedAt: new Date().toISOString(),
    };
  }

  return null;
}

function domainContextAcknowledgement(message: string): string | null {
  const detected = detectDomainContextStatement(message);
  if (!detected) return null;

  saveAssistantDomainContext(detected);

  return [
    `Domain context set to ${detected.domain}${detected.subdomain ? ` â€” ${detected.subdomain}` : ""}.`,
    `Workload: ${detected.workload}.`,
    "KMITORA will use this context for subsequent requirement, analysis and explanation requests in this browser session.",
    "For Banking KYC, governed migration analysis should consider customer identity, identifiers, addresses, onboarding/KYC status, KYC refresh lifecycle, source-of-funds/wealth where in scope, AML/financial-crime controls, document/evidence lineage, data quality, effective dating, duplicate/entity resolution, validation and reconciliation.",
    "This context update does not start migration execution. Production mutation remains disabled.",
  ].join(" ");
}

function explainOrderToPayment(activePage: string): string {
  const context = readAssistantDomainContext();
  const contextText = context
    ? ` Active domain context: ${context.domain}${context.subdomain ? ` â€” ${context.subdomain}` : ""}.`
    : "";

  return [
    `Order-to-payment is the governed business flow from an accepted order through payment completion and reconciliation.${contextText}`,
    "1) Order capture: receive the order and identify customer, products/services, quantities, values and contractual terms.",
    "2) Order validation: validate mandatory fields, customer/reference data, duplicates, eligibility and business rules.",
    "3) Dependency and fulfillment processing: confirm parent-child relationships, availability/service readiness and downstream dependencies.",
    "4) Billing/payment obligation: create or identify the invoice, charge, payable amount or payment obligation linked to the order.",
    "5) Payment initiation: create the payment instruction or receive the payment event with the required customer/order/invoice references.",
    "6) Payment validation: validate amount, currency, status, identifiers, payment method, duplicate-payment conditions and applicable controls.",
    "7) Settlement/status completion: record authorized/settled/failed/reversed status according to the source and target business semantics.",
    "8) Referential integrity: ensure every payment is linked to the correct order/customer and no orphan or duplicate relationships are introduced.",
    "9) Reconciliation: compare order/invoice/payment counts, keys, amounts, statuses and control totals between source and target.",
    "10) Exception handling: route ambiguous or invalid records to Review, Quarantine or Rejected instead of silently loading them.",
    "11) Evidence: retain migration ID, execution ID, transformations, tests, validation, reconciliation and approvals for auditability.",
    `In KMITORA this maps across Understand â†’ Discover â†’ Detect â†’ Diagnose â†’ Predict â†’ Recommend â†’ Simulate â†’ Execute â†’ Test â†’ Validate â†’ Reconcile â†’ Evidence â†’ Learn. Current page: ${pageLabel(activePage)}.`,
    "Production mutation remains disabled.",
  ].join(" ");
}

function explainBankingKycMigration(activePage: string): string {
  return [
    "Banking KYC migration moves governed customer-identification and due-diligence data from source systems to a target platform while preserving regulatory/business semantics and evidence.",
    "Typical scope includes customer/party identity, identifiers, addresses and contact history, KYC status, onboarding and refresh dates, customer risk classifications, verification documents and references, beneficial-owner/relationship data where applicable, and source-of-funds/source-of-wealth attributes when they are in scope.",
    "KMITORA should first understand the banking/KYC requirements, discover structures and relationships, detect duplicates/missing/invalid or stale KYC data, diagnose root causes, simulate transformations, execute only authorized DEV-ready records, test business rules, validate target state, reconcile source-to-target results and capture evidence.",
    "Entity resolution is particularly important because multiple customer/party records must not be destructively merged without deterministic matching evidence and governance.",
    `Current page: ${pageLabel(activePage)}. Production mutation remains disabled.`,
  ].join(" ");
}

function domainSpecificBusinessRequirement(activePage: string): string | null {
  const context = readAssistantDomainContext();
  if (!context || context.domain !== "Banking" || !/kyc/i.test(`${context.subdomain} ${context.workload}`)) {
    return null;
  }

  return [
    `Banking KYC Migration Business Requirement (${pageLabel(activePage)} context):`,
    "Objective: migrate governed KYC/customer due-diligence data to the DEV target while preserving identity, history, relationships, controls and audit evidence.",
    "Source scope: approved customer/party, KYC, address/contact, document/reference, risk and relationship sources.",
    "Target scope: approved DEV banking/KYC target entities and mappings only.",
    "Core entities: customer/party, identifiers, addresses, contacts, KYC profile/status, verification documents, relationships/beneficial ownership where applicable, risk attributes and controlled reference data.",
    "Key rules: preserve effective-dated history; resolve duplicates through governed entity-resolution rules; prevent orphan relationships; retain source lineage; validate mandatory identity/KYC fields; do not silently overwrite conflicting current-state records.",
    "KYC lifecycle: preserve onboarding status, review/refresh dates and current versus historical KYC state according to approved business rules.",
    "Disposition: READY records are eligible for governed DEV execution; ambiguous/conflicting records go to REVIEW; suspicious/unsafe records may be QUARANTINED; invalid non-remediable records are REJECTED.",
    "Validation: verify record counts, mandatory attributes, identifiers, reference values, dates, relationships, duplicate rules, effective dating and target invariants.",
    "Reconciliation: compare source/target keys, counts, statuses, relationships, selected field values/control totals and all exception populations.",
    "Evidence: capture migration ID, execution ID, mappings, transformations, tests, validation, reconciliation, approvals and traceable source lineage.",
    "Acceptance: no unauthorized records loaded; no false reconciliation PASS; no unintended duplicate customer/party creation; all source records accounted for; all exceptions evidenced; production mutation remains disabled.",
  ].join(" ");
}

function domainAwareConversation(message: string, activePage: string): string | null {
  const contextAck = domainContextAcknowledgement(message);
  if (contextAck) return contextAck;

  if (/\b(explain|describe|what\s+is)\b.*\border[\s-]*to[\s-]*payment\b/i.test(message)) {
    return explainOrderToPayment(activePage);
  }

  if (/\b(explain|describe|what\s+is)\b.*\b(banking\s+)?kyc\b.*\b(migration|flow|process)?\b/i.test(message)) {
    return explainBankingKycMigration(activePage);
  }

  if (
    /\b(provide|give|create|draft|generate|show|prepare|write)\b.*\b(business\s+requirement|business\s+requirements|migration\s+requirement|requirements)\b/i.test(message) ||
    /^\s*business\s+requirement(s)?\s*$/i.test(message)
  ) {
    const requirement = domainSpecificBusinessRequirement(activePage);
    if (requirement) return requirement;
  }

  if (/\b(what|show|current)\b.*\bdomain\s+context\b/i.test(message)) {
    const context = readAssistantDomainContext();
    if (!context) {
      return "No explicit Assistant domain context is currently stored. You can set one with a statement such as: This is banking KYC migration.";
    }
    return `Current Assistant domain context: ${context.domain}${context.subdomain ? ` â€” ${context.subdomain}` : ""}. Workload: ${context.workload}.`;
  }

  if (/\b(clear|reset|remove)\b.*\bdomain\s+context\b/i.test(message)) {
    try {
      localStorage.removeItem(KMITORA_DOMAIN_CONTEXT_KEY);
    } catch {
      // No-op.
    }
    return "Assistant domain context cleared. No migration execution was started.";
  }

  return null;
}
/* KMITORA_HIDDEN_ADDRESS_RULES_V1 */

function hiddenAddressRulesReply(activePage: string): string {
  return [
    `Hidden / derived address rules KMITORA should inspect in ${pageLabel(activePage)} context:`,
    "1) Permanent-address history: preserve multiple permanent addresses by effective date; never overwrite distinct historical records.",
    "2) Temporary-current rule: a temporary address can be current only while its effective period is active.",
    "3) Communication-address switch: when communication address changes from X to Y, retain X as history and make Y current only according to approved effective-date rules.",
    "4) Future-dated address: retain the record but do not mark it current before its valid-from date.",
    "5) Overlap detection: overlapping temporary/current address periods are ambiguous and should be routed to REVIEW unless a deterministic precedence rule exists.",
    "6) Missing end date: treat an open-ended address as current only when the approved business rule permits it; do not infer current state blindly.",
    "7) Same-day changes: resolve multiple address changes on the same day using governed timestamp, sequence or source-priority rules.",
    "8) Duplicate rows: deduplicate exact repeated address-history rows while preserving genuinely distinct history.",
    "9) Cross-format history: assemble one logical address timeline even when records are distributed across CSV, XML and TXT sources.",
    "10) SCD Type-2 semantics: preserve valid_from, valid_to, is_current and source-lineage attributes for history-capable targets.",
    "11) Current-state uniqueness: where the business rule requires it, enforce at most one current communication address per customer.",
    "12) Parent integrity: every address must resolve to a valid customer/party record before READY status.",
    "13) Normalization before duplicate comparison: compare canonicalized address values so formatting differences do not create false uniqueness.",
    "14) Conflict disposition: ambiguous, overlapping or weakly matched records should not be silently migrated; use REVIEW/QUARANTINE according to governance.",
    "15) Reconciliation: prove both history preservation and current-state correctness, not only row-count equality.",
    "These are deterministic KMITORA address-history rules/scenarios; they are not evidence that the current source data actually violates them. Actual violations require source discovery and record-level evidence.",
    "Production mutation remains disabled.",
  ].join(" ");
}

function addressRuleConversation(message: string, activePage: string): string | null {
  if (
    /\b(find|show|explain|identify|discover|detect)\b.*\b(hidden|implicit|derived|unwritten)?\s*address\s+rules?\b/i.test(message) ||
    /\baddress\s+rules?\b.*\b(hidden|implicit|derived|unwritten)\b/i.test(message)
  ) {
    return hiddenAddressRulesReply(activePage);
  }

  return null;
}
function deterministicGeneralConversation(message: string, activePage: string): string | null {
  const addressRuleReply = addressRuleConversation(message, activePage);
  if (addressRuleReply) {
    return addressRuleReply;
  }
  const domainAwareReply = domainAwareConversation(message, activePage);
  if (domainAwareReply) {
    return domainAwareReply;
  }
  const businessRequirementReply = businessRequirementGuidance(message, activePage);
  if (businessRequirementReply) {
    return businessRequirementReply;
  }
  if (
    /\bask\s+(me\s+)?(three|3)\s+(related|relevant|follow[- ]?up)\s+questions?\b/i.test(message) ||
    /\bgive\s+(me\s+)?(three|3)\s+(related|relevant|follow[- ]?up)\s+questions?\b/i.test(message)
  ) {
    const questions = relatedQuestionsForPage(activePage);
    return `Here are 3 related questions for ${pageLabel(activePage)}: 1) ${questions[0]} 2) ${questions[1]} 3) ${questions[2]}`;
  }

  if (
    /\bexplain\s+(this\s+)?project\b/i.test(message) ||
    /\bwhat\s+is\s+kmitora\b/i.test(message) ||
    /\bdescribe\s+kmitora\b/i.test(message)
  ) {
    return groundedProjectExplanation(activePage);
  }

  if (/\bwhat\s+can\s+you\s+do\b|\bcapabilities\b|\bhelp\s+me\b/i.test(message)) {
    return [
      "I can provide page-aware guidance, navigate KMITORA, report runtime status, explain the KMITORA project, generate stage-related questions, and route governed Analyze/Build/Fix/Automate work through the KMITORA Assistant runtime.",
      "General free-form generative answers require the KMITORA model runtime to be configured.",
      "Production mutation remains disabled.",
    ].join(" ");
  }

  if (/\bwhat\s+next\b|\bnext\s+step\b|\bwhat\s+should\s+i\s+do\s+next\b/i.test(message)) {
    const questions = relatedQuestionsForPage(activePage);
    return `Current page: ${pageLabel(activePage)}. A useful next step is to inspect the page evidence and ask: ${questions[0]}`;
  }

  return null;
}
/* KMITORA_WORKSPACE_ANALYSIS_V1 */

type WorkspaceContextPayload = {
  root?: string;
  counts?: {
    files?: number;
    code_files?: number;
    directories?: number;
  };
  languages?: Record<string, number>;
  sample_files?: string[];
  model_runtime?: string;
  production_mutation?: boolean;
};

async function readWorkspaceContext(): Promise<WorkspaceContextPayload> {
  const response = await fetch(`${ASSISTANT_RUNTIME}/v1/assistant/context`);
  if (!response.ok) {
    throw new Error(`Workspace context failed: ${response.status}`);
  }
  return (await response.json()) as WorkspaceContextPayload;
}

function isWorkspaceAnalysisRequest(message: string): boolean {
  return /\b(analy[sz]e|inspect|understand|scan|review)\b.*\b(workspace|codebase|repository|repo|project|source code)\b/i.test(message)
    || /\b(understand|analy[sz]e)\s+(the\s+)?complete\s+codebase\b/i.test(message);
}

function isMigrationFilesRequest(message: string): boolean {
  return /\bwhat\s+files?\b.*\b(implement|handle|contain|support)\b.*\bmigrat/i.test(message)
    || /\bwhich\s+files?\b.*\bmigrat/i.test(message)
    || /\bmigration\s+files?\b/i.test(message);
}

function formatTopLanguages(languages: Record<string, number> | undefined): string {
  if (!languages) return "not available";
  const rows = Object.entries(languages)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([ext, count]) => `${ext || "(none)"}=${count}`);
  return rows.length ? rows.join(", ") : "not available";
}

function selectMigrationFiles(files: string[] | undefined): string[] {
  if (!files?.length) return [];

  const scored = files
    .map((file) => {
      const f = file.toLowerCase();
      let score = 0;
      if (/\bmigrat/.test(f)) score += 8;
      if (f.includes("reconcile")) score += 5;
      if (f.includes("validate")) score += 4;
      if (f.includes("transform")) score += 4;
      if (f.includes("discover")) score += 3;
      if (f.includes("execute")) score += 3;
      if (f.includes("target")) score += 2;
      if (f.includes("source")) score += 2;
      if (f.includes("api")) score += 1;
      return { file, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.file.localeCompare(b.file))
    .slice(0, 15)
    .map((x) => x.file);

  return scored;
}

async function workspaceAwareReply(message: string): Promise<string | null> {
  if (!isWorkspaceAnalysisRequest(message) && !isMigrationFilesRequest(message)) {
    return null;
  }

  const context = await readWorkspaceContext();
  const fileCount = context.counts?.files ?? 0;
  const codeFileCount = context.counts?.code_files ?? 0;
  const directoryCount = context.counts?.directories ?? 0;
  const root = context.root ?? "KMITORA workspace";
  const model = context.model_runtime ?? "UNKNOWN";

  if (isMigrationFilesRequest(message)) {
    const migrationFiles = selectMigrationFiles(context.sample_files);

    if (!migrationFiles.length) {
      return `I inspected the current KMITORA workspace index at ${root}. The runtime currently exposes a bounded sample of workspace files, but none of the sampled paths were specific enough to identify migration implementation files with confidence. Use the full repository-analysis path before claiming exact file ownership. Model runtime: ${model}.`;
    }

    return [
      `From the current KMITORA workspace index, these sampled files are the strongest migration-related candidates:`,
      ...migrationFiles.map((file, index) => `${index + 1}) ${file}`),
      `This list is based on the runtime's sampled workspace index, not a complete semantic code scan.`,
    ].join(" ");
  }

  const sample = (context.sample_files ?? []).slice(0, 12);
  return [
    `Current KMITORA workspace: ${root}.`,
    `Indexed scope: ${fileCount} files, ${codeFileCount} code/text files, ${directoryCount} directories.`,
    `Top file extensions: ${formatTopLanguages(context.languages)}.`,
    sample.length ? `Sample indexed files: ${sample.join(", ")}.` : "No sample files were returned.",
    `Model runtime: ${model}.`,
    "This is a deterministic workspace inventory from the Assistant runtime. A complete semantic understanding of every source file requires the KMITORA model/runtime analysis layer to be configured or a deeper deterministic repository index to be added.",
  ].join(" ");
}
async function readRuntimeFallback(message: string): Promise<string> {
  const [healthResponse, contextResponse] = await Promise.all([
    fetch(`${ASSISTANT_RUNTIME}/health`),
    fetch(`${ASSISTANT_RUNTIME}/v1/assistant/context`),
  ]);
  if (!healthResponse.ok || !contextResponse.ok) {
    throw new Error("KMITORA Assistant runtime is unavailable.");
  }
  const health = (await healthResponse.json()) as UnknownRecord;
  const context = (await contextResponse.json()) as UnknownRecord;

  const lower = message.toLowerCase();
  if (/status|health|working|current system/.test(lower)) {
    const runtimeStatus = firstText(health.status, "UNKNOWN");
    const mode = firstText(health.mode, "DEV");
    const workspace = firstText(health.workspace, context.workspace, "KMITORA workspace");
    const model = firstText(health.model_runtime, "UNKNOWN");
    return `KMITORA Assistant runtime is ${runtimeStatus} in ${mode}. Workspace: ${workspace}. Model runtime: ${model}. Production mutation remains disabled.`;
  }

  return "KMITORA received the request, but the A000 conversational endpoint did not return a usable reply. The Assistant runtime is online; use Analyze/Build/Fix modes for governed task planning while A000 conversational response is being restored.";
}

async function askKmitora(message: string, activePage: string): Promise<string> {
  const navigation = requestedNavigation(message);

  if (navigation) {
    window.dispatchEvent(
      new CustomEvent("kmitora:navigate", {
        detail: { page: navigation },
      }),
    );
    return `Navigated to ${pageLabel(navigation)}. The Assistant context is now aligned to that page.`;
  }

  if (isCurrentPageQuestion(message)) {
    return `You are currently on the ${pageLabel(activePage)} page. Active page key: ${activePage}. Environment: DEV.`;
  }

  const scenarioReply = await runScenarioCommand(message);
  if (scenarioReply) {
    return scenarioReply;
  }
  const deterministicReply = deterministicGeneralConversation(message, activePage);
  if (deterministicReply) {
    return deterministicReply;
  }

  try {
    const workspaceReply = await workspaceAwareReply(message);
    if (workspaceReply) {
      return workspaceReply;
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : "workspace context unavailable";
    return `KMITORA could not inspect the current workspace because ${reason}. The Assistant runtime must be available on port 8083. Production mutation remains disabled.`;
  }

  try {
    const unifiedReply = await routeUnifiedAssistantRequest(message, {
      activePage,
      environment: "DEV",
    });
    if (unifiedReply) {
      return unifiedReply;
    }
    const reply = await postA000Message(message, activePage);
    if (isTelemetryOnly(reply) || invalidConversationalReply(reply)) {
      return await readRuntimeFallback(message);
    }
    return reply;
  } catch {
    return await readRuntimeFallback(message);
  }
}

function extractQuestionFromQuickAction(label: string): string {
  const normalized = text(label);
  const quote = normalized.match(/Ask\s+[â€œ\"'](.+?)[â€\"']/i);
  if (quote?.[1]) return quote[1].trim();
  if (/^open assistant$/i.test(normalized)) return "Open Assistant";
  return "";
}

export default function AssistantLiveResponseBridge() {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [activePage, setActivePage] = useState(() =>
    localStorage.getItem("kmitora.ui.activePage") || "overview",
  );

  useEffect(() => {
    const handlePageContext = (event: Event) => {
      const detail = (event as CustomEvent<{ page?: string }>).detail;
      const page = text(detail?.page);
      if (page) setActivePage(page);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === "kmitora.ui.activePage" && event.newValue) {
        setActivePage(event.newValue);
      }
    };

    window.addEventListener("kmitora:page-context", handlePageContext as EventListener);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("kmitora:page-context", handlePageContext as EventListener);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);
  const lastSentRef = useRef<{ value: string; at: number }>({ value: "", at: 0 });

  const latestAssistant = useMemo(
    () => [...turns].reverse().find((turn) => turn.role === "ASSISTANT"),
    [turns],
  );

  async function submit(message: string) {
    const prompt = text(message);
    if (!prompt || busy) return;
    const now = Date.now();
    if (lastSentRef.current.value === prompt && now - lastSentRef.current.at < 2000) return;
    lastSentRef.current = { value: prompt, at: now };

    setBusy(true);
    setLastError("");
    setTurns((current) => [...current, { id: `u-${now}`, role: "USER", text: prompt }]);
    try {
      const reply = await askKmitora(prompt, activePage);
      setTurns((current) => [...current, { id: `a-${Date.now()}`, role: "ASSISTANT", text: reply }]);
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "KMITORA Assistant request failed.";
      setLastError(messageText);
      setTurns((current) => [...current, { id: `e-${Date.now()}`, role: "ERROR", text: messageText }]);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const root = rootRef.current?.closest("aside.copilot") as HTMLElement | null;
    if (!root) return;

    function inputValue(): string {
      const composer = root.querySelector<HTMLElement>(".chatInput, .copilotInputRow") ?? root;
      const field = composer.querySelector<HTMLInputElement | HTMLTextAreaElement>("input, textarea");
      return field ? field.value : "";
    }

    function onClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      const button = target?.closest("button") as HTMLButtonElement | null;
      if (!button || rootRef.current?.contains(button)) return;

      const label = firstText(button.getAttribute("aria-label"), button.getAttribute("title"), button.textContent);
      const quickQuestion = extractQuestionFromQuickAction(label);
      if (quickQuestion === "Open Assistant") {
        void submit("What is current system status?");
        return;
      }
      if (quickQuestion) {
        void submit(quickQuestion);
        return;
      }

      const lower = label.toLowerCase();
      const isAttachment = /attach|paperclip|file|upload/.test(lower);
      const isSend = /send|submit|ask/.test(lower) || button.matches('[type="submit"]');
      if (isSend && !isAttachment) {
        const value = inputValue();
        if (value.trim()) void submit(value);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
      if (!root.contains(target)) return;
      if (event.key === "Enter" && !event.shiftKey) {
        const value = target.value;
        if (value.trim()) void submit(value);
      }
    }

    root.addEventListener("click", onClick, true);
    root.addEventListener("keydown", onKeyDown, true);
    return () => {
      root.removeEventListener("click", onClick, true);
      root.removeEventListener("keydown", onKeyDown, true);
    };
  });

  return (
    <div className="kmitoraLiveResponseBridge" data-kmitora-live-chat="1" ref={rootRef}>
      <div className="kmitoraLiveResponseHeader">
        <div><Bot size={14} /><strong>KMITORA Assistant</strong></div>
        <span>{busy ? "THINKING" : "READY"}</span>
      </div>

      {turns.length === 0 && (
        <div className="kmitoraLiveResponseEmpty">
          Assistant replies will appear here. Existing attachments and composer controls remain unchanged.
        </div>
      )}

      {turns.slice(-8).map((turn) => (
        <div key={turn.id} className={`kmitoraLiveTurn ${turn.role.toLowerCase()}`}>
          <b>{turn.role === "USER" ? "You" : turn.role === "ASSISTANT" ? "KMITORA" : "Runtime"}</b>
          <span>{turn.text}</span>
        </div>
      ))}

      {busy && (
        <div className="kmitoraLiveBusy"><LoaderCircle size={13} /> KMITORA is processing the request...</div>
      )}

      {lastError && (
        <div className="kmitoraLiveError"><TriangleAlert size={13} /> {lastError}</div>
      )}

      {latestAssistant && (
        <button type="button" className="kmitoraLiveRetry" onClick={() => void submit("What is current system status?")}>
          <RefreshCw size={12} /> Refresh status
        </button>
      )}
    </div>
  );
}
