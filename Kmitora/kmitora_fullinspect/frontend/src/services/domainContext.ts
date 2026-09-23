import type { ClientDomainContext } from "./domainIntelligenceApi";

export const KMITORA_DOMAIN_CONTEXT_KEY =
  "kmitora.a000.domainContext.v1";

export function saveDomainContext(context: ClientDomainContext): void {
  localStorage.setItem(
    KMITORA_DOMAIN_CONTEXT_KEY,
    JSON.stringify(context),
  );
  window.dispatchEvent(
    new CustomEvent("kmitora:domain-context", { detail: context }),
  );
}

export function readDomainContext(): ClientDomainContext | null {
  try {
    const raw = localStorage.getItem(KMITORA_DOMAIN_CONTEXT_KEY);
    return raw ? (JSON.parse(raw) as ClientDomainContext) : null;
  } catch {
    return null;
  }
}

