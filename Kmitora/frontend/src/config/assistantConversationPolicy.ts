export const KMITORA_LIFECYCLE_STAGES = [
  "understand", "discover", "detect", "diagnose", "predict", "recommend",
  "simulate", "execute", "test", "validate", "reconcile", "evidence", "learn",
] as const;

export type KmitoraLifecycleStage = (typeof KMITORA_LIFECYCLE_STAGES)[number];

export function normalizeAssistantText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

export function isAssistantContextSnapshot(value: unknown): boolean {
  const text = normalizeAssistantText(value).toLowerCase();
  if (!text) return false;
  const hasStage = text.startsWith("current stage:");
  const hasStatus = text.includes("status:");
  const hasReady = /\bready\s*=\s*\d+/i.test(text);
  const hasTotal = /\btotal\s*=\s*\d+/i.test(text);
  const hasConfidence = /\bconfidence\s*=\s*[a-z0-9_-]+/i.test(text);
  const hasAssistantHint = text.includes("ask me to diagnose") || text.includes("explain evidence");
  return hasStage && hasStatus && hasReady && hasTotal && hasConfidence && hasAssistantHint;
}

export function isAssistantRecommendationSnapshot(value: unknown): boolean {
  return /^the next best action is\s*:/i.test(normalizeAssistantText(value));
}

export function isNonConversationSystemMessage(value: unknown): boolean {
  return isAssistantContextSnapshot(value) || isAssistantRecommendationSnapshot(value);
}

export function normalizeLifecycleStage(value: unknown, fallback: KmitoraLifecycleStage = "understand"): KmitoraLifecycleStage {
  const candidate = normalizeAssistantText(value).toLowerCase();
  return (KMITORA_LIFECYCLE_STAGES as readonly string[]).includes(candidate)
    ? (candidate as KmitoraLifecycleStage)
    : fallback;
}

function extractMessageText(value: Record<string, unknown>): string {
  for (const key of ["message", "text", "content", "reply", "body", "value"]) {
    const text = normalizeAssistantText(value[key]);
    if (text) return text;
  }
  return "";
}

export function sanitizeAssistantConversationValue(value: unknown, depth = 0): unknown {
  if (depth > 12) return value;

  if (typeof value === "string") {
    return isNonConversationSystemMessage(value) ? "" : value;
  }

  if (Array.isArray(value)) {
    return value
      .filter((item) => {
        if (typeof item === "string") return !isNonConversationSystemMessage(item);
        if (item && typeof item === "object") {
          const text = extractMessageText(item as Record<string, unknown>);
          return !text || !isNonConversationSystemMessage(text);
        }
        return true;
      })
      .map((item) => sanitizeAssistantConversationValue(item, depth + 1));
  }

  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      result[key] = sanitizeAssistantConversationValue(item, depth + 1);
    }
    return result;
  }

  return value;
}

export function sanitizeAssistantStorageJson(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return JSON.stringify(sanitizeAssistantConversationValue(parsed));
  } catch {
    return raw;
  }
}