import type {
  SourceConnectAdapter,
  SourceConnectionDraft,
} from "./types";

function normalizeSourceDraft(draft: SourceConnectionDraft): SourceConnectionDraft {
  const rawType = String((draft as any).type || "").trim().toLowerCase();
  const type = (["file", "file system", "file_system", "filesystem", "folder"].includes(rawType)
    ? "file"
    : rawType) as SourceConnectionDraft["type"];

  if (type === "file") {
    return {
      name: String(draft.name || "").trim(),
      type: "file",
      filePath: String(draft.filePath || "").trim(),
    };
  }

  return {
    ...draft,
    name: String(draft.name || "").trim(),
    type,
    host: String(draft.host || "").trim(),
    database: String(draft.database || "").trim(),
    schema: String(draft.schema || "").trim(),
    username: String(draft.username || "").trim(),
  };
}

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload?.error || payload?.message || `HTTP ${res.status}`);
  }
  return payload as T;
}

export const realSourceAdapter: SourceConnectAdapter = {
  testSource(draft: SourceConnectionDraft) {
    return json("/source-api/v1/sources/test", {
      method: "POST",
      body: JSON.stringify(normalizeSourceDraft(draft)),
    });
  },

  createSource(draft: SourceConnectionDraft) {
    return json("/source-api/v1/sources", {
      method: "POST",
      body: JSON.stringify(normalizeSourceDraft(draft)),
    });
  },

  listSources() {
    return json("/source-api/v1/sources");
  },

  listObjects(sourceId: string) {
    return json(`/source-api/v1/sources/${encodeURIComponent(sourceId)}/objects`);
  },

  previewObject(sourceId: string, schema: string, objectName: string, limit: number) {
    const q = new URLSearchParams({
      schema,
      object: objectName,
      limit: String(limit),
    });
    return json(
      `/source-api/v1/sources/${encodeURIComponent(sourceId)}/preview?${q.toString()}`
    );
  },
};

