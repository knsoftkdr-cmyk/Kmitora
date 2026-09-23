export type ModelStatus = 'ACTIVE' | 'STANDBY' | 'BLOCKED' | 'UNKNOWN'
export type ModelEnvironment = 'DEV' | 'QA' | 'UAT' | 'PROD' | 'UNKNOWN'

export type ModelRecord = {
  id: string
  name: string
  provider: string
  modelType: string
  version?: string
  environment: ModelEnvironment
  status: ModelStatus
  capabilities: string[]
  source: string
  lastEvaluated?: string
  metrics?: Record<string, number | string | null>
  productionEligible?: boolean
  sensitiveDataEligible?: boolean
  region?: string
  evidence?: string[]
}

export type ModelWorkspaceSnapshot = {
  generatedAt: string
  registryCoveragePct: number
  evaluationCoveragePct: number
  governanceCoveragePct: number
  traceabilityCoveragePct: number
  models: ModelRecord[]
  warnings: string[]
}

