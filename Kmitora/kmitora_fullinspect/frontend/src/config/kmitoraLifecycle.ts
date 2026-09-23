export type KmitoraLifecycleStatus =
  | "done"
  | "active"
  | "pending"
  | "guarded"
  | "blocked";

export type KmitoraLifecycleStage = {
  key:
    | "understand"
    | "discover"
    | "detect"
    | "diagnose"
    | "predict"
    | "recommend"
    | "simulate"
    | "execute"
    | "test"
    | "validate"
    | "reconcile"
    | "evidence"
    | "learn";
  label: string;
  progress: number;
  status: KmitoraLifecycleStatus;
  summary: string;
};

export const KMITORA_LIFECYCLE: readonly KmitoraLifecycleStage[] = [
  {
    key: "understand",
    label: "Understand",
    progress: 100,
    status: "done",
    summary: "Intent, scope, context and constraints understood",
  },
  {
    key: "discover",
    label: "Discover",
    progress: 100,
    status: "done",
    summary: "Systems, data, dependencies and metadata discovered",
  },
  {
    key: "detect",
    label: "Detect",
    progress: 100,
    status: "done",
    summary: "Errors, anomalies, drift and silent failures detected",
  },
  {
    key: "diagnose",
    label: "Diagnose",
    progress: 100,
    status: "done",
    summary: "Root cause, localization and impact determined",
  },
  {
    key: "predict",
    label: "Predict",
    progress: 100,
    status: "done",
    summary: "Failure risk and downstream impact predicted",
  },
  {
    key: "recommend",
    label: "Recommend",
    progress: 100,
    status: "done",
    summary: "Evidence-backed remediation options prepared",
  },
  {
    key: "simulate",
    label: "Simulate",
    progress: 100,
    status: "done",
    summary: "Dry-run and digital-twin outcomes evaluated",
  },
  {
    key: "execute",
    label: "Execute",
    progress: 0,
    status: "guarded",
    summary: "Governed execution remains permission and approval controlled",
  },
  {
    key: "test",
    label: "Test",
    progress: 98,
    status: "active",
    summary: "Deterministic, integration and regression tests running",
  },
  {
    key: "validate",
    label: "Validate",
    progress: 97,
    status: "active",
    summary: "Technical, business, security and policy outcomes validated",
  },
  {
    key: "reconcile",
    label: "Reconcile",
    progress: 49,
    status: "pending",
    summary: "Expected and actual states reconciled",
  },
  {
    key: "evidence",
    label: "Evidence",
    progress: 76,
    status: "active",
    summary: "Auditable proof, provenance and decisions captured",
  },
  {
    key: "learn",
    label: "Learn",
    progress: 0,
    status: "pending",
    summary: "Only verified outcomes are promoted into reusable knowledge",
  },
] as const;

export const KMITORA_LIFECYCLE_LABEL =
  "Understand → Discover → Detect → Diagnose → Predict → Recommend → Simulate → Execute → Test → Validate → Reconcile → Evidence → Learn";

