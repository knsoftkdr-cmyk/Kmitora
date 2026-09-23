import MappingPremiumWorkspace from "../components/MappingPremiumWorkspace";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import KMITORACopilotOverview from "../components/KMITORACopilotOverview";

type SuggestedMapping = {
  source?: string;
  source_entity?: string;
  source_field?: string;
  target?: string;
  target_entity?: string;
  target_field?: string;
  action?: string;
  decision?: string;
  confidence?: number;
  rule?: string;
  business_rule?: string;
  business_rules?: string[];
  rationale?: string;
};

type DiscoveryResult = {
  migration_id?: string;
  status?: string;
  suggested_mappings?: SuggestedMapping[];
};

type MappingRow = {
  source: string;
  target: string;
  decision: string;
  confidence: number;
  rule: string;
  rationale: string;
};

export default function MapPage() {
  const [discovery, setDiscovery] =
    useState<DiscoveryResult | null>(null);

  useEffect(() => {
    const raw =
      localStorage.getItem(
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

  const mappings =
    useMemo<MappingRow[]>(() => {
      const sourceMappings =
        Array.isArray(
          discovery?.suggested_mappings
        )
          ? discovery!.suggested_mappings!
          : [];

      return sourceMappings.map((m) => {
        const source =
          m.source ??
          [
            m.source_entity,
            m.source_field,
          ]
            .filter(Boolean)
            .join(".") ??
          "—";

        const target =
          m.target ??
          [
            m.target_entity,
            m.target_field,
          ]
            .filter(Boolean)
            .join(".") ??
          "—";

        const decision =
          m.decision ??
          m.action ??
          "REVIEW";

        const confidenceRaw =
          typeof m.confidence === "number"
            ? m.confidence
            : 0;

        const confidence =
          confidenceRaw <= 1
            ? Math.round(
                confidenceRaw * 100
              )
            : Math.round(
                confidenceRaw
              );

        return {
          source:
            source || "—",

          target:
            target || "—",

          decision,

          confidence,

          rule:
            m.rule ||
            m.business_rule ||
            (
              Array.isArray(
                m.business_rules
              )
                ? m.business_rules.join(
                    ", "
                  )
                : "—"
            ),

          rationale:
            m.rationale ?? "",
        };
      });
    }, [discovery]);


  const safeMappings =
    mappings.filter(
      (m) =>
        m.confidence >= 90 &&
        !m.decision
          .toUpperCase()
          .includes("RELATIONSHIP") &&
        !m.decision
          .toUpperCase()
          .includes("REVIEW")
    );


  const reviewMappings =
    mappings.filter(
      (m) =>
        m.confidence < 90 ||
        m.decision
          .toUpperCase()
          .includes("RELATIONSHIP") ||
        m.decision
          .toUpperCase()
          .includes("REVIEW")
    );


  const blockedMappings =
    mappings.filter((m) => {
      const decision =
        m.decision.toUpperCase();

      return (
        decision.includes("REJECT") ||
        decision.includes("BLOCK")
      );
    });


  const averageConfidence =
    mappings.length > 0
      ? Math.round(
          mappings.reduce(
            (sum, mapping) =>
              sum +
              mapping.confidence,
            0
          ) / mappings.length
        )
      : 0;


  function saveSafeMappings() {
    localStorage.setItem(
      "kmitora.dev.safeMappings",
      JSON.stringify(
        safeMappings
      )
    );
  }


  return (
    <div className="page mappingStudioPage">
      <MappingPremiumWorkspace />

      <div className="mappingHero">

        <div className="mappingHeroCopy">

          <span className="eyebrow">
            STEP 03
          </span>

          <h1>Mapping Studio</h1>

          <p>
            Review, edit and approve source-to-target mappings with governed
            confidence, business rules and human-review controls.
          </p>

          <div className="mappingHeroActions">

            <button
              className="primary"
              type="button"
              onClick={
                saveSafeMappings
              }
              title="Stores DEV-safe mapping recommendations only; no target write or production execution"
            >
              <Sparkles size={16} />
              Auto-resolve Safe Mappings
            </button>

            <span className="mappingGuardedBadge">
              <ShieldCheck size={14} />
              Review mappings remain governed
            </span>

          </div>

        </div>


        <KMITORACopilotOverview
          status={
            mappings.length === 0
              ? "WAITING"
              : reviewMappings.length > 0
                ? "REVIEW"
                : "READY"
          }
          message="Mapping health, confidence and review guidance"
        />

      </div>


      <section className="mappingSection mappingContractSection">
        <div className="panel mappingTablePanel">
          <div className="mappingSectionHeader">
            <div>
              <span className="mappingSectionLabel">GOVERNED MAPPING CONTRACT</span>
              <h2>Source-to-target mapping decision context</h2>
              <p>
                Decision and action context remains visible even before Discovery
                returns live candidates. These are supported mapping actions, not
                executed production changes.
              </p>
            </div>
          </div>

          <div className="mappingHeader mappingHeaderEnterprise">
            <span>Source</span>
            <span>Decision</span>
            <span>Target</span>
            <span>Confidence</span>
            <span>Rule</span>
          </div>

          <div className="mappingRow mappingRowEnterprise mappingReferenceRow">
            <code>SOURCE.FIELD</code>
            <span className="statusPill review">REVIEW</span>
            <code>TARGET.FIELD</code>
            <span>Reference</span>
            <span>Governed action set: DIRECT_MAP · NORMALIZE · RELATIONSHIP_ONLY</span>
          </div>
        </div>
      </section>


      {!discovery && (
        <div className="panel mappingEmptyState">

          <GitBranch size={26} />

          <div>
            <h3>
              Mapping Not Available
            </h3>

            <p>
              Run Discovery first so
              KMITORA can generate real
              source-to-target mapping
              candidates.
            </p>
          </div>

        </div>
      )}


      {discovery &&
        mappings.length === 0 && (
          <div className="panel mappingEmptyState">

            <GitBranch size={26} />

            <div>
              <h3>
                No Mapping Candidates
              </h3>

              <p>
                Discovery completed,
                but no suggested mappings
                were returned for the
                current source and target.
              </p>
            </div>

          </div>
        )}


      {mappings.length > 0 && (
        <>

          <section className="mappingSection">

            <div className="mappingSectionHeader">

              <div>
                <span className="mappingSectionLabel">
                  MAPPING HEALTH
                </span>

                <h2>
                  Mapping readiness at a glance
                </h2>

                <p>
                  Understand which mappings
                  are safe, which require
                  review and where business
                  rules affect target design.
                </p>
              </div>

            </div>


            <div className="mappingMetrics">

              <div className="mappingMetricCard">

                <GitBranch size={18} />

                <span>Total Mappings</span>

                <strong>
                  {mappings.length}
                </strong>

                <small>
                  Candidate mappings
                </small>

              </div>


              <div className="mappingMetricCard safe">

                <CheckCircle2 size={18} />

                <span>Safe</span>

                <strong>
                  {safeMappings.length}
                </strong>

                <small>
                  Confidence ≥ 90%
                </small>

              </div>


              <div className="mappingMetricCard review">

                <AlertTriangle size={18} />

                <span>Requires Review</span>

                <strong>
                  {reviewMappings.length}
                </strong>

                <small>
                  Approval-gated
                </small>

              </div>


              <div className="mappingMetricCard blocked">

                <ShieldCheck size={18} />

                <span>Blocked / Rejected</span>

                <strong>
                  {blockedMappings.length}
                </strong>

                <small>
                  Not auto-resolved
                </small>

              </div>


              <div className="mappingMetricCard">

                <span>
                  Average Confidence
                </span>

                <strong>
                  {averageConfidence}%
                </strong>

                <small>
                  Across all mappings
                </small>

              </div>

            </div>

          </section>


          <section className="mappingSection">

            <div className="mappingSectionHeader">

              <div>
                <span className="mappingSectionLabel">
                  SOURCE → TARGET
                </span>

                <h2>
                  Mapping decisions
                </h2>

                <p>
                  Review each source-to-target
                  decision, confidence score
                  and governing rule.
                </p>
              </div>


              <span className="mappingMigrationBadge">
                {discovery?.migration_id ?? "—"}
              </span>

            </div>


            <div className="panel mappingTablePanel">

              <div className="mappingHeader mappingHeaderEnterprise">

                <span>Source</span>

                <span>Decision</span>

                <span>Target</span>

                <span>Confidence</span>

                <span>Rule</span>

              </div>


              {mappings.map(
                (m, i) => (

                  <div
                    className="mappingRow mappingRowEnterprise"
                    key={
                      `${m.source}-${m.target}-${i}`
                    }
                  >

                    <code>
                      {m.source}
                    </code>


                    <span
                      className={`statusPill ${m.decision
                        .toLowerCase()
                        .replaceAll(
                          "_",
                          "-"
                        )}`}
                    >
                      {m.decision}
                    </span>


                    <code>
                      {m.target}
                    </code>


                    <div className="confidence">

                      <div className="bar">

                        <span
                          style={{
                            width:
                              `${Math.max(
                                0,
                                Math.min(
                                  100,
                                  m.confidence
                                )
                              )}%`,
                          }}
                        />

                      </div>

                      <b>
                        {m.confidence}%
                      </b>

                    </div>


                    <div className="mappingRuleCell">

                      <span>
                        {m.rule || "—"}
                      </span>

                      {m.rationale && (
                        <small>
                          {m.rationale}
                        </small>
                      )}

                    </div>

                  </div>

                )
              )}

            </div>

          </section>


          {reviewMappings.length > 0 && (

            <section className="mappingSection">

              <div className="panel mappingReviewPanel">

                <div className="mappingReviewIcon">

                  <AlertTriangle
                    size={20}
                  />

                </div>


                <div className="mappingReviewContent">

                  <div className="mappingReviewHeader">

                    <div>

                      <span className="mappingSectionLabel">
                        ATTENTION REQUIRED
                      </span>

                      <h3>
                        Human Review Required
                      </h3>

                    </div>


                    <span className="statusPill review">

                      {
                        reviewMappings.length
                      } REVIEW

                    </span>

                  </div>


                  <p>
                    Low-confidence,
                    relationship-sensitive or
                    explicitly review-marked
                    mappings remain
                    approval-gated and are
                    not automatically changed.
                  </p>


                  <div className="mappingReviewSummary">

                    <span>
                      Safe mappings:
                      {" "}
                      <strong>
                        {
                          safeMappings.length
                        }
                      </strong>
                    </span>

                    <span>
                      Review:
                      {" "}
                      <strong>
                        {
                          reviewMappings.length
                        }
                      </strong>
                    </span>

                    <span>
                      Blocked:
                      {" "}
                      <strong>
                        {
                          blockedMappings.length
                        }
                      </strong>
                    </span>

                  </div>

                </div>

              </div>

            </section>

          )}


          <div className="mappingSafetyNote">

            <ShieldCheck size={16} />

            <div>
              <strong>
                Mapping automation is governed
              </strong>

              <span>
                Auto-resolve stores safe
                mapping recommendations only.
                No target write, production
                migration or cutover is
                executed from this page.
              </span>
            </div>

          </div>

        </>
      )}

    </div>
  );
}

