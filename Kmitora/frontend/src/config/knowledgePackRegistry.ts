export type A000KnowledgePackDefinition = {
  id: string;
  name: string;
  source: string;
  topicCount: number;
  purpose: string;
  status: "ACTIVE";
};

export const a000KnowledgePacks: A000KnowledgePackDefinition[] = [
  {
    id: "GLOBAL_BUSINESS_DOMAINS",
    name: "Global Business & Industry Domains",
    source: "Universal_Domain_Catalog.json",
    topicCount: 140,
    purpose: "Industry, horizontal enterprise, governmental, application, data and transformation-domain intelligence.",
    status: "ACTIVE",
  },
  {
    id: "DIGITAL_TWINS",
    name: "Universal Digital Twins",
    source: "Universal_Digital_Twin_Catalog.json",
    topicCount: 51,
    purpose: "F1/F2 enterprise twins, migration rehearsal, digital thread, defect twins, what-if simulation, target preview and governed optimization.",
    status: "ACTIVE",
  },
  {
    id: "NEURAL_NETWORKS",
    name: "Neural Networks",
    source: "NeuroNetworks.xlsx",
    topicCount: 889,
    purpose: "Semantic mapping, anomaly detection, pattern learning, causal and explainable migration intelligence.",
    status: "ACTIVE",
  },
  {
    id: "QUANTUM_COMPUTING",
    name: "Quantum Computing",
    source: "NeuroNetworks.xlsx",
    topicCount: 1009,
    purpose: "Optimization, scheduling, graph problems, quantum-inspired planning and future cryptographic readiness.",
    status: "ACTIVE",
  },
  {
    id: "TRANSFORMATIONS",
    name: "Universal Transformations",
    source: "NeuroNetworks.xlsx",
    topicCount: 704,
    purpose: "Cleansing, mapping, ETL/ELT, validation, data quality, CDC, reconciliation and migration transformations.",
    status: "ACTIVE",
  },
];

