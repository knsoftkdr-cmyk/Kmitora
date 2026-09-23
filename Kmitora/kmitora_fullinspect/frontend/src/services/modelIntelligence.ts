import type { ModelRecord, ModelWorkspaceSnapshot } from '../types/modelIntelligence'

const API_PREFIX = '/api'

async function safeJson(url: string): Promise<unknown | null> {
  try {
    const r = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } })
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}

function fromLocalStorage(): ModelRecord[] {
  const keys = [
    'kmitora.dev.modelRegistry',
    'kmitora.modelRegistry',
    'kmitora.dev.models',
    'kmitora.models',
    'kmitora.dev.enterpriseIntelligence'
  ]
  const out: ModelRecord[] = []
  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw)
      const candidates = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.models) ? parsed.models : []
      for (const m of candidates) {
        if (!m || typeof m !== 'object') continue
        const name = String(m.name ?? m.model_name ?? m.id ?? 'Unnamed model')
        out.push({
          id: String(m.id ?? `${key}:${name}`),
          name,
          provider: String(m.provider ?? 'UNKNOWN'),
          modelType: String(m.modelType ?? m.type ?? 'UNKNOWN'),
          version: m.version ? String(m.version) : undefined,
          environment: String(m.environment ?? 'DEV').toUpperCase() as ModelRecord['environment'],
          status: String(m.status ?? 'UNKNOWN').toUpperCase() as ModelRecord['status'],
          capabilities: Array.isArray(m.capabilities) ? m.capabilities.map(String) : [],
          source: `localStorage:${key}`,
          lastEvaluated: m.lastEvaluated ?? m.last_evaluated,
          metrics: typeof m.metrics === 'object' && m.metrics ? m.metrics : undefined,
          productionEligible: Boolean(m.productionEligible ?? false),
          sensitiveDataEligible: Boolean(m.sensitiveDataEligible ?? false),
          region: m.region ? String(m.region) : undefined,
          evidence: Array.isArray(m.evidence) ? m.evidence.map(String) : undefined
        })
      }
    } catch {
      // Truth-preserving: malformed state is ignored, never converted to a fake model.
    }
  }
  return out
}

function dedupe(models: ModelRecord[]): ModelRecord[] {
  const map = new Map<string, ModelRecord>()
  for (const m of models) {
    const key = `${m.provider}|${m.name}|${m.version ?? ''}|${m.environment}`.toLowerCase()
    if (!map.has(key)) map.set(key, m)
  }
  return [...map.values()]
}

export async function loadModelWorkspaceSnapshot(): Promise<ModelWorkspaceSnapshot> {
  const warnings: string[] = []
  const models = fromLocalStorage()

  const caps = await safeJson(`${API_PREFIX}/v1/capabilities`)
  if (!caps) warnings.push('Backend capabilities endpoint unavailable or returned non-200.')

  const generated = await safeJson('/model-registry.generated.json')
  if (Array.isArray((generated as any)?.models)) {
    for (const m of (generated as any).models) models.push(m)
  } else {
    warnings.push('Generated model registry not found; workspace is showing only runtime-discovered model metadata.')
  }

  const finalModels = dedupe(models)
  const total = finalModels.length
  const evalCount = finalModels.filter(m => m.metrics && Object.keys(m.metrics).length > 0).length
  const governed = finalModels.filter(m => typeof m.productionEligible === 'boolean').length
  const traceable = finalModels.filter(m => m.source || (m.evidence?.length ?? 0) > 0).length

  return {
    generatedAt: new Date().toISOString(),
    registryCoveragePct: total ? 100 : 0,
    evaluationCoveragePct: total ? Math.round((evalCount / total) * 10000) / 100 : 0,
    governanceCoveragePct: total ? Math.round((governed / total) * 10000) / 100 : 0,
    traceabilityCoveragePct: total ? Math.round((traceable / total) * 10000) / 100 : 0,
    models: finalModels,
    warnings
  }
}

