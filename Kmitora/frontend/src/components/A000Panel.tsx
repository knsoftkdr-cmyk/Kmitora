import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronRight,
  Eye,
  Gauge,
  PanelRight,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Paperclip,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { postA000Message, resolveSafeRemediation } from "../services/api";
import type {
  A000AssistantAction,
  A000AssistantContext,
  A000AssistantRecommendation,
} from "../services/api";
import type { AdvancedRuntime } from "../types/advancedRuntime";
import AssistantConversationGuard from "./AssistantConversationGuard";
import AssistantLiveResponseBridge from "./AssistantLiveResponseBridge";
type ChatMessage = {
  id: string;
  role: "assistant" | "user" | "system";
  text: string;
};

type RemediationPayload = {
  id?: string;
  migration_id?: string;
  status?: string;
  safe_action_count?: number;
  preserved_action_count?: number;
  source_write_executed?: boolean;
  target_write_executed?: boolean;
  production_action_executed?: boolean;
};


type AssistantAttachment = {
  id: string;
  name: string;
  type: string;
  size: number;
  category:
    | "BUSINESS_RULES"
    | "ERROR_LOG"
    | "MAPPING"
    | "SOURCE_SAMPLE"
    | "TARGET_SPEC"
    | "SQL"
    | "SCREENSHOT"
    | "DRAWING"
    | "OTHER";
  excerpt?: string;
  previewUrl?: string;
};

type AssistantViewMode = "DOCKED" | "WIDE" | "RESIZABLE" | "FOCUS";
type Props = {
  activePage: string;
  onNavigate?: (page: string) => void;
  onAdvancedRuntime?: (runtime: AdvancedRuntime | null) => void;
};

const MODES = [
  "ASK",
  "EXPLAIN",
  "ANALYZE",
  "RECOMMEND",
  "NEXT_ACTION",
  "TROUBLESHOOT",
  "COMPARE",
  "INVESTIGATE",
  "PLAN",
  "VALIDATE",
  "EVIDENCE",
  "EXECUTIVE",
  "TECHNICAL",
  "A000",
] as const;

const ROLES = ["ENGINEER", "MIGRATION_ARCHITECT", "DBA", "DATA_STEWARD", "EXECUTIVE", "AUDITOR", "VIEWER"] as const;

const DEFAULT_CONSTRAINTS = ["NO_SOURCE_WRITES", "NO_PRODUCTION_ACTIONS", "NO_CUTOVER", "DEV_ONLY"];
const DEFAULT_PROMPTS = [
  "What is the current migration status?",
  "Why is migration blocked?",
  "What should I do next?",
  "Can we migrate now?",
];

const initialMessage: ChatMessage = {
  id: "assistant-welcome",
  role: "assistant",
  text:
    "I am the governed KMITORA Assistant. I correlate lifecycle context, evidence, readiness, risk and A000 actions. I can diagnose, compare, trace, recommend, simulate and plan; I never grant production or cutover authority.",
};

function messageId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function fmtMetric(value: unknown) {
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "string" && value.trim()) return value;
  return "Ã¢â‚¬â€";
}


function classifyAttachment(file: File): AssistantAttachment["category"] {
  const name = file.name.toLowerCase();

  if (/\.(log|err|trace)$/i.test(name)) return "ERROR_LOG";
  if (/\.sql$/i.test(name)) return "SQL";
  if (/(rule|business)/i.test(name)) return "BUSINESS_RULES";
  if (/(mapping|map)/i.test(name)) return "MAPPING";
  if (/(source|sample|input)/i.test(name)) return "SOURCE_SAMPLE";
  if (/(target|output|spec|schema)/i.test(name)) return "TARGET_SPEC";
  if (/(drawing|diagram|flow)/i.test(name)) return "DRAWING";
  if (/\.(png|jpg|jpeg|webp|svg)$/i.test(name)) return "SCREENSHOT";

  return "OTHER";
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isTextLikeFile(file: File) {
  return (
    /^text\//i.test(file.type) ||
    /\.(txt|md|csv|json|xml|ya?ml|sql|log|ini|cfg)$/i.test(file.name)
  );
}

function isImageFile(file: File) {
  return (
    /^image\//i.test(file.type) ||
    /\.(png|jpg|jpeg|webp|svg)$/i.test(file.name)
  );
}

async function readFileAsDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = reject;

    reader.readAsDataURL(file);
  });
}

async function buildAssistantAttachment(
  file: File,
): Promise<AssistantAttachment> {
  const item: AssistantAttachment = {
    id: `${file.name}-${file.size}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 7)}`,
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
    category: classifyAttachment(file),
  };

  if (isTextLikeFile(file)) {
    const text = await file.text();
    item.excerpt = text.slice(0, 4000);
  }

  if (isImageFile(file)) {
    item.previewUrl = await readFileAsDataUrl(file);
  }

  return item;
}

function buildAttachmentContext(
  attachments: AssistantAttachment[],
) {
  if (!attachments.length) return "";

  const sections = attachments.map((item, index) => {
    return [
      `ATTACHMENT ${index + 1}`,
      `NAME: ${item.name}`,
      `TYPE: ${item.type}`,
      `SIZE: ${item.size}`,
      `CATEGORY: ${item.category}`,
      item.excerpt
        ? `EXCERPT:\n${item.excerpt}`
        : "EXCERPT: [not extracted]",
    ].join("\n");
  });

  return [
    "ATTACHED FILE CONTEXT START",
    ...sections,
    "ATTACHED FILE CONTEXT END",
  ].join("\n\n");
}

export default function A000Panel({ activePage, onNavigate, onAdvancedRuntime }: Props) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("kmitora.copilot.collapsed") === "1");
  const [assistantView, setAssistantView] = useState<AssistantViewMode>(() => {
    const stored = localStorage.getItem("kmitora.assistant.view");
    return stored === "WIDE" || stored === "RESIZABLE" || stored === "FOCUS" ? stored : "DOCKED";
  });
  const [assistantWidth, setAssistantWidth] = useState<number>(() => {
    const stored = Number(localStorage.getItem("kmitora.assistant.width") ?? "520");
    return Number.isFinite(stored) ? Math.min(760, Math.max(360, stored)) : 520;
  });
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadJson("kmitora.assistant.messages", [initialMessage]));
  const [context, setContext] = useState<A000AssistantContext | null>(null);
  const [recommendations, setRecommendations] = useState<A000AssistantRecommendation[]>([]);
  const [actions, setActions] = useState<A000AssistantAction[]>([]);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>(DEFAULT_PROMPTS);
  const [confidence, setConfidence] = useState<{ score?: number; label?: string } | null>(null);
  const [capabilityCount, setCapabilityCount] = useState(100);
  const [auditHash, setAuditHash] = useState("");
  const [role, setRole] = useState(() => localStorage.getItem("kmitora.assistant.role") ?? "ENGINEER");
  const [mode, setMode] = useState(() => localStorage.getItem("kmitora.assistant.mode") ?? "ASK");
  const [goal, setGoal] = useState(() => localStorage.getItem("kmitora.assistant.goal") ?? "");
  const [watchMode, setWatchMode] = useState(() => localStorage.getItem("kmitora.assistant.watch") === "1");
  const [constraints] = useState<string[]>(() => loadJson("kmitora.assistant.constraints", DEFAULT_CONSTRAINTS));
  const [remediation, setRemediation] = useState<RemediationPayload | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [attachments, setAttachments] = useState<AssistantAttachment[]>([]);
  const lastAutoStage = useRef("");

  const migrationId = useMemo(
    () => localStorage.getItem("kmitora.dev.migrationId") ?? context?.migration_id ?? null,
    [context?.migration_id],
  );

  useEffect(() => {
    localStorage.setItem("kmitora.assistant.messages", JSON.stringify(messages.slice(-40)));
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);

  useEffect(() => {
    const shell = document.querySelector(".appShell");
    if (shell) shell.classList.toggle("appShell--copilotCollapsed", collapsed);
  }, [collapsed]);

  useEffect(() => {
    const shell = document.querySelector(".appShell") as HTMLElement | null;
    if (!shell) return;

    shell.classList.toggle("appShell--assistantWide", assistantView === "WIDE");
    shell.classList.toggle("appShell--assistantResizable", assistantView === "RESIZABLE");
    shell.classList.toggle("appShell--assistantFocus", assistantView === "FOCUS");
    shell.style.setProperty("--assistant-width", `${assistantWidth}px`);

    localStorage.setItem("kmitora.assistant.view", assistantView);
    localStorage.setItem("kmitora.assistant.width", String(assistantWidth));

    return () => {
      shell.classList.remove("appShell--assistantWide");
      shell.classList.remove("appShell--assistantResizable");
      shell.classList.remove("appShell--assistantFocus");
      shell.style.removeProperty("--assistant-width");
    };
  }, [assistantView, assistantWidth]);

  const conversationSummary = useMemo(
    () => messages.slice(-8).map((item) => `${item.role.toUpperCase()}: ${item.text}`).join("\n").slice(0, 4000),
    [messages],
  );

  const absorbResponse = (payload: Record<string, unknown>) => {
    const reply = typeof payload.reply === "string" ? payload.reply : "A000 completed the analysis.";
    setMessages((current) => [...current, { id: messageId("assistant"), role: "assistant", text: reply }]);
    setContext((payload.context as A000AssistantContext | undefined) ?? null);
    setRecommendations(Array.isArray(payload.recommendations) ? (payload.recommendations as A000AssistantRecommendation[]) : []);
    setActions(Array.isArray(payload.next_actions) ? (payload.next_actions as A000AssistantAction[]) : []);
    setSuggestedQuestions(Array.isArray(payload.suggested_questions) ? (payload.suggested_questions as string[]) : DEFAULT_PROMPTS);
    setConfidence((payload.confidence as { score?: number; label?: string } | undefined) ?? null);
    const registry = payload.capability_registry as { total?: number } | undefined;
    if (registry?.total) setCapabilityCount(registry.total);
    const audit = payload.audit as { event_hash?: string } | undefined;
    if (audit?.event_hash) setAuditHash(audit.event_hash);
    onAdvancedRuntime?.((payload.advanced_runtime as AdvancedRuntime | null | undefined) ?? null);
  };

  const submit = async (messageOverride?: string, silentUser = false) => {
    const message = (messageOverride ?? value).trim();
    if ((!message && attachments.length === 0) || loading) return;

    const attachmentContext = buildAttachmentContext(attachments);

    let domainContext = "";
    try {
      const rawDomain = localStorage.getItem("kmitora.dev.domainIntelligence");
      if (rawDomain) {
        const parsedDomain = JSON.parse(rawDomain) as Record<string, unknown>;
        domainContext = [
          "DOMAIN INTELLIGENCE CONTEXT START",
          `DOMAIN ID: ${String(parsedDomain.domain_id ?? "")}`,
          `DOMAIN NAME: ${String(parsedDomain.domain_name ?? "")}`,
          `CATEGORY: ${String(parsedDomain.domain_category ?? "")}`,
          `BUSINESS FUNCTION: ${String(parsedDomain.business_function ?? "")}`,
          "DOMAIN INTELLIGENCE CONTEXT END",
        ].join("\n");
      }
    } catch {
      domainContext = "";
    }

    const contextBlocks = [domainContext, attachmentContext].filter(Boolean).join("\n\n");
    const effectiveMessage = contextBlocks
      ? `${contextBlocks}

USER REQUEST:
${message || "Analyze the available context and recommend the next governed migration action."}`
      : message;
    setLoading(true);
    setError("");
    if (!silentUser) setMessages((current) => [...current, { id: messageId("user"), role: "user", text: message }]);
    setValue("");
    try {
      const response = await postA000Message(effectiveMessage, {
        stage: activePage,
        migrationId,
        role,
        mode,
        goal,
        constraints,
        watchMode,
        conversationSummary,
      });
      absorbResponse((response.payload ?? response) as Record<string, unknown>);
      setAttachments([]);
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : "KMITORA Assistant request failed.";
      setError(text);
      setMessages((current) => [...current, { id: messageId("system"), role: "system", text }]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (collapsed || lastAutoStage.current === activePage) return;
    lastAutoStage.current = activePage;
    void submit("Summarize the current migration status, risk and next best action.", true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePage, collapsed]);

  const handleRole = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value;
    setRole(next);
    localStorage.setItem("kmitora.assistant.role", next);
  };

  const handleMode = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value;
    setMode(next);
    localStorage.setItem("kmitora.assistant.mode", next);
  };

  const handleGoal = (event: ChangeEvent<HTMLInputElement>) => {
    setGoal(event.target.value);
    localStorage.setItem("kmitora.assistant.goal", event.target.value);
  };

  const toggleWatch = () => {
    setWatchMode((current) => {
      const next = !current;
      localStorage.setItem("kmitora.assistant.watch", next ? "1" : "0");
      return next;
    });
  };

  const handleResolveSafe = async () => {
    if (resolving) return;
    setResolving(true);
    setError("");
    try {
      const response = await resolveSafeRemediation(migrationId ?? "DEV-ASSISTANT-001");
      const result = (response?.payload ?? response) as RemediationPayload;
      setRemediation(result);
      localStorage.setItem("kmitora.dev.safeRemediation", JSON.stringify(result));
      setMessages((current) => [...current, {
        id: messageId("assistant"),
        role: "assistant",
        text: `Safe remediation simulation completed. Safe actions=${result.safe_action_count ?? 0}; governed actions preserved=${result.preserved_action_count ?? 0}; source write=${result.source_write_executed ? "YES" : "NO"}; target write=${result.target_write_executed ? "YES" : "NO"}; production=${result.production_action_executed ? "YES" : "NO"}.`,
      }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Safe remediation simulation failed.");
    } finally {
      setResolving(false);
    }
  };
  const handlePickAttachments = () => {
    fileInputRef.current?.click();
  };

  const handleFilesSelected = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const files: File[] = event.target.files
      ? Array.from(event.target.files)
      : [];
    if (!files.length) return;

    try {
      const built = await Promise.all(
        files.map((file) => buildAssistantAttachment(file)),
      );

      setAttachments((current) =>
        [...current, ...built].slice(0, 8),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to process attachment.",
      );
    } finally {
      event.target.value = "";
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((current) =>
      current.filter((item) => item.id !== id),
    );
  };

  const clearAttachments = () => {
    setAttachments([]);
  };

  const runAction = (action: A000AssistantAction) => {
    if (action.execution_mode === "SAFE_REMEDIATION_SIMULATION") {
      void handleResolveSafe();
      return;
    }
    if (action.navigation_key && onNavigate) {
      onNavigate(action.navigation_key);
      return;
    }
    void submit(`Explain and preview this governed action: ${action.label}`);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  };

  const metrics = context?.metrics ?? {};
  const blocked = context?.status === "BLOCKED";
  const readinessScore = context?.readiness?.score;

  const setViewMode = (next: AssistantViewMode) => {
    setAssistantView(next);
    if (collapsed) {
      setCollapsed(false);
      localStorage.setItem("kmitora.copilot.collapsed", "0");
    }
  };

  const toggleWideView = () => {
    setViewMode(assistantView === "WIDE" ? "DOCKED" : "WIDE");
  };

  const toggleFocusView = () => {
    setViewMode(assistantView === "FOCUS" ? "DOCKED" : "FOCUS");
  };

  const startAssistantResize = (event: { preventDefault: () => void; clientX: number }) => {
    event.preventDefault();
    if (assistantView !== "RESIZABLE") return;

    const startX = event.clientX;
    const startWidth = assistantWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX;
      const nextWidth = Math.min(760, Math.max(360, startWidth + delta));
      setAssistantWidth(nextWidth);
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  return (
    <aside className={`copilot assistantView-${assistantView.toLowerCase()}${collapsed ? " is-collapsed" : ""}`}>
      <AssistantConversationGuard />
{assistantView === "RESIZABLE" && !collapsed && (
        <div
          className="assistantResizeHandle"
          onMouseDown={startAssistantResize}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize KMITORA Assistant"
          title="Drag to resize KMITORA Assistant"
        />
      )}
      <div className="copilotHeader">
        <button className="copilotToggle" onClick={() => setCollapsed((current) => {
          const next = !current;
          localStorage.setItem("kmitora.copilot.collapsed", next ? "1" : "0");
          return next;
        })} title={collapsed ? "Expand assistant" : "Collapse assistant"} aria-label={collapsed ? "Expand assistant" : "Collapse assistant"}>
          <PanelRight size={19} />
        </button>
        <Bot size={20} />
        <div><strong>KMITORA Assistant</strong><span>{capabilityCount} governed capabilities</span></div>
        <div className="assistantViewControls" aria-label="Assistant view controls">
          <button
            type="button"
            className={assistantView === "DOCKED" ? "is-active" : ""}
            onClick={() => setViewMode("DOCKED")}
            title="Fixed Assistant view"
          >
            Fixed
          </button>

          <button
            type="button"
            className={assistantView === "WIDE" ? "is-active" : ""}
            onClick={toggleWideView}
            title="Wide Assistant view"
          >
            Wide
          </button>

          <button
            type="button"
            className={assistantView === "RESIZABLE" ? "is-active" : ""}
            onClick={() => setViewMode("RESIZABLE")}
            title="Resizable Assistant view - drag the left edge"
          >
            Resize
          </button>

          <button
            type="button"
            className={assistantView === "FOCUS" ? "is-active" : ""}
            onClick={toggleFocusView}
            title="Full-screen Assistant focus view"
          >
            Focus
          </button>

          <button
            type="button"
            onClick={() => {
              setCollapsed(true);
              localStorage.setItem("kmitora.copilot.collapsed", "1");
            }}
            title="Minimize KMITORA Assistant"
          >
            Min
          </button>
        </div>
      </div>

      {!collapsed && <>
        <section className="assistantControlStrip">
          <select value={role} onChange={handleRole} aria-label="Assistant role">
            {ROLES.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select value={mode} onChange={handleMode} aria-label="Assistant mode">
            {MODES.map((item) => <option key={item}>{item}</option>)}
          </select>
          <button type="button" className={watchMode ? "is-active" : ""} onClick={toggleWatch} title="Watch lifecycle changes">
            <Eye size={13} /> Watch
          </button>
        </section>

        <section className="assistantGoalCard">
          <Target size={14} />
          <input value={goal} onChange={handleGoal} placeholder="Optional goal: Make this DEV migration ready" />
        </section>

        <section className="assistantContextCard" aria-label="Current KMITORA context">
          <div className="assistantContextTop">
            <div><span>Current context</span><strong>{migrationId ?? "No active migration"}</strong></div>
            <span className={`assistantState ${blocked ? "blocked" : "ready"}`}>
              {blocked ? <AlertTriangle size={12} /> : <ShieldCheck size={12} />}{context?.status ?? "CONTEXT CHECK"}
            </span>
          </div>
          <div className="assistantStageLine">
            <span>Stage</span><strong>{context?.stage ?? activePage}</strong>
            <span>Authority</span><strong>{context?.authoritative_context_available ? "YES" : "LIMITED"}</strong>
          </div>
          <div className="assistantMetricGrid">
            <div><span>Ready</span><strong>{fmtMetric(metrics.ready)}</strong></div>
            <div><span>Review</span><strong>{fmtMetric(metrics.review)}</strong></div>
            <div><span>Rejected</span><strong>{fmtMetric(metrics.rejected)}</strong></div>
            <div><span>Dependencies</span><strong>{fmtMetric(metrics.dependencies)}</strong></div>
          </div>
          <div className="assistantIntelligenceRow">
            <span><Gauge size={12} /> Readiness <strong>{typeof readinessScore === "number" ? `${readinessScore}%` : "Ã¢â‚¬â€"}</strong></span>
            <span>Confidence <strong>{confidence?.label ?? "Ã¢â‚¬â€"}</strong></span>
            <span>Risk <strong>{context?.risk?.level ?? "Ã¢â‚¬â€"}</strong></span>
          </div>
        </section>

        <section className="assistantChat" aria-label="KMITORA Assistant conversation">
          <div className="assistantChatToolbar">
            <strong>Conversation</strong>
            <button type="button" onClick={() => void submit("Refresh authoritative status, readiness, risk and next actions.", true)} disabled={loading} title="Refresh current context">
              <RefreshCw size={13} className={loading ? "assistantSpin" : ""} />
            </button>
          </div>
          <div className="assistantChatStream">
            {messages.slice(-14).map((message) => <div key={message.id} className={`assistantMessage ${message.role}`}>{message.text}</div>)}
            {loading && <div className="assistantMessage assistant assistantThinking">A000 is correlating context, evidence, governance and capability routing...</div>}
            <div ref={chatEndRef} />
          </div>
        </section>

        {recommendations.length > 0 && <section className="copilotCard assistantRecommendationCard">
          <div className="aiBadge"><Sparkles size={14} /> Ranked recommendations</div>
          <div className="assistantRecommendationList">
            {recommendations.slice(0, 5).map((item) => <button key={item.id} type="button" className="assistantRecommendation" onClick={() => item.navigation_key && onNavigate?.(item.navigation_key)}>
              <span className={`assistantPriority ${item.priority.toLowerCase()}`}>{item.priority}</span>
              <span><strong>{item.title}</strong><small>{item.reason}</small></span>
              {item.navigation_key ? <ChevronRight size={14} /> : null}
            </button>)}
          </div>
        </section>}

        {actions.length > 0 && <section className="copilotCard">
          <strong>Next-best actions</strong>
          <div className="assistantActionGrid">
            {actions.map((action) => <button key={action.id} type="button" onClick={() => runAction(action)} disabled={resolving} title={action.expected_result ?? action.label}>
              <CheckCircle2 size={13} /> {action.label}
            </button>)}
          </div>
        </section>}

        <section className="assistantAttachmentCard">
          <div className="assistantAttachmentToolbar">
            <strong>Attachments</strong>

            <div className="assistantAttachmentToolbarActions">
              <button
                type="button"
                className="assistantAttachButton"
                onClick={handlePickAttachments}
                title="Attach migration files, rules, logs, screenshots or drawings"
              >
                <Paperclip size={13} />
                Attach
              </button>

              {attachments.length > 0 ? (
                <button
                  type="button"
                  className="assistantClearButton"
                  onClick={clearAttachments}
                  title="Clear attachments"
                >
                  <Trash2 size={13} />
                  Clear
                </button>
              ) : null}
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            hidden
            multiple
            accept=".txt,.md,.csv,.json,.xml,.yaml,.yml,.sql,.log,.png,.jpg,.jpeg,.webp,.svg,.pdf,.doc,.docx,.xls,.xlsx"
            onChange={handleFilesSelected}
          />

          {attachments.length === 0 ? (
            <div className="assistantAttachmentHint">
              Attach business rules, mappings, source or target samples,
              SQL, error logs, screenshots, diagrams or drawings to help
              KMITORA Assistant plan migrations and diagnose defects.
            </div>
          ) : (
            <div className="assistantAttachmentList">
              {attachments.map((item) => (
                <div
                  key={item.id}
                  className="assistantAttachmentItem"
                >
                  <div className="assistantAttachmentMeta">
                    <div className="assistantAttachmentMetaLeft">
                      <strong>{item.name}</strong>
                      <span>
                        {item.category} Â· {formatBytes(item.size)}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="assistantAttachmentRemove"
                      onClick={() => removeAttachment(item.id)}
                      title="Remove attachment"
                    >
                      <X size={13} />
                    </button>
                  </div>

                  {item.excerpt ? (
                    <div className="assistantAttachmentExcerpt">
                      {item.excerpt.slice(0, 1000)}
                    </div>
                  ) : null}

                  {item.previewUrl ? (
                    <img
                      src={item.previewUrl}
                      alt={item.name}
                      className="assistantAttachmentPreview"
                    />
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>
        <div className="assistantPromptChips">
          {suggestedQuestions.slice(0, 5).map((prompt) => <button type="button" key={prompt} onClick={() => void submit(prompt)} disabled={loading}>{prompt}</button>)}
        </div>

        {attachments.length > 0 ? (
          <div className="assistantPromptChips">
            <button
              type="button"
              onClick={() =>
                void submit(
                  "Analyze the attached files and explain migration impact.",
                )
              }
            >
              Analyze attached files
            </button>

            <button
              type="button"
              onClick={() =>
                void submit(
                  "Use the attached business rules and build the governed migration approach.",
                )
              }
            >
              Build migration approach
            </button>

            <button
              type="button"
              onClick={() =>
                void submit(
                  "Use the attached logs, screenshots or files and diagnose the defect root cause.",
                )
              }
            >
              Diagnose defect
            </button>

            <button
              type="button"
              onClick={() =>
                void submit(
                  "Build validation and reconciliation checks from the attached files.",
                )
              }
            >
              Build validation checks
            </button>
          </div>
        ) : null}
              <AssistantLiveResponseBridge />
<div className="copilotInputRow">
          <textarea
            value={value}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
              setValue(event.target.value)
            }
            onKeyDown={onKeyDown}
            placeholder="Ask, diagnose, compare, trace, plan, validate, or use attached filesâ€¦"
            rows={2}
          />

          <button
            type="button"
            className="assistantAttachInline"
            onClick={handlePickAttachments}
            title="Attach files"
            aria-label="Attach files"
          >
            <Paperclip size={16} />
          </button>

          <button
            type="button"
            onClick={() => void submit()}
            disabled={
              loading ||
              (!value.trim() && attachments.length === 0)
            }
            aria-label="Send to KMITORA Assistant"
          >
            <Send size={17} />
          </button>
        </div>

        <div className="assistantSafetyFooter">
          <ShieldCheck size={13} /> DEV governance active Â· source/prod/cutover protected
          {auditHash ? <span title={auditHash}> Â· audit {auditHash.slice(0, 8)}</span> : null}
          {remediation ? <span> Â· remediation simulated</span> : null}
        </div>
        {error ? <div className="assistantError">{error}</div> : null}
      </>}
    </aside>
  );
}
