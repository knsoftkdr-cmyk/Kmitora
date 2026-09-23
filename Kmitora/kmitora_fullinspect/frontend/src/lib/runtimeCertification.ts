type BrowserCertification = {
  installedAt: string;
  consoleErrors: string[];
  windowErrors: string[];
  unhandledRejections: string[];
  a000Requests: Record<string, number>;
};

const KEY = "__KMITORA_RUNTIME_CERTIFICATION__";

declare global {
  interface Window { [KEY]?: BrowserCertification; }
}

export function installRuntimeCertification() {
  if (window[KEY]) return;
  const state: BrowserCertification = {
    installedAt: new Date().toISOString(),
    consoleErrors: [], windowErrors: [], unhandledRejections: [], a000Requests: {},
  };
  window[KEY] = state;

  const originalError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    state.consoleErrors.push(args.map(String).join(" ").slice(0, 2000));
    originalError(...args);
  };
  window.addEventListener("error", (event) => state.windowErrors.push(String(event.message || event.error || "window error").slice(0, 2000)));
  window.addEventListener("unhandledrejection", (event) => state.unhandledRejections.push(String(event.reason || "unhandled rejection").slice(0, 2000)));

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes("/v1/a000/") || url.includes("/api/v1/a000/")) {
      const normalized = url.replace(/^https?:\/\/[^/]+/, "");
      state.a000Requests[normalized] = (state.a000Requests[normalized] || 0) + 1;
    }
    return originalFetch(input, init);
  };
}

export function snapshotRuntimeCertification() {
  const state = window[KEY];
  if (!state) return null;
  return {
    ...state,
    capturedAt: new Date().toISOString(),
    criticalErrorCount: state.consoleErrors.length + state.windowErrors.length + state.unhandledRejections.length,
  };
}
