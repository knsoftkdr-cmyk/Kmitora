import ConnectWorkspaceTabs from "../components/ConnectWorkspaceTabs";
import ConnectR4Toolbar from "../components/ConnectR4Toolbar";
import ProjectPickerModal from "../components/ProjectPickerModal";
import ServerFileBrowserModal from "../components/ServerFileBrowserModal";
import SourceTargetDashboard from "../components/SourceTargetDashboard";
import LegacySystemSectionsSuppressor from "../components/LegacySystemSectionsSuppressor";
import KMITORACopilotOverview from "../components/KMITORACopilotOverview";
import {
  BookOpen,
  Brain,
  Cable,
  CheckCircle2,
  Database,
  Eye,
  FilePlus2,
  FileText,
  LoaderCircle,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import "../styles/connect-premium.css";
import "../styles/connect-r4-smart.css";
import { getHealth, previewFileSource, validateFileSystemConnection } from "../services/api";
import { listProjects, loadProject, saveProject } from "../services/projectRepository";
import { runA000AutoDiscovery, topologySignature } from "../services/autoOrchestration";
import type { A000WorkflowState } from "../models/AutomationWorkflow";
import type { DataViewPayload } from "../models/DataViewer";
import type { A000IntentPlan, KnowledgeItem } from "../models/KnowledgeContext";
import { a000KnowledgePacks } from "../config/knowledgePackRegistry";
import { bankingRecoveredSources, shouldRecoverBankingSources } from "../config/bankingRecoveredSources";
import { buildMigrationIntentPlan, createPromptKnowledgeItem, registerKnowledgeFile } from "../services/a000KnowledgeEngine";
import { loadSystemDataView } from "../services/dataViewer";
import A000EnterpriseIntelligencePanel from "../components/A000EnterpriseIntelligencePanel";
import A000DigitalTwinPanel from "../components/A000DigitalTwinPanel";
import A000CapabilityCoveragePanel from "../components/A000CapabilityCoveragePanel";
import {
  connectorCategories,
  connectorRegistry,
  type ConnectorDefinition,
} from "../config/connectorRegistry";
import type {
ConnectionReadiness,
  ConnectorCategory,
  MigrationSystem,
  SystemRole,
  TopologyRelationship,
  TopologyType,
} from "../models/MigrationTopology";
import TargetConnectionManagement from "../components/TargetConnectionManagement";

const SOURCE_DEFAULT_PATH = "";
const SOURCE_DEFAULT_PATTERN = "";
const TARGET_DEFAULT_PATH = "";
const TARGET_DEFAULT_PATTERN = "";

const topologyLabels: Record<TopologyType, string> = {
  ONE_TO_ONE: "One Source -> One Target",
  ONE_TO_MANY: "One Source -> Multiple Targets",
  MANY_TO_ONE: "Multiple Sources -> One Target",
  MANY_TO_MANY: "Multiple Sources -> Multiple Targets",
};

type QuickConnectorName = "Oracle" | "PostgreSQL" | "SQL Server" | "File / Folder" | "S3 / Object Storage" | "REST API";

const quickConnectorDefaults: Record<QuickConnectorName, { port: string; serviceLabel: string }> = {
  Oracle: { port: "1521", serviceLabel: "Database" },
  PostgreSQL: { port: "5432", serviceLabel: "Database" },
  "SQL Server": { port: "1433", serviceLabel: "Database" },
  "File / Folder": { port: "", serviceLabel: "Database" },
  "S3 / Object Storage": { port: "443", serviceLabel: "Database" },
  "REST API": { port: "443", serviceLabel: "Database" },
};

const quickConnectorNames = Object.keys(quickConnectorDefaults) as QuickConnectorName[];

function createSystem(role: SystemRole, index: number): MigrationSystem {
  const isSource = role === "SOURCE";
  return {
    id: `${role === "SOURCE" ? "SRC" : "TGT"}-${String(index).padStart(3, "0")}`,
    role,
    name: `${role === "SOURCE" ? "Source" : "Target"} ${index}`,
    category: "FILE",
    connector: isSource ? "excel" : "flatfile",
    path: isSource ? SOURCE_DEFAULT_PATH : TARGET_DEFAULT_PATH,
    pattern: isSource ? SOURCE_DEFAULT_PATTERN : TARGET_DEFAULT_PATTERN,
    status: "NOT_CONFIGURED",
    metadataAccessible: false,
    authenticationValidated: false,
    readPermissionValidated: false,
    writePermissionValidated: false,
    targetWriteRequested: false,
    targetWriteExecuted: false,
    productionActionExecuted: false,
  };
}

function connectorName(id: string) {
  return connectorRegistry.find((item) => item.id === id)?.name ?? id;
}

function inferFileConnector(pattern: string, fallback: string) {
  const value = pattern.trim().toLowerCase();

  if (value.endsWith(".csv")) return "csv";
  if (value.endsWith(".xlsx") || value.endsWith(".xls")) return "excel";

  if (
    value.endsWith(".json") ||
    value.endsWith(".jsonl") ||
    value.endsWith(".ndjson")
  ) return "json";

  if (value.endsWith(".parquet")) return "parquet";
  if (value.endsWith(".xml")) return "xml";
  if (value.endsWith(".avro")) return "avro";
  if (value.endsWith(".orc")) return "orc";

  if (
    value.endsWith(".txt") ||
    value.endsWith(".tsv") ||
    value.endsWith(".psv") ||
    value.endsWith(".flat")
  ) return "flatfile";

  return fallback;
}

function buildRelationships(
  topologyType: TopologyType,
  sources: MigrationSystem[],
  targets: MigrationSystem[]
): TopologyRelationship[] {
  const relationships: TopologyRelationship[] = [];
  const add = (sourceSystemId: string, targetSystemId: string) => {
    relationships.push({
      id: `REL-${relationships.length + 1}`,
      sourceSystemId,
      targetSystemId,
      confidence: 100,
      discoveredBy: "USER",
      status: "VALIDATED",
    });
  };

  if (topologyType === "ONE_TO_ONE") {
    if (sources[0] && targets[0]) add(sources[0].id, targets[0].id);
  } else if (topologyType === "ONE_TO_MANY") {
    if (sources[0]) targets.forEach((target) => add(sources[0].id, target.id));
  } else if (topologyType === "MANY_TO_ONE") {
    if (targets[0]) sources.forEach((source) => add(source.id, targets[0].id));
  } else {
    sources.forEach((source) => targets.forEach((target) => add(source.id, target.id)));
  }

  return relationships;
}

export default function Connect() {
  const [topologyType, setTopologyType] = useState<TopologyType>("ONE_TO_ONE");
  const [sources, setSources] = useState<MigrationSystem[]>([createSystem("SOURCE", 1)]);
  const [targets, setTargets] = useState<MigrationSystem[]>([createSystem("TARGET", 1)]);
  const [globalMessage, setGlobalMessage] = useState("Configure and validate the required systems to enable guided automation.");
  const [workflowState, setWorkflowState] = useState<A000WorkflowState | null>(null);
  const [openViewer, setOpenViewer] = useState<{ role: SystemRole; systemId: string } | null>(null);
  const [viewerData, setViewerData] = useState<DataViewPayload | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState("");
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [businessPrompt, setBusinessPrompt] = useState("");
  const [migrationPrompt, setMigrationPrompt] = useState("");
  const [intentPlan, setIntentPlan] = useState<A000IntentPlan | null>(null);
  const autoStartSignatureRef = useRef("");
  const [stateHydrated, setStateHydrated] = useState(false);

  // KMITORA Connect R4 - persistent project workspace.
  const [projectId] = useState("banking-multi-format-validation");
  const [projectName] = useState("Banking Multi-Format Validation");
  const [savedLabel, setSavedLabel] = useState("Not saved yet");
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projects, setProjects] = useState<Array<{
    projectId: string;
    projectName: string;
    updatedAt?: string;
    sourceCount?: number;
    targetCount?: number;
    currentStage?: string;
  }>>([]);
  const [systemQuery, setSystemQuery] = useState("");
  const [fileBrowser, setFileBrowser] = useState<{
    role: SystemRole;
    systemId: string;
  } | null>(null);

  // DEV-safe quick connection workspace retained alongside the richer topology model.
  // It provides a simple connector-first path while preserving the governed multi-system architecture below.
  const [quickConnector, setQuickConnector] = useState<QuickConnectorName>("PostgreSQL");
  const [quickHost, setQuickHost] = useState("");
  const [quickPort, setQuickPort] = useState("5432");
  const [quickDatabase, setQuickDatabase] = useState("");
  const [quickUsername, setQuickUsername] = useState("");
  const [quickSecret, setQuickSecret] = useState("");
  const [quickConnectionStatus, setQuickConnectionStatus] = useState<"NOT TESTED" | "TESTING" | "REACHABLE" | "FAILED">("NOT TESTED");
  const [quickConnectionMessage, setQuickConnectionMessage] = useState("");

  const relationships = useMemo(
    () => buildRelationships(topologyType, sources, targets),
    [topologyType, sources, targets]
  );

  const readiness = useMemo<ConnectionReadiness>(() => {
    const validatedSourceCount = sources.filter((item) => item.status === "VALIDATED").length;
    const validatedTargetCount = targets.filter((item) => item.status === "VALIDATED").length;
    const allSourcesValidated = sources.length > 0 && validatedSourceCount === sources.length;
    const allTargetsValidated = targets.length > 0 && validatedTargetCount === targets.length;
    const topologyValidated = relationships.length > 0;
    const overallReady = allSourcesValidated && allTargetsValidated && topologyValidated;
    return {
      sourceCount: sources.length,
      validatedSourceCount,
      targetCount: targets.length,
      validatedTargetCount,
      allSourcesValidated,
      allTargetsValidated,
      topologyValidated,
      overallReady,
      workflowEligible: overallReady,
      targetWriteRequested: false,
      targetWriteExecuted: false,
      productionActionExecuted: false,
    };
  }, [sources, targets, relationships]);

  function persistState(nextSources = sources, nextTargets = targets) {
    const nextRelationships = buildRelationships(topologyType, nextSources, nextTargets);
    const validatedSourceCount = nextSources.filter((item) => item.status === "VALIDATED").length;
    const validatedTargetCount = nextTargets.filter((item) => item.status === "VALIDATED").length;
    const allSourcesValidated = nextSources.length > 0 && validatedSourceCount === nextSources.length;
    const allTargetsValidated = nextTargets.length > 0 && validatedTargetCount === nextTargets.length;
    const nextReadiness: ConnectionReadiness = {
      sourceCount: nextSources.length,
      validatedSourceCount,
      targetCount: nextTargets.length,
      validatedTargetCount,
      allSourcesValidated,
      allTargetsValidated,
      topologyValidated: nextRelationships.length > 0,
      overallReady: allSourcesValidated && allTargetsValidated && nextRelationships.length > 0,
      workflowEligible: allSourcesValidated && allTargetsValidated && nextRelationships.length > 0,
      targetWriteRequested: false,
      targetWriteExecuted: false,
      productionActionExecuted: false,
    };

    localStorage.setItem("kmitora.dev.sources", JSON.stringify(nextSources));
    localStorage.setItem("kmitora.dev.targets", JSON.stringify(nextTargets));
    localStorage.setItem("kmitora.dev.topologyType", topologyType);
    localStorage.setItem("kmitora.dev.topologyRelationships", JSON.stringify(nextRelationships));
    localStorage.setItem("kmitora.dev.connectionReadiness", JSON.stringify(nextReadiness));

    if (nextSources.length === 1) {
      const source = nextSources[0];
      localStorage.setItem("kmitora.dev.sourceConnection", JSON.stringify(source));
      localStorage.setItem(
        "kmitora.dev.sourceValidation",
        JSON.stringify({ status: source.status === "VALIDATED" ? "VALIDATED" : source.status, connector: source.connector, validatedAt: source.validatedAt })
      );
      if (source.category === "FILE") {
        localStorage.setItem(
          "kmitora.dev.connectionDraft",
          JSON.stringify({
            connector: "File / Folder",
            host: source.path ?? "",
            port: "",
            service: source.pattern ?? "",
            username: source.username ?? "",
            savedAt: new Date().toISOString(),
          })
        );
      }
    }

    if (nextTargets.length === 1) {
      const target = nextTargets[0];
      localStorage.setItem("kmitora.dev.targetConnection", JSON.stringify(target));
      localStorage.setItem(
        "kmitora.dev.targetValidation",
        JSON.stringify({ status: target.status === "VALIDATED" ? "VALIDATED" : target.status, connector: target.connector, validatedAt: target.validatedAt })
      );
    }

    localStorage.setItem(
      "kmitora.dev.workflowState",
      JSON.stringify({
        status: nextReadiness.workflowEligible ? "AUTO_START_ELIGIBLE" : "WAITING_FOR_CONNECTIONS",
        currentStage: nextReadiness.workflowEligible ? "DISCOVERY_READY" : "CONNECT",
        targetWriteRequested: false,
        targetWriteExecuted: false,
        productionActionExecuted: false,
        updatedAt: new Date().toISOString(),
      })
    );
  }

  function updateSystem(role: SystemRole, id: string, patch: Partial<MigrationSystem>) {
    if (role === "SOURCE") {
      setSources((current) => current.map((item) => (item.id === id ? { ...item, ...patch, status: patch.status ?? (item.status === "VALIDATED" ? "CONFIGURED" : item.status) } : item)));
    } else {
      setTargets((current) => current.map((item) => (item.id === id ? { ...item, ...patch, status: patch.status ?? (item.status === "VALIDATED" ? "CONFIGURED" : item.status) } : item)));
    }
  }

  function addSystem(role: SystemRole) {
    if (role === "SOURCE") {
      setSources((current) => [...current, createSystem(role, current.length + 1)]);
    } else {
      setTargets((current) => [...current, createSystem(role, current.length + 1)]);
    }
  }

  function addSourceSmart() {
    addSystem("SOURCE");
    window.setTimeout(() => {
      window.scrollTo({
        top: document.body.scrollHeight,
        behavior: "smooth",
      });
    }, 80);
  }

  function addTargetSmart() {
    addSystem("TARGET");
    window.setTimeout(() => {
      window.scrollTo({
        top: document.body.scrollHeight,
        behavior: "smooth",
      });
    }, 80);
  }

  async function saveCurrentProject() {
    const snapshot = {
      projectId,
      projectName,
      topologyType,
      sources,
      targets,
      knowledgeItems,
      businessPrompt,
      migrationPrompt,
      workflowState,
      currentStage: "Connect",
      updatedAt: new Date().toISOString(),
    };

    const result = await saveProject(snapshot);
    const savedAt =
      result?.payload?.updatedAt ??
      new Date().toISOString();

    setSavedLabel(
      `Saved ${new Date(savedAt).toLocaleTimeString()}`
    );
  }

  async function openProjects() {
    setProjectsLoading(true);
    setProjectModalOpen(true);

    try {
      const result = await listProjects();
      setProjects(result?.payload?.projects ?? []);
    } catch (error) {
      setGlobalMessage(
        error instanceof Error
          ? `Project repository unavailable: ${error.message}`
          : "Project repository unavailable."
      );
    } finally {
      setProjectsLoading(false);
    }
  }

  async function resumeProject(id: string) {
    try {
      const result = await loadProject(id);
      const project = result?.payload?.project;

      if (!project) {
        throw new Error("Saved project payload was not returned.");
      }

      if (project.topologyType) {
        setTopologyType(project.topologyType as TopologyType);
      }

      if (Array.isArray(project.sources)) {
        setSources(project.sources as MigrationSystem[]);
      }

      if (Array.isArray(project.targets)) {
        setTargets(project.targets as MigrationSystem[]);
      }

      if (Array.isArray(project.knowledgeItems)) {
        setKnowledgeItems(project.knowledgeItems as KnowledgeItem[]);
      }

      if (typeof project.businessPrompt === "string") {
        setBusinessPrompt(project.businessPrompt);
      }

      if (typeof project.migrationPrompt === "string") {
        setMigrationPrompt(project.migrationPrompt);
      }

      if (project.workflowState) {
        setWorkflowState(project.workflowState as A000WorkflowState);
      }

      setProjectModalOpen(false);

      if (project.updatedAt) {
        setSavedLabel(
          `Resumed ${new Date(project.updatedAt).toLocaleString()}`
        );
      } else {
        setSavedLabel("Project resumed");
      }

      setGlobalMessage(
        `Project "${project.projectName ?? id}" restored. Continue from the saved Connect state.`
      );
    } catch (error) {
      setGlobalMessage(
        error instanceof Error
          ? `Unable to resume project: ${error.message}`
          : "Unable to resume project."
      );
    }
  }

  function removeSystem(role: SystemRole, id: string) {
    if (role === "SOURCE") {
      setSources((current) => (current.length === 1 ? current : current.filter((item) => item.id !== id)));
    } else {
      setTargets((current) => (current.length === 1 ? current : current.filter((item) => item.id !== id)));
    }
  }

  async function validateSystem(system: MigrationSystem) {
    updateSystem(system.role, system.id, { status: "TESTING", message: "Validating connection..." });
    try {
      const effectiveConnector =
        system.category === "FILE"
          ? inferFileConnector(system.pattern ?? "", system.connector)
          : system.connector;

      const definition = connectorRegistry.find(
        (item) => item.id === effectiveConnector
      );

      if (!definition) throw new Error("Connector definition not found.");

      if (system.category === "FILE") {
        if (!system.path?.trim()) throw new Error("Path is required.");
        if (!system.pattern?.trim()) throw new Error("File name or pattern is required.");
        const result = await validateFileSystemConnection(system.role, system.path.trim(), system.pattern.trim());
        if (result?.payload?.status !== "READY") {
          throw new Error(result?.payload?.message ?? `${system.role} file connector is not ready.`);
        }
      } else {
        if (!system.host?.trim()) throw new Error("Host / endpoint is required.");
        if (!definition.liveAdapter) {
          throw new Error(`${definition.name} live ${system.role.toLowerCase()} adapter is registered but not enabled yet.`);
        }
      }

      const health = await getHealth();
      const backendStatus = health?.payload?.status ?? health?.status ?? "UNKNOWN";
      if (backendStatus !== "UP") throw new Error(`Backend status is ${backendStatus}`);

      const validatedAt = new Date().toISOString();
      if (system.role === "SOURCE") {
        setSources((current) => {
          const next = current.map((item) => item.id === system.id ? {
            ...item,
            connector: effectiveConnector,
            status: "VALIDATED" as const,
            message: `${connectorName(effectiveConnector)} source validated.`,
            metadataAccessible: true,
            authenticationValidated: true,
            readPermissionValidated: true,
            validatedAt,
          } : item);
          persistState(next, targets);
          return next;
        });
      } else {
        setTargets((current) => {
          const next = current.map((item) => item.id === system.id ? {
            ...item,
            connector: effectiveConnector,
            status: "VALIDATED" as const,
            message: `${connectorName(effectiveConnector)} target validated.`,
            metadataAccessible: true,
            authenticationValidated: true,
            readPermissionValidated: true,
            writePermissionValidated: false,
            targetWriteRequested: false as const,
            targetWriteExecuted: false as const,
            productionActionExecuted: false as const,
            validatedAt,
          } : item);
          persistState(sources, next);
          return next;
        });
      }
    } catch (error) {
      updateSystem(system.role, system.id, {
        status: "FAILED",
        message: error instanceof Error ? error.message : "Connection validation failed.",
      });
    }
  }

  useEffect(() => {
    try {
      const savedSources = localStorage.getItem("kmitora.dev.sources");
      const savedTargets = localStorage.getItem("kmitora.dev.targets");
      const savedTopology = localStorage.getItem("kmitora.dev.topologyType") as TopologyType | null;
      const savedWorkflow = localStorage.getItem("kmitora.dev.workflowState");
      const savedKnowledge = localStorage.getItem("kmitora.dev.knowledgeItems");
      const savedIntent = localStorage.getItem("kmitora.dev.a000IntentPlan");

      if (savedSources) {
        const parsedSources = JSON.parse(savedSources) as MigrationSystem[];
        setSources(
          shouldRecoverBankingSources(parsedSources)
            ? bankingRecoveredSources
            : parsedSources
        );
      } else {
        setSources(bankingRecoveredSources);
      }
      if (savedTargets) setTargets(JSON.parse(savedTargets));
      if (savedTopology && topologyLabels[savedTopology]) setTopologyType(savedTopology);
      if (savedWorkflow) setWorkflowState(JSON.parse(savedWorkflow));
      if (savedKnowledge) setKnowledgeItems(JSON.parse(savedKnowledge));
      if (savedIntent) setIntentPlan(JSON.parse(savedIntent));
    } catch {
      setGlobalMessage("Saved DEV topology could not be restored. Configure connections again.");
    } finally {
      setStateHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!stateHydrated) return;

    persistState(sources, targets);
  }, [sources, targets, topologyType, stateHydrated]);

  useEffect(() => {
    if (!stateHydrated) return;
    if (!readiness.workflowEligible) return;

    const signature = topologySignature(sources, targets, relationships);
    if (autoStartSignatureRef.current === signature) return;
    autoStartSignatureRef.current = signature;

    const queuedAt = new Date().toISOString();
    const queued: A000WorkflowState = {
      status: "DISCOVERY_QUEUED",
      currentStage: "DISCOVERY_QUEUED",
      topologySignature: signature,
      updatedAt: queuedAt,
      totalRelationships: relationships.length,
      discoveredRelationships: 0,
      skippedRelationships: 0,
      failedRelationships: 0,
      results: [],
      targetWriteRequested: false,
      targetWriteExecuted: false,
      productionActionExecuted: false,
    };
    setWorkflowState(queued);
    localStorage.setItem("kmitora.dev.workflowState", JSON.stringify(queued));
    setGlobalMessage("KMITORA automation started automatically. Discovery is being orchestrated across the validated topology.");

    void runA000AutoDiscovery({
      sources,
      targets,
      relationships,
      onState: (next) => {
        setWorkflowState(next);
        localStorage.setItem("kmitora.dev.workflowState", JSON.stringify(next));
        localStorage.setItem("kmitora.dev.autoDiscoveryResults", JSON.stringify(next.results));

        const firstDiscovery = next.results.find((item) => item.status === "DISCOVERED" && item.result);
        if (firstDiscovery?.result) {
          localStorage.setItem("kmitora.dev.legacyDiscoveryResult", JSON.stringify(firstDiscovery.result));
          localStorage.setItem("kmitora.dev.legacyMigrationId", firstDiscovery.migrationId);
        }
      },
    });
  }, [readiness.workflowEligible, sources, targets, relationships]);

  function changeTopology(value: TopologyType) {
    setTopologyType(value);
    setGlobalMessage(`Topology selected: ${topologyLabels[value]}`);
    localStorage.setItem("kmitora.dev.topologyType", value);
  }

  function connectorOptions(system: MigrationSystem): ConnectorDefinition[] {
    return connectorRegistry.filter(
      (item) => item.category === system.category && (system.role === "SOURCE" ? item.sourceSupported : item.targetSupported)
    );
  }

  function persistKnowledge(next: KnowledgeItem[]) {
    setKnowledgeItems(next);
    localStorage.setItem("kmitora.dev.knowledgeItems", JSON.stringify(next));
  }

  function addBusinessPrompt() {
    const text = businessPrompt.trim();
    if (!text) return;
    const item = createPromptKnowledgeItem(text);
    persistKnowledge([...knowledgeItems, item]);
    setBusinessPrompt("");
    setGlobalMessage("KMITORA registered the business prompt as migration knowledge and will use it during planning.");
  }

  async function handleKnowledgeFiles(files: FileList | null) {
    if (!files?.length) return;
    const registered = await Promise.all(Array.from(files).map(registerKnowledgeFile));
    persistKnowledge([...knowledgeItems, ...registered]);
    const needsBackend = registered.filter((item) => item.status === "BACKEND_INGESTION_REQUIRED").length;
    setGlobalMessage(
      needsBackend
        ? `${registered.length} knowledge item(s) registered. ${needsBackend} binary document/image item(s) are queued for the KMITORA backend ingestion adapter.`
        : `${registered.length} knowledge item(s) registered and locally understood.`
    );
  }

  function preparePromptPlan() {
    const prompt = migrationPrompt.trim();
    if (!prompt) return;
    const plan = buildMigrationIntentPlan({ prompt, sources, targets, knowledgeItems });
    setIntentPlan(plan);
    localStorage.setItem("kmitora.dev.a000IntentPlan", JSON.stringify(plan));
    setGlobalMessage(
      readiness.workflowEligible
        ? "KMITORA prepared the governed migration intent. Connected-system automation can continue with preview-first execution controls."
        : "KMITORA prepared the migration intent. Validate all required Source and Target systems to activate automation."
    );
  }

  async function toggleDataViewer(system: MigrationSystem) {
    if (openViewer?.systemId === system.id && openViewer.role === system.role) {
      setOpenViewer(null);
      setViewerData(null);
      setViewerError("");
      return;
    }

    setOpenViewer({ role: system.role, systemId: system.id });
    setViewerLoading(true);
    setViewerError("");
    setViewerData(null);

    try {
      if (
        system.role === "SOURCE" &&
        system.category === "FILE" &&
        system.path?.trim() &&
        system.pattern?.trim()
      ) {
        const preview = await previewFileSource(
          system.path.trim(),
          system.pattern.trim(),
          25
        );

        if (preview?.payload?.status !== "READY") {
          throw new Error(
            preview?.payload?.message ?? "Source preview is not ready."
          );
        }

        const rows = Array.isArray(preview?.payload?.rows)
          ? preview.payload.rows
          : [];

        const fields =
          rows.length > 0 && typeof rows[0] === "object"
            ? Object.keys(rows[0])
            : [];

        const effectiveConnector = inferFileConnector(
          system.pattern,
          system.connector
        );

        const rowCount =
          Number(preview?.payload?.row_count ?? rows.length);

        const data: DataViewPayload = {
          role: system.role,
          systemId: system.id,
          title: `${system.name} Source View`,
          mode: "CURRENT_DATA",
          message:
            "Live KMITORA read-only preview from the validated source file.",
          summary: {
            connector: connectorName(effectiveConnector),
            file: system.pattern,
            rowCount,
            readOnly: true,
            targetWriteExecuted: false,
            productionActionExecuted: false
          },
          tables: [
            {
              name: system.pattern,
              fields,
              rows,
              rowCount
            }
          ],
          readOnly: true
        };

        setViewerData(data);
        return;
      }

      const data = await loadSystemDataView({
        system,
        workflowState
      });

      setViewerData(data);
    } catch (error) {
      setViewerError(
        error instanceof Error
          ? error.message
          : "Unable to load data view."
      );
    } finally {
      setViewerLoading(false);
    }
  }

  function renderDataViewer(system: MigrationSystem) {
    if (openViewer?.systemId !== system.id || openViewer.role !== system.role) return null;
    const table = viewerData?.tables?.[0];
    return (
      <div className="km-r4-data-popup">
        <div className="panelHeader">
          <div>
            <span className="eyebrow">{system.role} VIEW - READ ONLY</span>
            <h3>{viewerData?.title ?? `${system.name} Data View`}</h3>
            <p>{viewerData?.message ?? "Live/derived KMITORA data preview. Close it when not required."}</p>
          </div>
          <button type="button" onClick={() => toggleDataViewer(system)} aria-label="Close data viewer"><X size={16} /> Close</button>
        </div>

        {viewerLoading && <p><LoaderCircle size={15} /> Loading data...</p>}
        {viewerError && <p>{viewerError}</p>}

        {viewerData && (
          <>
            <div className="checkList" style={{ marginBottom: 12 }}>
              {Object.entries(viewerData.summary).slice(0, 8).map(([key, value]) => (
                <div className="checkRow" key={key}><span /><span>{key.replaceAll("_", " ")}</span><small>{String(value)}</small></div>
              ))}
            </div>

            {table ? (
              <div style={{ overflowX: "auto", maxHeight: 320, overflowY: "auto" }}>
                <div className="panelHeader" style={{ marginBottom: 8 }}>
                  <div><strong>{table.name}</strong><p>{table.rowCount ?? table.rows.length} record(s)</p></div>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead><tr>{table.fields.slice(0, 12).map((field) => <th key={field} style={{ textAlign: "left", padding: 7, borderBottom: "1px solid #d1d5db" }}>{field}</th>)}</tr></thead>
                  <tbody>{table.rows.slice(0, 25).map((row, index) => <tr key={index}>{table.fields.slice(0, 12).map((field) => <td key={field} style={{ padding: 7, borderBottom: "1px solid #eef2f7" }}>{String(row[field] ?? "")}</td>)}</tr>)}</tbody>
                </table>
              </div>
            ) : (
              <p>No row preview is currently available for this view.</p>
            )}
          </>
        )}
      </div>
    );
  }

  function selectQuickConnector(connector: QuickConnectorName) {
    setQuickConnector(connector);
    setQuickPort(quickConnectorDefaults[connector].port);
    setQuickConnectionStatus("NOT TESTED");
    setQuickConnectionMessage("");
  }

  function saveQuickConnectionDraft() {
    // Credential / secret material is deliberately excluded from local persistence.
    localStorage.setItem(
      "kmitora.dev.connectionDraft",
      JSON.stringify({
        connector: quickConnector,
        host: quickHost,
        port: quickPort,
        service: quickDatabase,
        username: quickUsername,
        savedAt: new Date().toISOString(),
      })
    );
    setQuickConnectionMessage("Draft saved locally. Credential / secret was not persisted.");
  }

  async function testQuickConnection() {
    setQuickConnectionStatus("TESTING");
    setQuickConnectionMessage("Checking KMITORA backend health...");
    try {
      const health = await getHealth();
      const backendStatus = health?.payload?.status ?? health?.status ?? "UNKNOWN";
      if (backendStatus !== "UP") throw new Error(`Backend status is ${backendStatus}`);
      setQuickConnectionStatus("REACHABLE");
      setQuickConnectionMessage("BACKEND REACHABLE");
    } catch (error) {
      setQuickConnectionStatus("FAILED");
      setQuickConnectionMessage(error instanceof Error ? error.message : "Backend connection test failed.");
    }
  }

  function renderSystemCard(system: MigrationSystem) {
    const options = connectorOptions(system);
    const isFile = system.category === "FILE";
    const statusClass = system.status === "VALIDATED" ? "success" : system.status === "FAILED" ? "reject" : "review";

    return (
      <div className="panel" key={system.id} style={{ marginBottom: 14 }}>
        <div className="panelHeader">
          <div>
            <span className="eyebrow">{system.id}</span>
            <h3>{system.name}</h3>
            <p>{system.role === "SOURCE" ? "Input system" : "Destination system"}</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className={`statusPill ${statusClass}`}>{system.status.replaceAll("_", " ")}</span>
            <button type="button" onClick={() => removeSystem(system.role, system.id)} disabled={(system.role === "SOURCE" ? sources.length : targets.length) === 1} aria-label={`Remove ${system.name}`}>
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        <div className="formGrid">
          <label>
            <span>System Name</span>
            <input value={system.name} onChange={(e) => updateSystem(system.role, system.id, { name: e.target.value })} />
          </label>

          <label>
            <span>Connector Category</span>
            <select
              aria-label={`Connector Category ${system.role} ${system.id}`}
              value={system.category}
              onChange={(e) => {
                const category = e.target.value as ConnectorCategory;
                const first = connectorRegistry.find((item) => item.category === category && (system.role === "SOURCE" ? item.sourceSupported : item.targetSupported));
                updateSystem(system.role, system.id, { category, connector: first?.id ?? "custom" });
              }}
            >
              {connectorCategories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>

          <label>
            <span>Connector</span>
            <select aria-label={`Connector ${system.role} ${system.id}`} value={system.connector} onChange={(e) => updateSystem(system.role, system.id, { connector: e.target.value })}>
              {options.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>

          {isFile ? (
            <>
              <label>
                <span>Folder / Location</span>
                <input value={system.path ?? ""} onChange={(e) => updateSystem(system.role, system.id, { path: e.target.value })} placeholder="C:\\data\\..." />
              </label>
              <label className="full">
                <span>File Name / Pattern</span>
                <input value={system.pattern ?? ""} onChange={(e) => updateSystem(system.role, system.id, { pattern: e.target.value })} placeholder="*.xlsx or target_schema.txt" />
              </label>
            </>
          ) : (
            <>
              <label>
                <span>Host / Endpoint</span>
                <input value={system.host ?? ""} onChange={(e) => updateSystem(system.role, system.id, { host: e.target.value })} placeholder="hostname or endpoint" />
              </label>
              <label>
                <span>Port</span>
                <input value={system.port ?? ""} onChange={(e) => updateSystem(system.role, system.id, { port: e.target.value })} placeholder="port" />
              </label>
              <label>
                <span>Service / Database / Resource</span>
                <input value={system.service ?? ""} onChange={(e) => updateSystem(system.role, system.id, { service: e.target.value })} placeholder="service, database or resource" />
              </label>
              <label>
                <span>Username</span>
                <input value={system.username ?? ""} onChange={(e) => updateSystem(system.role, system.id, { username: e.target.value })} placeholder="user or identity" />
              </label>
            </>
          )}
        </div>

        <div className="buttonRow">
          <button type="button" className="primary" onClick={() => validateSystem(system)} disabled={system.status === "TESTING"}>
            {system.status === "TESTING" ? <LoaderCircle size={16} /> : <Cable size={16} />}
            {system.status === "TESTING" ? "Validating..." : `Validate ${system.role === "SOURCE" ? "Source" : "Target"}`}
          </button>
          <button type="button" onClick={() => toggleDataViewer(system)} disabled={system.status !== "VALIDATED"}>
            <Eye size={16} />
            {openViewer?.systemId === system.id && openViewer.role === system.role
              ? `Hide ${system.role === "SOURCE" ? "Source" : "Target"}`
              : `View ${system.role === "SOURCE" ? "Source" : "Target"}`}
          </button>
        </div>

        {system.message && <p style={{ marginTop: 10, fontSize: 12 }}>{system.message}</p>}
        {renderDataViewer(system)}

        {system.role === "TARGET" && (
          <TargetConnectionManagement
            system={system}
            onEdit={() => {
              updateSystem("TARGET", system.id, {
                status: "CONFIGURED",
                message:
                  "Edit the target connection fields and run Validate Target again.",
              });
            }}
            onDeleted={() => {
              updateSystem("TARGET", system.id, {
                status: "NOT_CONFIGURED",
                message:
                  "Target connection removed from KMITORA. Physical target data was not modified.",
                metadataAccessible: false,
                authenticationValidated: false,
                readPermissionValidated: false,
                writePermissionValidated: false,
                targetWriteRequested: false,
                targetWriteExecuted: false,
                productionActionExecuted: false,
              });

              localStorage.removeItem("kmitora.active.targetId");
              localStorage.removeItem("kmitora.dev.targetRuntimeConnection");
              localStorage.removeItem("kmitora.dev.targetConnection");
              localStorage.removeItem("kmitora.dev.targetValidation");
              localStorage.removeItem("kmitora.dev.discoveryResult");
              localStorage.removeItem("kmitora.dev.discoveryResults");
            }}
          />
        )}

        {system.role === "TARGET" && (
          <div className="checkList" style={{ marginTop: 14 }}>
            <div className="checkRow"><span /><span>Target write requested</span><small>NO</small></div>
            <div className="checkRow"><span /><span>Target write executed</span><small>NO</small></div>
            <div className="checkRow"><span /><span>Production execution</span><small>NO</small></div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="page kmConnectPremium">
      <ConnectWorkspaceTabs />

      <ConnectR4Toolbar
        projectName={projectName}
        savedLabel={savedLabel}
        query={systemQuery}
        setQuery={setSystemQuery}
        onSave={() => void saveCurrentProject()}
        onProjects={() => void openProjects()}
        onAddSource={addSourceSmart}
        onAddTarget={addTargetSmart}
      />
      <SourceTargetDashboard
        sources={sources}
        targets={targets}
        onView={(system) => void toggleDataViewer(system)}
        onAddSource={addSourceSmart}
        onAddTarget={addTargetSmart}
      />
      <LegacySystemSectionsSuppressor />
      <div className="pageTitle">
        <div>
          <span className="eyebrow">STEP 01</span>
          <h1>Migration Topology Studio</h1>
          <p>Define one-to-one, one-to-many, many-to-one or many-to-many migration relationships. KMITORA Copilot coordinates automation after every required Source and Target is validated.</p>
        </div>
        <KMITORACopilotOverview
          status="OVERVIEW"
          message="Workflow guidance & automation status"
        />

      </div>

            <section className="km-connect-hero" aria-label="Connection summary">
        <div className="km-connect-stat">
          <span className="label">Total Systems</span>
          <strong>{readiness.sourceCount + readiness.targetCount}</strong>
          <small>Configured source + target landscape</small>
        </div>
        <div className="km-connect-stat">
          <span className="label">Validated Connections</span>
          <strong className="good">{readiness.validatedSourceCount + readiness.validatedTargetCount}</strong>
          <small>Validated and available for governed workflow</small>
        </div>
        <div className="km-connect-stat">
          <span className="label">Source Systems</span>
          <strong className="blue">{readiness.sourceCount}</strong>
          <small>{readiness.validatedSourceCount}/{readiness.sourceCount} validated</small>
        </div>
        <div className="km-connect-stat">
          <span className="label">Target Systems</span>
          <strong>{readiness.targetCount}</strong>
          <small>{readiness.validatedTargetCount}/{readiness.targetCount} validated</small>
        </div>
        <div className="km-connect-stat">
          <span className="label">Connection Readiness</span>
          <strong className={readiness.overallReady ? "good" : "warn"}>
            {readiness.overallReady
              ? "100%"
              : `${Math.round(((readiness.validatedSourceCount + readiness.validatedTargetCount) / Math.max(1, readiness.sourceCount + readiness.targetCount)) * 100)}%`}
          </strong>
          <small>{readiness.workflowEligible ? "Automation eligible" : "Validation required"}</small>
        </div>
      </section>

      <section className="km-connect-pipeline" aria-label="Connection pipeline">
        <div className="km-connect-pipeline-head">
          <div>
            <h3>Connection Pipeline</h3>
            <span>Existing KMITORA validation and readiness flow</span>
          </div>
          <span>{relationships.length} relationship(s)</span>
        </div>
        <div className="km-connect-steps">
          <div className="km-connect-step complete">
            <div className="node">01</div>
            <strong>Configure</strong>
            <small>{readiness.sourceCount + readiness.targetCount} system(s)</small>
          </div>
          <div className={`km-connect-step ${(readiness.validatedSourceCount + readiness.validatedTargetCount) > 0 ? "complete" : "active"}`}>
            <div className="node">02</div>
            <strong>Authenticate</strong>
            <small>Existing connector validation</small>
          </div>
          <div className={`km-connect-step ${readiness.allSourcesValidated ? "complete" : "active"}`}>
            <div className="node">03</div>
            <strong>Test Connectivity</strong>
            <small>{readiness.validatedSourceCount}/{readiness.sourceCount} source(s)</small>
          </div>
          <div className={`km-connect-step ${readiness.topologyValidated ? "complete" : "active"}`}>
            <div className="node">04</div>
            <strong>Validate Topology</strong>
            <small>{relationships.length} relationship(s)</small>
          </div>
          <div className={`km-connect-step ${readiness.overallReady ? "complete" : "active"}`}>
            <div className="node">05</div>
            <strong>Ready</strong>
            <small>{readiness.overallReady ? "Connection gate ready" : "Waiting for validation"}</small>
          </div>
        </div>
      </section>
<div className="panel" style={{ marginBottom: 18 }}>
        <div className="panelHeader">
          <div>
            <span className="eyebrow">QUICK CONNECTION</span>
            <h3>Select Source System</h3>
            <p>Choose a source connector, capture DEV-safe connection metadata, save a non-secret draft, and verify backend reachability before deeper topology validation.</p>
          </div>
          <span className={`statusPill ${quickConnectionStatus === "REACHABLE" ? "success" : quickConnectionStatus === "FAILED" ? "reject" : "review"}`}>
            {quickConnectionStatus === "NOT TESTED" ? "PENDING" : quickConnectionStatus}
          </span>
        </div>

        <div className="buttonRow" style={{ marginBottom: 14, flexWrap: "wrap" }}>
          {quickConnectorNames.map((connector) => (
            <button
              key={connector}
              type="button"
              className={quickConnector === connector ? "selected" : ""}
              onClick={() => selectQuickConnector(connector)}
            >
              {connector}
            </button>
          ))}
        </div>

        <div className="formGrid">
          <label>
            <span>Host / Location</span>
            <input value={quickHost} onChange={(e) => setQuickHost(e.target.value)} placeholder="host, endpoint, bucket or folder" />
          </label>
          <label>
            <span>Port</span>
            <input value={quickPort} onChange={(e) => setQuickPort(e.target.value)} disabled={quickConnector === "File / Folder"} placeholder="port" />
          </label>
          <label>
            <span>{quickConnectorDefaults[quickConnector].serviceLabel}</span>
            <input aria-label="Database" value={quickDatabase} onChange={(e) => setQuickDatabase(e.target.value)} placeholder="database, service or resource" />
          </label>
          <label>
            <span>Username</span>
            <input value={quickUsername} onChange={(e) => setQuickUsername(e.target.value)} placeholder="DEV read-only identity" />
          </label>
          <label className="full">
            <span>Credential / Secret Reference</span>
            <input type="password" value={quickSecret} onChange={(e) => setQuickSecret(e.target.value)} autoComplete="new-password" placeholder="Not persisted in localStorage" />
          </label>
        </div>

        <div className="buttonRow" style={{ marginTop: 12 }}>
          <button type="button" onClick={saveQuickConnectionDraft}>Save Draft</button>
          <button type="button" className="primary" onClick={() => void testQuickConnection()} disabled={quickConnectionStatus === "TESTING"}>
            {quickConnectionStatus === "TESTING" ? <LoaderCircle size={16} /> : <Cable size={16} />}
            Test Connection
          </button>
        </div>

        {quickConnectionMessage && <p style={{ marginTop: 10, fontSize: 12 }}>{quickConnectionMessage}</p>}

        <div className="checkList" style={{ marginTop: 14 }}>
          <div className="checkRow"><Cable size={16} /><span>Selected connector</span><small>{quickConnector}</small></div>
          <div className="checkRow"><span /><span>Connection check</span><small>{quickConnectionStatus === "REACHABLE" ? "PASS" : quickConnectionStatus === "FAILED" ? "FAIL" : quickConnectionStatus}</small></div>
          <div className="checkRow"><span /><span>Readiness</span><small>{quickConnectionStatus === "REACHABLE" ? "100%" : "0%"}</small></div>
          <div className="checkRow"><span /><span>Connector-specific authentication</span><small>NOT EXECUTED</small></div>
          <div className="checkRow"><span /><span>Production action</span><small>NOT EXECUTED</small></div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="panelHeader">
          <div>
            <span className="eyebrow">MIGRATION TOPOLOGY</span>
            <h3>How are your systems related?</h3>
            <p>Keep setup simple. KMITORA Copilot manages the complex relationship model behind the scenes.</p>
          </div>
        </div>
        <div className="formGrid">
          <label className="full">
            <span>Migration Pattern</span>
            <select value={topologyType} onChange={(e) => changeTopology(e.target.value as TopologyType)}>
              {Object.entries(topologyLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>
        <p style={{ marginTop: 10, fontSize: 12 }}>{globalMessage}</p>
      </div>

      <div className="twoCol wideLeft">
        <div>
          <div className="panelHeader" style={{ marginBottom: 10 }}>
            <div>
              <span className="eyebrow">SOURCES</span>
              <h3>{readiness.validatedSourceCount}/{readiness.sourceCount} Validated</h3>
            </div>
            <button type="button" onClick={() => addSystem("SOURCE")}><Plus size={16} /> Add Source</button>
          </div>
          {sources.map(renderSystemCard)}
        </div>

        <div>
          <div className="panelHeader" style={{ marginBottom: 10 }}>
            <div>
              <span className="eyebrow">TARGETS</span>
              <h3>{readiness.validatedTargetCount}/{readiness.targetCount} Validated</h3>
            </div>
            <button type="button" onClick={() => addSystem("TARGET")}><Plus size={16} /> Add Target</button>
          </div>
          {targets.map(renderSystemCard)}
        </div>
      </div>

      <div className="panel" style={{ marginTop: 18 }}>
        <div className="panelHeader">
          <div>
            <span className="eyebrow">BUSINESS & ARCHITECTURE CONTEXT</span>
            <h3>Teach KMITORA how the business and systems work</h3>
            <p>Add business rules, BRD/FRD, architecture, mappings, process flows, diagrams, API specifications, test cases, code or plain-English instructions. KMITORA preserves every item as governed migration knowledge.</p>
          </div>
          <span className={`statusPill ${knowledgeItems.length ? "success" : "review"}`}>{knowledgeItems.length ? `${knowledgeItems.length} ITEM(S)` : "OPTIONAL"}</span>
        </div>

        <div className="formGrid">
          <label className="full">
            <span>Business Logic / Rule / Architecture Prompt</span>
            <textarea value={businessPrompt} onChange={(e) => setBusinessPrompt(e.target.value)} rows={4} placeholder="Example: Active customers migrate. Normalize IN, IND and India to INDIA. Invalid email records must be quarantined. Orders must reference an existing customer." />
          </label>
        </div>
        <div className="buttonRow">
          <button type="button" className="primary" onClick={addBusinessPrompt} disabled={!businessPrompt.trim()}><BookOpen size={16} /> Add Business Context</button>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <Upload size={16} /> Upload Documents / Diagrams
            <input type="file" multiple style={{ display: "none" }} onChange={(e) => { void handleKnowledgeFiles(e.target.files); e.currentTarget.value = ""; }} />
          </label>
        </div>

        <div className="checkList" style={{ marginTop: 14 }}>
          {knowledgeItems.slice(-6).map((item) => (
            <div className="checkRow" key={item.id}>
              <FileText size={16} />
              <span>{item.title}</span>
              <small>{item.status.replaceAll("_", " ")}</small>
            </div>
          ))}
          {!knowledgeItems.length && <div className="checkRow"><span /><span>No additional business context supplied yet</span><small>KMITORA WILL DISCOVER + INFER</small></div>}
        </div>

        <div className="panelHeader" style={{ marginTop: 18, marginBottom: 8 }}>
          <div><span className="eyebrow">KMITORA KNOWLEDGE PACKS</span><p>Reusable specialist knowledge is available to mapping, cleansing, transformation, validation and defect-resolution agents.</p></div>
        </div>
        <div className="checkList">
          {a000KnowledgePacks.map((pack) => (
            <div className="checkRow" key={pack.id}><Brain size={16} /><span>{pack.name}</span><small>{pack.topicCount.toLocaleString()} TOPICS | {pack.status}</small></div>
          ))}
        </div>
      </div>

      <div className="panel" style={{ marginTop: 18 }}>
        <div className="panelHeader">
          <div>
            <span className="eyebrow">PROMPT-DRIVEN MIGRATION</span>
            <h3>Tell KMITORA the outcome you want</h3>
            <p>KMITORA converts the request into a preview-first governed plan covering discovery, mapping, cleansing, transformations, validation, quality, migration, reconciliation and evidence.</p>
          </div>
          <span className={`statusPill ${intentPlan ? "success" : "review"}`}>{intentPlan ? "PLAN READY" : "WAITING"}</span>
        </div>
        <div className="formGrid">
          <label className="full">
            <span>Migration Prompt</span>
            <textarea value={migrationPrompt} onChange={(e) => setMigrationPrompt(e.target.value)} rows={4} placeholder="Example: Merge all validated customer sources, remove duplicates, standardize countries, validate email and phone, apply business rules, preview the target, migrate only approved records, reconcile and generate evidence." />
          </label>
        </div>
        <div className="buttonRow">
          <button type="button" className="primary" onClick={preparePromptPlan} disabled={!migrationPrompt.trim()}><Sparkles size={16} /> Analyze & Prepare</button>
          <button type="button" disabled={!intentPlan}><Eye size={16} /> Preview First</button>
          <button type="button" disabled={!readiness.workflowEligible}><Send size={16} /> KMITORA Auto-Execute Supported Stages</button>
        </div>

        {intentPlan && (
          <div className="checkList" style={{ marginTop: 14 }}>
            <div className="checkRow"><Brain size={16} /><span>Detected domain</span><small>{intentPlan.detectedDomain}</small></div>
            <div className="checkRow"><CheckCircle2 size={16} /><span>Planned operations</span><small>{intentPlan.operations.join(" → ")}</small></div>
            <div className="checkRow"><BookOpen size={16} /><span>Rule candidates</span><small>{intentPlan.ruleCandidates.length}</small></div>
            <div className="checkRow"><span /><span>Plan confidence</span><small>{intentPlan.confidence}%</small></div>
            <div className="checkRow"><span /><span>Execution policy</span><small>PREVIEW FIRST · GOVERNED</small></div>
            <div className="checkRow"><span /><span>Target write requested</span><small>NO</small></div>
          </div>
        )}
      </div>

      <A000EnterpriseIntelligencePanel
        sources={sources}
        targets={targets}
        knowledgeItems={knowledgeItems}
      />

      <A000DigitalTwinPanel
        sources={sources}
        targets={targets}
        knowledgeItems={knowledgeItems}
        migrationPrompt={migrationPrompt}
      />

      <A000CapabilityCoveragePanel />

      <div className="panel" style={{ marginTop: 18 }}>
        <div className="panelHeader">
          <div>
            <span className="eyebrow">KMITORA CONNECTION GATE</span>
            <h3>Connection Readiness</h3>
            <p>When every Source and Target is validated, KMITORA can start Discovery automatically.</p>
          </div>
          <span className={`statusPill ${readiness.overallReady ? "success" : "review"}`}>{readiness.overallReady ? "READY" : "WAITING"}</span>
        </div>

        <div className="checkList">
          <div className="checkRow">{readiness.allSourcesValidated ? <CheckCircle2 size={17} /> : <LoaderCircle size={17} />}<span>Source & Target</span><small>{readiness.validatedSourceCount}/{readiness.sourceCount} VALIDATED</small></div>
          <div className="checkRow">{readiness.allTargetsValidated ? <CheckCircle2 size={17} /> : <LoaderCircle size={17} />}<span>KMITORA Capability Coverage</span><small>{readiness.validatedTargetCount}/{readiness.targetCount} VALIDATED</small></div>
          <div className="checkRow">{readiness.topologyValidated ? <CheckCircle2 size={17} /> : <LoaderCircle size={17} />}<span>Topology</span><small>{readiness.topologyValidated ? "VALIDATED" : "PENDING"}</small></div>
          <div className="checkRow"><Database size={17} /><span>KMITORA automation</span><small>{readiness.workflowEligible ? "ELIGIBLE" : "BLOCKED"}</small></div>
          <div className="checkRow"><FilePlus2 size={17} /><span>Migration execution</span><small>GUARDED</small></div>
          <div className="checkRow"><span /><span>Production execution</span><small>NOT EXECUTED</small></div>
        </div>

        <div className="progressBlock">
          <div className="progressHeader">
            <span>Overall readiness</span>
            <strong>{readiness.overallReady ? "COMPLETE" : `${Math.round(((readiness.validatedSourceCount + readiness.validatedTargetCount) / Math.max(1, readiness.sourceCount + readiness.targetCount)) * 100)} PCT`}</strong>
          </div>
          <div className="bar"><span style={{ width: readiness.overallReady ? "100%" : `${Math.round(((readiness.validatedSourceCount + readiness.validatedTargetCount) / Math.max(1, readiness.sourceCount + readiness.targetCount)) * 100)}%` }} /></div>
          <div className="progressMeta">
            <span>{readiness.workflowEligible ? "Source and Target landscape validated. KMITORA automation eligible." : "Validate all required systems to continue."}</span>
            <span>DEV SAFE MODE</span>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 18 }}>
        <div className="panelHeader">
          <div>
            <span className="eyebrow">KMITORA AUTO-ORCHESTRATION</span>
            <h3>Automatic Migration Workflow</h3>
            <p>Once all required systems are validated, KMITORA starts the supported discovery work automatically and records unsupported adapters as governed gaps instead of pretending they ran.</p>
          </div>
          <span className={`statusPill ${workflowState?.status === "DISCOVERY_COMPLETE" ? "success" : workflowState?.status === "FAILED" ? "reject" : "review"}`}>
            {workflowState?.status?.replaceAll("_", " ") ?? "WAITING FOR READINESS"}
          </span>
        </div>

        <div className="checkList">
          <div className="checkRow"><span /><span>Relationships</span><small>{workflowState?.totalRelationships ?? relationships.length}</small></div>
          <div className="checkRow"><CheckCircle2 size={17} /><span>Discovered</span><small>{workflowState?.discoveredRelationships ?? 0}</small></div>
          <div className="checkRow"><span /><span>Waiting for connector adapters</span><small>{workflowState?.skippedRelationships ?? 0}</small></div>
          <div className="checkRow"><span /><span>Failed</span><small>{workflowState?.failedRelationships ?? 0}</small></div>
          <div className="checkRow"><FilePlus2 size={17} /><span>Target writes</span><small>DISABLED</small></div>
          <div className="checkRow"><span /><span>Production execution</span><small>NOT EXECUTED</small></div>
        </div>

        <div className="progressBlock">
          <div className="progressHeader">
            <span>Automatic discovery coverage</span>
            <strong>{workflowState?.totalRelationships ? `${Math.round((workflowState.discoveredRelationships / workflowState.totalRelationships) * 100)}%` : "0%"}</strong>
          </div>
          <div className="bar"><span style={{ width: workflowState?.totalRelationships ? `${Math.round((workflowState.discoveredRelationships / workflowState.totalRelationships) * 100)}%` : "0%" }} /></div>
          <div className="progressMeta">
            <span>{workflowState?.status === "PARTIAL_AUTOMATION_WAITING_FOR_ADAPTERS" ? "Supported relationships completed. Remaining connectors need live backend adapters." : workflowState?.status === "DISCOVERY_COMPLETE" ? "Discovery completed across all validated relationships." : "KMITORA waits for full connection readiness, then starts automatically."}</span>
            <span>DEV SAFE MODE</span>
          </div>
        </div>
      </div>

      <div className="km-r4-floating">
        <button
          type="button"
          className="primary"
          onClick={addSourceSmart}
        >
          + Source
        </button>

        <button
          type="button"
          className="primary"
          onClick={addTargetSmart}
        >
          + Target
        </button>
      </div>

      <ProjectPickerModal
        open={projectModalOpen}
        loading={projectsLoading}
        projects={projects}
        onClose={() => setProjectModalOpen(false)}
        onOpenProject={(id) => void resumeProject(id)}
      />

      <ServerFileBrowserModal
        open={Boolean(fileBrowser)}
        initialPath={
          fileBrowser
            ? (
                [...sources, ...targets].find(
                  (system) => system.id === fileBrowser.systemId
                )?.path ?? "C:\\KMITORA"
              )
            : "C:\\KMITORA"
        }
        onClose={() => setFileBrowser(null)}
        onSelectFile={(_, folder, fileName) => {
          if (!fileBrowser) return;

          updateSystem(
            fileBrowser.role,
            fileBrowser.systemId,
            {
              path: folder,
              pattern: fileName,
            }
          );

          setFileBrowser(null);
        }}
      />
    </div>
  );
}







