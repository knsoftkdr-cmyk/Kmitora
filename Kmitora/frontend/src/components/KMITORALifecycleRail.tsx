import {
  KMITORA_LIFECYCLE,
  KMITORA_LIFECYCLE_LABEL,
} from "../config/kmitoraLifecycle";

export default function KMITORALifecycleRail() {
  return (
    <div className="km-lifecycle">
      <div className="km-lifecycle-sequence" aria-label="KMITORA lifecycle">
        {KMITORA_LIFECYCLE_LABEL}
      </div>

      <div className="km-lifecycle-scroll">
        <div className="km-lifecycle-rail">
          {KMITORA_LIFECYCLE.map((stage, index) => (
            <div
              key={stage.key}
              className={`km-lifecycle-stage ${stage.status}`}
              aria-current={stage.status === "active" ? "step" : undefined}
            >
              <div className="km-lifecycle-node-row">
                <span className="km-lifecycle-node">
                  {String(index + 1).padStart(2, "0")}
                </span>

                {index < KMITORA_LIFECYCLE.length - 1 && (
                  <span className="km-lifecycle-connector" aria-hidden="true" />
                )}
              </div>

              <div className="km-lifecycle-stage-head">
                <strong>{stage.label}</strong>
                <span>{stage.progress}%</span>
              </div>

              <div className="km-lifecycle-progress">
                <i style={{ width: `${stage.progress}%` }} />
              </div>

              <p>{stage.summary}</p>

              <small>{stage.status}</small>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

