import React, { useMemo, useRef, useState } from "react";
import "./business-requirements.css";
import { compileSourceScope } from "../../services/requirementScope";

type RequirementRecord = {
  objective: string;
  rules: string[];
  attachments: { name: string; size: number; type: string }[];
  savedAt: string;
  environment: "DEV";
  productionWritesEnabled: false;
  cutoverEnabled: false;
};

type Props = {
  onClose?: () => void;
  onContinue?: () => void;
};

const STORAGE_KEY = "kmitora.business.requirements.v1";

const DEV_TEMPLATE = `Migrate customers, orders and payments from the connected source
to the KMITORA DEV PostgreSQL target.

BUSINESS RULES

1. customer_id is the unique customer key.
2. Trim customer_name.
3. Convert email to lowercase.
4. ACTIVE customer status becomes A.
5. INACTIVE customer status becomes I.
6. SOUTH becomes S.
7. NORTH becomes N.
8. EAST becomes E.
9. WEST becomes W.
10. Customer balance cannot be negative.
11. Every order must reference an existing customer.
12. OPEN order status becomes PENDING.
13. COMPLETED remains COMPLETED.
14. CANCELLED remains CANCELLED.
15. Order amount must be greater than zero.
16. Every payment must reference an existing order.
17. Payment amount must be greater than zero.
18. Source must remain read-only.
19. Only validated records may enter the DEV target.
20. Customers must load before Orders.
21. Orders must load before Payments.
22. Source and target counts must reconcile.
23. Generate evidence for mappings, transformations, validation, target load and reconciliation.`;

function extractRules(text: string) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const numbered = lines
    .filter((line) => /^\d+[.)]\s+/.test(line) || /^[-*•]\s+/.test(line))
    .map((line) => line.replace(/^(?:\d+[.)]|[-*•])\s+/, "").trim());
  if (numbered.length) return numbered;

  // Natural-language fallback: do not silently produce zero rules when the
  // migration owner writes one substantive rule per line without numbering.
  // Section headings and short titles are ignored.
  return lines.filter((line) => {
    if (/^(business rules?|migration objective|requirements?|rules?)[:]?$/i.test(line)) return false;
    if (line.split(/\s+/).length < 4) return false;
    return /\b(must|should|shall|only|exclude|include|preserve|reconcile|generate|detect|reject|hold|map|maps|normalize|convert|trim|prohibit|prohibited|remain|reference|equals|execute|execution)\b/i.test(line);
  });
}

function detectMappings(rules: string[]) {
  return rules.map((rule) => {
    const match = rule.match(/^(.+?)\s+maps?\s+to\s+(.+?)\.?$/i);
    return match ? `${match[1].trim()} → ${match[2].trim()}` : null;
  }).filter((x): x is string => Boolean(x));
}

function detectLoadWaves(text: string) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const edges: Array<[string, string]> = [];
  for (const line of lines) {
    const match = line.match(/(?:^|\.\s*)([A-Za-z0-9_ .-]+?)\s+must\s+load\s+before\s+([A-Za-z0-9_ .-]+?)\.?$/i);
    if (match) edges.push([match[1].replace(/^\d+[.)]\s*/, "").trim(), match[2].trim()]);
  }
  if (!edges.length) return [];

  const nodes = Array.from(new Set(edges.flat()));
  const remaining = new Set(nodes);
  const done = new Set<string>();
  const waves: string[] = [];
  let waveNumber = 1;
  while (remaining.size) {
    const ready = Array.from(remaining).filter((node) => edges.filter(([, child]) => child.toLowerCase() === node.toLowerCase()).every(([parent]) => done.has(parent)));
    if (!ready.length) {
      waves.push(`Wave ${waveNumber} · ${Array.from(remaining).join(", ")}`);
      break;
    }
    waves.push(`Wave ${waveNumber} · ${ready.join(", ")}`);
    ready.forEach((node) => { remaining.delete(node); done.add(node); });
    waveNumber += 1;
  }
  return waves;
}

export default function KMITORABusinessRequirementsWorkspace({ onClose, onContinue }: Props) {
  const existing = (() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") as RequirementRecord | null; }
    catch { return null; }
  })();
  const [text, setText] = useState(existing?.objective || "");
  const [attachments, setAttachments] = useState<RequirementRecord["attachments"]>(existing?.attachments || []);
  const [saved, setSaved] = useState<RequirementRecord | null>(existing);
  const [message, setMessage] = useState(existing ? "Previously saved DEV requirement loaded." : "");
  const [analyzing, setAnalyzing] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const analysisRef = useRef<HTMLDivElement | null>(null);

  const rules = useMemo(() => extractRules(text), [text]);
  const waves = useMemo(() => detectLoadWaves(text), [text]);
  const mappings = useMemo(() => detectMappings(rules), [rules]);
  const sourceScope = useMemo(() => compileSourceScope(rules), [rules]);
  const hasObjective = text.trim().length >= 20;

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const next = Array.from(files).map((f) => ({ name: f.name, size: f.size, type: f.type || "application/octet-stream" }));
    setAttachments((prev) => [...prev, ...next].filter((v, i, a) => a.findIndex((x) => x.name === v.name && x.size === v.size) === i));
    setMessage("Attachment references added. Content ingestion/semantic extraction occurs in Discover & Understand.");
  };

  const saveRequirement = () => {
    if (!hasObjective) { setMessage("Enter the migration objective and business rules before saving."); return; }
    setAnalyzing(true);
    const record: RequirementRecord = {
      objective: text.trim(), rules, attachments, savedAt: new Date().toISOString(), environment: "DEV",
      productionWritesEnabled: false, cutoverEnabled: false,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    window.dispatchEvent(new CustomEvent("kmitora:business-requirement-state", { detail: { ready: true, ruleCount: rules.length } }));
    setSaved(record);
    setAnalyzing(false);
    setMessage(`ANALYSIS COMPLETE · ${rules.length} explicit business rules captured · ${waves.length} load waves detected · Ready for Discover & Understand.`);
    window.setTimeout(() => analysisRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const continueToDiscover = () => {
    if (!saved) return;
    setMessage("Opening Discover & Understand with the saved requirement context.");
    if (onContinue) {
      onContinue();
      return;
    }
    window.dispatchEvent(new CustomEvent("kmitora:navigate", { detail: { page: "discover" } }));
  };

  return <section className="kbr-shell">
    <div className="kbr-head">
      <div><div className="kbr-eyebrow">UI-005 · BUSINESS REQUIREMENTS & RULES</div><h2>Tell KMITORA What You Want</h2><p>Capture the migration objective, rules and supporting artifacts before discovery, mapping or transformation.</p></div>
      {onClose && <button className="kbr-ghost" onClick={onClose}>Back to Connections</button>}
    </div>

    <div className="kbr-safety"><strong>DEV GOVERNANCE</strong><span>Source remains read-only · DEV planning only · Production writes DISABLED · Cutover DISABLED</span></div>

    <div className="kbr-grid">
      <div className="kbr-card kbr-editor-card">
        <div className="kbr-card-head"><div><span>MIGRATION OBJECTIVE</span><h3>Prompt / Business Rules</h3></div><button className="kbr-secondary" onClick={() => { setText(DEV_TEMPLATE); setMessage("DEV end-to-end test template loaded. Review before saving."); }}>Load DEV Test Template</button></div>
        <textarea value={text} onChange={(e) => { setText(e.target.value); setSaved(null); }} placeholder="Describe what KMITORA must migrate, how data must transform, validation rules, load sequence and reconciliation expectations..." />
        <div className="kbr-input-actions">
          <input ref={fileRef} type="file" multiple hidden onChange={(e) => addFiles(e.target.files)} accept=".txt,.md,.csv,.json,.sql,.ddl,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg" />
          <button className="kbr-secondary" onClick={() => fileRef.current?.click()}>+ Add Documents / Diagrams</button>
          <button className="kbr-primary" disabled={!hasObjective || analyzing} onClick={saveRequirement}>{analyzing ? "Analyzing..." : "Save & Analyze Requirement"}</button>
        </div>
        {attachments.length > 0 && <div className="kbr-attachments"><strong>Supporting artifacts</strong>{attachments.map((f) => <span key={`${f.name}-${f.size}`}>{f.name} · {Math.max(1, Math.round(f.size / 1024))} KB</span>)}</div>}
        {message && <div className="kbr-message" role="status" aria-live="polite">{message}</div>}
      </div>

      <div className="kbr-card" ref={analysisRef}>
        <div className="kbr-card-head"><div><span>KMITORA UNDERSTANDING PREVIEW</span><h3>Captured Intent</h3></div><span className={`kbr-status ${saved ? "ready" : "draft"}`}>{saved ? "ANALYZED" : "DRAFT"}</span></div>
        <div className="kbr-kpis"><div><strong>{rules.length}</strong><span>Explicit Rules</span></div><div><strong>{attachments.length}</strong><span>Artifacts</span></div><div><strong>{waves.length || 0}</strong><span>Load Waves Detected</span></div></div>
        <div className="kbr-summary-block"><strong>Expected entity flow</strong>{mappings.length ? mappings.map((mapping) => <p key={mapping}>{mapping}</p>) : <p>Entity mappings will be inferred from captured rules and live metadata.</p>}</div>
        <div className="kbr-summary-block"><strong>Compiled source scope</strong><p>{sourceScope.mode === "FILTERED" ? sourceScope.description : "No row-level source filter detected."}</p></div>
        <div className="kbr-summary-block"><strong>Dependency / load sequence</strong>{waves.length ? waves.map((w) => <p key={w}>{w}</p>) : <p>Save the requirement to establish the governed load sequence.</p>}</div>
        <div className="kbr-summary-block"><strong>Analysis result</strong><p>{saved ? `${rules.length} rules captured. ${waves.length} governed load waves detected. Requirement context persisted for Discover & Understand.` : "Save & Analyze Requirement to establish the governed requirement context."}</p></div>
        <div className="kbr-summary-block"><strong>Next engine</strong><p>Discover & Understand will inspect source/target metadata and combine it with this requirement. No mapping, transformation or migration is executed by UI-005.</p></div>
      </div>
    </div>

    {rules.length > 0 && <div className="kbr-card kbr-rules-card"><div className="kbr-card-head"><div><span>BUSINESS RULE REGISTER</span><h3>{rules.length} Captured Rules</h3></div></div><div className="kbr-rule-table"><table><thead><tr><th>ID</th><th>Rule</th><th>State</th></tr></thead><tbody>{rules.map((r, i) => <tr key={`${r}-${i}`}><td>BR-{String(i + 1).padStart(3, "0")}</td><td>{r}</td><td><span className="kbr-rule-state">CAPTURED</span></td></tr>)}</tbody></table></div></div>}

    <div className="kbr-next" id="kbr-next"><div><span>{saved ? "READY" : "REQUIREMENT REQUIRED"}</span><h3>Continue to Discover</h3><p>{saved ? "Requirement analysis is complete. Continue to inspect actual source/target metadata and combine it with the saved business requirement." : "Save and analyze the requirement before continuing."}</p></div><button disabled={!saved} onClick={continueToDiscover}>Continue to Discover</button></div>
  </section>;
}

