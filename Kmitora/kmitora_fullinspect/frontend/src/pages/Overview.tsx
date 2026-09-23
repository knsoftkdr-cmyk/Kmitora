import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Database,
  Gauge,
  ShieldCheck,
  Timer,
  WandSparkles,
} from "lucide-react";

import { activity, stages } from "../data/mock";
import StageTracker from "../components/StageTracker";
import ProgressRing from "../components/ProgressRing";
import ActivityTimeline from "../components/ActivityTimeline";
import KMITORACopilotOverview from "../components/KMITORACopilotOverview";

export default function Overview({
  onOpen,
}: {
  onOpen: (key: string) => void;
}) {
  return (
    <div className="page controlTowerPage">

      <div className="controlTowerHero">

        <div className="controlTowerHeroCopy">

          <div className="eyebrow">
            PRE-PROD · REFERENCE_MIGRATION_001
          </div>

          <h1>Migration Control Tower</h1>

          <p>
            Monitor migration health, readiness, automation progress,
            exceptions and the next recommended action from one
            executive-operational view.
          </p>

          <div className="controlTowerHeroActions">

            <button
              className="primary actionButton"
              onClick={() => onOpen("validate")}
            >
              Open Current Stage
              <ArrowRight size={17} />
            </button>

            <span className="controlTowerGuardedStatus">
              <ShieldCheck size={15} />
              Execution Guarded
            </span>

          </div>

        </div>

        <KMITORACopilotOverview
          status="ON TRACK"
          message="Workflow guidance, readiness and automation status"
        />

      </div>


      <section className="controlTowerSection">

        <div className="controlTowerSectionHeader">
          <div>
            <span className="controlTowerSectionLabel">
              CURRENT STATUS
            </span>
            <h2>Migration health at a glance</h2>
          </div>
        </div>

        <div className="controlTowerStatusGrid">

          <div className="panel controlTowerProgressPanel">

            <div className="controlTowerProgressVisual">
              <ProgressRing
                value={76}
                label="Overall"
              />
            </div>

            <div className="controlTowerProgressDetails">

              <div className="controlTowerCurrentStage">

                <span>Current Stage</span>

                <strong>Validate</strong>

                <small>
                  96.8% readiness · 6 open exceptions
                </small>

              </div>

              <div className="controlTowerFactGrid">

                <div>
                  <span>Elapsed</span>
                  <strong>03h 48m</strong>
                </div>

                <div>
                  <span>ETA</span>
                  <strong>01h 11m</strong>
                </div>

                <div>
                  <span>Completion</span>
                  <strong>19:42</strong>
                </div>

                <div>
                  <span>Environment</span>
                  <strong>PRE-PROD</strong>
                </div>

              </div>

            </div>

          </div>

          <div className="controlTowerReadinessCard">

            <div className="controlTowerReadinessTop">

              <div>
                <span className="controlTowerSectionLabel">
                  READINESS
                </span>

                <strong>96.8%</strong>

                <p>
                  Migration preparation is on track.
                  Validation remains the active control gate.
                </p>
              </div>

              <Gauge size={28} />

            </div>

            <div className="controlTowerReadinessBar">
              <div
                className="controlTowerReadinessFill"
                style={{ width: "96.8%" }}
              />
            </div>

            <div className="controlTowerReadinessFooter">

              <span>
                <ShieldCheck size={14} />
                No production execution
              </span>

              <button
                onClick={() => onOpen("validate")}
              >
                Review Validation
              </button>

            </div>

          </div>

        </div>

      </section>


      <section className="controlTowerSection">

        <div className="controlTowerSectionHeader">

          <div>
            <span className="controlTowerSectionLabel">
              KEY HEALTH
            </span>

            <h2>Operational indicators</h2>
          </div>

        </div>

        <div className="controlTowerMetrics">

          <div className="controlTowerMetricCard">

            <div className="controlTowerMetricIcon">
              <Database size={19} />
            </div>

            <span>Objects Discovered</span>

            <strong>1,284</strong>

            <small>342 relationships</small>

          </div>


          <div className="controlTowerMetricCard">

            <div className="controlTowerMetricIcon">
              <WandSparkles size={19} />
            </div>

            <span>Mappings Generated</span>

            <strong>1,217</strong>

            <small>14 require review</small>

          </div>


          <div className="controlTowerMetricCard">

            <div className="controlTowerMetricIcon">
              <Gauge size={19} />
            </div>

            <span>Readiness</span>

            <strong>96.8%</strong>

            <small>Pre-production</small>

          </div>


          <div className="controlTowerMetricCard">

            <div className="controlTowerMetricIcon warning">
              <AlertTriangle size={19} />
            </div>

            <span>Open Exceptions</span>

            <strong>6</strong>

            <small>0 critical</small>

          </div>


          <div className="controlTowerMetricCard">

            <div className="controlTowerMetricIcon">
              <Timer size={19} />
            </div>

            <span>Throughput</span>

            <strong>128K</strong>

            <small>records/min</small>

          </div>


          <div className="controlTowerMetricCard">

            <div className="controlTowerMetricIcon">
              <Activity size={19} />
            </div>

            <span>Agents Active</span>

            <strong>8</strong>

            <small>KMITORA orchestration active</small>

          </div>

        </div>

      </section>


      <section className="controlTowerSection">

        <div className="controlTowerSectionHeader">

          <div>
            <span className="controlTowerSectionLabel">
              MIGRATION JOURNEY
            </span>

            <h2>End-to-end workflow progress</h2>

            <p>
              Understand → Discover → Detect → Diagnose → Predict → Recommend → Simulate → Execute → Test → Validate → Reconcile → Evidence → Learn.
            </p>

          </div>

        </div>

        <StageTracker
          stages={stages}
          onOpen={onOpen}
        />

      </section>


      <section className="controlTowerSection">

        <div className="controlTowerBottomGrid">

          <div className="controlTowerActivityColumn">

            <div className="controlTowerSectionHeader compact">

              <div>
                <span className="controlTowerSectionLabel">
                  ACTIVITY
                </span>

                <h2>Recent migration activity</h2>
              </div>

            </div>

            <ActivityTimeline items={activity} />

          </div>


          <div className="panel controlTowerQueuePanel">

            <div className="panelHeader">

              <div>

                <span className="controlTowerSectionLabel">
                  AUTOMATION
                </span>

                <h3>Automation Queue</h3>

                <p>
                  Current orchestration activity and upcoming work.
                </p>

              </div>

            </div>

            <div className="controlTowerQueue">

              <div className="controlTowerQueueItem complete">

                <div className="controlTowerQueueIndicator">
                  ✓
                </div>

                <div>
                  <strong>Metadata extraction</strong>
                  <span>Completed</span>
                </div>

              </div>


              <div className="controlTowerQueueItem complete">

                <div className="controlTowerQueueIndicator">
                  ✓
                </div>

                <div>
                  <strong>Semantic mapping</strong>
                  <span>1,217 generated</span>
                </div>

              </div>


              <div className="controlTowerQueueItem active">

                <div className="controlTowerQueueIndicator">
                  ●
                </div>

                <div>
                  <strong>Validation</strong>
                  <span>1,846 / 1,852 tests</span>
                </div>

              </div>


              <div className="controlTowerQueueItem pending">

                <div className="controlTowerQueueIndicator">
                  ○
                </div>

                <div>
                  <strong>Migration wave preparation</strong>
                  <span>Waiting for validation</span>
                </div>

              </div>

            </div>


            <div className="controlTowerSafetyBox">

              <ShieldCheck size={17} />

              <div>
                <strong>Execution remains guarded</strong>

                <span>
                  No production migration or cutover is enabled.
                </span>
              </div>

            </div>

          </div>

        </div>

      </section>

    </div>
  );
}


