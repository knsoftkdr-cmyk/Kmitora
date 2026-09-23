export type WorkflowStatus =
  | "DRAFT"
  | "READY"
  | "SCHEDULED"
  | "QUEUED"
  | "RUNNING"
  | "WAITING"
  | "WAITING_APPROVAL"
  | "PAUSED"
  | "RETRYING"
  | "COMPLETED"
  | "PARTIAL_SUCCESS"
  | "FAILED"
  | "BLOCKED"
  | "CANCELLED";

export type TriggerType =
  | "MANUAL"
  | "SCHEDULE"
  | "EVENT"
  | "DEPENDENCY"
  | "FILE_ARRIVAL"
  | "DATABASE_CHANGE"
  | "API"
  | "APPROVAL"
  | "THRESHOLD";

export type NodeType =
  | "SOURCE"
  | "TARGET"
  | "DISCOVER"
  | "DETECT"
  | "DIAGNOSE"
  | "PREDICT"
  | "RECOMMEND"
  | "SIMULATE"
  | "APPROVAL"
  | "EXECUTE"
  | "TEST"
  | "VALIDATE"
  | "RECONCILE"
  | "EVIDENCE"
  | "LEARN"
  | "TRANSFORM"
  | "MAPPING"
  | "MAPPLET"
  | "WORKLET"
  | "BATCH"
  | "DECISION"
  | "PARALLEL"
  | "JOIN"
  | "LOOP"
  | "WAIT"
  | "TIMER"
  | "EVENT"
  | "SQL"
  | "API"
  | "FILE"
  | "SCRIPT"
  | "AGENT"
  | "NOTIFY"
  | "CHECKPOINT"
  | "ROLLBACK";

export type WorkflowNode = {
  id: string;
  label: string;
  type: NodeType;
  dependsOn?: string[];
  status?: WorkflowStatus;
  policy?: string;
};

export type WorkflowDefinition = {
  id: string;
  name: string;
  description: string;
  version: string;
  domain: string;
  businessFunction: string;
  environment: "DEV" | "TEST" | "UAT" | "PROD";
  status: WorkflowStatus;
  trigger: TriggerType;
  schedule: string;
  timezone: string;
  nextRun: string;
  owner: string;
  batch: string;
  priority: "P0" | "P1" | "P2" | "P3";
  retryCount: number;
  retryDelayMinutes: number;
  timeoutMinutes: number;
  concurrency: number;
  slaMinutes: number;
  checkpointEvery: number;
  watermark: string;
  approvalGate: boolean;
  nodes: WorkflowNode[];
};

export const KMITORA_WORKFLOW_CAPABILITIES = [
  "Workflow Studio",
  "Reusable Workflow Modules (Worklet equivalent)",
  "Reusable Transformation Components (Mapplet equivalent)",
  "Execution Jobs (Session equivalent)",
  "Batch Manager",
  "Job Scheduler",
  "DAG / Dependency Manager",
  "Event & Trigger Manager",
  "Parameter & Variable Manager",
  "Business Calendar Manager",
  "Queue & Priority Manager",
  "Retry / Recovery Manager",
  "Checkpoint / Resume Manager",
  "SLA Manager",
  "Resource-Aware Scheduling",
  "Notification Manager",
  "Approval Workflow Manager",
  "Workflow Version Manager",
  "Workflow Evidence Manager",
  "Workflow Digital Twin",
  "A000 Intelligent Scheduler",
  "Self-Healing Job Manager",
  "Workflow Import / Conversion Engine",
  "Workflow Template Library",
  "CDC / Incremental Job Manager",
  "Backfill / Replay Manager",
  "Batch Reconciliation Manager",
  "Operational Calendar",
  "Run History & Audit",
  "Human Review Tasks",
  "Conditional Branching",
  "Parallel Fan-Out / Fan-In",
  "Dynamic Looping",
  "Watermark Processing",
  "File Arrival Sensors",
  "Database Change Sensors",
  "API / Webhook Triggers",
  "Queue / Message Triggers",
  "Cron / Calendar Schedules",
  "Parameter Sets",
  "Workflow Variables",
  "Command / SQL / API Tasks",
  "Import Adapters for Informatica, Airflow, Control-M, AutoSys, SSIS, Talend, DataStage, ADF, Glue, Databricks and NiFi",
] as const;

export const DEFAULT_WORKFLOWS: WorkflowDefinition[] = [
  {
    id: "WF-001",
    name: "Customer Governed Migration",
    description: "Reusable governed migration chain with approval, checkpoint, reconciliation and evidence.",
    version: "1.0.0",
    domain: "Banking",
    businessFunction: "Customer / Party",
    environment: "DEV",
    status: "READY",
    trigger: "MANUAL",
    schedule: "On demand",
    timezone: "Asia/Kolkata",
    nextRun: "Manual",
    owner: "A000",
    batch: "BATCH-CUSTOMER-001",
    priority: "P1",
    retryCount: 3,
    retryDelayMinutes: 10,
    timeoutMinutes: 120,
    concurrency: 4,
    slaMinutes: 90,
    checkpointEvery: 100000,
    watermark: "Last reconciled execution",
    approvalGate: true,
    nodes: [
      { id: "n1", label: "Discover", type: "DISCOVER" },
      { id: "n2", label: "Detect", type: "DETECT", dependsOn: ["n1"] },
      { id: "n3", label: "Diagnose", type: "DIAGNOSE", dependsOn: ["n2"] },
      { id: "n4", label: "Predict", type: "PREDICT", dependsOn: ["n3"] },
      { id: "n5", label: "Recommend", type: "RECOMMEND", dependsOn: ["n4"] },
      { id: "n6", label: "Simulate", type: "SIMULATE", dependsOn: ["n5"] },
      { id: "n7", label: "Approval", type: "APPROVAL", dependsOn: ["n6"], policy: "Required for governed execution" },
      { id: "n8", label: "Execute", type: "EXECUTE", dependsOn: ["n7"] },
      { id: "n9", label: "Test", type: "TEST", dependsOn: ["n8"] },
      { id: "n10", label: "Validate", type: "VALIDATE", dependsOn: ["n9"] },
      { id: "n11", label: "Reconcile", type: "RECONCILE", dependsOn: ["n10"] },
      { id: "n12", label: "Evidence", type: "EVIDENCE", dependsOn: ["n11"] },
      { id: "n13", label: "Learn", type: "LEARN", dependsOn: ["n12"] },
    ],
  },
  {
    id: "WF-002",
    name: "Nightly Discovery & Quality",
    description: "Read-only nightly discovery, quality detection, diagnosis and evidence refresh.",
    version: "1.0.0",
    domain: "Universal",
    businessFunction: "Data Quality",
    environment: "DEV",
    status: "SCHEDULED",
    trigger: "SCHEDULE",
    schedule: "Daily 01:00",
    timezone: "Asia/Kolkata",
    nextRun: "Next daily window",
    owner: "A000",
    batch: "BATCH-DISCOVERY-NIGHTLY",
    priority: "P2",
    retryCount: 2,
    retryDelayMinutes: 15,
    timeoutMinutes: 90,
    concurrency: 2,
    slaMinutes: 60,
    checkpointEvery: 50000,
    watermark: "Last successful discovery",
    approvalGate: false,
    nodes: [
      { id: "d1", label: "Discover", type: "DISCOVER" },
      { id: "d2", label: "Detect", type: "DETECT", dependsOn: ["d1"] },
      { id: "d3", label: "Diagnose", type: "DIAGNOSE", dependsOn: ["d2"] },
      { id: "d4", label: "Evidence", type: "EVIDENCE", dependsOn: ["d3"] },
    ],
  },
  {
    id: "WF-003",
    name: "Inbound Multi-Format File Pipeline",
    description: "File-arrival driven CSV/XML/TXT validation, mapping, simulation and reconciliation pipeline.",
    version: "1.0.0",
    domain: "Universal",
    businessFunction: "Inbound Data",
    environment: "DEV",
    status: "WAITING",
    trigger: "FILE_ARRIVAL",
    schedule: "customer_*.* sensor",
    timezone: "Asia/Kolkata",
    nextRun: "When file arrives",
    owner: "A000",
    batch: "BATCH-INBOUND-001",
    priority: "P1",
    retryCount: 3,
    retryDelayMinutes: 5,
    timeoutMinutes: 180,
    concurrency: 4,
    slaMinutes: 120,
    checkpointEvery: 100000,
    watermark: "File checksum + arrival timestamp",
    approvalGate: true,
    nodes: [
      { id: "f1", label: "File Sensor", type: "FILE" },
      { id: "f2", label: "Discover", type: "DISCOVER", dependsOn: ["f1"] },
      { id: "f3", label: "Validate", type: "VALIDATE", dependsOn: ["f2"] },
      { id: "f4", label: "Transform", type: "TRANSFORM", dependsOn: ["f3"] },
      { id: "f5", label: "Simulate", type: "SIMULATE", dependsOn: ["f4"] },
      { id: "f6", label: "Approval", type: "APPROVAL", dependsOn: ["f5"] },
      { id: "f7", label: "Execute", type: "EXECUTE", dependsOn: ["f6"] },
      { id: "f8", label: "Reconcile", type: "RECONCILE", dependsOn: ["f7"] },
      { id: "f9", label: "Evidence", type: "EVIDENCE", dependsOn: ["f8"] },
    ],
  },
];

export const IMPORT_FAMILIES = [
  ["Informatica", "Workflow, Worklet, Session, Mapping, Mapplet, Parameters, Schedules"],
  ["Airflow", "DAGs, Operators, Sensors, Task Instances, Variables"],
  ["Control-M", "Jobs, Folders, Calendars, Conditions, SLAs"],
  ["AutoSys", "JIL jobs, boxes, conditions, calendars"],
  ["SSIS", "Packages, control flow, data flow, parameters"],
  ["Talend", "Jobs, subjobs, contexts, routines"],
  ["DataStage", "Jobs, sequences, stages, parameters"],
  ["ADF", "Pipelines, activities, triggers, datasets"],
  ["AWS Glue", "Jobs, crawlers, workflows, triggers"],
  ["Databricks", "Jobs, tasks, dependencies, clusters"],
  ["NiFi", "Processors, process groups, queues, controller services"],
] as const;