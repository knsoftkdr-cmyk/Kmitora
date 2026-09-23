import { useEffect, useMemo, useState } from "react";
import "./TestQualificationProgress.css";

type VisualStatus =
  | "WAITING"
  | "CHECKING"
  | "RUNNING"
  | "PASSED"
  | "REVIEW"
  | "FAILED"
  | "BLOCKED";

type Props = {
  executionStatus?: string | null;
};

function readPageSignal(executionStatus?: string | null): VisualStatus {
  const execution = String(executionStatus ?? "").trim().toUpperCase();
  const text = String(document.body?.innerText ?? "").toUpperCase();

  const criticalMatch = text.match(/CRITICAL FAILURES\s*:?\s*(\d+)/);
  const criticalFailures = criticalMatch ? Number(criticalMatch[1]) : 0;

  if (
    criticalFailures > 0 ||
    text.includes("TEST GATE: FAIL") ||
    text.includes("TEST STATUS: FAILED") ||
    text.includes("PROMOTION: BLOCKED")
  ) {
    return "FAILED";
  }

  if (
    text.includes("TEST GATE: BLOCKED") ||
    text.includes("TEST QUALIFICATION BLOCKED")
  ) {
    return "BLOCKED";
  }

  if (
    text.includes("QUALIFIED WITH GOVERNED REVIEW") ||
    text.includes("TEST GATE: REVIEW")
  ) {
    return "REVIEW";
  }

  if (
    execution === "POST_LOAD_COMPLETED" &&
    (
      text.includes("TEST GATE: PASS") ||
      text.includes("PROMOTION: ALLOWED") ||
      (text.includes("QUALIFICATION CHECKS") && /\b9\s*\/\s*9\b/.test(text))
    )
  ) {
    return "PASSED";
  }

  if (execution !== "POST_LOAD_COMPLETED") {
    return "WAITING";
  }

  if (
    text.includes("RUNNING TESTS") ||
    text.includes("RUNNING DETERMINISTIC") ||
    text.includes("QUALIFYING EXECUTION")
  ) {
    return "RUNNING";
  }

  return "CHECKING";
}

function statusCopy(status: VisualStatus) {
  switch (status) {
    case "PASSED":
      return {
        label: "TEST QUALIFICATION PASSED",
        detail: "All mandatory deterministic qualification checks passed. Ready for Validate.",
        tone: "success",
        progress: 100,
      };
    case "REVIEW":
      return {
        label: "QUALIFIED WITH GOVERNED REVIEW",
        detail: "Technical qualification completed, but governed review items remain before promotion.",
        tone: "review",
        progress: 100,
      };
    case "FAILED":
      return {
        label: "TEST QUALIFICATION FAILED",
        detail: "One or more mandatory test checks failed. Promotion remains blocked until the failures are resolved.",
        tone: "danger",
        progress: 100,
      };
    case "BLOCKED":
      return {
        label: "TEST QUALIFICATION BLOCKED",
        detail: "KMITORA cannot continue Test qualification until the blocking execution or dependency condition is resolved.",
        tone: "danger",
        progress: 100,
      };
    case "RUNNING":
      return {
        label: "RUNNING DETERMINISTIC TESTS",
        detail: "KMITORA is executing the qualification suite against the authoritative DEV execution.",
        tone: "processing",
        progress: 78,
      };
    case "CHECKING":
      return {
        label: "QUALIFYING EXECUTION",
        detail: "KMITORA found the post-load execution and is checking test eligibility and qualification evidence.",
        tone: "processing",
        progress: 58,
      };
    default:
      return {
        label: "WAITING FOR EXECUTION",
        detail: "KMITORA is waiting for the authoritative POST_LOAD_COMPLETED DEV execution before Test can start.",
        tone: "processing",
        progress: 34,
      };
  }
}

export default function TestQualificationProgress({ executionStatus }: Props) {
  const [status, setStatus] = useState<VisualStatus>(() =>
    typeof document === "undefined" ? "CHECKING" : readPageSignal(executionStatus),
  );
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const evaluate = () => setStatus(readPageSignal(executionStatus));
    evaluate();

    const observer = new MutationObserver(evaluate);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    const signalTimer = window.setInterval(evaluate, 1000);
    return () => {
      observer.disconnect();
      window.clearInterval(signalTimer);
    };
  }, [executionStatus]);

  useEffect(() => {
    if (!['WAITING', 'CHECKING', 'RUNNING'].includes(status)) {
      setElapsed(0);
      return;
    }

    const timer = window.setInterval(() => setElapsed((current) => current + 1), 1000);
    return () => window.clearInterval(timer);
  }, [status]);

  const copy = useMemo(() => statusCopy(status), [status]);
  const execution = String(executionStatus ?? "NOT AVAILABLE").toUpperCase();
  const postLoadReady = execution === "POST_LOAD_COMPLETED";
  const complete = status === "PASSED" || status === "REVIEW" || status === "FAILED" || status === "BLOCKED";

  const steps = [
    { label: "Migration Context", state: "done" },
    { label: "Execution Located", state: execution && execution !== "NOT AVAILABLE" ? "done" : "active" },
    { label: "Post-Load Complete", state: postLoadReady ? "done" : execution ? "active" : "pending" },
    {
      label: status === "FAILED" ? "Test Failed" : status === "PASSED" ? "Test Passed" : "Test Qualification",
      state: complete ? (status === "FAILED" || status === "BLOCKED" ? "failed" : "done") : postLoadReady ? "active" : "pending",
    },
  ];

  const minutes = Math.floor(elapsed / 60).toString().padStart(2, "0");
  const seconds = (elapsed % 60).toString().padStart(2, "0");

  return (
    <section className={`testQualificationProgress testQualificationProgress--${copy.tone}`} aria-live="polite">
      <div className="testQualificationProgress__top">
        <div>
          <span className="testQualificationProgress__eyebrow">Execution Readiness Monitor</span>
          <strong>{copy.label}</strong>
          <p>{copy.detail}</p>
        </div>
        <div className="testQualificationProgress__status">
          {copy.progress}%
        </div>
      </div>

      <div className={`testQualificationProgress__bar${!complete ? " is-animated" : ""}`}>
        <span style={{ width: `${copy.progress}%` }} />
      </div>

      <div className="testQualificationProgress__facts">
        <span>Current: <strong>{execution}</strong></span>
        <span>Required: <strong>POST_LOAD_COMPLETED</strong></span>
        {!complete ? <span>Elapsed: <strong>{minutes}:{seconds}</strong></span> : null}
      </div>

      <div className="testQualificationProgress__steps">
        {steps.map((step, index) => (
          <div key={step.label} className={`testQualificationProgress__step is-${step.state}`}>
            <span>{index + 1}</span>
            <small>{step.label}</small>
          </div>
        ))}
      </div>

      {(status === "WAITING" || status === "CHECKING") ? (
        <div className="testQualificationProgress__actions">
          <button type="button" onClick={() => window.location.reload()}>
            Check Again
          </button>
        </div>
      ) : null}
    </section>
  );
}