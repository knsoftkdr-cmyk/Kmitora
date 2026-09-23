import React, { useEffect, useMemo, useState } from "react";

import A000ScenarioContextBanner from "../components/A000ScenarioContextBanner";
import { DiscoverIntelligencePanel } from "../components/DiscoverIntelligencePanel";
import "./discover-unified.css";
import { applySourceScope, compileSourceScope, entitySupportsScope, type CompiledSourceScope } from "../services/requirementScope";

type Props = {
  onNavigate?: (page: string) => void;
  advancedRuntime?: unknown;
};

type SourceRecord = {
  id: string;
  name: string;
  type: string;
  status: string;
  filePath?: string | null;
  host?: string | null;
  database?: string | null;
  schema?: string | null;
};

type TargetRecord = {
  id: string;
  name: string;
  type: string;
  status: string;
  host: string;
  port: number;
  database: string;
  schema?: string | null;
  environment?: string;
};

type CatalogObject = { schema: string; name: string; type: string };
type Preview = { columns: string[]; rows: Record<string, unknown>[]; totalRows?: number | null; scannedRows?: number | null; scopeApplied?: boolean };
type Structure = { columns: { name: string; dataType: string; nullable: boolean; ordinal: number }[] };
type Requirement = {
  objective: string;
  rules: string[];
  attachments?: { name: string; size: number; type: string }[];
  savedAt?: string;
  environment?: string;
  productionWritesEnabled?: false;
  cutoverEnabled?: false;
};

type EntityProfile = {
  schema: string;
  name: string;
  stem: string;
  columns: string[];
  rowCountObserved: number;
  rowsScanned: number;
  scopeApplied: boolean;
  scopeSupported: boolean;
  previewTruncated: boolean;
};

type TargetProfile = {
  schema: string;
  name: string;
  stem: string;
  columns: { name: string; dataType: string; nullable: boolean; ordinal: number }[];
};

type Relation = { parent: string; child: string; key: string; orphanCount: number };
type EntityMapping = { source: string; target: string; confidence: number; decision: "CANDIDATE" };
type FieldMapping = { source: string; target: string; action: "DIRECT_MAP" | "TRANSFORM"; rules: string[] };

type UnifiedDiscovery = {
  version: "UI-006-R1";
  generatedAt: string;
  scopeSignature: string;
  source: { id: string; name: string; type: string; path?: string | null; entities: EntityProfile[] };
  target: { id: string; name: string; type: string; database: string; schema?: string | null; entities: TargetProfile[] };
  requirement: Requirement;
  relationships: Relation[];
  entityMappings: EntityMapping[];
  fieldMappings: FieldMapping[];
  transformationCandidates: { ruleId: string; rule: string }[];
  validationCandidates: { ruleId: string; rule: string }[];
  loadWaves: string[][];
  coveragePct: number;
  sourceScope: CompiledSourceScope;
  safety: { sourceReadOnly: true; targetReadOnlyDuringDiscovery: true; productionWritesEnabled: false; cutoverEnabled: false };
};

const REQUIREMENT_KEY = "kmitora.business.requirements.v1";
const DISCOVERY_KEY = "kmitora.discovery.unified.v1";

async function api<T>(url: string): Promise<T> {
  const r = await fetch(url, { headers: { "Content-Type": "application/json" } });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as any)?.error || (data as any)?.message || `HTTP ${r.status}`);
  return data as T;
}

async function apiPost<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg =
      (data as any)?.payload?.message ||
      (data as any)?.error ||
      (data as any)?.message ||
      `HTTP ${r.status}`;
    throw new Error(msg);
  }
  return data as T;
}

function compactDiscoveryForStorage(discovery: any) {
  const staging = discovery?.target_staging_plan ?? {};
  const count = (value: unknown) => Array.isArray(value) ? value.length : 0;

  // STORAGE-QUOTA-002: browser storage is a compact projection only.
  // Full authoritative staging records remain server-side under migration_id.
  // This prevents localStorage quota failures and avoids duplicating governed
  // record payloads in the browser.
  return {
    migration_id: discovery?.migration_id,
    version: discovery?.version,
    generated_at: discovery?.generated_at,
    source: discovery?.source,
    target: discovery?.target,
    business_rules: discovery?.business_rules ?? [],
    source_scope: discovery?.source_scope ?? null,
    relationships: discovery?.relationships ?? [],
    load_waves: discovery?.load_waves ?? [],
    suggested_mappings: discovery?.suggested_mappings ?? [],
    transformation_plan: discovery?.transformation_plan ?? [],
    quality_findings: discovery?.quality_findings ?? [],
    coverage_pct: discovery?.coverage_pct ?? 0,
    safety: discovery?.safety ?? {},
    compatibility_projection: discovery?.compatibility_projection === true,
    authoritative_key: discovery?.authoritative_key,
    authoritative_evidence_synced_at: discovery?.authoritative_evidence_synced_at,
    summary: {
      ...(discovery?.summary ?? {}),
      staging_ready_count:
        discovery?.summary?.staging_ready_count ?? count(staging.ready_records),
      staging_review_count:
        discovery?.summary?.staging_review_count ?? count(staging.review_records),
      staging_quarantine_count:
        discovery?.summary?.staging_quarantine_count ?? count(staging.quarantine_records),
      staging_rejected_count:
        discovery?.summary?.staging_rejected_count ?? count(staging.rejected_records),
      staging_referential_dependency_count:
        discovery?.summary?.staging_referential_dependency_count ?? count(staging.referential_dependencies),
    },
    target_staging_plan: {
      ready_records: [],
      review_records: [],
      quarantine_records: [],
      rejected_records: [],
      referential_dependencies: [],
      ready_count: count(staging.ready_records),
      review_count: count(staging.review_records),
      quarantine_count: count(staging.quarantine_records),
      rejected_count: count(staging.rejected_records),
      referential_dependency_count: count(staging.referential_dependencies),
      authoritative_records_server_side: true,
      compact: true,
    },
  };
}

function persistDiscoveryResult(discovery: any) {
  const compact = compactDiscoveryForStorage(discovery);
  const serialized = JSON.stringify(compact);

  const write = () =>
    localStorage.setItem("kmitora.dev.discoveryResult", serialized);

  try {
    write();
  } catch (error: any) {
    const quotaExceeded =
      error?.name === "QuotaExceededError" ||
      error?.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      Number(error?.code) === 22 ||
      Number(error?.code) === 1014;

    if (!quotaExceeded) throw error;

    // Remove only derived/rebuildable caches. Preserve source, target and
    // business-requirement state. Then retry the compact projection once.
    [
      "kmitora.dev.discoveryResult",
      "kmitora.dev.discoveryResults",
      "kmitora.dev.autoDiscoveryResults",
      "kmitora.dev.legacyDiscoveryResult",
      "kmitora.dev.workflowState",
    ].forEach((key) => localStorage.removeItem(key));

    write();
  }
}

function basename(path: string) {
  return path.split(/[\\/]/).filter(Boolean).pop() || path;
}

function stem(name: string) {
  return basename(name).replace(/\.[^.]+$/, "").replace(/^target[_-]/i, "").toLowerCase();
}

// REPEAT-DISCOVERY-001: normalize partitioned file names into stable logical
// entities so CSV/XML/TXT parts of one business entity are understood as one
// source on every run. Example: customer_master_part1.csv -> customer_master.
function logicalPartitionStem(name: string) {
  return stem(name)
    .replace(/(?:[_-]part[_-]?\d+)$/i, "")
    .replace(/(?:[_-]p\d+)$/i, "");
}

function singular(name: string) {
  if (name.endsWith("ies")) return name.slice(0, -3) + "y";
  if (name.endsWith("s") && name.length > 1) return name.slice(0, -1);
  return name;
}

function rulesForField(rules: string[], field: string) {
  const token = field.toLowerCase().replace(/_/g, " ");
  const compact = field.toLowerCase();
  return rules.filter((r) => {
    const x = r.toLowerCase();
    return x.includes(token) || x.includes(compact) || (compact === "status" && x.includes("status")) || (compact === "region" && /(south|north|east|west)/.test(x));
  });
}

function isTransformationRule(rule: string) {
  const x = rule.toLowerCase();
  return x.includes("trim ") || x.includes("lowercase") || x.includes(" becomes ");
}

function isValidationRule(rule: string) {
  const x = rule.toLowerCase();
  return x.includes("unique") || x.includes("cannot be negative") || x.includes("must reference") || x.includes("greater than zero") || x.includes("validated") || x.includes("read-only") || x.includes("reconcile") || x.includes("evidence");
}

function inferRelations(entities: EntityProfile[]) {
  const out: Relation[] = [];

  // RELATIONSHIP-DAG-001: derive semantic entity keys instead of requiring
  // only <entire_entity_name>_id. This understands domain names such as
  // customer_master -> customer_id and address_history -> address_id while
  // still supporting order_items -> order_item_id.
  const keyCandidates = (entityName: string) => {
    const n = singular(entityName.toLowerCase());
    const bases = [n];
    for (const suffix of ["_master", "_history", "_detail", "_details", "_header", "_transaction", "_transactions", "_table", "_data"]) {
      if (n.endsWith(suffix)) bases.push(n.slice(0, -suffix.length).replace(/_+$/, ""));
    }
    bases.push(...n.split("_").filter(Boolean));
    const uniqueBases = Array.from(new Set(bases.filter(Boolean)));
    return uniqueBases.flatMap((base) => [`${base}_id`, `${base}_key`, `${base}_code`]);
  };

  const ownKeys = new Map<string, string>();
  for (const entity of entities) {
    const cols = new Map(entity.columns.map((c) => [c.toLowerCase(), c]));
    const own = keyCandidates(entity.stem).map((c) => cols.get(c)).find(Boolean);
    if (own) ownKeys.set(entity.name, own);
  }

  for (const parent of entities) {
    const parentCols = new Map(parent.columns.map((c) => [c.toLowerCase(), c]));
    const parentKey = keyCandidates(parent.stem).map((c) => parentCols.get(c)).find(Boolean);
    if (!parentKey) continue;

    for (const child of entities) {
      if (child.name === parent.name) continue;
      const childCols = new Map(child.columns.map((c) => [c.toLowerCase(), c]));
      const childFk = childCols.get(parentKey.toLowerCase());
      if (!childFk) continue;
      if ((ownKeys.get(child.name) || "").toLowerCase() === childFk.toLowerCase()) continue;
      out.push({ parent: parent.name, child: child.name, key: parentKey, orphanCount: 0 });
    }
  }

  return out.filter((v, i, a) => a.findIndex((x) => x.parent === v.parent && x.child === v.child && x.key === v.key) === i);
}

function buildWaves(entities: EntityProfile[], relations: Relation[]) {
  const nodes = entities.map((e) => e.name);
  const remaining = new Set(nodes);
  const done = new Set<string>();
  const waves: string[][] = [];
  while (remaining.size) {
    const wave = Array.from(remaining).filter((n) => relations.filter((r) => r.child === n).every((r) => done.has(r.parent)));
    if (!wave.length) {
      waves.push(Array.from(remaining));
      break;
    }
    waves.push(wave);
    wave.forEach((n) => { remaining.delete(n); done.add(n); });
  }
  return waves;
}

function pct(n: number, d: number) {
  return d <= 0 ? 0 : Math.round((n / d) * 100);
}

export default function Discover({

  onNavigate,
  advancedRuntime,
}: Props) {
  const [, setSyncPaths] = useState<Record<string, unknown>>({});
  const existing = useMemo(() => {
    try {
      const parsed =
        JSON.parse(
          localStorage.getItem(DISCOVERY_KEY) || "null"
        ) as UnifiedDiscovery | null;

      if (!parsed) return null;

      const activeSourceId =
        localStorage.getItem("kmitora.active.sourceId");

      const activeTargetId =
        localStorage.getItem("kmitora.active.targetId");

      if (
        !parsed.scopeSignature ||
        !parsed.source?.id ||
        !parsed.target?.id ||
        (activeSourceId && parsed.source.id !== activeSourceId) ||
        (activeTargetId && parsed.target.id !== activeTargetId)
      ) {
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }, []);
  const [result, setResult] = useState<UnifiedDiscovery | null>(existing);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [serviceState, setServiceState] = useState({ core: "UNKNOWN", source: "UNKNOWN", target: "UNKNOWN" });

  // --- Server-verified evidence sync (bridges the browser's discovery
  // preview with the backend's own authoritative record-level
  // computation, so the numbers used for Approval match the numbers
  // Execute Migration checks against). ---
  const [syncOpen, setSyncOpen] = useState(false);

  // PERSISTENT-UI-STATE-001: rehydrate the DEV lifecycle context from A000
  // when browser localStorage is empty or was cleared. This state contains no
  // connection passwords/secrets.
  useEffect(() => {
    let cancelled = false;
    const rehydratePersistentState = async () => {
      try {
        const response = await api<any>("/api/v1/ui-state");
        const state = response?.payload?.state ?? response?.state ?? {};
        if (cancelled || !state || typeof state !== "object") return;
        if (!localStorage.getItem(REQUIREMENT_KEY) && state.business_requirement) {
          localStorage.setItem(REQUIREMENT_KEY, JSON.stringify(state.business_requirement));
        }
        if (!localStorage.getItem("kmitora.active.sourceId") && state.active_source_id) {
          localStorage.setItem("kmitora.active.sourceId", String(state.active_source_id));
        }
        if (!localStorage.getItem("kmitora.active.targetId") && state.active_target_id) {
          localStorage.setItem("kmitora.active.targetId", String(state.active_target_id));
        }
        if (!result && !localStorage.getItem(DISCOVERY_KEY) && state.last_good_discovery) {
          localStorage.setItem(DISCOVERY_KEY, JSON.stringify(state.last_good_discovery));
          setResult(state.last_good_discovery as UnifiedDiscovery);
          setError("");
        }
      } catch (error) {
        console.warn("KMITORA persistent lifecycle rehydration failed", error);
      }
    };
    void rehydratePersistentState();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const recoverRuntimeContext = async () => {
      try {
        const health = await Promise.allSettled([
          api<any>("/api/health"),
          api<any>("/source-api/health"),
          api<any>("/target-api/health"),
        ]);

        if (cancelled) return;

        setServiceState({
          core: health[0].status === "fulfilled" ? "UP" : "DOWN",
          source: health[1].status === "fulfilled" ? "UP" : "DOWN",
          target: health[2].status === "fulfilled" ? "UP" : "DOWN",
        });

        if (health.some((item) => item.status === "rejected")) {
          return;
        }

        const [sources, targets] = await Promise.all([
          api<SourceRecord[]>("/source-api/v1/sources"),
          api<TargetRecord[]>("/target-api/v1/targets"),
        ]);

        if (cancelled) return;

        const connectedSources = sources.filter(
          (source) =>
            String(source.status || "").toLowerCase() === "connected"
        );

        const connectedDevTargets = targets.filter(
          (target) =>
            String(target.status || "").toLowerCase() === "connected" &&
            String(target.environment || "DEV").toUpperCase() === "DEV"
        );

        if (connectedSources.length === 1) {
          const source = connectedSources[0];

          localStorage.setItem(
            "kmitora.active.sourceId",
            String(source.id)
          );
        }

        if (connectedDevTargets.length === 1) {
          const target = connectedDevTargets[0];

          localStorage.setItem(
            "kmitora.active.targetId",
            String(target.id)
          );
        }
      } catch (error) {
        if (!cancelled) {
          setServiceState({
            core: "DOWN",
            source: "DOWN",
            target: "DOWN",
          });

          console.warn(
            "KMITORA runtime context recovery failed",
            error
          );
        }
      }
    };

    recoverRuntimeContext();

    return () => {
      cancelled = true;
    };
  }, []);
  // AUTHORITATIVE-SYNC-001: authoritative evidence reuses the exact
  // active source, target, saved business requirement and supporting artifacts
  // from Unified Discovery. No duplicate file/schema/rules paths are accepted.
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [syncSummary, setSyncSummary] = useState<Record<string, number> | null>(null);

  const syncAuthoritativeEvidence = async () => {
    setSyncing(true);
    setSyncError("");
    try {
      const migrationId =
        localStorage.getItem("kmitora.dev.migrationId") || "";

      if (!migrationId) {
        throw new Error(
          "Run Unified Discovery first, then sync server evidence."
        );
      }

      if (!result) {
        throw new Error("No Unified Discovery result is available to synchronize.");
      }

      const savedRules = Array.isArray(result?.requirement?.rules)
        ? result.requirement.rules.filter((rule: unknown) => String(rule ?? "").trim())
        : [];

      if (!savedRules.length) {
        throw new Error(
          "Saved business requirements are missing. Return to Understand and Save & Analyze Requirement first."
        );
      }

      const sourceEntities = Array.isArray(result?.source?.entities)
        ? result.source.entities
        : [];

      if (!sourceEntities.length) {
        throw new Error(
          "Unified Discovery has no source entities. Run Unified Discovery successfully before evidence sync."
        );
      }

      const sourceFilePath =
        result?.source?.filePath || result?.source?.path || "";

      const sourceEntityAllowlist = sourceEntities
        .map((entity: any) => String(entity?.name || entity?.entity || "").trim())
        .filter(Boolean);

      const expectedEntityRowCounts = Object.fromEntries(
        sourceEntities
          .map((entity: any) => {
            const name = String(entity?.name || entity?.entity || "").trim();
            const count = Number(
              entity?.rowCountObserved ?? entity?.row_count ?? entity?.rowCount ?? 0
            );
            return name ? [name, count] : null;
          })
          .filter(Boolean) as [string, number][]
      );

      const expectedScopedRecordCount = Object.values(expectedEntityRowCounts)
        .reduce((sum, value) => sum + Number(value || 0), 0);

      const supportingArtifacts = Array.isArray(result?.requirement?.attachments)
        ? result.requirement.attachments.map((artifact: any) => ({
            name: String(artifact?.name || ""),
            path: String(artifact?.path || artifact?.filePath || ""),
            type: String(artifact?.type || artifact?.mimeType || ""),
          }))
        : [];

      const response = await apiPost<any>(
        "/api/v1/discovery/jobs",
        {
          migration_id: migrationId,

          ...(sourceFilePath
            ? { source_path: sourceFilePath }
            : { source_id: result?.source?.id }),

          target_schema: {
            type: result?.target?.type || "postgresql",
            name: result?.target?.name || "",
            database: result?.target?.database || "",
            schema: result?.target?.schema || "public",
            entities: Array.isArray(result?.target?.entities)
              ? result.target.entities
              : [],
          },

          business_rules: savedRules,
          supporting_artifacts: supportingArtifacts,
          source_entity_allowlist: sourceEntityAllowlist,
          expected_entity_row_counts: expectedEntityRowCounts,
          expected_scoped_record_count: expectedScopedRecordCount,
        }
      );

      const payload = response?.payload ?? response;

      const raw = localStorage.getItem("kmitora.dev.discoveryResult");
      const current = raw ? JSON.parse(raw) : {};

      const merged = {
        ...current,
        target_staging_plan: payload?.target_staging_plan ?? null,
        summary: {
          ...(current.summary || {}),
          ...(payload?.summary || {}),
        },
        authoritative_evidence_synced_at: new Date().toISOString(),
      };

      persistDiscoveryResult(merged);

      setSyncSummary(payload?.summary ?? null);
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncing(false);
    }
  };
  const run = async () => {
    setLoading(true);
    setError("");
    setSyncError("");
    let unifiedDiscoverySucceeded = false;
    try {
      const requirementRaw = localStorage.getItem(REQUIREMENT_KEY);
      if (!requirementRaw) throw new Error("Business requirement is missing. Return to Connect     Business Requirements and save the requirement first.");
      const requirement = JSON.parse(requirementRaw) as Requirement;
      if (!Array.isArray(requirement.rules) || !requirement.rules.length) throw new Error("Saved business requirement contains no parsed rules.");

      const health = await Promise.allSettled([
        api<any>("/api/health"),
        api<any>("/source-api/health"),
        api<any>("/target-api/health"),
      ]);
      setServiceState({
        core: health[0].status === "fulfilled" ? "UP" : "DOWN",
        source: health[1].status === "fulfilled" ? "UP" : "DOWN",
        target: health[2].status === "fulfilled" ? "UP" : "DOWN",
      });
      if (health.some((h) => h.status === "rejected")) throw new Error("One or more KMITORA services are unavailable. Required: Core 8080, Source API 8081, Target API 8082.");

      const [sources, targets] = await Promise.all([
        api<SourceRecord[]>("/source-api/v1/sources"),
        api<TargetRecord[]>("/target-api/v1/targets"),
      ]);
      const activeSourceId = localStorage.getItem("kmitora.active.sourceId");
      const activeTargetId = localStorage.getItem("kmitora.active.targetId");

      const connectedSources = sources.filter(
        (s) => String(s.status).toLowerCase() === "connected"
      );

      const connectedDevTargets = targets.filter(
        (t) =>
          String(t.status).toLowerCase() === "connected" &&
          String(t.environment || "DEV").toUpperCase() === "DEV"
      );

      const connectedTargets = connectedDevTargets.length
        ? connectedDevTargets
        : targets.filter(
            (t) => String(t.status).toLowerCase() === "connected"
          );

      const source = activeSourceId
        ? connectedSources.find((s) => s.id === activeSourceId)
        : connectedSources.length === 1
          ? connectedSources[0]
          : undefined;

      const target = activeTargetId
        ? connectedTargets.find((t) => t.id === activeTargetId)
        : connectedTargets.length === 1
          ? connectedTargets[0]
          : undefined;

      if (!source) {
        throw new Error(
          activeSourceId
            ? "The selected active source is no longer connected. Return to Understand and reconnect/select the source."
            : "Multiple or no connected sources exist. Return to Understand and explicitly select one source."
        );
      }

      if (!target) {
        throw new Error(
          activeTargetId
            ? "The selected active target is no longer connected. Return to Understand and reconnect/select the target."
            : "Multiple or no connected targets exist. Return to Understand and explicitly select one DEV target."
        );
      }

      localStorage.setItem("kmitora.active.sourceId", source.id);
      localStorage.setItem("kmitora.active.targetId", target.id);
      void fetch("/api/v1/ui-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active_source_id: source.id, active_target_id: target.id }),
      }).catch((error) => console.warn("KMITORA active context persistence failed", error));

      const [allSourceObjects, allTargetObjects] = await Promise.all([
        api<CatalogObject[]>(`/source-api/v1/sources/${encodeURIComponent(source.id)}/objects`),
        api<CatalogObject[]>(`/target-api/v1/targets/${encodeURIComponent(target.id)}/objects`),
      ]);

      const targetObjects = allTargetObjects.filter((o) => o.type === "table" || o.type === "view");
      const targetStems = new Set(targetObjects.map((o) => stem(o.name)));
      const sourceObjectsAll = allSourceObjects.filter((o) => o.type === "table" || o.type === "view");
      const exactScope = sourceObjectsAll.filter((o) => targetStems.has(stem(o.name)));
      const topLevelScope = sourceObjectsAll.filter((o) => !/[\\/]/.test(o.name));
      const sourceObjects = exactScope.length ? exactScope : (topLevelScope.length ? topLevelScope : sourceObjectsAll);
      if (!sourceObjects.length) throw new Error("Connected source has no discoverable table/file objects.");
      if (!targetObjects.length) throw new Error("Connected target has no discoverable tables/views.");

      const sourceScope = compileSourceScope(requirement.rules);

      const sourceProfilesAll: EntityProfile[] = await Promise.all(sourceObjects.map(async (o) => {
        const q = new URLSearchParams({ schema: o.schema || "", object: o.name, limit: "500" });
        const serverScoped = source.type === "file" && sourceScope.mode === "FILTERED" && sourceScope.predicates.length === 1;
        if (serverScoped) {
          const predicate = sourceScope.predicates[0];
          q.set("scope_field", predicate.field);
          q.set("scope_operator", predicate.operator);
          q.set("scope_value", predicate.value);
        }
        const p = await api<Preview>(`/source-api/v1/sources/${encodeURIComponent(source.id)}/preview?${q.toString()}`);
        const rows = Array.isArray(p.rows) ? p.rows : [];
        const columns = p.columns || [];
        const supportsScope = entitySupportsScope(columns, sourceScope);
        const scopedRows = sourceScope.mode === "FILTERED" && supportsScope ? applySourceScope(rows, sourceScope) : rows;
        // totalRows is authoritative for file previews even when only the first
        // 500 rows are returned to the browser. Do not mistake preview size for
        // source population size.
        const matchedCount = typeof p.totalRows === "number"
          ? p.totalRows
          : scopedRows.length;
        const scannedCount = typeof p.scannedRows === "number"
          ? p.scannedRows
          : (typeof p.totalRows === "number" ? p.totalRows : rows.length);
        return {
          schema: o.schema,
          name: o.name,
          stem: logicalPartitionStem(o.name),
          columns,
          rowCountObserved: matchedCount,
          rowsScanned: scannedCount,
          scopeApplied: sourceScope.mode === "FILTERED" && supportsScope,
          scopeSupported: supportsScope,
          previewTruncated: matchedCount > scopedRows.length || (!p.totalRows && rows.length >= 500),
        };
      }));

      const unsupportedScopedEntities = sourceScope.mode === "FILTERED"
        ? sourceProfilesAll.filter((entity) => !entity.scopeSupported)
        : [];
      if (unsupportedScopedEntities.length) {
        throw new Error(`Requirement-derived source scope (${sourceScope.description}) cannot be enforced because these in-scope entities do not expose the required field(s): ${unsupportedScopedEntities.map((entity) => entity.name).join(", ")}. Discovery is blocked to prevent cross-scenario data leakage.`);
      }

      // Merge physical file partitions into logical business entities for the
      // UI model. This keeps repeat discovery stable and aligns the UI with the
      // authoritative backend recursive reader.
      const sourceProfiles: EntityProfile[] = source.type === "file"
        ? Array.from(sourceProfilesAll.reduce((acc, entity) => {
            const key = entity.stem;
            const current = acc.get(key);
            if (!current) {
              acc.set(key, {
                ...entity,
                name: key,
                stem: key,
                columns: [...entity.columns],
                rowCountObserved: entity.rowCountObserved,
                rowsScanned: entity.rowsScanned,
                previewTruncated: entity.previewTruncated,
              });
              return acc;
            }
            current.rowCountObserved += entity.rowCountObserved;
            current.rowsScanned += entity.rowsScanned;
            current.previewTruncated = current.previewTruncated || entity.previewTruncated;
            for (const column of entity.columns) {
              if (!current.columns.includes(column)) current.columns.push(column);
            }
            return acc;
          }, new Map<string, EntityProfile>()).values())
        : sourceProfilesAll;

      if (sourceScope.mode === "FILTERED" && sourceProfiles.reduce((sum, entity) => sum + entity.rowCountObserved, 0) === 0) {
        throw new Error(`Requirement-derived source scope (${sourceScope.description}) matched zero rows. Verify the rule value before continuing.`);
      }

      const targetProfiles: TargetProfile[] = await Promise.all(targetObjects.map(async (o) => {
        const q = new URLSearchParams({ schema: o.schema || "", object: o.name });
        const s = await api<Structure>(`/target-api/v1/targets/${encodeURIComponent(target.id)}/structure?${q.toString()}`);
        return { schema: o.schema, name: o.name, stem: stem(o.name), columns: s.columns || [] };
      }));

      const entityMappings: EntityMapping[] = sourceProfiles.map((s) => {
        const t = targetProfiles.find((x) => x.stem === s.stem)
          || targetProfiles.find((x) => x.stem.endsWith(`_${s.stem}`));
        return t ? { source: s.name, target: t.name, confidence: 100, decision: "CANDIDATE" as const } : null;
      }).filter((x): x is EntityMapping => Boolean(x));

      const fieldMappings: FieldMapping[] = [];
      for (const em of entityMappings) {
        const s = sourceProfiles.find((x) => x.name === em.source)!;
        const t = targetProfiles.find((x) => x.name === em.target)!;
        for (const sc of s.columns) {
          const tc = t.columns.find((c) => c.name.toLowerCase() === sc.toLowerCase());
          if (!tc) continue;
          const matchedRules = rulesForField(requirement.rules, sc);
          fieldMappings.push({
            source: `${s.name}.${sc}`,
            target: `${t.name}.${tc.name}`,
            action: matchedRules.some(isTransformationRule) ? "TRANSFORM" : "DIRECT_MAP",
            rules: matchedRules,
          });
        }
      }

      const relationships = inferRelations(sourceProfiles);
      const transformationCandidates = requirement.rules.map((rule, i) => ({ ruleId: `BR-${String(i + 1).padStart(3, "0")}`, rule })).filter((x) => isTransformationRule(x.rule));
      const validationCandidates = requirement.rules.map((rule, i) => ({ ruleId: `BR-${String(i + 1).padStart(3, "0")}`, rule })).filter((x) => isValidationRule(x.rule));
      const loadWaves = buildWaves(sourceProfiles, relationships);
      const sourceColumnCount = sourceProfiles.reduce((n, e) => n + e.columns.length, 0);
      const coveragePct = pct(fieldMappings.length, sourceColumnCount);

      const scopeSignature = JSON.stringify({
        sourceId: source.id,
        sourceName: source.name,
        sourceType: source.type,
        sourcePath: source.filePath || null,
        targetId: target.id,
        targetName: target.name,
        targetType: target.type,
        targetDatabase: target.database,
        targetSchema: target.schema || null,
        requirementSavedAt: requirement.savedAt || null,
        sourceScope,
      });

      const unified: UnifiedDiscovery = {
        version: "UI-006-R1",
        generatedAt: new Date().toISOString(),
        scopeSignature,
        source: { id: source.id, name: source.name, type: source.type, path: source.filePath, entities: sourceProfiles },
        target: { id: target.id, name: target.name, type: target.type, database: target.database, schema: target.schema, entities: targetProfiles },
        requirement,
        sourceScope,
        relationships,
        entityMappings,
        fieldMappings,
        transformationCandidates,
        validationCandidates,
        loadWaves,
        coveragePct,
        safety: { sourceReadOnly: true, targetReadOnlyDuringDiscovery: true, productionWritesEnabled: false, cutoverEnabled: false },
      };
      // STALE-DISCOVERY-BANNER-001: once live source/target discovery has
      // completed successfully, clear any historical discovery error before
      // attempting authoritative staging promotion. Promotion failures belong
      // to the evidence/staging sync channel and must never relabel a valid
      // Unified Discovery result as "Discovery blocked".
      unifiedDiscoverySucceeded = true;
      setError("");

      // Authoritative current migration discovery state.
      localStorage.setItem(DISCOVERY_KEY, JSON.stringify(unified));
      void fetch("/api/v1/ui-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          active_source_id: source.id,
          active_target_id: target.id,
          business_requirement: requirement,
          last_good_discovery: unified,
        }),
      }).catch((error) => console.warn("KMITORA discovery persistence failed", error));

      // UI-007 / UI-008 downstream compatibility projection.
      // This object is DERIVED from kmitora.discovery.unified.v1.
      // It is not an independent source of truth.
      const migrationId =
        `DEV-UNIFIED-${String(unified.generatedAt)
          .replace(/\D/g, "")
          .slice(0, 14)}`;

      const compatibilityDiscovery = {
        migration_id: migrationId,
        version: unified.version,
        generated_at: unified.generatedAt,

        source: unified.source,
        target: unified.target,

        business_rules:
          unified.requirement?.rules ?? [],

        source_scope: unified.sourceScope,

        relationships:
          unified.relationships ?? [],

        load_waves:
          unified.loadWaves ?? [],

        suggested_mappings:
          (unified.fieldMappings ?? []).map((m: any) => ({
            source: m.source,
            target: m.target,
            decision: "CANDIDATE",
            confidence: 100,
            rule:
              Array.isArray(m.rules) && m.rules.length
                ? m.rules.join(", ")
                : m.action,
            business_rule:
              Array.isArray(m.rules) && m.rules.length
                ? m.rules.join(", ")
                : "",
            action: m.action,
            rules: m.rules ?? [],
          })),

        transformation_plan:
          (unified.fieldMappings ?? []).map((m: any) => {
            const source = String(m.source ?? "");
            const dot = source.lastIndexOf(".");

            const entity =
              dot >= 0
                ? source.slice(0, dot)
                : source;

            const field =
              dot >= 0
                ? source.slice(dot + 1)
                : source;

            return {
              source: m.source,
              target: m.target,

              entity,
              field,

              action: m.action,

              rule:
                Array.isArray(m.rules) && m.rules.length
                  ? m.rules.join(", ")
                  : m.action,

              expression:
                Array.isArray(m.rules) && m.rules.length
                  ? m.rules.join(", ")
                  : m.action,

              rules: m.rules ?? [],

              category:
                m.action === "TRANSFORM"
                  ? "BUSINESS_RULE"
                  : "DIRECT_MAP",

              status: "PLANNED",
              severity: "LOW",
            };
          }),

        validation_plan:
          unified.validationCandidates ?? [],

        transformation_candidates:
          unified.transformationCandidates ?? [],

        quality_findings: [],

        coverage_pct:
          unified.coveragePct ?? 0,

        safety:
          unified.safety,

        compatibility_projection: true,

        authoritative_key:
          "kmitora.discovery.unified.v1",
      };

      // EXEC-STAGE-001: Unified Discovery must not hand downstream stages a
      // metadata-only compatibility projection. Promote the same governed
      // migration id immediately through the authoritative backend discovery
      // engine so target_staging_plan, quality evidence and execution counts
      // are available before approval can be requested.
      const authoritativeResponse = await apiPost<any>(
        "/api/v1/discovery/jobs",
        {
          migration_id: migrationId,
          ...(source.filePath
            ? { source_path: source.filePath }
            : { source_id: source.id }),
          target_schema: {
            type: target.type || "postgresql",
            name: target.name || "",
            database: target.database || "",
            schema: target.schema || "public",
            entities: targetProfiles,
          },
          business_rules: unified.requirement?.rules ?? [],
          // EXEC-STAGE-002: authoritative staging must be built from exactly
          // the same scoped entities and matched row counts shown in Unified
          // Discovery. This prevents a broad source folder from silently
          // staging unrelated scenario/control files.
          source_entity_allowlist: sourceProfiles.map((entity) => entity.name),
          expected_entity_row_counts: Object.fromEntries(
            sourceProfiles.map((entity) => [entity.name, entity.rowCountObserved])
          ),
          expected_scoped_record_count: sourceProfiles.reduce(
            (sum, entity) => sum + entity.rowCountObserved,
            0
          ),
        }
      );

      const authoritativePayload =
        authoritativeResponse?.payload ?? authoritativeResponse;

      const promotedDiscovery = {
        ...compatibilityDiscovery,
        suggested_mappings:
          authoritativePayload?.suggested_mappings ??
          compatibilityDiscovery.suggested_mappings,
        transformation_plan:
          authoritativePayload?.transformation_plan ??
          compatibilityDiscovery.transformation_plan,
        quality_findings:
          authoritativePayload?.quality_findings ?? [],
        target_staging_plan:
          authoritativePayload?.target_staging_plan ?? null,
        summary:
          authoritativePayload?.summary ?? {},
        authoritative_evidence_synced_at:
          new Date().toISOString(),
        authoritative_promotion:
          "AUTO_SYNCED",
      };

      const promotedReady = Number(
        promotedDiscovery?.summary?.staging_ready_count ??
        promotedDiscovery?.target_staging_plan?.ready_records?.length ??
        0
      );
      const promotedReview = Number(
        promotedDiscovery?.summary?.staging_review_count ??
        promotedDiscovery?.target_staging_plan?.review_records?.length ??
        0
      );
      const promotedQuarantine = Number(
        promotedDiscovery?.summary?.staging_quarantine_count ??
        promotedDiscovery?.target_staging_plan?.quarantine_records?.length ??
        0
      );
      const promotedRejected = Number(
        promotedDiscovery?.summary?.staging_rejected_count ??
        promotedDiscovery?.target_staging_plan?.rejected_records?.length ??
        0
      );
      const promotedTotal =
        promotedReady + promotedReview + promotedQuarantine + promotedRejected;
      const expectedScopedTotal = sourceProfiles.reduce(
        (sum, entity) => sum + entity.rowCountObserved,
        0
      );

      if (promotedTotal !== expectedScopedTotal) {
        throw new Error(
          `Authoritative staging mismatch: Unified Discovery scoped ${expectedScopedTotal} records, ` +
          `but authoritative staging classified ${promotedTotal}. Execution is blocked.`
        );
      }

      if (promotedReady <= 0) {
        throw new Error(
          "Authoritative discovery produced zero ready staging records. " +
          "Execution promotion is blocked until governed staging is populated."
        );
      }

      persistDiscoveryResult(promotedDiscovery);

      // Any approval or execution created against an earlier staging snapshot
      // is stale by definition once a new authoritative discovery is promoted.
      localStorage.removeItem("kmitora.dev.approvalRequest");
      localStorage.removeItem("kmitora.dev.executionResult");
      localStorage.removeItem("kmitora.dev.executionId");
      setSyncSummary(authoritativePayload?.summary ?? null);

      localStorage.setItem(
        "kmitora.dev.migrationId",
        migrationId
      );
      // LIFECYCLE-CONTEXT-001: one migration id correlates every downstream
      // stage. Persist it on A000 together with the last good discovery.
      void fetch("/api/v1/ui-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          active_migration_id: migrationId,
          last_good_discovery: compactDiscoveryForStorage(promotedDiscovery),
          stage_outputs: {},
        }),
      }).catch((error) => console.warn("KMITORA lifecycle migration context persistence failed", error));
      window.dispatchEvent(new CustomEvent("kmitora:unified-discovery-state", { detail: { ready: true, migrationId, sourceEntities: sourceProfiles.length, targetEntities: targetProfiles.length, rules: requirement.rules.length } }));
      setResult(unified);

      if (source.filePath) {
        setSyncPaths((prev) => ({
          ...prev,
          sourcePath: prev.sourcePath || source.filePath || "",
        }));
      }    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (unifiedDiscoverySucceeded) {
        // STALE-DISCOVERY-BANNER-001: discovery itself succeeded. Keep the
        // successful discovery visible and surface only the downstream
        // authoritative staging/evidence issue in the sync panel.
        setError("");
        setSyncError(message);
        setSyncOpen(true);
      } else {
        // REPEAT-DISCOVERY-001: a failed discovery rerun must not erase the
        // last successful result from the screen. Preserve it and show the
        // current discovery failure for the operator.
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const sourceRows = result?.source.entities.reduce((n, e) => n + e.rowCountObserved, 0) || 0;
  const ready = Boolean(result && result.source.entities.length && result.target.entities.length && result.requirement.rules.length);

  return <div className="kud-page">
      <A000ScenarioContextBanner />
        <header className="kud-header kud-header-compact">
      <div>
        <h1>Discover</h1>
        <p>Governed source, target, rule and evidence discovery.</p>
      </div>
    </header>

        {advancedRuntime && (
      <DiscoverIntelligencePanel
        runtime={advancedRuntime}
        stage="Discover"
      />
    )}
<section className="kud-safety"><strong>READ-ONLY DISCOVERY</strong><span>Source reads only | Target metadata/preview only | Production writes DISABLED | Cutover DISABLED</span></section>

    <div className="kud-actions">
      <button className="kud-primary" onClick={run} disabled={loading}>{loading ? "Discovering & Understanding..." : "Run Unified Discovery"}</button>
      <div className="kud-services">
        <span>Core <b className={serviceState.core === "UP" ? "ok" : ""}>{serviceState.core}</b></span>
        <span>Source <b className={serviceState.source === "UP" ? "ok" : ""}>{serviceState.source}</b></span>
        <span>Target <b className={serviceState.target === "UP" ? "ok" : ""}>{serviceState.target}</b></span>
      </div>
      {ready && <span className="kud-ready">UNDERSTOOD</span>}
    </div>

    {ready && (
      <section style={{
        margin: "12px 0 20px",
        padding: "14px 16px",
        border: "1px dashed #94a3b8",
        borderRadius: 8,
        background: "#f8fafc",
      }}>
        <button
          type="button"
          onClick={() => setSyncOpen((v) => !v)}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            color: "#334155",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {syncOpen ? "       " : "       "} Sync server-verified evidence (recommended before Request Approval)
        </button>

        {syncOpen && (
          <div style={{ marginTop: 10 }}>
            <p style={{ margin: "0 0 10px", color: "#64748b", fontSize: 13 }}>
              The backend independently recomputes ready/review/quarantine/rejected
              counts from the same active source, target metadata and saved business
              requirement used by Unified Discovery. This keeps Approval and Execute
              Migration aligned without requiring duplicate file-path inputs.
            </p>
            <div style={{ display: "grid", gap: 6, maxWidth: 760, marginTop: 10, fontSize: 12, color: "#475569" }}>
              <div><strong>Source:</strong> {result?.source?.name || "Active connected source"}</div>
              <div><strong>Target:</strong> {result?.target?.name || "Active connected target"}</div>
              <div>
                <strong>Business rules:</strong> {Array.isArray(result?.requirement?.rules) ? result.requirement.rules.length : 0} saved rules
              </div>
              <div>
                <strong>Supporting artifacts:</strong> {Array.isArray(result?.requirement?.attachments) ? result.requirement.attachments.length : 0}
              </div>
              <div style={{ color: "#166534" }}>
                Uses the same governed source resolver, target metadata, saved requirement, supporting artifacts and entity counts as Unified Discovery. No separate source/schema/rules file is required.
              </div>
            </div>

            <button
              type="button"
              onClick={syncAuthoritativeEvidence}
              disabled={syncing}
              style={{
                marginTop: 10,
                padding: "8px 14px",
                background: "#2563eb",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: syncing ? "default" : "pointer",
              }}
            >
              {syncing ? "Syncing..." : "Sync Authoritative Evidence"}
            </button>

            {syncError && (
              <p style={{ color: "#b91c1c", marginTop: 8, fontSize: 13 }}>
                {syncError}
              </p>
            )}

            {syncSummary && !syncError && (
              <p style={{ color: "#166534", marginTop: 8, fontSize: 13 }}>
                Synced | Ready {syncSummary.staging_ready_count ?? 0}   {" "}
                Review {syncSummary.staging_review_count ?? 0}   {" "}
                Quarantine {syncSummary.staging_quarantine_count ?? 0}   {" "}
                Rejected {syncSummary.staging_rejected_count ?? 0}.
                Go to Validate/Migrate          these numbers will now match what
                Execute Migration checks against.
              </p>
            )}
          </div>
        )}
      </section>
    )}
    {error && <div className="kud-error"><strong>Discovery blocked</strong><span>{error}</span></div>}

    {result?.sourceScope?.mode === "FILTERED" && <section className="kud-safety"><strong>READ-ONLY DISCOVERY</strong><span>Source reads only | Target metadata/preview only | Production writes DISABLED | Cutover DISABLED</span></section>}

    <section className="kud-kpis">
      <div><span>Source Entities</span><strong>{result?.source.entities.length || 0}</strong><small>Live source scope</small></div>
      <div><span>Target Entities</span><strong>{result?.target.entities.length || 0}</strong><small>Live target catalog</small></div>
      <div><span>Business Rules</span><strong>{result?.requirement.rules.length || 0}</strong><small>UI-005 saved rules</small></div>
      <div><span>Relationships</span><strong>{result?.relationships.length || 0}</strong><small>Structural dependencies</small></div>
      <div><span>Rows Observed</span><strong>{sourceRows}</strong><small>Read-only preview scope</small></div>
      <div><span>Field Coverage</span><strong>{result ? `${result.coveragePct}%` : "0%"}</strong><small>Exact field candidates</small></div>
    </section>

    <div className="kud-grid">
      <section className="kud-card">
        <div className="kud-card-head"><div><span>F1    CURRENT STATE</span><h2>Source Understanding</h2></div><b>{result?.source.type || "WAITING"}</b></div>
        {!result ? <div className="kud-empty">Run Unified Discovery to inspect the connected source.</div> : <>
          <div className="kud-meta"><span>{result.source.name}</span><span>{result.source.path || "Connected database source"}</span></div>
          <table><thead><tr><th>Entity</th><th>Columns</th><th>Rows Matched</th><th>Rows Scanned</th></tr></thead><tbody>{result.source.entities.map((e) => <tr key={e.name}><td>{e.name}</td><td>{e.columns.length}</td><td>{e.previewTruncated ? `${e.rowCountObserved}+` : e.rowCountObserved}</td><td>{e.rowsScanned}</td></tr>)}</tbody></table>
        </>}
      </section>

      <section className="kud-card">
        <div className="kud-card-head"><div><span>F2    DESIRED STATE</span><h2>Target Understanding</h2></div><b>{result?.target.type || "WAITING"}</b></div>
        {!result ? <div className="kud-empty">Run Unified Discovery to inspect the connected target.</div> : <>
          <div className="kud-meta"><span>{result.target.name}</span><span>{result.target.database}    {result.target.schema || "default schema"}</span></div>
          <table><thead><tr><th>Entity</th><th>Columns</th><th>Schema</th></tr></thead><tbody>{result.target.entities.map((e) => <tr key={`${e.schema}.${e.name}`}><td>{e.name}</td><td>{e.columns.length}</td><td>{e.schema}</td></tr>)}</tbody></table>
        </>}
      </section>
    </div>

    <div className="kud-grid">
      <section className="kud-card">
        <div className="kud-card-head"><div><span>SEMANTIC ALIGNMENT</span><h2>Entity & Field Mapping Candidates</h2></div><b>{result?.fieldMappings.length || 0} fields</b></div>
        {!result ? <div className="kud-empty">No mapping candidates until discovery completes.</div> : <>
          <div className="kud-flow">{result.entityMappings.map((m) => <div key={m.source}><strong>{m.source}</strong><span>   </span><strong>{m.target}</strong><em>{m.confidence}% candidate</em></div>)}</div>
          <div className="kud-summary-line"><span>Direct map: {result.fieldMappings.filter((x) => x.action === "DIRECT_MAP").length}</span><span>Transform: {result.fieldMappings.filter((x) => x.action === "TRANSFORM").length}</span></div>
        </>}
      </section>

      <section className="kud-card">
        <div className="kud-card-head"><div><span>DEPENDENCY DAG</span><h2>Relationships & Load Waves</h2></div><b>{result?.loadWaves.length || 0} waves</b></div>
        {!result ? <div className="kud-empty">Dependencies will be inferred from actual entity keys.</div> : <>
          <div className="kud-relations">{result.relationships.length ? result.relationships.map((r) => <div key={`${r.parent}-${r.child}-${r.key}`}><strong>{r.parent}</strong><span>    {r.key}    </span><strong>{r.child}</strong></div>) : <span>No structural relationship detected.</span>}</div>
          <div className="kud-waves">{result.loadWaves.map((w, i) => <div key={i}><b>Wave {i + 1}</b><span>{w.join(", ")}</span></div>)}</div>
        </>}
      </section>
    </div>

    <div className="kud-grid">
      <section className="kud-card">
        <div className="kud-card-head"><div><span>BUSINESS INTELLIGENCE</span><h2>Requirement Interpretation</h2></div><b>{result?.requirement.rules.length || 0} rules</b></div>
        {!result ? <div className="kud-empty">Saved UI-005 rules will be interpreted here.</div> : <div className="kud-rule-metrics"><div><strong>{result.transformationCandidates.length}</strong><span>Transformation candidates</span></div><div><strong>{result.validationCandidates.length}</strong><span>Validation / governance candidates</span></div><div><strong>{result.requirement.attachments?.length || 0}</strong><span>Supporting artifacts</span></div></div>}
      </section>

      <section className="kud-card">
        <div className="kud-card-head"><div><span>GOVERNANCE</span><h2>Discovery Decision</h2></div><b className={ready ? "kud-green" : ""}>{ready ? "READY FOR MAP" : "WAITING"}</b></div>
        <div className="kud-governance"><p>Source write executed: <strong>NO</strong></p><p>Target write executed: <strong>NO</strong></p><p>Production action executed: <strong>NO</strong></p><p>Cutover: <strong>DISABLED</strong></p></div>
      </section>
    </div>

    <section className="kud-next"><div><span>{ready ? "READY" : "DISCOVERY REQUIRED"}</span><h2>Continue to Detect</h2><p>{ready ? "Unified discovery context is persisted. Continue to governed error, anomaly, drift and silent-failure detection." : "Run Unified Discovery before continuing."}</p></div><button disabled={!ready} onClick={() => onNavigate ? onNavigate("detect") : window.dispatchEvent(new CustomEvent("kmitora:navigate", { detail: { page: "detect" } }))}>Continue to Detect</button></section>
  </div>;
}











