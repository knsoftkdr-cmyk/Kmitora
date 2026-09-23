import { postDiscovery } from "./api";
import type {
  MigrationSystem,
  TopologyRelationship,
} from "../models/MigrationTopology";
import type {
  A000WorkflowState,
  RelationshipAutomationResult,
} from "../models/AutomationWorkflow";

const LEGACY_REFERENCE_BUSINESS_RULES_PATH = "";

function joinWindowsPath(base?: string, child?: string) {
  const cleanBase = String(base ?? "").replace(/[\\/]+$/, "");
  const cleanChild = String(child ?? "").replace(/^[\\/]+/, "");
  return cleanBase && cleanChild ? `${cleanBase}\\${cleanChild}` : cleanBase || cleanChild;
}

export function topologySignature(
  sources: MigrationSystem[],
  targets: MigrationSystem[],
  relationships: TopologyRelationship[]
) {
  return JSON.stringify({
    sources: sources.map((item) => [item.id, item.connector, item.path, item.pattern, item.status]),
    targets: targets.map((item) => [item.id, item.connector, item.path, item.pattern, item.status]),
    relationships: relationships.map((item) => [item.sourceSystemId, item.targetSystemId]),
  });
}

export async function runA000AutoDiscovery(args: {
  sources: MigrationSystem[];
  targets: MigrationSystem[];
  relationships: TopologyRelationship[];
  onState?: (state: A000WorkflowState) => void;
}) {
  const { sources, targets, relationships, onState } = args;
  const signature = topologySignature(sources, targets, relationships);
  const startedAt = new Date().toISOString();

  let state: A000WorkflowState = {
    status: "DISCOVERY_RUNNING",
    currentStage: "DISCOVERY_RUNNING",
    topologySignature: signature,
    startedAt,
    updatedAt: startedAt,
    totalRelationships: relationships.length,
    discoveredRelationships: 0,
    skippedRelationships: 0,
    failedRelationships: 0,
    results: [],
    targetWriteRequested: false,
    targetWriteExecuted: false,
    productionActionExecuted: false,
  };

  onState?.(state);

  for (const relationship of relationships) {
    const source = sources.find((item) => item.id === relationship.sourceSystemId);
    const target = targets.find((item) => item.id === relationship.targetSystemId);
    const migrationId = `DEV-${relationship.sourceSystemId}-${relationship.targetSystemId}`;

    let item: RelationshipAutomationResult;

    if (!source || !target) {
      item = {
        relationshipId: relationship.id,
        sourceSystemId: relationship.sourceSystemId,
        targetSystemId: relationship.targetSystemId,
        migrationId,
        status: "FAILED",
        reason: "Topology relationship references a missing system.",
      };
    } else if (source.category !== "FILE" || target.category !== "FILE") {
      item = {
        relationshipId: relationship.id,
        sourceSystemId: source.id,
        targetSystemId: target.id,
        migrationId,
        status: "SKIPPED",
        reason: "Live auto-discovery adapter is currently enabled for FILE-to-FILE relationships only.",
      };
    } else {
      try {
        const sourceFile = joinWindowsPath(source.path, source.pattern);
        const targetPath = joinWindowsPath(target.path, target.pattern);
        const response = await postDiscovery({
          migration_id: migrationId,
          source_file: sourceFile,
          target_path: targetPath,
          business_rules_path: LEGACY_REFERENCE_BUSINESS_RULES_PATH,
        });
        const discovery = response?.payload ?? response;
        item = {
          relationshipId: relationship.id,
          sourceSystemId: source.id,
          targetSystemId: target.id,
          migrationId,
          status: "DISCOVERED",
          result: discovery,
        };
      } catch (error) {
        item = {
          relationshipId: relationship.id,
          sourceSystemId: source.id,
          targetSystemId: target.id,
          migrationId,
          status: "FAILED",
          reason: error instanceof Error ? error.message : "Discovery failed.",
        };
      }
    }

    const results = [...state.results, item];
    state = {
      ...state,
      results,
      discoveredRelationships: results.filter((x) => x.status === "DISCOVERED").length,
      skippedRelationships: results.filter((x) => x.status === "SKIPPED").length,
      failedRelationships: results.filter((x) => x.status === "FAILED").length,
      updatedAt: new Date().toISOString(),
    };
    onState?.(state);
  }

  const completedAt = new Date().toISOString();
  const finalStatus =
    state.failedRelationships > 0
      ? "FAILED"
      : state.skippedRelationships > 0
        ? "PARTIAL_AUTOMATION_WAITING_FOR_ADAPTERS"
        : "DISCOVERY_COMPLETE";

  state = {
    ...state,
    status: finalStatus,
    currentStage: finalStatus,
    completedAt,
    updatedAt: completedAt,
  };
  onState?.(state);
  return state;
}


