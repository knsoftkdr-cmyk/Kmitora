import { universalDomainRegistry } from "../config/domainRegistry";
import { coreAgentRegistry, asDynamicAgent } from "../config/agentRegistry";
import type { DomainMatch, DynamicAgent, AgentCapability } from "../models/EnterpriseIntelligence";

function tokenize(text: string) {
  return new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter((x) => x.length > 2));
}

export function detectEnterpriseDomains(text: string): DomainMatch[] {
  const tokens = tokenize(text);
  return universalDomainRegistry
    .map((domain) => {
      const haystack = `${domain.name} ${domain.majorDataAreas} ${domain.typicalSystems} ${domain.migrationUse}`.toLowerCase();
      const words = haystack.split(/[^a-z0-9]+/).filter((x) => x.length > 2);
      const hits = [...new Set(words)].filter((word) => tokens.has(word));
      const score = Math.min(99, 25 + hits.length * 12 + (text.toLowerCase().includes(domain.name.toLowerCase()) ? 35 : 0));
      return { id: domain.id, name: domain.name, score, evidence: hits.slice(0, 8) };
    })
    .filter((x) => x.score >= 37)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

const capabilityKeywords: Array<[AgentCapability, RegExp]> = [
  ["NETWORK", /network|latency|dns|firewall|load balancer|tcp|route/i],
  ["SECURITY", /security|iam|identity|role|permission|certificate|secret|encrypt|vulnerab/i],
  ["INFRASTRUCTURE", /server|hardware|storage|cpu|memory|kubernetes|container|vm|cloud|infrastructure/i],
  ["PERFORMANCE", /slow|performance|latency|throughput|bottleneck|capacity/i],
  ["DEFECT", /defect|issue|problem|failure|error|incident|broken|incorrect/i],
  ["ROOT_CAUSE", /root cause|why|cause|failure|incident/i],
  ["DATA_QUALITY", /quality|duplicate|null|missing|invalid|clean|orphan|inconsistent/i],
  ["TRANSFORMATION", /transform|mapping|convert|normalize|standardize|join|lookup|enrich/i],
  ["MIGRATION", /migrate|migration|cutover|target|source/i],
  ["ARCHITECTURE", /architecture|modernize|future state|as-is|to-be|application/i],
];

export function activateAgentsForProblem(text: string, domains: DomainMatch[]): DynamicAgent[] {
  const required = new Set<AgentCapability>(["DOMAIN","BUSINESS_PROCESS","DEFECT","ROOT_CAUSE","MIGRATION","VALIDATION","EVIDENCE"]);
  capabilityKeywords.forEach(([capability, pattern]) => { if (pattern.test(text)) required.add(capability); });
  const selected = coreAgentRegistry.filter((agent) => agent.capabilities.some((cap) => required.has(cap)));
  const agents = selected.map((agent) => asDynamicAgent(agent, `Required for ${[...required].join(", ")}`));

  const primary = domains[0];
  if (primary && primary.score >= 60) {
    agents.push({
      id: `DYN-${primary.id}`,
      name: `${primary.name} Migration & Defect Specialist`,
      capabilities: ["DOMAIN","BUSINESS_PROCESS","DEFECT","ROOT_CAUSE","TRANSFORMATION","VALIDATION","RECONCILIATION"],
      activatedBecause: `KMITORA detected ${primary.name} with ${primary.score}% confidence.`,
      inheritedKnowledge: ["GLOBAL_DOMAIN", primary.name, "TRANSFORMATIONS", "NEURAL_NETWORKS"],
      status: "CREATED_FOR_TASK",
    });
  }
  return agents;
}


