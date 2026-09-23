import AgentOperationsPremiumWorkspace from "../components/AgentOperationsPremiumWorkspace";
import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  Brain,
  CheckCircle2,
  Search,
  ShieldCheck,
  Sparkles,
  UserCog,
} from "lucide-react";

import {
  coreAgentRegistry,
} from "../config/agentRegistry";

import type {
  AgentCapability,
  DynamicAgent,
  EnterpriseIntelligenceState,
} from "../models/EnterpriseIntelligence";

import KMITORACopilotOverview from "../components/KMITORACopilotOverview";
import KMITORAAutonomousQualityPanel from "../components/KMITORAAutonomousQualityPanel";

type AgentViewFilter =
  | "ALL"
  | "ACTIVE"
  | "STANDBY"
  | "CREATED_FOR_TASK"
  | "CORE";

const ENTERPRISE_INTELLIGENCE_KEY =
  "kmitora.dev.enterpriseIntelligence";

function readEnterpriseState():
  EnterpriseIntelligenceState | null {
  try {
    const raw =
      localStorage.getItem(
        ENTERPRISE_INTELLIGENCE_KEY
      );

    if (!raw) {
      return null;
    }

    return JSON.parse(
      raw
    ) as EnterpriseIntelligenceState;
  } catch {
    return null;
  }
}

export default function AgentOperations() {
  const [enterpriseState, setEnterpriseState] =
    useState<EnterpriseIntelligenceState | null>(
      null
    );

  const [search, setSearch] =
    useState("");

  const [filter, setFilter] =
    useState<AgentViewFilter>("ALL");

  const [capabilityFilter, setCapabilityFilter] =
    useState<AgentCapability | "ALL">("ALL");

  const [selectedAgentId, setSelectedAgentId] =
    useState<string | null>(null);

  useEffect(() => {
    setEnterpriseState(
      readEnterpriseState()
    );
  }, []);

  const runtimeAgents =
    enterpriseState?.activatedAgents ?? [];

  const dynamicSpecialists =
    runtimeAgents.filter(
      (agent) =>
        agent.status === "CREATED_FOR_TASK"
    );

  const activeRuntimeAgents =
    runtimeAgents.filter(
      (agent) =>
        agent.status === "ACTIVE"
    );

  const standbyRuntimeAgents =
    runtimeAgents.filter(
      (agent) =>
        agent.status === "STANDBY"
    );

  const allCapabilities =
    useMemo(() => {
      const set =
        new Set<AgentCapability>();

      for (const agent of coreAgentRegistry) {
        for (
          const capability of
          agent.capabilities
        ) {
          set.add(capability);
        }
      }

      for (const agent of runtimeAgents) {
        for (
          const capability of
          agent.capabilities
        ) {
          set.add(capability);
        }
      }

      return [...set].sort();
    }, [runtimeAgents]);

  const unifiedAgents =
    useMemo(() => {
      const runtimeMap =
        new Map<string, DynamicAgent>(
          runtimeAgents.map(
            (agent): [string, DynamicAgent] => [
              agent.id,
              agent,
            ]
          )
        );

      const core =
        coreAgentRegistry.map(
          (definition) => {
            const runtime =
              runtimeMap.get(
                definition.id
              );

            return {
              id: definition.id,
              name: definition.name,
              capabilities:
                definition.capabilities,
              knowledge:
                definition.knowledgePacks,
              status:
                runtime?.status ??
                "STANDBY",
              activatedBecause:
                runtime?.activatedBecause ??
                "Available in the KMITORA core agent registry.",
              source:
                "CORE" as const,
            };
          }
        );

      const coreIds =
        new Set(
          core.map((agent) => agent.id)
        );

      const dynamic =
        runtimeAgents
          .filter(
            (agent) =>
              !coreIds.has(agent.id)
          )
          .map((agent) => ({
            id: agent.id,
            name: agent.name,
            capabilities:
              agent.capabilities,
            knowledge:
              agent.inheritedKnowledge,
            status:
              agent.status,
            activatedBecause:
              agent.activatedBecause,
            source:
              "DYNAMIC" as const,
          }));

      return [
        ...core,
        ...dynamic,
      ];
    }, [runtimeAgents]);

  const filteredAgents =
    useMemo(() => {
      const q =
        search.trim().toLowerCase();

      return unifiedAgents.filter(
        (agent) => {
          if (
            filter === "CORE" &&
            agent.source !== "CORE"
          ) {
            return false;
          }

          if (
            filter === "ACTIVE" &&
            agent.status !== "ACTIVE"
          ) {
            return false;
          }

          if (
            filter === "STANDBY" &&
            agent.status !== "STANDBY"
          ) {
            return false;
          }

          if (
            filter ===
              "CREATED_FOR_TASK" &&
            agent.status !==
              "CREATED_FOR_TASK"
          ) {
            return false;
          }

          if (
            capabilityFilter !==
              "ALL" &&
            !agent.capabilities.includes(
              capabilityFilter
            )
          ) {
            return false;
          }

          if (!q) {
            return true;
          }

          return [
            agent.id,
            agent.name,
            agent.status,
            agent.source,
            agent.activatedBecause,
            ...agent.capabilities,
            ...agent.knowledge,
          ].some((value) =>
            String(value)
              .toLowerCase()
              .includes(q)
          );
        }
      );
    }, [
      unifiedAgents,
      filter,
      capabilityFilter,
      search,
    ]);

  const selectedAgent =
    unifiedAgents.find(
      (agent) =>
        agent.id === selectedAgentId
    ) ?? null;

  const businessConfidence =
    enterpriseState
      ?.businessUnderstandingConfidence ??
    0;

  const defectCount =
    enterpriseState
      ?.defects.length ?? 0;

  const governedChanges =
    enterpriseState
      ?.safety.governedChangesRequired ??
    false;

  const safetyPass =
    enterpriseState
      ? enterpriseState.safety
          .readOnlyDiscovery === true &&
        enterpriseState.safety
          .sourceWriteExecuted === false &&
        enterpriseState.safety
          .targetWriteExecuted === false &&
        enterpriseState.safety
          .productionActionExecuted === false
      : true;

  return (
    <div className="page agentOpsPage">
      <AgentOperationsPremiumWorkspace />

      <div className="agentOpsHero">

        <div className="agentOpsHeroCopy">

          <span className="eyebrow">
            AGENTIC OPERATIONS
          </span>

          <h1>
            Agent Operations Center
          </h1>

          <p>
            Observe KMITORA's core intelligence
            agents, activated runtime agents and
            task-created specialists from a single
            governed workspace.
          </p>

          <div className="agentOpsHeroMeta">

            <span className="agentOpsBadge">
              <ShieldCheck size={14} />
              Governed execution
            </span>

            <span className="agentOpsBadge">
              KMITORA = Master Orchestration
            </span>

          </div>

        </div>


        <KMITORACopilotOverview
          status={
            runtimeAgents.length > 0
              ? "ACTIVE"
              : "READY"
          }
          message="Agent activation, specialist coverage and governance status"
        />

      </div>


      <section className="agentOpsSection">

        <div className="agentOpsSectionHeader">

          <div>
            <span className="agentOpsSectionLabel">
              AGENT HEALTH
            </span>

            <h2>
              Runtime intelligence overview
            </h2>

            <p>
              Values come from the current
              enterprise-intelligence state and
              the core KMITORA agent registry.
            </p>
          </div>

        </div>


        <div className="agentOpsMetrics">

          <div className="agentOpsMetricCard">

            <Bot size={18} />

            <span>
              Core Agents
            </span>

            <strong>
              {coreAgentRegistry.length}
            </strong>

            <small>
              Registered intelligence agents
            </small>

          </div>


          <div className="agentOpsMetricCard safe">

            <CheckCircle2 size={18} />

            <span>
              Active Runtime
            </span>

            <strong>
              {activeRuntimeAgents.length}
            </strong>

            <small>
              Currently activated
            </small>

          </div>


          <div className="agentOpsMetricCard">

            <Sparkles size={18} />

            <span>
              Dynamic Specialists
            </span>

            <strong>
              {dynamicSpecialists.length}
            </strong>

            <small>
              Created for task
            </small>

          </div>


          <div className="agentOpsMetricCard">

            <Brain size={18} />

            <span>
              Business Understanding
            </span>

            <strong>
              {businessConfidence}%
            </strong>

            <small>
              Enterprise confidence
            </small>

          </div>


          <div className="agentOpsMetricCard">

            <UserCog size={18} />

            <span>
              Defects / Hypotheses
            </span>

            <strong>
              {defectCount}
            </strong>

            <small>
              Current intelligence workload
            </small>

          </div>

        </div>

      </section>


      <section className="agentOpsSection">

        <div className="panel agentOpsOrchestratorCard">

          <div className="agentOpsOrchestratorIcon">
            <Brain size={24} />
          </div>

          <div>

            <span className="agentOpsSectionLabel">
              INTERNAL ORCHESTRATOR
            </span>

            <h2>
              KMITORA · Global Intelligence Orchestrator
            </h2>

            <p>
              KMITORA coordinates domain,
              business-process, knowledge,
              migration and optimization
              capabilities and activates
              appropriate specialist agents
              based on available evidence and
              workflow requirements.
            </p>

          </div>

          <span className="statusPill success">
            ORCHESTRATOR
          </span>

        </div>

      </section>


      <section className="agentOpsSection">

        <div className="agentOpsSectionHeader">

          <div>

            <span className="agentOpsSectionLabel">
              RUNTIME CONTEXT
            </span>

            <h2>
              Current enterprise assignment
            </h2>

          </div>

        </div>


        <div className="agentOpsContextGrid">

          <div>
            <span>Primary Domain</span>
            <strong>
              {
                enterpriseState
                  ?.primaryDomain ??
                "Not analyzed yet"
              }
            </strong>
          </div>

          <div>
            <span>
              Activated Agents
            </span>
            <strong>
              {runtimeAgents.length}
            </strong>
          </div>

          <div>
            <span>
              Standby Runtime
            </span>
            <strong>
              {standbyRuntimeAgents.length}
            </strong>
          </div>

          <div>
            <span>
              Governed Changes
            </span>
            <strong>
              {
                governedChanges
                  ? "REQUIRED"
                  : "NONE"
              }
            </strong>
          </div>

        </div>

      </section>


      <section className="agentOpsSection">

        <div className="agentOpsSectionHeader">

          <div>

            <span className="agentOpsSectionLabel">
              AGENT DIRECTORY
            </span>

            <h2>
              Core and dynamic specialists
            </h2>

            <p>
              Search by agent, capability,
              knowledge pack, status or
              activation reason.
            </p>

          </div>


          <div className="agentOpsSearch">

            <Search size={15} />

            <input
              placeholder="Search agents..."
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
            />

          </div>

        </div>


        <div className="agentOpsControls">

          <div className="agentOpsFilters">

            {[
              "ALL",
              "CORE",
              "ACTIVE",
              "STANDBY",
              "CREATED_FOR_TASK",
            ].map((item) => (

              <button
                type="button"
                key={item}
                className={
                  filter === item
                    ? "primary"
                    : ""
                }
                onClick={() =>
                  setFilter(
                    item as AgentViewFilter
                  )
                }
              >
                {
                  item.replaceAll(
                    "_",
                    " "
                  )
                }
              </button>

            ))}

          </div>


          <select
            value={capabilityFilter}
            onChange={(event) =>
              setCapabilityFilter(
                event.target.value as
                  | AgentCapability
                  | "ALL"
              )
            }
          >
            <option value="ALL">
              All capabilities
            </option>

            {
              allCapabilities.map(
                (capability) => (
                  <option
                    value={capability}
                    key={capability}
                  >
                    {
                      capability.replaceAll(
                        "_",
                        " "
                      )
                    }
                  </option>
                )
              )
            }

          </select>

        </div>


        <div className="agentOpsDirectory">

          {
            filteredAgents.length > 0
              ? filteredAgents.map(
                  (agent) => (

                    <button
                      type="button"
                      className={`agentOpsAgentCard ${
                        selectedAgentId ===
                        agent.id
                          ? "active"
                          : ""
                      }`}
                      key={agent.id}
                      onClick={() =>
                        setSelectedAgentId(
                          agent.id
                        )
                      }
                    >

                      <div className="agentOpsAgentHeader">

                        <div className="agentOpsAgentIcon">

                          {
                            agent.status ===
                            "CREATED_FOR_TASK"
                              ? (
                                <Sparkles
                                  size={18}
                                />
                              )
                              : (
                                <Bot
                                  size={18}
                                />
                              )
                          }

                        </div>


                        <div>

                          <strong>
                            {agent.id}
                            {" · "}
                            {agent.name}
                          </strong>

                          <span>
                            {
                              agent.source ===
                              "CORE"
                                ? "CORE REGISTRY"
                                : "DYNAMIC SPECIALIST"
                            }
                          </span>

                        </div>


                        <span
                          className={`statusPill ${
                            agent.status ===
                            "ACTIVE" ||
                            agent.status ===
                            "CREATED_FOR_TASK"
                              ? "success"
                              : ""
                          }`}
                        >
                          {
                            agent.status.replaceAll(
                              "_",
                              " "
                            )
                          }
                        </span>

                      </div>


                      <div className="agentOpsCapabilityTags">

                        {
                          agent.capabilities
                            .slice(0, 5)
                            .map(
                              (capability) => (

                                <span
                                  key={
                                    capability
                                  }
                                >
                                  {
                                    capability.replaceAll(
                                      "_",
                                      " "
                                    )
                                  }
                                </span>

                              )
                            )
                        }

                      </div>

                    </button>

                  )
                )
              : (
                <div className="panel agentOpsEmpty">
                  No agents match the current filters.
                </div>
              )
          }

        </div>

      </section>


      {selectedAgent && (

        <section className="agentOpsSection">

          <div className="panel agentOpsDetailPanel">

            <div className="panelHeader">

              <div>

                <span className="agentOpsSectionLabel">
                  AGENT DETAIL
                </span>

                <h3>
                  {selectedAgent.id}
                  {" · "}
                  {selectedAgent.name}
                </h3>

                <p>
                  Runtime capability and
                  knowledge profile.
                </p>

              </div>


              <button
                type="button"
                onClick={() =>
                  setSelectedAgentId(
                    null
                  )
                }
              >
                Close
              </button>

            </div>


            <div className="agentOpsDetailGrid">

              <div>
                <span>Status</span>
                <strong>
                  {
                    selectedAgent.status.replaceAll(
                      "_",
                      " "
                    )
                  }
                </strong>
              </div>

              <div>
                <span>Agent Type</span>
                <strong>
                  {
                    selectedAgent.source ===
                    "CORE"
                      ? "CORE"
                      : "DYNAMIC"
                  }
                </strong>
              </div>

              <div>
                <span>
                  Capabilities
                </span>
                <strong>
                  {
                    selectedAgent
                      .capabilities.length
                  }
                </strong>
              </div>

              <div>
                <span>
                  Knowledge Packs
                </span>
                <strong>
                  {
                    selectedAgent
                      .knowledge.length
                  }
                </strong>
              </div>

            </div>


            <div className="agentOpsDetailBlock">

              <span className="agentOpsSectionLabel">
                ACTIVATION REASON
              </span>

              <p>
                {
                  selectedAgent
                    .activatedBecause
                }
              </p>

            </div>


            <div className="agentOpsDetailBlock">

              <span className="agentOpsSectionLabel">
                CAPABILITIES
              </span>

              <div className="agentOpsCapabilityTags">

                {
                  selectedAgent
                    .capabilities
                    .map(
                      (capability) => (

                        <span
                          key={
                            capability
                          }
                        >
                          {
                            capability.replaceAll(
                              "_",
                              " "
                            )
                          }
                        </span>

                      )
                    )
                }

              </div>

            </div>


            <div className="agentOpsDetailBlock">

              <span className="agentOpsSectionLabel">
                INHERITED KNOWLEDGE
              </span>

              <div className="agentOpsKnowledgeList">

                {
                  selectedAgent.knowledge
                    .map(
                      (knowledge) => (

                        <span
                          key={
                            knowledge
                          }
                        >
                          {knowledge}
                        </span>

                      )
                    )
                }

              </div>

            </div>

          </div>

        </section>

      )}


      <section className="agentOpsSection">

        <div className="agentOpsSectionHeader">

          <div>

            <span className="agentOpsSectionLabel">
              GOVERNANCE
            </span>

            <h2>
              Agent execution safety
            </h2>

          </div>

          <span
            className={`statusPill ${
              safetyPass
                ? "success"
                : "review"
            }`}
          >
            {
              safetyPass
                ? "SAFE"
                : "REVIEW"
            }
          </span>

        </div>


        <div className="agentOpsSafetyGrid">

          <div>
            <span>
              Discovery Mode
            </span>
            <strong>
              {
                enterpriseState
                  ?.safety
                  .readOnlyDiscovery ===
                true
                  ? "READ ONLY"
                  : "NOT AVAILABLE"
              }
            </strong>
          </div>

          <div>
            <span>
              Source Write
            </span>
            <strong>
              {
                String(
                  enterpriseState
                    ?.safety
                    .sourceWriteExecuted ??
                  false
                )
              }
            </strong>
          </div>

          <div>
            <span>
              Target Write
            </span>
            <strong>
              {
                String(
                  enterpriseState
                    ?.safety
                    .targetWriteExecuted ??
                  false
                )
              }
            </strong>
          </div>

          <div>
            <span>
              Production Action
            </span>
            <strong>
              {
                String(
                  enterpriseState
                    ?.safety
                    .productionActionExecuted ??
                  false
                )
              }
            </strong>
          </div>

        </div>

      </section>


      <KMITORAAutonomousQualityPanel />

      <div className="agentOpsSafetyNote">

        <ShieldCheck size={18} />

        <div>

          <strong>
            Governed agent operations
          </strong>

          <span>
            This workspace observes registered
            and runtime agent intelligence.
            It does not independently execute
            source writes, target writes,
            production migration or cutover.
          </span>

        </div>

      </div>

    </div>
  );
}



