export type AssistantMode =
  | "ASK" | "BUILD" | "FIX" | "ANALYZE" | "AUTOMATE" | "SCHEDULE"
  | "MIGRATE" | "TEST" | "OPERATE" | "DOCUMENT" | "RECONCILE";

export type AuthorityLevel = "L0" | "L1" | "L2" | "L3" | "L4" | "L5" | "L6" | "L7";

export type AssistantCapability = {
  id: string;
  group: string;
  name: string;
  purpose: string;
  authority: AuthorityLevel;
  existingReuse?: string;
};

export const ASSISTANT_MODES: { id: AssistantMode; label: string; purpose: string }[] = [
  { id: "ASK", label: "Ask", purpose: "Explain systems, data, business flows, code, evidence and decisions." },
  { id: "BUILD", label: "Build", purpose: "Turn business intent into governed code, schema, API, UI and workflow changes." },
  { id: "FIX", label: "Fix", purpose: "Diagnose defects, generate minimal repairs, build, test and verify." },
  { id: "ANALYZE", label: "Analyze", purpose: "Inspect repositories, databases, files, APIs, jobs, logs and dependencies." },
  { id: "AUTOMATE", label: "Automate", purpose: "Convert repeated operations into reusable governed workflows." },
  { id: "SCHEDULE", label: "Schedule", purpose: "Create recurring, event, dependency and calendar-driven jobs." },
  { id: "MIGRATE", label: "Migrate", purpose: "Plan, simulate, validate, execute and reconcile authorized migrations." },
  { id: "TEST", label: "Test", purpose: "Generate and run unit, integration, regression, data and acceptance tests." },
  { id: "OPERATE", label: "Operate", purpose: "Monitor tasks, jobs, SLA, runtime health, incidents and recovery." },
  { id: "DOCUMENT", label: "Document", purpose: "Generate requirements, architecture, API, runbook and evidence artifacts." },
  { id: "RECONCILE", label: "Reconcile", purpose: "Compare intended and actual results with traceable evidence." },
];

export const AUTHORITY_LEVELS = [
  ["L0", "Explain only"], ["L1", "Inspect authorized context"], ["L2", "Recommend"],
  ["L3", "Generate artifacts / patches"], ["L4", "Simulate"], ["L5", "Execute DEV"],
  ["L6", "Controlled non-production"], ["L7", "Production eligible with policy + approval"],
] as const;

export const ASSISTANT_CAPABILITIES: AssistantCapability[] = [
  { id:"intent", group:"Intent", name:"Business Intent Understanding", purpose:"Convert natural language into objective, scope, constraints and acceptance criteria.", authority:"L1" },
  { id:"requirements", group:"Intent", name:"Requirement Engineering", purpose:"Create structured requirements, acceptance criteria, edge cases and traceability.", authority:"L2" },
  { id:"domain", group:"Context", name:"Domain Intelligence", purpose:"Ground work in industry, business function, terminology and policy context.", authority:"L2", existingReuse:"Domain Intelligence" },
  { id:"workspace", group:"Context", name:"Workspace Context", purpose:"Maintain client, program, app, repo, DB, environment, workflow and evidence context.", authority:"L1" },
  { id:"filesystem", group:"Discovery", name:"File-System Intelligence", purpose:"Inventory authorized directories, files, languages, configs and artifacts.", authority:"L1" },
  { id:"repo", group:"Discovery", name:"Repository Intelligence", purpose:"Map modules, imports, functions, ownership, tests and dependency structure.", authority:"L1" },
  { id:"appflow", group:"Discovery", name:"Application Flow Intelligence", purpose:"Trace UI to API to service to database to integration and response.", authority:"L1" },
  { id:"db", group:"Discovery", name:"Database Intelligence", purpose:"Understand schemas, keys, indexes, procedures, triggers, jobs and relationships.", authority:"L1", existingReuse:"Neural Intelligence / Database" },
  { id:"businessflow", group:"Discovery", name:"Business Flow Reconstruction", purpose:"Recover end-to-end business processes from code, data, workflows and documents.", authority:"L2" },
  { id:"rules", group:"Discovery", name:"Business Rule Mining", purpose:"Extract rules from code, SQL, ETL, documents, configuration and workflow decisions.", authority:"L2" },
  { id:"kg", group:"Context", name:"Enterprise Digital Twin / Knowledge Graph", purpose:"Connect requirements, systems, data, code, jobs, risks and evidence.", authority:"L2", existingReuse:"Digital Twin Graph" },
  { id:"rag", group:"Context", name:"Grounded Multi-Source Retrieval", purpose:"Retrieve from code, DB metadata, docs, logs, tests, workflows and evidence.", authority:"L1" },
  { id:"attachments", group:"Input", name:"Multimodal Attachments", purpose:"Use text documents, code, structured files and image-derived context supplied by the user.", authority:"L1" },
  { id:"mail", group:"Input", name:"Message / Mail Context", purpose:"Use authorized message content as business intent, evidence or task context.", authority:"L1" },
  { id:"impact", group:"Engineering", name:"Change Impact Analysis", purpose:"Determine all affected modules, APIs, DB objects, jobs, tests and downstream systems.", authority:"L2" },
  { id:"dedupe", group:"Engineering", name:"Duplicate Prevention", purpose:"Search existing code, agents, skills, tools, rules and workflows before generating anything.", authority:"L2" },
  { id:"plan", group:"Orchestration", name:"Autonomous Plan + DAG", purpose:"Create dependency-aware tasks, agents, tools, gates, tests and rollback strategy.", authority:"L2", existingReuse:"Workflow & Automation" },
  { id:"routing", group:"Orchestration", name:"A000 Dynamic Specialist Routing", purpose:"Compose domain, architecture, code, data, security, test and evidence specialists.", authority:"L2", existingReuse:"A000 / Agents" },
  { id:"codegen", group:"Engineering", name:"Prompt-to-Code", purpose:"Generate minimal context-aware patches through the configured KMITORA model runtime.", authority:"L3" },
  { id:"dbchange", group:"Engineering", name:"Prompt-to-Database Change", purpose:"Generate schema, SQL, migration and rollback artifacts.", authority:"L3" },
  { id:"apigen", group:"Engineering", name:"Prompt-to-API", purpose:"Generate API contract, route, service, validation and tests.", authority:"L3" },
  { id:"uigen", group:"Engineering", name:"Prompt-to-UI", purpose:"Generate or modify UI components while preserving existing design and behavior.", authority:"L3" },
  { id:"workflow", group:"Automation", name:"Prompt-to-Workflow", purpose:"Create workflows, reusable modules, jobs, dependencies, triggers and evidence steps.", authority:"L3", existingReuse:"Workflow & Automation" },
  { id:"scheduler", group:"Automation", name:"Prompt-to-Schedule", purpose:"Create time, event, file, API, dependency and calendar schedules.", authority:"L3", existingReuse:"Workflow & Automation" },
  { id:"reuse", group:"Automation", name:"Reusable Operation Learning", purpose:"Promote verified repeated task sequences into reusable modules/templates.", authority:"L2" },
  { id:"build", group:"Assurance", name:"Automatic Build", purpose:"Run allowed build commands and collect deterministic output.", authority:"L5" },
  { id:"repair", group:"Assurance", name:"Bounded Build Repair Loop", purpose:"Parse build errors, propose minimal repairs, rebuild and stop after bounded retries.", authority:"L5" },
  { id:"tests", group:"Assurance", name:"Automatic Test Generation / Execution", purpose:"Generate and run impacted unit, integration, regression, API, DB and business-rule tests.", authority:"L5" },
  { id:"simulation", group:"Assurance", name:"Simulation / Dry Run", purpose:"Preview code, data and workflow outcomes before state-changing execution.", authority:"L4" },
  { id:"validation", group:"Assurance", name:"Deterministic Validation Gates", purpose:"Require objective checks before promotion.", authority:"L4" },
  { id:"security", group:"Governance", name:"Security / Policy Gate", purpose:"Check permissions, environment, secrets exposure, destructive actions and approval requirements.", authority:"L4" },
  { id:"approval", group:"Governance", name:"Human Approval", purpose:"Pause state-changing or high-risk actions when policy requires authorization.", authority:"L6", existingReuse:"Approvals" },
  { id:"rollback", group:"Governance", name:"Rollback Planning", purpose:"Prepare reversible change strategy before governed execution.", authority:"L4" },
  { id:"execute", group:"Execution", name:"Governed DEV Execution", purpose:"Execute only authorized actions within configured workspace and environment.", authority:"L5" },
  { id:"reconcile", group:"Assurance", name:"Reconciliation", purpose:"Compare expected and actual outputs, counts, values, relationships and invariants.", authority:"L4", existingReuse:"Reconcile" },
  { id:"evidence", group:"Evidence", name:"Evidence Chain", purpose:"Record prompt, plan, tools, diffs, tests, approvals, result and verification.", authority:"L1", existingReuse:"Evidence" },
  { id:"docs", group:"Evidence", name:"Autonomous Documentation", purpose:"Update requirements, API docs, schema docs, runbooks, change log and release notes.", authority:"L3" },
  { id:"version", group:"Evidence", name:"Change Versioning", purpose:"Track prompt-to-change lineage and task versions.", authority:"L1" },
  { id:"git", group:"Engineering", name:"Git-Aware Operations", purpose:"Inspect branch, diff, status and support governed patch/revert flows.", authority:"L5" },
  { id:"runtime", group:"Operations", name:"Runtime Diagnostics", purpose:"Inspect health, logs and service status to diagnose operational defects.", authority:"L1" },
  { id:"sla", group:"Operations", name:"SLA / Job Operations", purpose:"Track schedules, queues, retries, checkpoints and recovery.", authority:"L2", existingReuse:"Workflow & Automation" },
  { id:"neural", group:"Intelligence", name:"Neural / Predictive Intelligence", purpose:"Use schema, anomaly, workload, failure, RCA and drift intelligence where available.", authority:"L2", existingReuse:"Neural Intelligence" },
  { id:"learning", group:"Learning", name:"Verified Continuous Learning", purpose:"Reuse only validated outcomes, patterns, tests and evidence.", authority:"L2", existingReuse:"Learn" },
  { id:"provider", group:"Platform", name:"KMITORA Model Runtime Adapter", purpose:"Route generative reasoning through a KMITORA-controlled model endpoint; no dependency on external assistant products.", authority:"L2" },
];