import { NEURAL_CAPABILITIES, type NeuralCapability } from "../config/neuralIntelligenceModel";

export type NeuralRuntimeContext = {
  migrationId?: string;
  domain?: string;
  stage?: string;
  environment?: string;
  hasDiscovery?: boolean;
  hasEvidence?: boolean;
  hasWorkflowAutomation?: boolean;
};

export type NeuralReadiness = {
  capability: NeuralCapability;
  readiness: "READY_FOR_ANALYSIS" | "NEEDS_ADAPTER" | "RESEARCH_ONLY";
  reason: string;
};

export function readNeuralRuntimeContext(): NeuralRuntimeContext {
  if (typeof window === "undefined") return {};
  let domain = "";
  try {
    const raw = localStorage.getItem("kmitora.dev.domainContext");
    if (raw) domain = JSON.parse(raw)?.domainName || JSON.parse(raw)?.customDomain || "";
  } catch { domain = ""; }
  return {
    migrationId: localStorage.getItem("kmitora.dev.migrationId") || undefined,
    domain: domain || undefined,
    stage: localStorage.getItem("kmitora.dev.stage") || undefined,
    environment: "DEV",
    hasDiscovery: Boolean(localStorage.getItem("kmitora.dev.discoveryResult")),
    hasEvidence: Boolean(localStorage.getItem("kmitora.dev.executionId")),
    hasWorkflowAutomation: Boolean(localStorage.getItem("kmitora.dev.workflowAutomation.v1")),
  };
}

export function capabilityReadiness(capability: NeuralCapability): NeuralReadiness {
  if (capability.status === "RESEARCH_ONLY") {
    return { capability, readiness: "RESEARCH_ONLY", reason: "Simulation/research only until benchmarked and governed." };
  }
  if (capability.status === "MODEL_ADAPTER") {
    return { capability, readiness: "NEEDS_ADAPTER", reason: "Architecture is modeled; live model/runtime adapter is required." };
  }
  return { capability, readiness: "READY_FOR_ANALYSIS", reason: "Control-plane capability is available for governed DEV analysis." };
}

export function getNeuralReadiness() {
  return NEURAL_CAPABILITIES.map(capabilityReadiness);
}

export function getStageCapabilities(stage: string) {
  const normalized = stage.toUpperCase();
  return NEURAL_CAPABILITIES.filter((c) => c.stages.includes(normalized as never));
}

export function buildGovernanceSummary() {
  return {
    neuralCanRecommend: true,
    neuralCanPredict: true,
    neuralCanSimulate: true,
    productionMutationAllowed: false,
    deterministicValidationRequired: true,
    evidenceRequired: true,
    approvalRequiredForStateChange: true,
  } as const;
}