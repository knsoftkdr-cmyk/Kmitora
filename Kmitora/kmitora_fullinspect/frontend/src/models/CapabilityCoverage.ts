export type CapabilityStatus = "ACTIVE" | "FOUNDATION" | "ADAPTER_REQUIRED" | "GOVERNED";

export type CapabilityCategory =
  | "BUSINESS"
  | "ARCHITECTURE"
  | "DATA"
  | "INTEGRATION"
  | "AI"
  | "SECURITY"
  | "OPERATIONS"
  | "PLATFORM"
  | "INTEROPERABILITY";

export type CapabilityCoverageItem = {
  id: string;
  name: string;
  category: CapabilityCategory;
  status: CapabilityStatus;
  purpose: string;
  backendModule?: string;
};

