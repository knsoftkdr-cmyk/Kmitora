import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  BrainCircuit,
  CheckCircle2,
  Search,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from "lucide-react";

import {
  allocateDomainAgents,
  buildClientDomainContext,
  getDomainCatalog,
  inferDomainContext,
  synthesizeDomainScenarios,
  type AgentAllocation,
  type ClientDomainContext,
  type DomainInference,
  type DomainItem,
  type DynamicScenarioSet,
} from "../services/domainIntelligenceApi";
import { saveDomainContext } from "../services/domainContext";

type Props = {
  onNavigate: (value: string) => void;
};

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function DomainIntelligence({ onNavigate }: Props) {
  const [catalog, setCatalog] = useState<DomainItem[]>([]);
  const [query, setQuery] = useState("");
  const [description, setDescription] = useState(
    "Global enterprise modernizing customer, finance, data, APIs and cloud applications with defects, migration risk and regulatory controls.",
  );
  const [systems, setSystems] = useState(
    "Oracle, SAP, Salesforce, APIs, Kubernetes",
  );
  const [processes, setProcesses] = useState(
    "customer onboarding, order to cash, record to report",
  );
  const [issues, setIssues] = useState(
    "data defects, API errors, performance incidents, schema mismatches",
  );
  const [technologies, setTechnologies] = useState(
    "SQL, REST API, cloud, microservices, ETL",
  );
  const [inference, setInference] = useState<DomainInference | null>(null);
  const [context, setContext] = useState<ClientDomainContext | null>(null);
  const [allocation, setAllocation] = useState<AgentAllocation | null>(null);
  const [scenarios, setScenarios] = useState<DynamicScenarioSet | null>(null);
  const [selectedDomain, setSelectedDomain] = useState("");
  const [selectedFunctions, setSelectedFunctions] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getDomainCatalog()
      .then((data) => setCatalog(data.items))
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : String(reason)),
      );
  }, []);

  const filteredCatalog = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return catalog.slice(0, 40);
    return catalog
      .filter((item) =>
        `${item.id} ${item.name} ${item.kind}`.toLowerCase().includes(term),
      )
      .slice(0, 60);
  }, [catalog, query]);

  function payload(domainName?: string) {
    return {
      description,
      domain_name: domainName ?? selectedDomain,
      systems: splitCsv(systems),
      processes: splitCsv(processes),
      issues: splitCsv(issues),
      technologies: splitCsv(technologies),
      functions: selectedFunctions,
    };
  }

  async function infer() {
    setBusy(true);
    setError("");
    try {
      const result = await inferDomainContext(payload());
      setInference(result);

      const domain = result.industries[0]?.name ?? selectedDomain;
      const functions = result.functions.map((item) => item.name);
      setSelectedDomain(domain);
      setSelectedFunctions(functions);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  async function activate() {
    setBusy(true);
    setError("");
    try {
      const base = payload(selectedDomain);
      const clientContext = await buildClientDomainContext(base);
      const agents = await allocateDomainAgents({
        ...base,
        domain_name: clientContext.domain,
        functions: clientContext.functions,
      });
      const dynamic = await synthesizeDomainScenarios({
        ...base,
        domain_name: clientContext.domain,
        functions: clientContext.functions,
      });

      saveDomainContext(clientContext);
      setContext(clientContext);
      setAllocation(agents);
      setScenarios(dynamic);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page kdiPage">
      <section className="kdiHero">
        <div>
          <span className="eyebrow">A000 UNIVERSAL DOMAIN INTELLIGENCE</span>
          <h1>Smart Business Domain Understanding</h1>
          <p>
            Describe the client once. KMITORA infers business domains,
            enterprise functions, systems, technologies and problem context,
            then composes governed specialist agents and lifecycle scenarios.
          </p>
        </div>
        <div className="kdiHeroStatus">
          <BrainCircuit size={20} />
          <strong>170 seeded domains</strong>
          <span>Extensible per client</span>
          <span>Production actions denied by default</span>
        </div>
      </section>

      {error && <div role="alert" className="a1mAlert">{error}</div>}

      <section className="kdiGrid">
        <div className="panel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">SMART CONTEXT</span>
              <h3>Tell KMITORA about the business</h3>
              <p>Natural-language context plus system/process/problem signals.</p>
            </div>
          </div>

          <label className="kdiField">
            <span>Client / business description</span>
            <textarea
              rows={5}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              data-testid="kdi-description"
            />
          </label>

          <div className="kdiTwo">
            <label className="kdiField">
              <span>Systems</span>
              <input value={systems} onChange={(e) => setSystems(e.target.value)} />
            </label>
            <label className="kdiField">
              <span>Processes</span>
              <input value={processes} onChange={(e) => setProcesses(e.target.value)} />
            </label>
            <label className="kdiField">
              <span>Problems / defects / risks</span>
              <input value={issues} onChange={(e) => setIssues(e.target.value)} />
            </label>
            <label className="kdiField">
              <span>Technologies</span>
              <input value={technologies} onChange={(e) => setTechnologies(e.target.value)} />
            </label>
          </div>

          <div className="buttonRow">
            <button
              className="primary"
              type="button"
              onClick={() => void infer()}
              disabled={busy}
              data-testid="kdi-infer"
            >
              <Sparkles size={16} />
              Smart Infer Domain
            </button>
            <button
              type="button"
              onClick={() => void activate()}
              disabled={busy || !selectedDomain}
              data-testid="kdi-activate"
            >
              <WandSparkles size={16} />
              Activate A000 Context
            </button>
          </div>
        </div>

        <div className="panel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">UNIVERSAL CATALOG</span>
              <h3>Search or override</h3>
              <p>Human selection always remains available.</p>
            </div>
          </div>

          <div className="dtgSearch">
            <Search size={16} />
            <input
              aria-label="Search domains"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Banking, healthcare, finance, security..."
            />
          </div>

          <div className="kdiCatalog">
            {filteredCatalog.map((item) => (
              <button
                key={item.id}
                type="button"
                className={selectedDomain === item.name ? "active" : ""}
                onClick={() => {
                  if (item.kind === "INDUSTRY") setSelectedDomain(item.name);
                  else if (!selectedFunctions.includes(item.name)) {
                    setSelectedFunctions((current) => [...current, item.name]);
                  }
                }}
              >
                <small>{item.id}</small>
                <span>{item.name}</span>
                <em>{item.kind === "INDUSTRY" ? "Industry" : "Function"}</em>
              </button>
            ))}
          </div>
        </div>
      </section>

      {inference && (
        <section className="panel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">A000 INFERENCE</span>
              <h3>Recommended business context</h3>
            </div>
            <span className="statusPill success">
              {inference.inference_truth}
            </span>
          </div>

          <div className="kdiInference">
            <div>
              <span>Industry candidates</span>
              {inference.industries.length ? inference.industries.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedDomain(item.name)}
                  className={selectedDomain === item.name ? "active" : ""}
                >
                  <strong>{item.name}</strong>
                  <small>{item.confidence}% confidence</small>
                </button>
              )) : <p>Manual confirmation required.</p>}
            </div>
            <div>
              <span>Business / technical functions</span>
              <div className="kdiChips">
                {inference.functions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={selectedFunctions.includes(item.name) ? "active" : ""}
                    onClick={() =>
                      setSelectedFunctions((current) =>
                        current.includes(item.name)
                          ? current.filter((name) => name !== item.name)
                          : [...current, item.name],
                      )
                    }
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {context && allocation && scenarios && (
        <>
          <section className="kdiContext" data-testid="kdi-context">
            <div>
              <span>ACTIVE CLIENT CONTEXT</span>
              <strong>{context.domain}</strong>
              <small>{context.context_id}</small>
            </div>
            <div>
              <span>Functions</span>
              <strong>{context.functions.length}</strong>
            </div>
            <div>
              <span>Allocated agents</span>
              <strong>{allocation.agent_count}</strong>
            </div>
            <div>
              <span>Dynamic scenarios</span>
              <strong>{scenarios.scenario_count}</strong>
            </div>
            <div className="kdiSafe">
              <ShieldCheck size={18} />
              <strong>GOVERNED</strong>
              <small>PROD DENIED</small>
            </div>
          </section>

          <section className="kdiGrid">
            <div className="panel">
              <div className="panelHeader">
                <div>
                  <span className="eyebrow">DYNAMIC AGENT TEAM</span>
                  <h3>A000 specialist allocation</h3>
                </div>
              </div>
              <div className="kdiAgentList">
                {allocation.agents.map((agent) => (
                  <div key={agent.agent_id}>
                    <Bot size={16} />
                    <div>
                      <strong>{agent.agent_id} · {agent.title}</strong>
                      <p>{agent.purpose}</p>
                    </div>
                    <small>{agent.authority}</small>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel">
              <div className="panelHeader">
                <div>
                  <span className="eyebrow">DYNAMIC SCENARIO FABRIC</span>
                  <h3>Context-driven lifecycle scenarios</h3>
                </div>
              </div>
              <div className="kdiScenarioList">
                {scenarios.scenarios.slice(0, 20).map((scenario) => (
                  <div key={scenario.scenario_id}>
                    <CheckCircle2 size={15} />
                    <div>
                      <strong>{scenario.stage} · {scenario.driver}</strong>
                      <p>{scenario.expected_behavior}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="buttonRow">
                <button type="button" onClick={() => onNavigate("digitalTwinGraph")}>
                  Open Digital Twin Graph
                </button>
                <button type="button" className="primary" onClick={() => onNavigate("understand")}>
                  Start 13-Stage Lifecycle
                </button>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

