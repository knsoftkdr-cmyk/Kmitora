import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleX,
  FileCheck2,
  LockKeyhole,
  PlayCircle,
  ShieldCheck,
  TestTube2,
} from "lucide-react";

import A000ScenarioContextBanner from "../components/A000ScenarioContextBanner";
import { postTestExecution } from "../services/api";

type Props = {
  onNavigate?: (key: string) => void;
};

type ExecutionResult = {
  execution_id?: string;
  migration_id?: string;
  status?: string;
  execution_mode?: string;
  environment?: string;
  input_record_count?: number;
  simulated_record_count?: number;
  success_count?: number;
  failure_count?: number;
  target_write_executed?: boolean;
  production_action_executed?: boolean;
};

type TestCheck = {
  id?: string;
  name?: string;
  critical?: boolean;
  passed?: boolean;
  expected_order?: string[];
  actual_order?: string[];
};

type TestResult = {
  test_id?: string;
  execution_id?: string;
  migration_id?: string;
  status?: string;
  test_gate?: string;
  promotion_allowed?: boolean;
  progress?: number;
  total_tests?: number;
  passed_tests?: number;
  failed_tests?: number;
  critical_failure_count?: number;
  critical_failures?: Array<{
    id?: string;
    name?: string;
  }>;
  checks?: TestCheck[];
  record_summary?: {
    input_record_count?: number;
    simulated_record_count?: number;
    success_count?: number;
    failure_count?: number;
  };
  dependency_order?: {
    expected?: string[];
    actual?: string[];
    valid?: boolean;
  };
  safety?: {
    source_write_executed?: boolean;
    target_write_executed?: boolean;
    production_action_executed?: boolean;
  };
  created_at?: string;
};

const EXECUTION_KEY = "kmitora.dev.executionResult";
const TEST_KEY = "kmitora.dev.testResult";
const DISCOVERY_KEY = "kmitora.dev.discoveryResult";

function readStoredJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function yesNo(value: boolean | undefined) {
  return value === true ? "YES" : "NO";
}

export default function Test({
  onNavigate,
}: Props) {
  const [execution, setExecution] =
    useState<ExecutionResult | null>(null);

  const [result, setResult] =
    useState<TestResult | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  useEffect(() => {
    const storedExecution =
      readStoredJson<ExecutionResult>(
        EXECUTION_KEY
      );

    const storedTest =
      readStoredJson<TestResult>(
        TEST_KEY
      );

    const currentMigrationId =
      readStoredJson<{ migration_id?: string }>(
        DISCOVERY_KEY
      )?.migration_id;

    // An execution left over from a previous migration would otherwise be
    // reported as this migration's record counts.
    const executionMatchesDiscovery =
      Boolean(storedExecution) &&
      (!currentMigrationId ||
        !storedExecution?.migration_id ||
        storedExecution.migration_id === currentMigrationId);

    const activeExecution = executionMatchesDiscovery
      ? storedExecution
      : null;

    setExecution(activeExecution);

    if (
      storedTest &&
      activeExecution?.execution_id &&
      storedTest.execution_id ===
        activeExecution.execution_id
    ) {
      setResult(storedTest);
    } else {
      setResult(null);
    }
  }, []);

  const checks =
    Array.isArray(result?.checks)
      ? result!.checks!
      : [];

  const progress =
    typeof result?.progress === "number"
      ? result.progress
      : 0;

  const passed =
    result?.status === "PASSED" &&
    result?.test_gate === "PASS" &&
    result?.promotion_allowed === true &&
    progress === 100 &&
    (result?.critical_failure_count ?? 0) === 0;

  const executionEligible =
    Boolean(execution?.execution_id) &&
    String(
      execution?.status ?? ""
    ).toUpperCase() ===
      "DRY_RUN_COMPLETED" &&
    String(
      execution?.execution_mode ?? ""
    ).toUpperCase() ===
      "DRY_RUN" &&
    String(
      execution?.environment ?? "DEV"
    ).toUpperCase() ===
      "DEV" &&
    execution?.target_write_executed !== true &&
    execution?.production_action_executed !== true;

  const statusLabel = useMemo(() => {
    if (loading) {
      return "RUNNING";
    }

    if (passed) {
      return "PASSED";
    }

    if (result) {
      return result.status ?? "FAILED";
    }

    if (!execution) {
      return "WAITING FOR EXECUTION";
    }

    return "READY TO TEST";
  }, [
    execution,
    loading,
    passed,
    result,
  ]);

  async function handleRunTests() {
    if (
      loading ||
      !execution?.execution_id
    ) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response =
        await postTestExecution(
          execution.execution_id
        );

      const testResult =
        (response?.payload ??
          response) as TestResult;

      setResult(testResult);

      localStorage.setItem(
        TEST_KEY,
        JSON.stringify(testResult)
      );
    } catch (err) {
      setResult(null);

      setError(
        err instanceof Error
          ? err.message
          : "Deterministic Test qualification failed."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="page"
      style={{
        paddingBottom: 40,
      }}
    >
      <A000ScenarioContextBanner />

      <section
        style={{
          marginTop: 18,
          padding: 24,
          borderRadius: 14,
          border: "1px solid #dbe4f0",
          background: "#ffffff",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 20,
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 14,
              alignItems: "flex-start",
            }}
          >
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 12,
                display: "grid",
                placeItems: "center",
                border: "1px solid #dbe4f0",
              }}
            >
              <TestTube2 size={23} />
            </div>

            <div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: 1,
                }}
              >
                STEP 09 · DETERMINISTIC QUALIFICATION
              </span>

              <h1
                style={{
                  margin: "7px 0 8px",
                }}
              >
                Test
              </h1>

              <p
                style={{
                  margin: 0,
                  maxWidth: 780,
                  opacity: 0.74,
                  lineHeight: 1.6,
                }}
              >
                Qualify the completed DEV dry-run
                using deterministic execution,
                staging, dependency, quality and
                safety evidence. Mandatory critical
                tests must pass before Validate is
                permitted.
              </p>
            </div>
          </div>

          <div
            style={{
              padding: "9px 14px",
              borderRadius: 999,
              border: "1px solid #dbe4f0",
              fontWeight: 700,
            }}
          >
            {statusLabel}
          </div>
        </div>
      </section>

      {error && (
        <section
          style={{
            marginTop: 16,
            padding: 16,
            borderRadius: 12,
            border: "1px solid #fecaca",
            background: "#ffffff",
            display: "flex",
            gap: 10,
            alignItems: "center",
          }}
        >
          <AlertTriangle size={19} />
          <span>{error}</span>
        </section>
      )}

      {!execution && (
        <section
          style={{
            marginTop: 16,
            padding: 20,
            borderRadius: 14,
            border: "1px solid #dbe4f0",
            background: "#ffffff",
          }}
        >
          <LockKeyhole size={22} />

          <h3>
            DEV dry-run execution required
          </h3>

          <p>
            Complete the governed Execute stage
            before running Step 09 Test.
          </p>
        </section>
      )}

      {execution && (
        <>
          <section
            style={{
              marginTop: 16,
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(170px, 1fr))",
              gap: 12,
            }}
          >
            {[
              [
                "Execution",
                execution.status ?? "-",
              ],
              [
                "Input Records",
                String(
                  execution.input_record_count ??
                    0
                ),
              ],
              [
                "Simulated",
                String(
                  execution.simulated_record_count ??
                    0
                ),
              ],
              [
                "Success",
                String(
                  execution.success_count ?? 0
                ),
              ],
              [
                "Failures",
                String(
                  execution.failure_count ?? 0
                ),
              ],
              [
                "Target Write",
                yesNo(
                  execution.target_write_executed
                ),
              ],
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  padding: 16,
                  borderRadius: 12,
                  border: "1px solid #dbe4f0",
                  background: "#ffffff",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    opacity: 0.62,
                    marginBottom: 7,
                  }}
                >
                  {label}
                </div>

                <strong>{value}</strong>
              </div>
            ))}
          </section>

          <section
            style={{
              marginTop: 16,
              padding: 20,
              borderRadius: 14,
              border: "1px solid #dbe4f0",
              background: "#ffffff",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                gap: 16,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div>
                <h2
                  style={{
                    marginTop: 0,
                    marginBottom: 6,
                  }}
                >
                  Deterministic Test Execution
                </h2>

                <p
                  style={{
                    margin: 0,
                    opacity: 0.7,
                  }}
                >
                  Execution ID:{" "}
                  {execution.execution_id}
                </p>
              </div>

              <button
                type="button"
                onClick={handleRunTests}
                disabled={
                  loading ||
                  !executionEligible
                }
                style={{
                  minHeight: 42,
                  padding: "0 18px",
                  borderRadius: 9,
                  cursor:
                    loading ||
                    !executionEligible
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                <PlayCircle
                  size={16}
                  style={{
                    marginRight: 8,
                    verticalAlign: "middle",
                  }}
                />

                {loading
                  ? "Running Tests..."
                  : result
                    ? "Run Tests Again"
                    : "Run Deterministic Tests"}
              </button>
            </div>
          </section>

          <section
            style={{
              marginTop: 16,
              display: "grid",
              gridTemplateColumns:
                "minmax(0, 2fr) minmax(260px, 1fr)",
              gap: 16,
            }}
          >
            <article
              style={{
                padding: 20,
                borderRadius: 14,
                border: "1px solid #dbe4f0",
                background: "#ffffff",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <h2
                  style={{
                    margin: 0,
                  }}
                >
                  Qualification Checks
                </h2>

                {result && (
                  <strong>
                    {result.passed_tests ?? 0}/
                    {result.total_tests ?? 0}
                  </strong>
                )}
              </div>

              {!result && (
                <p
                  style={{
                    opacity: 0.68,
                  }}
                >
                  Run deterministic tests to
                  generate qualification evidence.
                </p>
              )}

              {checks.map((check) => (
                <div
                  key={check.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "28px 85px 1fr 90px",
                    gap: 10,
                    alignItems: "center",
                    borderTop:
                      "1px solid #edf1f6",
                    padding: "12px 0",
                  }}
                >
                  {check.passed ? (
                    <CheckCircle2
                      size={18}
                    />
                  ) : (
                    <CircleX
                      size={18}
                    />
                  )}

                  <strong>
                    {check.id}
                  </strong>

                  <span>
                    {check.name}
                  </span>

                  <strong>
                    {check.passed
                      ? "PASS"
                      : "FAIL"}
                  </strong>
                </div>
              ))}
            </article>

            <article
              style={{
                padding: 20,
                borderRadius: 14,
                border: "1px solid #dbe4f0",
                background: "#ffffff",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <ShieldCheck size={18} />
                <h2
                  style={{
                    margin: 0,
                  }}
                >
                  Promotion Gate
                </h2>
              </div>

              <div
                style={{
                  marginTop: 24,
                  fontSize: 38,
                  fontWeight: 800,
                }}
              >
                {progress}%
              </div>

              <div
                style={{
                  height: 9,
                  borderRadius: 999,
                  background: "#edf1f6",
                  overflow: "hidden",
                  marginTop: 10,
                }}
              >
                <div
                  style={{
                    width: `${progress}%`,
                    height: "100%",
                    background:
                      "currentColor",
                  }}
                />
              </div>

              <div
                style={{
                  marginTop: 22,
                  display: "grid",
                  gap: 11,
                }}
              >
                <div>
                  Test Gate:{" "}
                  <strong>
                    {result?.test_gate ??
                      "NOT RUN"}
                  </strong>
                </div>

                <div>
                  Critical Failures:{" "}
                  <strong>
                    {result
                      ?.critical_failure_count ??
                      0}
                  </strong>
                </div>

                <div>
                  Promotion:{" "}
                  <strong>
                    {passed
                      ? "ALLOWED"
                      : "BLOCKED"}
                  </strong>
                </div>

                <div>
                  Target Writes:{" "}
                  <strong>
                    {result?.safety
                      ?.target_write_executed ===
                    true
                      ? "DETECTED"
                      : "NONE"}
                  </strong>
                </div>
              </div>
            </article>
          </section>

          {result?.dependency_order && (
            <section
              style={{
                marginTop: 16,
                padding: 20,
                borderRadius: 14,
                border: "1px solid #dbe4f0",
                background: "#ffffff",
              }}
            >
              <h2>
                Dependency Order Evidence
              </h2>

              <p>
                Expected:{" "}
                <strong>
                  {(
                    result.dependency_order
                      .expected ?? []
                  ).join(" -> ")}
                </strong>
              </p>

              <p>
                Actual:{" "}
                <strong>
                  {(
                    result.dependency_order
                      .actual ?? []
                  ).join(" -> ")}
                </strong>
              </p>

              <p>
                Result:{" "}
                <strong>
                  {result.dependency_order.valid
                    ? "PASS"
                    : "FAIL"}
                </strong>
              </p>
            </section>
          )}

          <section
            style={{
              marginTop: 16,
              padding: 20,
              borderRadius: 14,
              border: "1px solid #dbe4f0",
              background: "#ffffff",
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                NEXT GOVERNED STAGE
              </span>

              <h2
                style={{
                  margin:
                    "5px 0 5px",
                }}
              >
                Validate
              </h2>

              <p
                style={{
                  margin: 0,
                  opacity: 0.7,
                }}
              >
                Technical, business,
                referential and policy
                validation may proceed only
                after Test qualification
                passes.
              </p>
            </div>

            <button
              type="button"
              disabled={!passed}
              onClick={() =>
                onNavigate?.("validate")
              }
              style={{
                minHeight: 42,
                padding: "0 18px",
                borderRadius: 9,
                cursor: passed
                  ? "pointer"
                  : "not-allowed",
              }}
            >
              <FileCheck2
                size={16}
                style={{
                  marginRight: 8,
                  verticalAlign: "middle",
                }}
              />

              Continue to Validate

              <ArrowRight
                size={16}
                style={{
                  marginLeft: 8,
                  verticalAlign: "middle",
                }}
              />
            </button>
          </section>
        </>
      )}
    </div>
  );
}