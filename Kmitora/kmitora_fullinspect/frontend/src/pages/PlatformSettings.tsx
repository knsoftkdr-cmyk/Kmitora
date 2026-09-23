import SettingsGovernancePremiumWorkspace from "../components/SettingsGovernancePremiumWorkspace";
import {
  Brain,
  CheckCircle2,
  Database,
  Layers3,
  LockKeyhole,
  Mic2,
  Server,
  Settings2,
  ShieldCheck,
} from "lucide-react";

import {
  a000KnowledgePacks,
} from "../config/knowledgePackRegistry";

import KMITORACopilotOverview from "../components/KMITORACopilotOverview";

export default function PlatformSettings() {
  const totalTopics =
    a000KnowledgePacks.reduce(
      (total, pack) =>
        total + pack.topicCount,
      0
    );

  const activePacks =
    a000KnowledgePacks.filter(
      (pack) =>
        pack.status === "ACTIVE"
    );

  const environments = [
    {
      name: "DEV",
      purpose:
        "Development and governed validation workspace",
    },
    {
      name: "QA",
      purpose:
        "Quality-assurance promotion stage",
    },
    {
      name: "UAT",
      purpose:
        "User-acceptance promotion stage",
    },
    {
      name: "PROD",
      purpose:
        "Production environment governed by explicit authority",
    },
  ];

  return (
    <div className="page platformSettingsPage">
      <SettingsGovernancePremiumWorkspace />

      <div className="settingsHero">

        <div className="settingsHeroCopy">

          <span className="eyebrow">
            PLATFORM GOVERNANCE
          </span>

          <h1>
            Platform Settings & Governance
          </h1>

          <p>
            Central visibility into KMITORA
            runtime contracts, environment
            governance, knowledge foundations
            and protected execution policies.
            Only capabilities actually supported
            by the current platform are shown.
          </p>

          <div className="settingsHeroMeta">

            <span className="settingsBadge">
              <ShieldCheck size={14} />
              Governed configuration
            </span>

            <span className="settingsBadge">
              No synthetic settings
            </span>

          </div>

        </div>


        <KMITORACopilotOverview
          status="READY"
          message="Platform configuration, capability foundations and governance posture"
        />

      </div>


      <section className="settingsSection">

        <div className="settingsSectionHeader">

          <div>

            <span className="settingsSectionLabel">
              PLATFORM BASELINE
            </span>

            <h2>
              Runtime configuration posture
            </h2>

            <p>
              Current frontend governance
              baseline and supported runtime
              configuration contracts.
            </p>

          </div>

        </div>


        <div className="settingsMetrics">

          <div className="settingsMetricCard">

            <Layers3 size={18} />

            <span>
              Environment Stages
            </span>

            <strong>
              4
            </strong>

            <small>
              DEV · QA · UAT · PROD
            </small>

          </div>


          <div className="settingsMetricCard safe">

            <CheckCircle2 size={18} />

            <span>
              Knowledge Packs
            </span>

            <strong>
              {activePacks.length}
            </strong>

            <small>
              Active registry entries
            </small>

          </div>


          <div className="settingsMetricCard">

            <Brain size={18} />

            <span>
              Knowledge Topics
            </span>

            <strong>
              {totalTopics.toLocaleString()}
            </strong>

            <small>
              Registered intelligence topics
            </small>

          </div>


          <div className="settingsMetricCard">

            <Mic2 size={18} />

            <span>
              Voice Contract
            </span>

            <strong>
              OPTIONAL
            </strong>

            <small>
              Runtime-provided capability
            </small>

          </div>


          <div className="settingsMetricCard safe">

            <ShieldCheck size={18} />

            <span>
              Production Policy
            </span>

            <strong>
              GUARDED
            </strong>

            <small>
              Explicit authority required
            </small>

          </div>

        </div>

      </section>


      <section className="settingsSection">

        <div className="settingsSectionHeader">

          <div>

            <span className="settingsSectionLabel">
              ENVIRONMENTS
            </span>

            <h2>
              Promotion and authority model
            </h2>

            <p>
              KMITORA defines DEV, QA, UAT
              and PROD environment contracts.
              Runtime state and authority are
              supplied by the platform API.
            </p>

          </div>

          <span className="statusPill review">
            RUNTIME MANAGED
          </span>

        </div>


        <div className="settingsEnvironmentGrid">

          {environments.map(
            (environment) => (

              <div
                className="settingsEnvironmentCard"
                key={environment.name}
              >

                <div className="settingsEnvironmentIcon">
                  <Server size={18} />
                </div>

                <div>

                  <strong>
                    {environment.name}
                  </strong>

                  <p>
                    {environment.purpose}
                  </p>

                </div>


                <span className="settingsReadOnlyTag">
                  PLATFORM CONTROLLED
                </span>

              </div>

            )
          )}

        </div>

      </section>


      <section className="settingsSection">

        <div className="settingsSectionHeader">

          <div>

            <span className="settingsSectionLabel">
              EXECUTION GOVERNANCE
            </span>

            <h2>
              Protected safety policies
            </h2>

            <p>
              Execution authority remains
              separate from presentation-layer
              settings.
            </p>

          </div>

        </div>


        <div className="settingsGovernanceGrid">

          <div className="settingsGovernanceCard">

            <ShieldCheck size={20} />

            <div>

              <span>
                Authoritative Decisions
              </span>

              <strong>
                REQUIRED WHERE GATED
              </strong>

              <p>
                Runtime envelopes distinguish
                authoritative operations from
                informational responses.
              </p>

            </div>

          </div>


          <div className="settingsGovernanceCard">

            <LockKeyhole size={20} />

            <div>

              <span>
                Production Migration
              </span>

              <strong>
                DISABLED
              </strong>

              <p>
                Production migration remains
                unavailable until explicit
                authorization changes the
                governed execution posture.
              </p>

            </div>

          </div>


          <div className="settingsGovernanceCard">

            <LockKeyhole size={20} />

            <div>

              <span>
                Cutover
              </span>

              <strong>
                DISABLED
              </strong>

              <p>
                Cutover remains protected and
                outside the current DEV
                frontend workflow.
              </p>

            </div>

          </div>


          <div className="settingsGovernanceCard">

            <Database size={20} />

            <div>

              <span>
                Target Writes
              </span>

              <strong>
                GOVERNED
              </strong>

              <p>
                Approval and DEV dry-run
                workflows do not independently
                authorize target writes.
              </p>

            </div>

          </div>

        </div>

      </section>


      <section className="settingsSection">

        <div className="settingsSectionHeader">

          <div>

            <span className="settingsSectionLabel">
              ASSISTANT RUNTIME
            </span>

            <h2>
              Interaction capability contract
            </h2>

            <p>
              KMITORA runtime status supports
              operational mode, text capability,
              optional voice capability,
              request telemetry, issues and
              last-agent-action reporting.
            </p>

          </div>

          <span className="statusPill">
            RUNTIME PROVIDED
          </span>

        </div>


        <div className="settingsCapabilityGrid">

          <div>
            <span>
              Runtime Mode
            </span>
            <strong>
              API PROVIDED
            </strong>
          </div>

          <div>
            <span>
              Text Interaction
            </span>
            <strong>
              API PROVIDED
            </strong>
          </div>

          <div>
            <span>
              Voice Interaction
            </span>
            <strong>
              OPTIONAL
            </strong>
          </div>

          <div>
            <span>
              Runtime Requests
            </span>
            <strong>
              TELEMETRY
            </strong>
          </div>

          <div>
            <span>
              Runtime Issues
            </span>
            <strong>
              TELEMETRY
            </strong>
          </div>

          <div>
            <span>
              Last Agent Action
            </span>
            <strong>
              TELEMETRY
            </strong>
          </div>

        </div>

      </section>


      <section className="settingsSection">

        <div className="settingsSectionHeader">

          <div>

            <span className="settingsSectionLabel">
              KNOWLEDGE FOUNDATION
            </span>

            <h2>
              Active intelligence packs
            </h2>

            <p>
              Registered platform knowledge
              is shown as read-only capability
              configuration. These entries are
              not editable user preferences.
            </p>

          </div>


          <span className="statusPill success">
            {activePacks.length} ACTIVE
          </span>

        </div>


        <div className="settingsKnowledgeGrid">

          {a000KnowledgePacks.map(
            (pack) => (

              <div
                className="settingsKnowledgeCard"
                key={pack.id}
              >

                <div className="settingsKnowledgeHeader">

                  <div className="settingsKnowledgeIcon">
                    <Brain size={18} />
                  </div>

                  <div>

                    <span>
                      {pack.id}
                    </span>

                    <strong>
                      {pack.name}
                    </strong>

                  </div>


                  <span className="statusPill success">
                    {pack.status}
                  </span>

                </div>


                <p>
                  {pack.purpose}
                </p>


                <div className="settingsKnowledgeMeta">

                  <div>
                    <span>
                      Topics
                    </span>
                    <strong>
                      {
                        pack.topicCount
                          .toLocaleString()
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      Source
                    </span>
                    <strong>
                      {pack.source}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Configuration
                    </span>
                    <strong>
                      READ ONLY
                    </strong>
                  </div>

                </div>

              </div>

            )
          )}

        </div>

      </section>


      <section className="settingsSection">

        <div className="panel settingsPlatformContract">

          <div className="settingsPlatformContractIcon">
            <Settings2 size={22} />
          </div>

          <div>

            <span className="settingsSectionLabel">
              CONFIGURATION POLICY
            </span>

            <h2>
              Settings must represent real platform capability
            </h2>

            <p>
              This console intentionally avoids
              presenting unsupported toggles,
              synthetic feature flags or fake
              environment controls. Configuration
              that is governed by runtime APIs,
              adapters, deployment policy or
              authoritative workflow remains
              clearly identified as platform
              controlled.
            </p>

          </div>

        </div>

      </section>


      <div className="settingsSafetyNote">

        <ShieldCheck size={18} />

        <div>

          <strong>
            Governance boundary preserved
          </strong>

          <span>
            The Settings workspace is
            informational in the current DEV
            frontend. It does not modify backend
            configuration, environment authority,
            migration execution, target writes,
            production activation or cutover.
          </span>

        </div>

      </div>

    </div>
  );
}


