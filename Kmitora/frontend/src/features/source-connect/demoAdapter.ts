import type { SourceConnectAdapter } from "./types";

export const demoSourceAdapter: SourceConnectAdapter = {
  async testSource() {
    return { ok: true, message: "Demo connection successful." };
  },
  async createSource(draft) {
    return {
      id: `src-${Date.now()}`,
      name: draft.name,
      type: draft.type,
      status: "connected",
      host: draft.host,
      database: draft.database,
      schema: draft.schema,
    };
  },
  async listSources() {
    return [];
  },
  async listObjects() {
    return [
      { schema: "public", name: "customer", type: "table", rowCount: 2436817 },
      { schema: "public", name: "orders", type: "table", rowCount: 4562311 },
      { schema: "public", name: "active_customers", type: "view" },
    ];
  },
  async previewObject(_, __, objectName) {
    if (objectName === "orders") {
      return {
        columns: ["order_id", "customer_id", "status", "amount"],
        rows: [
          { order_id: 9001, customer_id: 1001, status: "OPEN", amount: 1250 },
          { order_id: 9002, customer_id: 1002, status: "OPEN", amount: 4800 },
        ],
        totalRows: 4562311,
      };
    }
    return {
      columns: ["customer_id", "customer_name", "status", "region"],
      rows: [
        { customer_id: 1001, customer_name: "ABC Industries", status: "ACTIVE", region: "SOUTH" },
        { customer_id: 1002, customer_name: "XYZ Enterprises", status: "ACTIVE", region: "NORTH" },
      ],
      totalRows: 2436817,
    };
  },
};
