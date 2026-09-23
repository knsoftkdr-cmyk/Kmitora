import TransformPremiumWorkspace from "../components/TransformPremiumWorkspace";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  FileSearch,
  GitBranch,
  Layers3,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";

import KMITORACopilotOverview from "../components/KMITORACopilotOverview";

type TransformationPlanItem = {
  action?: string;
  source?: string;
  target?: string;
  entity?: string;
  field?: string;
  row?: number | null;
  value?: unknown;
  finding_type?: string;
  severity?: string;
  business_rules?: string[];
  reason?: string;
  status?: string;
  execution_state?: string;
  orphan_values?: unknown[];
};

type DiscoveryResult = {
  migration_id?: string;
  status?: string;
  transformation_plan?: TransformationPlanItem[];
};

export default function Transform() {
  const [discovery, setDiscovery] =
    useState<DiscoveryResult | null>(null);

  const [selectedIndex, setSelectedIndex] =
    useState(0);

  const [sampleStatus, setSampleStatus] =
    useState("READY");

  const [assistantStatus, setAssistantStatus] =
    useState("READY");

  const [revalidationStatus, setRevalidationStatus] =
    useState("NOT_EXECUTED");

  useEffect(() => {
    const raw = localStorage.getItem(
      "kmitora.dev.discoveryResult"
    );

    if (!raw) {
      setDiscovery(null);
      return;
    }

    try {
      setDiscovery(
        JSON.parse(raw) as DiscoveryResult
      );
    } catch {
      setDiscovery(null);
    }
  }, []);

  const plan = useMemo(() => {
    return Array.isArray(
      discovery?.transformation_plan
    )
      ? discovery!.transformation_plan!
      : [];
  }, [discovery]);

  const selected =
    plan.length > 0
      ? plan[
          Math.min(
            selectedIndex,
            plan.length - 1
          )
        ]
      : null;

  const actionCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    for (const item of plan) {
      const action =
        item.action || "UNSPECIFIED";

      counts[action] =
        (counts[action] || 0) + 1;
    }

    return counts;
  }, [plan]);

  const ruleCount = useMemo(() => {
    const rules = new Set<string>();

    for (const item of plan) {
      for (
        const rule of
        item.business_rules || []
      ) {
        rules.add(rule);
      }
    }

    return rules.size;
  }, [plan]);

  const notExecutedCount =
    useMemo(
      () =>
        plan.filter(
          (item) =>
            !item.execution_state ||
            item.execution_state ===
              "NOT_EXECUTED"
        ).length,
      [plan]
    );

  const attentionCount =
    useMemo(
      () =>
        plan.filter((item) => {
          const status = (
            item.status || ""
          ).toUpperCase();

          const severity = (
            item.severity || ""
          ).toUpperCase();

          return (
            status.includes("REVIEW") ||
            status.includes("BLOCK") ||
            status.includes("REJECT") ||
            status.includes("QUARANTINE") ||
            severity === "HIGH" ||
            severity === "CRITICAL"
          );
        }).length,
      [plan]
    );

  const runReferenceSample = () => {
    setSampleStatus("PASS");

    localStorage.setItem(
      "kmitora.dev.transform.sample",
      JSON.stringify({
        mode: "DEV_SIMULATION",
        input: "india",
        trimmed: "india",
        uppercase: "INDIA",
        target: 'country_code = "INDIA"',
        target_write_requested: false,
        execution_state: "NOT_EXECUTED",
      })
    );
  };

  const askKmitora = () => {
    setAssistantStatus("EXPLAINED");
  };

  const applyAndRevalidate = () => {
    setRevalidationStatus("DEV_REVALIDATED");

    localStorage.setItem(
      "kmitora.dev.transform.revalidation",
      JSON.stringify({
        mode: "DEV_ONLY",
        rule: "COUNTRY_REFERENCE_NORMALIZATION",
        validation: "PASS",
        target_write_requested: false,
        execution_state: "NOT_EXECUTED",
      })
    );
  };

  return (
    <div className="page transformStudioPage">
      <TransformPremiumWorkspace />

      <div className="transformHero">

        <div className="transformHeroCopy">

          <span className="eyebrow">
            STEP 04
          </span>

          <h1>
            Transformation Studio
          </h1>

          <p>
            Understand what KMITORA plans to
            transform, why each change is
            required, which business rules are
            involved and what target structure
            the plan references before any
            execution occurs.
          </p>

          <div className="transformHeroMeta">

            <span className="transformReadOnlyBadge">
              <ShieldCheck size={14} />
              Read-only planning
            </span>

            <span className="transformReadOnlyBadge">
              Target-safe
            </span>

          </div>

        </div>

        <KMITORACopilotOverview
          status={
            plan.length === 0
              ? "WAITING"
              : attentionCount > 0
                ? "REVIEW"
                : "READY"
          }
          message="Transformation plan, rule impact and execution readiness"
        />

      </div>


      <section className="transformSection">

        <div className="transformSectionHeader">
          <div>
            <span className="transformSectionLabel">
              DEV TRANSFORMATION WORKBENCH
            </span>
            <h2>Transformation Preview</h2>
            <p>
              Safe reference preview for Trim, Uppercase and Reference validation before any governed execution.
            </p>
          </div>
          <span className="statusPill success">DEV SAFE</span>
        </div>

        <div className="transformFlow">
          <div>
            <strong>Trim</strong>
            <span className="dataBox">india</span>
          </div>
          <b>→</b>
          <div>
            <strong>Reference validation</strong>
            <span className="dataBox">IN → IND → India</span>
          </div>
          <b>→</b>
          <div>
            <strong>Uppercase</strong>
            <span className="dataBox">INDIA</span>
          </div>
          <b>→</b>
          <div>
            <strong>Target preview</strong>
            <span>country_code = "INDIA"</span>
          </div>
        </div>

        <div className="panel transformInspector">
          <div className="panelHeader">
            <div>
              <h3>Rule Editor</h3>
              <p>Editable with preview and impact analysis.</p>
            </div>
            <span className="statusPill review">MEDIUM RISK</span>
          </div>

          <div className="transformEvidenceRows">
            <div>
              <span>Condition</span>
              <strong>IF Value IN country reference set</strong>
            </div>
            <div>
              <span>Reference Values</span>
              <strong>IN → IND → India</strong>
            </div>
            <div>
              <span>Target</span>
              <strong>country_code = "INDIA"</strong>
            </div>
            <div>
              <span>Execution Policy</span>
              <strong>DEV SIMULATION · TARGET WRITES DISABLED</strong>
            </div>
          </div>

          <div className="transformHeroMeta">
            <button type="button" className="primary" onClick={runReferenceSample}>
              Test Sample
            </button>
            <button type="button" onClick={askKmitora}>
              Ask KMITORA
            </button>
            <button type="button" onClick={applyAndRevalidate}>
              Apply &amp; Revalidate
            </button>
          </div>

          <div className="transformEvidenceRows">
            <div>
              <span>Sample</span>
              <strong>{sampleStatus}</strong>
            </div>
            <div>
              <span>KMITORA Guidance</span>
              <strong>{assistantStatus}</strong>
            </div>
            <div>
              <span>Revalidation</span>
              <strong>{revalidationStatus}</strong>
            </div>
          </div>
        </div>

      </section>


      {!discovery && (
        <div className="panel transformEmptyState">

          <FileSearch size={26} />

          <div>
            <h3>No Discovery Result</h3>

            <p>
              Run Discovery before opening
              Transformation Studio.
            </p>
          </div>

        </div>
      )}


      {discovery &&
        plan.length === 0 && (
          <div className="panel transformEmptyState">

            <Workflow size={26} />

            <div>
              <h3>
                No Transformation Plan
              </h3>

              <p>
                Discovery completed, but no
                transformation actions were
                generated.
              </p>
            </div>

          </div>
        )}


      {plan.length > 0 && (
        <>

          <section className="transformSection">

            <div className="transformSectionHeader">

              <div>
                <span className="transformSectionLabel">
                  TRANSFORMATION HEALTH
                </span>

                <h2>
                  Plan readiness at a glance
                </h2>

                <p>
                  Review the generated plan,
                  business-rule coverage,
                  attention items and current
                  execution state.
                </p>
              </div>

            </div>


            <div className="transformMetrics">

              <div className="transformMetricCard">

                <Layers3 size={18} />

                <span>Plan Items</span>

                <strong>
                  {plan.length}
                </strong>

                <small>
                  Transformation actions
                </small>

              </div>


              <div className="transformMetricCard">

                <Workflow size={18} />

                <span>Business Rules</span>

                <strong>
                  {ruleCount}
                </strong>

                <small>
                  Unique governed rules
                </small>

              </div>


              <div className="transformMetricCard attention">

                <AlertTriangle size={18} />

                <span>Needs Attention</span>

                <strong>
                  {attentionCount}
                </strong>

                <small>
                  Review / high-impact items
                </small>

              </div>


              <div className="transformMetricCard safe">

                <ShieldCheck size={18} />

                <span>Not Executed</span>

                <strong>
                  {notExecutedCount}
                </strong>

                <small>
                  Plan-only actions
                </small>

              </div>


              <div className="transformMetricCard">

                <GitBranch size={18} />

                <span>Migration</span>

                <strong className="transformMigrationId">
                  {
                    discovery?.migration_id ||
                    "—"
                  }
                </strong>

                <small>
                  Current migration context
                </small>

              </div>

            </div>

          </section>


          <section className="transformSection">

            <div className="transformSectionHeader">

              <div>
                <span className="transformSectionLabel">
                  TRANSFORMATION FLOW
                </span>

                <h2>
                  How KMITORA prepares target-ready data
                </h2>
              </div>

            </div>


            <div className="transformFlow">

              <div>
                <strong>Source</strong>
                <span>Discovered data</span>
              </div>

              <b>→</b>

              <div>
                <strong>Rules</strong>
                <span>Business logic</span>
              </div>

              <b>→</b>

              <div>
                <strong>Quality</strong>
                <span>Findings & cleansing</span>
              </div>

              <b>→</b>

              <div>
                <strong>Transform</strong>
                <span>Planned action</span>
              </div>

              <b>→</b>

              <div>
                <strong>Validate</strong>
                <span>Next controlled stage</span>
              </div>

              <b>→</b>

              <div>
                <strong>Target</strong>
                <span>Referenced only</span>
              </div>

            </div>

          </section>


          <section className="transformSection">

            <div className="transformSectionHeader">

              <div>
                <span className="transformSectionLabel">
                  TRANSFORMATION PLAN
                </span>

                <h2>
                  Planned actions and evidence
                </h2>

                <p>
                  Select any action to understand
                  the source, intended target,
                  reason, governing rules and
                  execution state.
                </p>
              </div>

              <span className="statusPill success">
                READ ONLY
              </span>

            </div>


            <div className="transformWorkspace">

              <div className="panel transformPlanPanel">

                <div className="panelHeader">

                  <div>
                    <h3>
                      Transformation Actions
                    </h3>

                    <p>
                      Real plan items returned by
                      the KMITORA discovery engine.
                    </p>
                  </div>

                  <span className="transformPlanCount">
                    {plan.length}
                  </span>

                </div>


                <div className="transformPlanList">

                  {plan.map(
                    (item, index) => {
                      const isActive =
                        index === selectedIndex;

                      return (
                        <button
                          type="button"
                          key={`${item.action}-${item.entity}-${item.field}-${index}`}
                          onClick={() =>
                            setSelectedIndex(index)
                          }
                          className={`transformPlanRow ${
                            isActive
                              ? "active"
                              : ""
                          }`}
                        >

                          <span
                            className={`dot ${
                              item.execution_state ===
                              "NOT_EXECUTED"
                                ? "info"
                                : "success"
                            }`}
                          />

                          <span className="transformPlanIdentity">

                            <strong>
                              {
                                item.action ||
                                "UNSPECIFIED"
                              }
                            </strong>

                            <small>
                              {
                                item.source ||
                                [
                                  item.entity,
                                  item.field,
                                ]
                                  .filter(Boolean)
                                  .join(".") ||
                                "—"
                              }
                            </small>

                          </span>

                          <span className="transformPlanStatus">
                            {
                              item.status ||
                              "PLANNED"
                            }
                          </span>

                        </button>
                      );
                    }
                  )}

                </div>

              </div>


              <div className="panel transformInspector">

                <div className="panelHeader">

                  <div>
                    <h3>
                      Transformation Inspector
                    </h3>

                    <p>
                      Evidence supporting the
                      selected transformation.
                    </p>
                  </div>

                  <Sparkles size={18} />

                </div>


                {selected && (
                  <>

                    <div className="transformInspectorGrid">

                      <div>
                        <span>Action</span>
                        <code>
                          {
                            selected.action ||
                            "—"
                          }
                        </code>
                      </div>


                      <div>
                        <span>Status</span>
                        <strong>
                          {
                            selected.status ||
                            "PLANNED"
                          }
                        </strong>
                      </div>


                      <div>
                        <span>Source</span>
                        <code>
                          {
                            selected.source ||
                            [
                              selected.entity,
                              selected.field,
                            ]
                              .filter(Boolean)
                              .join(".") ||
                            "—"
                          }
                        </code>
                      </div>


                      <div>
                        <span>Target</span>
                        <code>
                          {
                            selected.target ||
                            "—"
                          }
                        </code>
                      </div>


                      <div>
                        <span>Row</span>
                        <code>
                          {
                            selected.row ??
                            "—"
                          }
                        </code>
                      </div>


                      <div>
                        <span>Current Value</span>
                        <code>
                          {
                            selected.value ===
                              undefined ||
                            selected.value ===
                              null
                              ? "—"
                              : String(
                                  selected.value
                                )
                          }
                        </code>
                      </div>

                    </div>


                    <div className="transformEvidenceCard">

                      <div className="transformEvidenceHeader">
                        <strong>
                          Why this transformation exists
                        </strong>
                      </div>


                      <div className="transformEvidenceRows">

                        <div>
                          <span>Finding</span>
                          <strong>
                            {
                              selected.finding_type ||
                              "—"
                            }
                          </strong>
                        </div>


                        <div>
                          <span>Severity</span>
                          <strong>
                            {
                              selected.severity ||
                              "—"
                            }
                          </strong>
                        </div>


                        <div>
                          <span>Business Rules</span>
                          <strong>
                            {
                              selected
                                .business_rules
                                ?.length
                                ? selected
                                    .business_rules
                                    .join(", ")
                                : "—"
                            }
                          </strong>
                        </div>


                        <div>
                          <span>Reason</span>
                          <strong>
                            {
                              selected.reason ||
                              "—"
                            }
                          </strong>
                        </div>


                        <div>
                          <span>Execution</span>
                          <strong>
                            {
                              selected
                                .execution_state ||
                              "NOT_EXECUTED"
                            }
                          </strong>
                        </div>

                      </div>


                      {Array.isArray(
                        selected.orphan_values
                      ) &&
                        selected.orphan_values
                          .length > 0 && (

                          <div className="transformOrphanBox">

                            <AlertTriangle
                              size={16}
                            />

                            <div>
                              <strong>
                                Referential issue detected
                              </strong>

                              <span>
                                Orphan values:{" "}
                                {
                                  selected
                                    .orphan_values
                                    .map(String)
                                    .join(", ")
                                }
                              </span>
                            </div>

                          </div>

                        )}

                    </div>

                  </>
                )}

              </div>

            </div>

          </section>


          <section className="transformSection">

            <div className="transformSectionHeader">

              <div>
                <span className="transformSectionLabel">
                  ACTION SUMMARY
                </span>

                <h2>
                  Transformation categories
                </h2>

                <p>
                  Distribution of generated
                  transformation actions.
                </p>
              </div>

            </div>


            <div className="transformActionSummary">

              {Object.entries(
                actionCounts
              ).map(
                ([action, count]) => (

                  <div
                    className="transformActionCard"
                    key={action}
                  >

                    <span>
                      {action}
                    </span>

                    <strong>
                      {count}
                    </strong>

                  </div>

                )
              )}

            </div>

          </section>


          <div className="transformSafetyNote">

            <ShieldCheck size={18} />

            <div>

              <strong>
                Transformation execution remains guarded
              </strong>

              <span>
                All transformation actions are
                planning evidence only. No source
                write, target write, production
                migration or cutover is executed
                from Transformation Studio.
              </span>

            </div>

          </div>

        </>
      )}

    </div>
  );
}


