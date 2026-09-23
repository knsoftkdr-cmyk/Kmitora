import { useEffect, useState } from "react";
import { checkBackendHealth, type BackendHealth } from "../services/backendApi";

const initial: BackendHealth = {
  connected: false,
  status: "CHECKING",
  endpoint: null,
  latencyMs: null,
};

export function BackendConnectionStatus() {
  const [health, setHealth] = useState<BackendHealth>(initial);

  const refresh = async () => {
    setHealth((current) => ({ ...current, status: "CHECKING" }));
    setHealth(await checkBackendHealth());
  };

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div
      data-kmitora-backend={health.status}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 12,
        padding: "6px 10px",
        border: "1px solid #d7dee8",
        borderRadius: 7,
        background: "#fff",
      }}
      title={health.endpoint ?? "Backend health endpoint unavailable"}
    >
      <span
        aria-hidden="true"
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background:
            health.status === "CONNECTED"
              ? "#18864b"
              : health.status === "CHECKING"
                ? "#d68a00"
                : "#b42318",
        }}
      />
      <strong>KMITORA Backend</strong>
      <span>{health.status}</span>
      {health.latencyMs !== null && <span>{health.latencyMs} ms</span>}
      <button
        type="button"
        onClick={() => void refresh()}
        style={{
          marginLeft: "auto",
          border: 0,
          background: "transparent",
          cursor: "pointer",
          fontSize: 12,
        }}
      >
        Refresh
      </button>
    </div>
  );
}

