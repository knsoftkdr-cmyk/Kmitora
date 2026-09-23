export type AdvancedRuntimeMode = "SHADOW_READ_ONLY" | string;

export interface AdvancedIntent {
  objective?: string;
  action?: string;
  subjects?: string[];
  source_systems?: string[];
  target_systems?: string[];
  constraints?: string[];
  requested_environment?: string;
  requires_simulation?: boolean;
  requires_approval?: boolean;
  confidence_basis?: string[];
  ambiguous?: boolean;
}

export interface AdvancedSafety {
  decision?: string;
  blockers?: string[];

  planning_authorized?: boolean;
  execution_authorized?: boolean;
  production_authorized?: boolean;
  cutover_authorized?: boolean;
}

export interface AdvancedMigrationPlanStep {
  step_id?: string;
  stage?: string;
  name?: string;

  dependencies?: string[];
  required_evidence?: string[];

  write_capable?: boolean;
  approval_required?: boolean;
}

export interface AdvancedMigrationPlan {
  plan_created?: boolean;

  migration_id?: string;
  tenant_id?: string;

  objective?: string;
  requested_environment?: string;

  steps?: AdvancedMigrationPlanStep[];

  execution_authorized?: boolean;
  target_write_authorized?: boolean;
  production_authorized?: boolean;
  cutover_authorized?: boolean;
}

export interface AdvancedRuntime {
  mode?: AdvancedRuntimeMode;
  bridge?: string;

  trace_id?: string | null;
  task_id?: string | null;
  agent_id?: string | null;
  environment?: string | null;

  intent?: AdvancedIntent | null;
  safety?: AdvancedSafety | null;

  route?: string | null;

  migration_plan?: AdvancedMigrationPlan | null;

  blockers?: string[];

  authoritative?: boolean;
  reply_replaced?: boolean;

  model_execution?: boolean;
  tool_execution?: boolean;

  execution_authorized?: boolean;

  source_write_authorized?: boolean;
  target_write_authorized?: boolean;

  production_authorized?: boolean;
  cutover_authorized?: boolean;

  source_write_executed?: boolean;
  target_write_executed?: boolean;

  production_action_executed?: boolean;
  cutover_executed?: boolean;
}

export interface A000AdvancedEnvelope {
  advanced_runtime?: AdvancedRuntime | null;
}

export interface AdvancedRuntimeAuthoritySummary {
  authoritative: boolean;
  executionAuthorized: boolean;
  sourceWriteAuthorized: boolean;
  targetWriteAuthorized: boolean;
  productionAuthorized: boolean;
  cutoverAuthorized: boolean;

  sourceWriteExecuted: boolean;
  targetWriteExecuted: boolean;
  productionActionExecuted: boolean;
  cutoverExecuted: boolean;
}

export const summarizeAdvancedAuthority = (
  runtime?: AdvancedRuntime | null
): AdvancedRuntimeAuthoritySummary => ({
  authoritative: runtime?.authoritative === true,

  executionAuthorized:
    runtime?.execution_authorized === true,

  sourceWriteAuthorized:
    runtime?.source_write_authorized === true,

  targetWriteAuthorized:
    runtime?.target_write_authorized === true,

  productionAuthorized:
    runtime?.production_authorized === true,

  cutoverAuthorized:
    runtime?.cutover_authorized === true,

  sourceWriteExecuted:
    runtime?.source_write_executed === true,

  targetWriteExecuted:
    runtime?.target_write_executed === true,

  productionActionExecuted:
    runtime?.production_action_executed === true,

  cutoverExecuted:
    runtime?.cutover_executed === true,
});

export const advancedRuntimeIsReadOnly = (
  runtime?: AdvancedRuntime | null
): boolean => {
  if (!runtime) return true;

  const authority =
    summarizeAdvancedAuthority(runtime);

  return !(
    authority.authoritative ||
    authority.executionAuthorized ||
    authority.sourceWriteAuthorized ||
    authority.targetWriteAuthorized ||
    authority.productionAuthorized ||
    authority.cutoverAuthorized ||
    authority.sourceWriteExecuted ||
    authority.targetWriteExecuted ||
    authority.productionActionExecuted ||
    authority.cutoverExecuted
  );
};

export const advancedRuntimeHasBlockers = (
  runtime?: AdvancedRuntime | null
): boolean =>
  Array.isArray(runtime?.blockers) &&
  runtime!.blockers!.length > 0;