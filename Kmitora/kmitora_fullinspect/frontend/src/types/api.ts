export type HealthState = 'checking' | 'up' | 'down'

export interface Envelope<T> {
  product: string
  agent?: string
  version: string
  kind: string
  trace_id: string
  timestamp: string
  authoritative: boolean
  production_action_executed: boolean
  payload: T
}

export interface HealthPayload {
  status: 'UP' | string
}

export interface CapabilitiesPayload {
  services: string[]
  boundaries: string[]
}

export interface EnvironmentItem {
  name: 'DEV' | 'QA' | 'UAT' | 'PROD' | string
  state: string
  authority: string
}

export interface EnvironmentsPayload {
  promotion_path: string[]
  environments: EnvironmentItem[]
}

export interface A000StatusPayload {
  name: string
  role: string
  mode: string
  text: boolean
  voice_optional: boolean
  runtime: {
    requests: number
    issues: unknown[]
    last_agent_action: string
  }
}

export interface A000MessagePayload {
  reply: string
  voice_reply: string
  suggested_actions: string[]
}

export interface SelfTestPayload {
  result: 'PASS' | 'FAIL'
  checks: Array<{ name: string; status: 'PASS' | 'FAIL'; detail: string }>
  safe_remediations_applied: string[]
  requires_user_approval: string[]
}

