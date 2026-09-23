import type { DigitalTwinType } from "../models/DigitalTwin";

export type TwinDefinition = {
  type: DigitalTwinType;
  label: string;
  purpose: string;
  activationSignals: string[];
  alwaysAvailable?: boolean;
};

export const digitalTwinRegistry: TwinDefinition[] = [
  { type: "ENTERPRISE", label: "Enterprise Twin", purpose: "Unified current/future enterprise representation", activationSignals: [], alwaysAvailable: true },
  { type: "BUSINESS_PROCESS", label: "Business Process Twin", purpose: "Business flows, rules, dependencies and operational sequence", activationSignals: ["process", "workflow", "business", "order", "payment", "claim", "project"], alwaysAvailable: true },
  { type: "APPLICATION", label: "Application Twin", purpose: "Applications, modules, APIs, jobs and configuration", activationSignals: ["application", "erp", "crm", "sap", "salesforce", "java", "service"] },
  { type: "DATA", label: "Data Twin", purpose: "Entities, schema, quality, lineage and state", activationSignals: ["data", "table", "file", "schema", "customer", "account"], alwaysAvailable: true },
  { type: "DATABASE", label: "Database Twin", purpose: "Database structures, constraints, workloads and dependencies", activationSignals: ["database", "oracle", "postgres", "sql", "teradata", "db2"] },
  { type: "INTEGRATION", label: "Integration Twin", purpose: "APIs, ETL, messages, events and cross-system dependencies", activationSignals: ["api", "integration", "etl", "kafka", "mq", "message", "event"] },
  { type: "INFRASTRUCTURE", label: "Infrastructure Twin", purpose: "Compute, storage, runtime, cloud and platform dependencies", activationSignals: ["server", "vm", "container", "kubernetes", "storage", "cloud", "infrastructure"] },
  { type: "NETWORK", label: "Network Twin", purpose: "Connectivity paths, latency, gateways, firewalls and network dependencies", activationSignals: ["network", "latency", "timeout", "dns", "firewall", "load balancer", "port"] },
  { type: "SECURITY", label: "Security Twin", purpose: "IAM, roles, secrets, certificates, access and control posture", activationSignals: ["security", "iam", "role", "permission", "certificate", "secret", "vulnerability"] },
  { type: "ENVIRONMENT", label: "Environment Twin", purpose: "DEV/QA/UAT/Pre-Prod/Prod comparison and configuration drift", activationSignals: ["dev", "qa", "uat", "prod", "environment"], alwaysAvailable: true },
  { type: "DEFECT", label: "Defect Twin", purpose: "Living model of symptom, root cause, impact, fix and regression status", activationSignals: ["defect", "issue", "error", "failure", "problem", "duplicate", "orphan"], alwaysAvailable: true },
  { type: "MIGRATION", label: "Migration Twin", purpose: "Virtual migration rehearsal before target writes", activationSignals: [], alwaysAvailable: true },
  { type: "TARGET_PREVIEW", label: "Future Target Twin", purpose: "Preview target state after mappings, rules and transformations", activationSignals: [], alwaysAvailable: true },
  { type: "MIGRATION_WAVE", label: "Migration Wave Twin", purpose: "Wave scope, dependencies, load, expected runtime and reconciliation", activationSignals: ["wave", "batch", "cutover", "cdc"] },
  { type: "ASSET", label: "Asset Twin", purpose: "Physical/enterprise asset condition, lifecycle and performance", activationSignals: ["asset", "machine", "equipment", "vehicle", "device", "meter"] },
  { type: "FACILITY", label: "Facility / BIM Twin", purpose: "Building, plant, facility, BIM and engineering operations", activationSignals: ["building", "bim", "facility", "plant", "hvac", "construction"] },
  { type: "SUPPLY_CHAIN", label: "Supply Chain Twin", purpose: "Supplier, procurement, inventory, warehouse, transport and demand flow", activationSignals: ["supplier", "procurement", "inventory", "warehouse", "logistics", "supply chain"] },
];

