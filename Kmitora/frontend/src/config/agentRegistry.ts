import type { AgentCapability, DynamicAgent } from "../models/EnterpriseIntelligence";

export type AgentDefinition = {
  id: string;
  name: string;
  capabilities: AgentCapability[];
  knowledgePacks: string[];
};

export const coreAgentRegistry: AgentDefinition[] = [
  { id: "A000", name: "Global Intelligence Orchestrator", capabilities: ["DOMAIN","BUSINESS_PROCESS","KNOWLEDGE","MIGRATION","OPTIMIZATION"], knowledgePacks: ["GLOBAL_DOMAIN","TRANSFORMATIONS","NEURAL_NETWORKS","QUANTUM_COMPUTING"] },
  { id: "A101", name: "Industry Intelligence Agent", capabilities: ["DOMAIN","BUSINESS_PROCESS"], knowledgePacks: ["GLOBAL_DOMAIN"] },
  { id: "A102", name: "Business Process Intelligence Agent", capabilities: ["BUSINESS_PROCESS","DEFECT","ROOT_CAUSE"], knowledgePacks: ["GLOBAL_DOMAIN"] },
  { id: "A103", name: "Application Intelligence Agent", capabilities: ["APPLICATION","ARCHITECTURE","DEFECT"], knowledgePacks: ["TECHNOLOGY"] },
  { id: "A104", name: "Data Intelligence Agent", capabilities: ["DATA","DATA_QUALITY","VALIDATION"], knowledgePacks: ["TRANSFORMATIONS"] },
  { id: "A105", name: "Semantic Mapping Agent", capabilities: ["MAPPING","DATA","DOMAIN"], knowledgePacks: ["NEURAL_NETWORKS","TRANSFORMATIONS"] },
  { id: "A106", name: "Transformation Intelligence Agent", capabilities: ["TRANSFORMATION","DATA_QUALITY","VALIDATION"], knowledgePacks: ["TRANSFORMATIONS"] },
  { id: "A107", name: "Data Quality & Cleansing Agent", capabilities: ["DATA_QUALITY","VALIDATION","DEFECT"], knowledgePacks: ["TRANSFORMATIONS","NEURAL_NETWORKS"] },
  { id: "A108", name: "Defect Intelligence Agent", capabilities: ["DEFECT","ROOT_CAUSE","BUSINESS_PROCESS"], knowledgePacks: ["GLOBAL_DOMAIN","NEURAL_NETWORKS"] },
  { id: "A109", name: "Architecture Intelligence Agent", capabilities: ["ARCHITECTURE","APPLICATION","INFRASTRUCTURE","OPTIMIZATION"], knowledgePacks: ["TECHNOLOGY","GLOBAL_DOMAIN"] },
  { id: "A110", name: "Infrastructure & Server Agent", capabilities: ["INFRASTRUCTURE","PERFORMANCE","DEFECT"], knowledgePacks: ["TECHNOLOGY"] },
  { id: "A111", name: "Network Intelligence Agent", capabilities: ["NETWORK","PERFORMANCE","ROOT_CAUSE"], knowledgePacks: ["TECHNOLOGY"] },
  { id: "A112", name: "Security & Governance Agent", capabilities: ["SECURITY","VALIDATION"], knowledgePacks: ["GLOBAL_DOMAIN","QUANTUM_COMPUTING"] },
  { id: "A113", name: "Performance Optimization Agent", capabilities: ["PERFORMANCE","OPTIMIZATION","ROOT_CAUSE"], knowledgePacks: ["NEURAL_NETWORKS","QUANTUM_COMPUTING"] },
  { id: "A114", name: "Migration Planning Agent", capabilities: ["MIGRATION","TRANSFORMATION","VALIDATION"], knowledgePacks: ["TRANSFORMATIONS","GLOBAL_DOMAIN"] },
  { id: "A115", name: "Reconciliation Agent", capabilities: ["RECONCILIATION","VALIDATION","DATA_QUALITY"], knowledgePacks: ["TRANSFORMATIONS"] },
  { id: "A116", name: "Evidence & Lineage Agent", capabilities: ["EVIDENCE","VALIDATION"], knowledgePacks: ["GLOBAL_DOMAIN"] },
  { id: "A117", name: "Knowledge Inheritance Agent", capabilities: ["KNOWLEDGE","DOMAIN","BUSINESS_PROCESS"], knowledgePacks: ["GLOBAL_DOMAIN","TRANSFORMATIONS","NEURAL_NETWORKS","QUANTUM_COMPUTING"] },
];

export function asDynamicAgent(agent: AgentDefinition, reason: string): DynamicAgent {
  return {
    id: agent.id,
    name: agent.name,
    capabilities: agent.capabilities,
    activatedBecause: reason,
    inheritedKnowledge: agent.knowledgePacks,
    status: "ACTIVE",
  };
}


