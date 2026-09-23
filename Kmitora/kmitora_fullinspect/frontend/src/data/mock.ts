import type { ActivityEvent, LifecycleStage, MappingRow, ValidationCard } from "../types";

export const stages: LifecycleStage[] = [
  { key: "understand", label: "Understand", progress: 100, status: "complete", summary: "Intent, scope, context and constraints understood" },
  { key: "discover", label: "Discover", progress: 100, status: "complete", summary: "Systems, data, dependencies and metadata discovered" },
  { key: "detect", label: "Detect", progress: 100, status: "complete", summary: "Errors, anomalies, drift and silent failures detected" },
  { key: "diagnose", label: "Diagnose", progress: 100, status: "complete", summary: "Root cause, localization and impact determined" },
  { key: "predict", label: "Predict", progress: 100, status: "complete", summary: "Failure risk and downstream impact predicted" },
  { key: "recommend", label: "Recommend", progress: 100, status: "complete", summary: "Evidence-backed remediation options prepared" },
  { key: "simulate", label: "Simulate", progress: 100, status: "complete", summary: "Dry-run and digital-twin outcomes evaluated" },
  { key: "execute", label: "Execute", progress: 0, status: "blocked", summary: "Governed execution requires explicit permission and approval" },
  { key: "test", label: "Test", progress: 98, status: "active", summary: "Deterministic, integration and regression tests running" },
  { key: "validate", label: "Validate", progress: 97, status: "active", summary: "Technical, business, security and policy outcomes validated" },
  { key: "reconcile", label: "Reconcile", progress: 49, status: "pending", summary: "Expected and actual states reconciled" },
  { key: "evidence", label: "Evidence", progress: 76, status: "active", summary: "Auditable proof, provenance and decisions captured" },
  { key: "learn", label: "Learn", progress: 0, status: "pending", summary: "Verified outcomes promoted into reusable knowledge" },
]

export const activity: ActivityEvent[] = [
  { time: "14:31:08", title: "Source connection validated", severity: "success" },
  { time: "14:31:12", title: "Metadata scan started", severity: "info" },
  { time: "14:31:47", title: "1,284 objects discovered", severity: "success" },
  { time: "14:32:05", title: "342 relationships detected", severity: "success" },
  { time: "14:32:48", title: "18 quality issues discovered", severity: "warning" },
  { time: "14:33:22", title: "Source thumbprint completed", severity: "success" },
  { time: "14:33:26", title: "Target analysis started", severity: "info" }
];

export const mappings: MappingRow[] = [
  { source: "customers.Customer_ID", target: "customer.customer_id", confidence: 100, decision: "ACCEPT", action: "DIRECT_MAP", rule: "BR-001" },
  { source: "customers.Customer_Name", target: "customer.legal_name", confidence: 98, decision: "ACCEPT", action: "DIRECT_MAP" },
  { source: "customers.Email", target: "customer.email", confidence: 99, decision: "ACCEPT", action: "NORMALIZE", rule: "BR-002" },
  { source: "customers.Country", target: "customer.country_code", confidence: 94, decision: "ACCEPT", action: "NORMALIZE", rule: "BR-003" },
  { source: "orders.Status", target: "customer_order.order_status", confidence: 93, decision: "ACCEPT", action: "NORMALIZE", rule: "BR-009" },
  { source: "orders.Customer_ID", target: "customer.customer_id", confidence: 71, decision: "REJECT", action: "RELATIONSHIP_ONLY", rule: "BR-008" }
];

export const validations: ValidationCard[] = [
  {
    id: "V-1842",
    title: "Referential Integrity",
    severity: "HIGH",
    status: "AUTO_REMEDIATED",
    summary: "orders.Customer_ID = C9999 does not exist in customers.",
    evidence: "Record removed from ready set; target write remains prohibited."
  },
  {
    id: "V-1850",
    title: "Email Normalization",
    severity: "LOW",
    status: "PASSED",
    summary: "Email values normalized to lowercase and trimmed.",
    evidence: "All transformed values passed rule validation."
  }
];

