import SystemExplorerPremiumWorkspace from "../components/SystemExplorerPremiumWorkspace";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Database,
  GitBranch,
  Network,
  Search,
  Server,
  ShieldCheck,
} from "lucide-react";

import type {
  ConnectionReadiness,
  MigrationSystem,
  TopologyRelationship,
  TopologyType,
} from "../models/MigrationTopology";

import type { A000WorkflowState } from "../models/AutomationWorkflow";

import KMITORACopilotOverview from "../components/KMITORACopilotOverview";

type SystemFilter =
  | "ALL"
  | "SOURCE"
  | "TARGET";

type DiscoveryResultLike = {
  status?: string;
  migration_id?: string;
  summary?: {
    source_entity_count?: number;
    target_entity_count?: number;
    relationship_count?: number;
    business_rule_count?: number;
  };
};

const topologyLabels: Record<
  TopologyType,
  string
> = {
  ONE_TO_ONE:
    "One Source → One Target",
  ONE_TO_MANY:
    "One Source → Multiple Targets",
  MANY_TO_ONE:
    "Multiple Sources → One Target",
  MANY_TO_MANY:
    "Multiple Sources → Multiple Targets",
};

function readJson<T>(
  key: string,
  fallback: T
): T {
  try {
    const raw =
      localStorage.getItem(key);

    if (!raw) {
      return fallback;
    }

    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function SystemExplorer() {
  const [sources, setSources] =
    useState<MigrationSystem[]>([]);

  const [targets, setTargets] =
    useState<MigrationSystem[]>([]);

  const [relationships, setRelationships] =
    useState<TopologyRelationship[]>([]);

  const [topologyType, setTopologyType] =
    useState<TopologyType>("ONE_TO_ONE");

  const [readiness, setReadiness] =
    useState<ConnectionReadiness | null>(
      null
    );

  const [workflow, setWorkflow] =
    useState<A000WorkflowState | null>(
      null
    );

  const [discovery, setDiscovery] =
    useState<DiscoveryResultLike | null>(
      null
    );

  const [search, setSearch] =
    useState("");

  const [filter, setFilter] =
    useState<SystemFilter>("ALL");

  const [selectedSystemId, setSelectedSystemId] =
    useState<string | null>(null);

  useEffect(() => {
    setSources(
      readJson<MigrationSystem[]>(
        "kmitora.dev.sources",
        []
      )
    );

    setTargets(
      readJson<MigrationSystem[]>(
        "kmitora.dev.targets",
        []
      )
    );

    setRelationships(
      readJson<TopologyRelationship[]>(
        "kmitora.dev.topologyRelationships",
        []
      )
    );

    const storedTopology =
      localStorage.getItem(
        "kmitora.dev.topologyType"
      ) as TopologyType | null;

    if (
      storedTopology &&
      topologyLabels[storedTopology]
    ) {
      setTopologyType(
        storedTopology
      );
    }

    setReadiness(
      readJson<ConnectionReadiness | null>(
        "kmitora.dev.connectionReadiness",
        null
      )
    );

    setWorkflow(
      readJson<A000WorkflowState | null>(
        "kmitora.dev.workflowState",
        null
      )
    );

    setDiscovery(
      readJson<DiscoveryResultLike | null>(
        "kmitora.dev.discoveryResult",
        null
      )
    );
  }, []);

  const systems =
    useMemo(
      () => [
        ...sources,
        ...targets,
      ],
      [sources, targets]
    );

  const filteredSystems =
    useMemo(() => {
      const q =
        search.trim().toLowerCase();

      return systems.filter(
        (system) => {
          if (
            filter !== "ALL" &&
            system.role !== filter
          ) {
            return false;
          }

          if (!q) {
            return true;
          }

          return [
            system.id,
            system.name,
            system.role,
            system.category,
            system.connector,
            system.host,
            system.status,
          ].some((value) =>
            String(value ?? "")
              .toLowerCase()
              .includes(q)
          );
        }
      );
    }, [
      systems,
      search,
      filter,
    ]);

  const selectedSystem =
    systems.find(
      (system) =>
        system.id === selectedSystemId
    ) ?? null;

  const relatedRelationships =
    selectedSystem
      ? relationships.filter(
          (relationship) =>
            relationship.sourceSystemId ===
              selectedSystem.id ||
            relationship.targetSystemId ===
              selectedSystem.id
        )
      : [];

  const validatedSystems =
    systems.filter(
      (system) =>
        system.status === "VALIDATED"
    ).length;

  const discoveredRelationships =
    workflow?.discoveredRelationships ??
    0;

  const failedRelationships =
    workflow?.failedRelationships ??
    0;

  const skippedRelationships =
    workflow?.skippedRelationships ??
    0;

  const systemCoverage =
    systems.length > 0
      ? Math.round(
          (
            validatedSystems /
            systems.length
          ) * 100
        )
      : 0;

  const relationshipCoverage =
    relationships.length > 0
      ? Math.round(
          (
            discoveredRelationships /
            relationships.length
          ) * 100
        )
      : 0;

  const sourceEntityCount =
    discovery?.summary
      ?.source_entity_count ?? 0;

  const targetEntityCount =
    discovery?.summary
      ?.target_entity_count ?? 0;

  return (
    <div className="page systemExplorerPage">
      <SystemExplorerPremiumWorkspace />

      <div className="systemExplorerHero">

        <div className="systemExplorerHeroCopy">

          <span className="eyebrow">
            ENTERPRISE LANDSCAPE
          </span>

          <h1>
            System Explorer
          </h1>

          <p>
            Explore the current KMITORA
            source, target, topology,
            relationship and discovery
            landscape using persisted
            DEV runtime evidence.
          </p>

          <div className="systemExplorerHeroMeta">

            <span className="systemExplorerBadge">
              <ShieldCheck size={14} />
              Read-only explorer
            </span>

            <span className="systemExplorerBadge">
              Topology:{" "}
              {
                topologyLabels[
                  topologyType
                ]
              }
            </span>

          </div>

        </div>


        <KMITORACopilotOverview
          status={
            readiness?.overallReady
              ? "READY"
              : "REVIEW"
          }
          message="Enterprise topology, systems, relationships and discovery coverage"
        />

      </div>


      <section className="systemExplorerSection">

        <div className="systemExplorerSectionHeader">

          <div>

            <span className="systemExplorerSectionLabel">
              LANDSCAPE HEALTH
            </span>

            <h2>
              Current enterprise topology
            </h2>

            <p>
              Runtime values are read from
              the current Connect and
              Discovery state.
            </p>

          </div>

        </div>


        <div className="systemExplorerMetrics">

          <div className="systemExplorerMetricCard">

            <Database size={18} />

            <span>
              Source Systems
            </span>

            <strong>
              {sources.length}
            </strong>

            <small>
              {sourceEntityCount} discovered entities
            </small>

          </div>


          <div className="systemExplorerMetricCard">

            <Server size={18} />

            <span>
              Target Systems
            </span>

            <strong>
              {targets.length}
            </strong>

            <small>
              {targetEntityCount} discovered entities
            </small>

          </div>


          <div className="systemExplorerMetricCard safe">

            <CheckCircle2 size={18} />

            <span>
              Validated Systems
            </span>

            <strong>
              {validatedSystems}
            </strong>

            <small>
              {systemCoverage}% connection coverage
            </small>

          </div>


          <div className="systemExplorerMetricCard">

            <GitBranch size={18} />

            <span>
              Relationships
            </span>

            <strong>
              {relationships.length}
            </strong>

            <small>
              {relationshipCoverage}% discovered
            </small>

          </div>


          <div className="systemExplorerMetricCard">

            <Network size={18} />

            <span>
              Workflow
            </span>

            <strong>
              {
                workflow?.status ??
                "NOT STARTED"
              }
            </strong>

            <small>
              Discovery automation state
            </small>

          </div>

        </div>

      </section>


      <section className="systemExplorerSection">

        <div className="systemExplorerSectionHeader">

          <div>

            <span className="systemExplorerSectionLabel">
              TOPOLOGY MAP
            </span>

            <h2>
              Source → Target relationships
            </h2>

            <p>
              Relationship view generated
              from the topology already
              configured in Connect.
            </p>

          </div>

          <span
            className={`statusPill ${
              readiness?.topologyValidated
                ? "success"
                : "review"
            }`}
          >
            {
              readiness?.topologyValidated
                ? "VALIDATED"
                : "PENDING"
            }
          </span>

        </div>


        <div className="systemExplorerTopology">

          <div className="systemExplorerTopologyColumn">

            <span className="systemExplorerColumnLabel">
              SOURCES
            </span>

            {
              sources.length > 0
                ? sources.map(
                    (system) => (

                      <button
                        type="button"
                        key={system.id}
                        className={`systemExplorerNode ${
                          selectedSystemId ===
                          system.id
                            ? "active"
                            : ""
                        }`}
                        onClick={() =>
                          setSelectedSystemId(
                            system.id
                          )
                        }
                      >

                        <Database size={17} />

                        <div>
                          <strong>
                            {system.name}
                          </strong>

                          <span>
                            {system.connector}
                          </span>
                        </div>

                        <small>
                          {
                            system.status ??
                            "CONFIGURED"
                          }
                        </small>

                      </button>

                    )
                  )
                : (
                  <div className="systemExplorerTopologyEmpty">
                    No source systems configured.
                  </div>
                )
            }

          </div>


          <div className="systemExplorerRelationshipColumn">

            <span className="systemExplorerColumnLabel">
              RELATIONSHIPS
            </span>

            {
              relationships.length > 0
                ? relationships.map(
                    (relationship) => {

                      const source =
                        sources.find(
                          (system) =>
                            system.id ===
                            relationship
                              .sourceSystemId
                        );

                      const target =
                        targets.find(
                          (system) =>
                            system.id ===
                            relationship
                              .targetSystemId
                        );

                      return (
                        <div
                          className="systemExplorerRelationship"
                          key={
                            relationship.id
                          }
                        >

                          <strong>
                            {
                              source?.name ??
                              relationship
                                .sourceSystemId
                            }
                          </strong>

                          <span>
                            →
                          </span>

                          <strong>
                            {
                              target?.name ??
                              relationship
                                .targetSystemId
                            }
                          </strong>

                          <small>
                            {
                              relationship.status
                            }
                            {
                              relationship
                                .confidence !==
                              undefined
                                ? ` · ${relationship.confidence}%`
                                : ""
                            }
                          </small>

                        </div>
                      );
                    }
                  )
                : (
                  <div className="systemExplorerTopologyEmpty">
                    No topology relationships available.
                  </div>
                )
            }

          </div>


          <div className="systemExplorerTopologyColumn">

            <span className="systemExplorerColumnLabel">
              TARGETS
            </span>

            {
              targets.length > 0
                ? targets.map(
                    (system) => (

                      <button
                        type="button"
                        key={system.id}
                        className={`systemExplorerNode ${
                          selectedSystemId ===
                          system.id
                            ? "active"
                            : ""
                        }`}
                        onClick={() =>
                          setSelectedSystemId(
                            system.id
                          )
                        }
                      >

                        <Server size={17} />

                        <div>
                          <strong>
                            {system.name}
                          </strong>

                          <span>
                            {system.connector}
                          </span>
                        </div>

                        <small>
                          {
                            system.status ??
                            "CONFIGURED"
                          }
                        </small>

                      </button>

                    )
                  )
                : (
                  <div className="systemExplorerTopologyEmpty">
                    No target systems configured.
                  </div>
                )
            }

          </div>

        </div>

      </section>


      <section className="systemExplorerSection">

        <div className="systemExplorerSectionHeader">

          <div>

            <span className="systemExplorerSectionLabel">
              SYSTEM INVENTORY
            </span>

            <h2>
              Search the current landscape
            </h2>

          </div>


          <div className="systemExplorerSearch">

            <Search size={15} />

            <input
              placeholder="Search systems..."
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
            />

          </div>

        </div>


        <div className="systemExplorerFilters">

          {[
            "ALL",
            "SOURCE",
            "TARGET",
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
                  item as SystemFilter
                )
              }
            >
              {item}
            </button>

          ))}

        </div>


        <div className="systemExplorerInventory">

          {
            filteredSystems.length > 0
              ? filteredSystems.map(
                  (system) => (

                    <button
                      type="button"
                      className="systemExplorerInventoryCard"
                      key={system.id}
                      onClick={() =>
                        setSelectedSystemId(
                          system.id
                        )
                      }
                    >

                      <div className="systemExplorerInventoryIcon">

                        {
                          system.role ===
                          "SOURCE"
                            ? (
                              <Database
                                size={18}
                              />
                            )
                            : (
                              <Server
                                size={18}
                              />
                            )
                        }

                      </div>


                      <div className="systemExplorerInventoryCopy">

                        <div>

                          <strong>
                            {system.name}
                          </strong>

                          <span>
                            {system.id}
                          </span>

                        </div>


                        <small>
                          {system.category}
                          {" · "}
                          {system.connector}
                        </small>

                      </div>


                      <span
                        className={`statusPill ${
                          system.status ===
                          "VALIDATED"
                            ? "success"
                            : "review"
                        }`}
                      >
                        {
                          system.status ??
                          "CONFIGURED"
                        }
                      </span>

                    </button>

                  )
                )
              : (
                <div className="panel systemExplorerNoResults">
                  No systems match the current filter.
                </div>
              )
          }

        </div>

      </section>


      {selectedSystem && (

        <section className="systemExplorerSection">

          <div className="panel systemExplorerDetailPanel">

            <div className="panelHeader">

              <div>

                <span className="systemExplorerSectionLabel">
                  SYSTEM DETAIL
                </span>

                <h3>
                  {selectedSystem.name}
                </h3>

                <p>
                  Read-only configuration and
                  topology evidence.
                </p>

              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedSystemId(
                    null
                  )
                }
              >
                Close
              </button>

            </div>


            <div className="systemExplorerDetailGrid">

              <div>
                <span>System ID</span>
                <strong>
                  {selectedSystem.id}
                </strong>
              </div>

              <div>
                <span>Role</span>
                <strong>
                  {selectedSystem.role}
                </strong>
              </div>

              <div>
                <span>Category</span>
                <strong>
                  {
                    selectedSystem.category
                  }
                </strong>
              </div>

              <div>
                <span>Connector</span>
                <strong>
                  {
                    selectedSystem.connector
                  }
                </strong>
              </div>

              <div>
                <span>Host / Location</span>
                <strong>
                  {
                    selectedSystem.host ??
                    "—"
                  }
                </strong>
              </div>

              <div>
                <span>Status</span>
                <strong>
                  {
                    selectedSystem.status ??
                    "—"
                  }
                </strong>
              </div>

            </div>


            <div className="systemExplorerRelated">

              <span className="systemExplorerSectionLabel">
                RELATED TOPOLOGY
              </span>

              {
                relatedRelationships.length >
                0
                  ? relatedRelationships.map(
                      (relationship) => (

                        <div
                          key={
                            relationship.id
                          }
                        >

                          <GitBranch
                            size={15}
                          />

                          <span>
                            {
                              relationship
                                .sourceSystemId
                            }
                            {" → "}
                            {
                              relationship
                                .targetSystemId
                            }
                          </span>

                          <small>
                            {
                              relationship.status
                            }
                          </small>

                        </div>

                      )
                    )
                  : (
                    <p>
                      No relationships linked to
                      this system.
                    </p>
                  )
              }

            </div>

          </div>

        </section>

      )}


      <section className="systemExplorerSection">

        <div className="systemExplorerSectionHeader">

          <div>

            <span className="systemExplorerSectionLabel">
              AUTOMATION COVERAGE
            </span>

            <h2>
              Relationship discovery state
            </h2>

          </div>

        </div>


        <div className="systemExplorerAutomationGrid">

          <div>
            <span>
              Total Relationships
            </span>
            <strong>
              {
                workflow
                  ?.totalRelationships ??
                relationships.length
              }
            </strong>
          </div>

          <div>
            <span>
              Discovered
            </span>
            <strong>
              {
                discoveredRelationships
              }
            </strong>
          </div>

          <div>
            <span>
              Adapter Waiting
            </span>
            <strong>
              {
                skippedRelationships
              }
            </strong>
          </div>

          <div>
            <span>
              Failed
            </span>
            <strong>
              {
                failedRelationships
              }
            </strong>
          </div>

        </div>

      </section>


      <div className="systemExplorerSafetyNote">

        <ShieldCheck size={18} />

        <div>

          <strong>
            System Explorer is read-only
          </strong>

          <span>
            No connection, source, target,
            migration or production state is
            modified from this workspace.
            Production migration and cutover
            remain disabled.
          </span>

        </div>

      </div>

    </div>
  );
}


