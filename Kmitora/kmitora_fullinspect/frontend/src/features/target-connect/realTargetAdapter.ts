import type {
  TargetConnectAdapter,
  TargetConnectionDraft,
} from "./types";

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  const response = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorPayload = response?.payload ?? response;

    throw new Error(
      errorPayload?.error ||
      errorPayload?.message ||
      response?.error ||
      response?.message ||
      `HTTP ${res.status}`
    );
  }

  return response as T;
}

function unwrap<T = any>(response: any): T {
  if (
    response &&
    typeof response === "object" &&
    "payload" in response
  ) {
    return response.payload as T;
  }

  return response as T;
}

function normalizeArray<T = any>(response: any): T[] {
  const value: any = unwrap(response);

  if (Array.isArray(value)) {
    return value as T[];
  }

  if (Array.isArray(value?.items)) {
    return value.items as T[];
  }

  if (Array.isArray(value?.objects)) {
    return value.objects as T[];
  }

  if (Array.isArray(value?.targets)) {
    return value.targets as T[];
  }

  return [];
}

export const realTargetAdapter: TargetConnectAdapter = {
  testTarget(draft: TargetConnectionDraft) {
    return json("/target-api/v1/targets/test", {
      method: "POST",
      body: JSON.stringify(draft),
    });
  },

  createTarget(draft: TargetConnectionDraft) {
    return json("/target-api/v1/targets", {
      method: "POST",
      body: JSON.stringify(draft),
    });
  },

  async listTargets() {
    const response = await json<any>(
      "/target-api/v1/targets"
    );

    return normalizeArray(response);
  },

  async listObjects(targetId: string) {
    const response = await json<any>(
      `/target-api/v1/targets/${encodeURIComponent(targetId)}/objects`
    );

    return normalizeArray(response);
  },

  async getStructure(
    targetId: string,
    schema: string,
    objectName: string
  ) {
    const q = new URLSearchParams({
      schema,
      object: objectName,
    });

    const response = await json<any>(
      `/target-api/v1/targets/${encodeURIComponent(targetId)}/structure?${q.toString()}`
    );

    const value: any = unwrap(response);

    if (Array.isArray(value)) {
      return {
        columns: value,
      };
    }

    return {
      columns:
        Array.isArray(value?.columns)
          ? value.columns
          : [],
    };
  },

  async previewObject(
    targetId: string,
    schema: string,
    objectName: string,
    limit: number
  ) {
    const q = new URLSearchParams({
      schema,
      object: objectName,
      limit: String(limit),
    });

    const response = await json<any>(
      `/target-api/v1/targets/${encodeURIComponent(targetId)}/preview?${q.toString()}`
    );

    const value: any = unwrap(response);

    return {
      columns:
        Array.isArray(value?.columns)
          ? value.columns
          : [],
      rows:
        Array.isArray(value?.rows)
          ? value.rows
          : [],
      totalRows:
        value?.totalRows ??
        value?.total_rows ??
        null,
    };
  },

  deleteTarget(targetId: string) {
    return json(`/target-api/v1/targets/${encodeURIComponent(targetId)}`, { method: "DELETE" });
  },
};

