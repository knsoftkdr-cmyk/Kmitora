import { useEffect, useMemo, useState } from "react";
import {
  BrainCircuit,
  CheckCircle2,
  FileCheck2,
  GitBranch,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import { getEvidenceById } from "../services/api";

type EvidencePackage = {
  evidence_id?: string;
  created_at?: string;
  migration_id?: string;
  approval_id?: string;
  execution_id?: string;
  reconciliation_id?: string;
  status?: string;

  discovery_summary?: Record<string, any>;
  approval_summary?: Record<string, any>;
  execution_summary?: Record<string, any>;
  reconciliation_summary?: Record<string, any>;

  record_results?: Array<any>;
  transformation_evidence?: Array<any>;
  business_rules?: Array<any>;

  safety?: {
    production_executed?: boolean;
    production_action_executed?: boolean;
    target_write_executed?: boolean;
    target_write_count?: number;
    production_action_count?: number;
    source_write_executed?: boolean;
  };
};

type LearningItem = {
  id: string;
  category: string;
  subject: string;
  status: "VERIFIED";
  provenance: string;
};

type VerifiedLearningPackage = {
  learning_id: string;
  created_at: string;
  status: "COMPLETE";
  promotion_gate: "PASS";
  promotion_progress: 100;

  evidence_id: string;
  migration_id: string;
  approval_id: string;
  execution_id: string;
  reconciliation_id: string;

  verified_outcomes: LearningItem[];

  regression_protection: {
    enabled: true;
    execution_success_required: true;
    reconciliation_pass_required: true;
    zero_target_write_required: boolean;
    dev_write_boundary_required: true;
    zero_production_action_required: true;
  };

  provenance: {
    source: "KMITORA_GOVERNED_DEV_EVIDENCE";
    evidence_status: string;
    execution_status: string;
    reconciliation_status: string;
  };

  safety: {
    source_write_executed: boolean;
    target_write_executed: boolean;
    production_action_executed: boolean;
    production_executed: boolean;
  };
};

const EVIDENCE_KEY = "kmitora.dev.lastEvidence";
const LEARNING_KEY = "kmitora.dev.verifiedLearning";

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function upper(value: unknown): string {
  return text(value).toUpperCase();
}

function makeLearningId(): string {
  const random =
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `LEARN-${random}`;
}

export default function Learn() {
  const [evidence, setEvidence] = useState<EvidencePackage | null>(null);
  const [hydrating, setHydrating] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      try {
        const stored = readJson<any>(EVIDENCE_KEY);
        const evidenceId = String(stored?.evidence_id ?? "").trim();

        if (evidenceId) {
          try {
            const response = await getEvidenceById(evidenceId);
            const authoritative = response?.payload ?? response;
            if (!cancelled && authoritative) {
              setEvidence(authoritative as EvidencePackage);
              return;
            }
          } catch (lookupError) {
            console.warn("KMITORA Learn authoritative evidence lookup failed", lookupError);
          }
        }

        if (!cancelled) {
          const looksFull =
            Array.isArray(stored?.business_rules) ||
            Array.isArray(stored?.transformation_evidence) ||
            Boolean(stored?.execution_summary) ||
            Boolean(stored?.reconciliation_summary);
          setEvidence(looksFull ? (stored as EvidencePackage) : null);
        }
      } finally {
        if (!cancelled) setHydrating(false);
      }
    };

    void hydrate();
    return () => { cancelled = true; };
  }, []);

  const initialLearning = useMemo(
    () => readJson<VerifiedLearningPackage>(LEARNING_KEY),
    [],
  );

  const [learning, setLearning] =
    useState<VerifiedLearningPackage | null>(null);

  useEffect(() => {
    if (
      initialLearning &&
      evidence &&
      initialLearning.evidence_id === evidence.evidence_id
    ) {
      setLearning(initialLearning);
    }
  }, [initialLearning, evidence]);

  const [message, setMessage] = useState("");

  const executionStatus =
    upper(evidence?.execution_summary?.status);

  const reconciliationStatus =
    upper(evidence?.reconciliation_summary?.status);

  const reconciliationMode =
    upper(evidence?.reconciliation_summary?.reconciliation_mode);

  const evidenceStatus =
    upper(evidence?.status);

  const targetWriteCount =
    Number(evidence?.safety?.target_write_count ?? 0);

  const productionActionCount =
    Number(evidence?.safety?.production_action_count ?? 0);

  const reconciledCount = Number(
    evidence?.reconciliation_summary?.matched_records ??
    evidence?.reconciliation_summary?.input_record_count ??
    0,
  );

  const isPostLoad =
    executionStatus === "POST_LOAD_COMPLETED" ||
    reconciliationMode === "POST_LOAD_DEV";

  const identityComplete =
    Boolean(evidence?.evidence_id) &&
    Boolean(evidence?.migration_id) &&
    Boolean(evidence?.approval_id) &&
    Boolean(evidence?.execution_id) &&
    Boolean(evidence?.reconciliation_id);

  const executionVerified = isPostLoad
    ? executionStatus === "POST_LOAD_COMPLETED"
    : executionStatus === "DRY_RUN_COMPLETED";

  const reconciliationVerified =
    reconciliationStatus === "PASS";

  const evidenceVerified =
    evidenceStatus === "COMPLETE";

  const targetBoundaryVerified = isPostLoad
    ? targetWriteCount > 0 &&
      evidence?.safety?.target_write_executed === true &&
      (reconciledCount === 0 || targetWriteCount === reconciledCount)
    : targetWriteCount === 0 &&
      evidence?.safety?.target_write_executed !== true;

  const safetyVerified =
    targetBoundaryVerified &&
    productionActionCount === 0 &&
    evidence?.safety?.production_action_executed !== true &&
    evidence?.safety?.production_executed !== true;

  const checks = [
    {
      id: "LRN-001",
      label: "Evidence identity chain is complete",
      pass: identityComplete,
    },
    {
      id: "LRN-002",
      label: "Evidence package is COMPLETE",
      pass: evidenceVerified,
    },
    {
      id: "LRN-003",
      label: isPostLoad
        ? "Execution is POST_LOAD_COMPLETED"
        : "Execution is DRY_RUN_COMPLETED",
      pass: executionVerified,
    },
    {
      id: "LRN-004",
      label: "Reconciliation result is PASS",
      pass: reconciliationVerified,
    },
    {
      id: "LRN-005",
      label: isPostLoad
        ? "Approved DEV target writes match reconciled records"
        : "Target write count is zero",
      pass: targetBoundaryVerified,
    },
    {
      id: "LRN-006",
      label: "Production action count is zero",
      pass:
        productionActionCount === 0 &&
        evidence?.safety?.production_action_executed !== true &&
        evidence?.safety?.production_executed !== true,
    },
  ];

  const passedChecks =
    checks.filter((item) => item.pass).length;

  const progress =
    checks.length > 0
      ? Math.round(
          (passedChecks / checks.length) * 100,
        )
      : 0;

  const promotionEligible =
    Boolean(evidence) &&
    identityComplete &&
    evidenceVerified &&
    executionVerified &&
    reconciliationVerified &&
    safetyVerified &&
    passedChecks === checks.length &&
    progress === 100;

  function promoteVerifiedLearning() {
    if (!evidence || !promotionEligible) {
      setMessage(
        "Promotion blocked. Only fully verified evidence may become learned knowledge.",
      );
      return;
    }

    const verifiedOutcomes: LearningItem[] = [
      {
        id: "KNOW-001",
        category: "MIGRATION",
        subject:
          isPostLoad
            ? `Migration ${evidence.migration_id} completed the governed DEV post-load evidence chain.`
            : `Migration ${evidence.migration_id} completed the governed DEV dry-run evidence chain.`,
        status: "VERIFIED",
        provenance: String(evidence.evidence_id),
      },
      {
        id: "KNOW-002",
        category: "EXECUTION",
        subject:
          `${evidence.record_results?.length ?? 0} record execution results are preserved as verified DEV evidence.`,
        status: "VERIFIED",
        provenance: String(evidence.evidence_id),
      },
      {
        id: "KNOW-003",
        category: "TRANSFORMATION",
        subject:
          `${evidence.transformation_evidence?.length ?? 0} transformation evidence items are linked to the run.`,
        status: "VERIFIED",
        provenance: String(evidence.evidence_id),
      },
      {
        id: "KNOW-004",
        category: "BUSINESS_RULE",
        subject:
          `${evidence.business_rules?.length ?? 0} business rules are represented in the evidence package.`,
        status: "VERIFIED",
        provenance: String(evidence.evidence_id),
      },
      {
        id: "KNOW-005",
        category: "RECONCILIATION",
        subject:
          `Reconciliation ${evidence.reconciliation_id} passed for the same execution chain.`,
        status: "VERIFIED",
        provenance: String(evidence.evidence_id),
      },
      {
        id: "KNOW-006",
        category: "SAFETY",
        subject:
          isPostLoad
            ? `Governed DEV post-load completed with ${targetWriteCount} approved DEV target writes and zero production actions.`
            : "DEV dry-run completed with zero target writes and zero production actions.",
        status: "VERIFIED",
        provenance: String(evidence.evidence_id),
      },
    ];

    const next: VerifiedLearningPackage = {
      learning_id: makeLearningId(),
      created_at: new Date().toISOString(),
      status: "COMPLETE",
      promotion_gate: "PASS",
      promotion_progress: 100,

      evidence_id: String(evidence.evidence_id),
      migration_id: String(evidence.migration_id),
      approval_id: String(evidence.approval_id),
      execution_id: String(evidence.execution_id),
      reconciliation_id: String(
        evidence.reconciliation_id,
      ),

      verified_outcomes: verifiedOutcomes,

      regression_protection: {
        enabled: true,
        execution_success_required: true,
        reconciliation_pass_required: true,
        zero_target_write_required: !isPostLoad,
        dev_write_boundary_required: true,
        zero_production_action_required: true,
      },

      provenance: {
        source: "KMITORA_GOVERNED_DEV_EVIDENCE",
        evidence_status: evidenceStatus,
        execution_status: executionStatus,
        reconciliation_status:
          reconciliationStatus,
      },

      safety: {
        source_write_executed: evidence?.safety?.source_write_executed === true,
        target_write_executed: evidence?.safety?.target_write_executed === true,
        production_action_executed: false,
        production_executed: false,
      },
    };

    localStorage.setItem(
      LEARNING_KEY,
      JSON.stringify(next),
    );

    setLearning(next);

    setMessage(
      isPostLoad
        ? "Verified learning promoted from the governed POST_LOAD_DEV evidence package. Approved DEV target writes are preserved as evidence; no production action was performed."
        : "Verified learning promoted from the governed dry-run evidence package. No source, target or production write was performed.",
    );
  }

  if (hydrating) {
    return (
      <div className="page" style={{ paddingBottom: 32 }}>
        <section style={{ border: "1px solid #d9e2ec", borderRadius: 14, padding: 20, background: "#fff" }}>
          <strong>Loading authoritative evidence...</strong>
        </section>
      </div>
    );
  }

  const complete =
    learning?.status === "COMPLETE" &&
    learning?.promotion_gate === "PASS" &&
    learning?.promotion_progress === 100 &&
    learning?.evidence_id === evidence?.evidence_id;

  const cardStyle = {
    border: "1px solid #d9e2ec",
    borderRadius: 14,
    padding: 20,
    background: "#fff",
  };

  return (
    <div
      className="page"
      style={{
        display: "grid",
        gap: 20,
        paddingBottom: 32,
      }}
    >
      <section style={cardStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 20,
            alignItems: "flex-start",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: 1.2,
              }}
            >
              VERIFIED CONTINUOUS LEARNING
            </div>

            <h1 style={{ marginBottom: 8 }}>
              13 · Learn
            </h1>

            <p style={{ margin: 0 }}>
              Promote only deterministic,
              reconciled and evidenced outcomes
              into reusable KMITORA knowledge.
            </p>
          </div>

          <strong
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              border: "1px solid #d9e2ec",
            }}
          >
            {complete
              ? "COMPLETE"
              : promotionEligible
                ? "VERIFIED"
                : "BLOCKED"}
          </strong>
        </div>
      </section>

      <section style={cardStyle}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <ShieldCheck size={20} />
          <h2 style={{ margin: 0 }}>
            Promotion Qualification
          </h2>
        </div>

        <div
          style={{
            display: "grid",
            gap: 10,
            marginTop: 18,
          }}
        >
          {checks.map((item) => (
            <div
              key={item.id}
              style={{
                display: "grid",
                gridTemplateColumns:
                  "90px 1fr 90px",
                alignItems: "center",
                gap: 12,
                padding: "12px 0",
                borderBottom:
                  "1px solid #edf2f7",
              }}
            >
              <strong>{item.id}</strong>

              <span>{item.label}</span>

              <strong>
                {item.pass ? (
                  <>
                    <CheckCircle2
                      size={15}
                      style={{
                        verticalAlign: "middle",
                        marginRight: 5,
                      }}
                    />
                    PASS
                  </>
                ) : (
                  <>
                    <XCircle
                      size={15}
                      style={{
                        verticalAlign: "middle",
                        marginRight: 5,
                      }}
                    />
                    FAIL
                  </>
                )}
              </strong>
            </div>
          ))}
        </div>
      </section>

      <section style={cardStyle}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <GitBranch size={20} />
          <h2 style={{ margin: 0 }}>
            Provenance Chain
          </h2>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(210px, 1fr))",
            gap: 14,
            marginTop: 18,
          }}
        >
          {[
            ["Migration", evidence?.migration_id],
            ["Approval", evidence?.approval_id],
            ["Execution", evidence?.execution_id],
            [
              "Reconciliation",
              evidence?.reconciliation_id,
            ],
            ["Evidence", evidence?.evidence_id],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {label}
              </div>

              <div
                style={{
                  wordBreak: "break-all",
                  marginTop: 5,
                }}
              >
                {value || "MISSING"}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={cardStyle}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <BrainCircuit size={20} />
          <h2 style={{ margin: 0 }}>
            Promotion Gate
          </h2>
        </div>

        <div
          style={{
            fontSize: 40,
            fontWeight: 800,
            marginTop: 18,
          }}
        >
          {progress}%
        </div>

        <p>
          Verified checks:{" "}
          <strong>
            {passedChecks}/{checks.length}
          </strong>
        </p>

        <p>
          Eligibility:{" "}
          <strong>
            {promotionEligible
              ? "VERIFIED"
              : "BLOCKED"}
          </strong>
        </p>

        <p>
          Target writes:{" "}
          <strong>{targetWriteCount}</strong>
        </p>

        <p>
          Production actions:{" "}
          <strong>{productionActionCount}</strong>
        </p>

        <button
          type="button"
          disabled={!promotionEligible || complete}
          onClick={promoteVerifiedLearning}
          style={{
            padding: "11px 18px",
            borderRadius: 8,
            fontWeight: 700,
            cursor:
              !promotionEligible || complete
                ? "not-allowed"
                : "pointer",
          }}
        >
          <Sparkles
            size={16}
            style={{
              verticalAlign: "middle",
              marginRight: 7,
            }}
          />

          {complete
            ? "Verified Learning Promoted"
            : "Promote Verified Learning"}
        </button>

        {message && (
          <p
            style={{
              marginTop: 14,
              fontWeight: 600,
            }}
          >
            {message}
          </p>
        )}
      </section>

      {learning && (
        <section style={cardStyle}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <FileCheck2 size={20} />

            <h2 style={{ margin: 0 }}>
              Verified Learning Package
            </h2>
          </div>

          <div style={{ marginTop: 16 }}>
            <p>
              Learning ID:{" "}
              <strong>
                {learning.learning_id}
              </strong>
            </p>

            <p>
              Status:{" "}
              <strong>{learning.status}</strong>
            </p>

            <p>
              Promotion Gate:{" "}
              <strong>
                {learning.promotion_gate}
              </strong>
            </p>

            <p>
              Verified Outcomes:{" "}
              <strong>
                {
                  learning.verified_outcomes
                    .length
                }
              </strong>
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gap: 10,
              marginTop: 16,
            }}
          >
            {learning.verified_outcomes.map(
              (item) => (
                <div
                  key={item.id}
                  style={{
                    padding: 12,
                    border:
                      "1px solid #edf2f7",
                    borderRadius: 8,
                  }}
                >
                  <strong>
                    {item.id} ·{" "}
                    {item.category}
                  </strong>

                  <div
                    style={{
                      marginTop: 5,
                    }}
                  >
                    {item.subject}
                  </div>

                  <small>
                    Provenance:{" "}
                    {item.provenance}
                  </small>
                </div>
              ),
            )}
          </div>
        </section>
      )}

      <section style={cardStyle}>
        <ShieldCheck size={18} />

        <strong
          style={{
            marginLeft: 8,
          }}
        >
          Learning safety boundary
        </strong>

        <p style={{ marginBottom: 0 }}>
          Learning is derived from verified DEV evidence only.
          Approved DEV target writes may be learned only when they
          reconcile exactly; source writes, production actions,
          production migration and cutover remain disabled.
        </p>
      </section>
    </div>
  );
}
