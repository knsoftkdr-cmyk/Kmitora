import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { createFileSource, expectHealthy } from "./helpers/api";
import {
  goldenSourceDir,
  hasRealTargetCredentials,
  targetConfig,
  urls,
} from "./helpers/env";
import {
  assertUniquePrimaryKeys,
  canonicalRows,
  goldenEntities,
  orphanCount,
  rowsSha256,
  type DataRow,
  writeGoldenEvidence,
} from "./helpers/goldenPath";

type SourcePreview = {
  columns: string[];
  rows: DataRow[];
  totalRows?: number | null;
};

type TargetPreview = SourcePreview;

type TargetRecord = {
  id: string;
  status: string;
  environment: string;
};

type WriteResult = {
  ok: boolean;
  table: string;
  attempted: number;
  inserted: number;
  skipped_no_matching_columns: number;
};

test.describe("real source to PostgreSQL golden path", () => {
  test.skip(
    !hasRealTargetCredentials,
    "Set KMITORA_E2E_TARGET_DATABASE and KMITORA_E2E_TARGET_USERNAME.",
  );

  test("loads golden source, writes DEV target, reconciles exactly, and emits evidence", async ({
    request,
  }, testInfo) => {
    const traceId = randomUUID();
    const startedAt = new Date().toISOString();

    const sourceHealth = await expectHealthy(request, urls.source);
    const targetHealthBefore = await expectHealthy(request, urls.target);

    expect(sourceHealth.production_writes).toBe(0);
    expect(targetHealthBefore.production_writes).toBe(0);
    expect(targetHealthBefore.cutover).toBe("DISABLED");

    const source = await createFileSource(
      request,
      urls.source,
      goldenSourceDir,
    );

    const sourceObjectsResponse = await request.get(
      `${urls.source}/v1/sources/${encodeURIComponent(source.id)}/objects`,
    );
    expect(sourceObjectsResponse.ok()).toBeTruthy();

    const sourceObjects = await sourceObjectsResponse.json() as Array<{
      name: string;
      schema: string;
      type: string;
    }>;

    for (const entity of goldenEntities) {
      expect(
        sourceObjects.some((item) => item.name === entity.sourceObject),
        `Source catalog must contain ${entity.sourceObject}`,
      ).toBeTruthy();
    }

    const targetTestResponse = await request.post(
      `${urls.target}/v1/targets/test`,
      { data: targetConfig },
    );
    expect(
      targetTestResponse.ok(),
      await targetTestResponse.text(),
    ).toBeTruthy();

    const targetCreateResponse = await request.post(
      `${urls.target}/v1/targets`,
      { data: targetConfig },
    );
    expect([200, 201]).toContain(targetCreateResponse.status());

    const target = await targetCreateResponse.json() as TargetRecord;
    expect(target.status).toBe("connected");
    expect(target.environment).toBe("DEV");

    const targetObjectsResponse = await request.get(
      `${urls.target}/v1/targets/${encodeURIComponent(target.id)}/objects`,
    );
    expect(targetObjectsResponse.ok()).toBeTruthy();

    const targetObjects = await targetObjectsResponse.json() as Array<{
      name: string;
      schema: string;
      type: string;
    }>;

    for (const entity of goldenEntities) {
      expect(
        targetObjects.some(
          (item) =>
            item.schema === targetConfig.schema &&
            item.name === entity.targetObject,
        ),
        `Target catalog must contain ${targetConfig.schema}.${entity.targetObject}`,
      ).toBeTruthy();
    }

    const sourceRowsByEntity: Record<string, DataRow[]> = {};
    const writeResults: WriteResult[] = [];

    for (const entity of goldenEntities) {
      const sourcePreviewResponse = await request.get(
        `${urls.source}/v1/sources/${encodeURIComponent(source.id)}/preview` +
          `?schema=files&object=${encodeURIComponent(entity.sourceObject)}` +
          "&limit=500",
      );

      expect(sourcePreviewResponse.ok()).toBeTruthy();

      const sourcePreview =
        await sourcePreviewResponse.json() as SourcePreview;

      expect(sourcePreview.rows.length).toBeGreaterThan(0);
      expect(
        assertUniquePrimaryKeys(
          sourcePreview.rows,
          entity.primaryKey,
        ),
        `${entity.sourceObject} primary keys must be unique`,
      ).toBeTruthy();

      sourceRowsByEntity[entity.targetObject] = sourcePreview.rows;

      const writeResponse = await request.post(
        `${urls.target}/v1/targets/${encodeURIComponent(target.id)}/write`,
        {
          data: {
            schema: targetConfig.schema,
            object: entity.targetObject,
            rows: sourcePreview.rows,
          },
        },
      );

      expect(
        writeResponse.ok(),
        await writeResponse.text(),
      ).toBeTruthy();

      const writeResult = await writeResponse.json() as WriteResult;

      expect(writeResult.ok).toBe(true);
      expect(writeResult.attempted).toBe(sourcePreview.rows.length);
      expect(writeResult.skipped_no_matching_columns).toBe(0);
      expect(writeResult.inserted).toBeGreaterThanOrEqual(0);
      expect(writeResult.inserted).toBeLessThanOrEqual(
        sourcePreview.rows.length,
      );

      writeResults.push(writeResult);
    }

    const targetRowsByEntity: Record<string, DataRow[]> = {};
    const reconciliation: Record<string, unknown> = {
      status: "PASS",
      entities: {},
      business_rules: {},
    };

    for (const entity of goldenEntities) {
      const targetPreviewResponse = await request.get(
        `${urls.target}/v1/targets/${encodeURIComponent(target.id)}/preview` +
          `?schema=${encodeURIComponent(targetConfig.schema)}` +
          `&object=${encodeURIComponent(entity.targetObject)}` +
          "&limit=500",
      );

      expect(targetPreviewResponse.ok()).toBeTruthy();

      const targetPreview =
        await targetPreviewResponse.json() as TargetPreview;

      const sourceRows = sourceRowsByEntity[entity.targetObject];
      const targetRows = targetPreview.rows;

      targetRowsByEntity[entity.targetObject] = targetRows;

      expect(
        targetRows.length,
        `${entity.targetObject} target row count must exactly match source`,
      ).toBe(sourceRows.length);

      expect(
        canonicalRows(targetRows, entity.primaryKey),
        `${entity.targetObject} canonical target rows must match source`,
      ).toBe(canonicalRows(sourceRows, entity.primaryKey));

      const sourceHash = rowsSha256(
        sourceRows,
        entity.primaryKey,
      );
      const targetHash = rowsSha256(
        targetRows,
        entity.primaryKey,
      );

      expect(targetHash).toBe(sourceHash);

      (reconciliation.entities as Record<string, unknown>)[
        entity.targetObject
      ] = {
        primary_key: entity.primaryKey,
        source_count: sourceRows.length,
        target_count: targetRows.length,
        source_sha256: sourceHash,
        target_sha256: targetHash,
        matched: true,
      };
    }

    const customers = targetRowsByEntity.customers;
    const orders = targetRowsByEntity.orders;
    const orderItems = targetRowsByEntity.order_items;

    const orphanCustomerReferences = orphanCount(
      orders,
      "customer_id",
      customers,
      "customer_id",
    );

    const orphanOrderReferences = orphanCount(
      orderItems,
      "order_id",
      orders,
      "order_id",
    );

    const negativeOrderAmounts = orders.filter(
      (row) => Number(row.amount) < 0,
    ).length;

    const nonPositiveQuantities = orderItems.filter(
      (row) => Number(row.quantity) <= 0,
    ).length;

    const invalidCustomerStatuses = customers.filter(
      (row) =>
        !["ACTIVE", "INACTIVE"].includes(String(row.status)),
    ).length;

    const invalidOrderStatuses = orders.filter(
      (row) =>
        !["NEW", "PAID", "SHIPPED", "CANCELLED"].includes(
          String(row.status),
        ),
    ).length;

    expect(orphanCustomerReferences).toBe(0);
    expect(orphanOrderReferences).toBe(0);
    expect(negativeOrderAmounts).toBe(0);
    expect(nonPositiveQuantities).toBe(0);
    expect(invalidCustomerStatuses).toBe(0);
    expect(invalidOrderStatuses).toBe(0);

    reconciliation.business_rules = {
      orphan_customer_references: orphanCustomerReferences,
      orphan_order_references: orphanOrderReferences,
      negative_order_amounts: negativeOrderAmounts,
      non_positive_item_quantities: nonPositiveQuantities,
      invalid_customer_statuses: invalidCustomerStatuses,
      invalid_order_statuses: invalidOrderStatuses,
    };

    const expectedPath = path.resolve(
      process.cwd(),
      "../TEST_DATA/E2E_GOLDEN/expected/expected_reconciliation.json",
    );

    const expectedReconciliation = JSON.parse(
      await readFile(expectedPath, "utf8"),
    ) as {
      happy: {
        row_counts: Record<string, number>;
        orphan_customer_refs: number;
        orphan_order_refs: number;
        negative_order_amounts: number;
        non_positive_item_quantities: number;
        production_writes: number;
      };
    };

    expect(customers.length).toBe(
      expectedReconciliation.happy.row_counts.customers,
    );
    expect(orders.length).toBe(
      expectedReconciliation.happy.row_counts.orders,
    );
    expect(orderItems.length).toBe(
      expectedReconciliation.happy.row_counts.order_items,
    );
    expect(orphanCustomerReferences).toBe(
      expectedReconciliation.happy.orphan_customer_refs,
    );
    expect(orphanOrderReferences).toBe(
      expectedReconciliation.happy.orphan_order_refs,
    );
    expect(negativeOrderAmounts).toBe(
      expectedReconciliation.happy.negative_order_amounts,
    );
    expect(nonPositiveQuantities).toBe(
      expectedReconciliation.happy.non_positive_item_quantities,
    );

    const targetHealthAfter = await expectHealthy(request, urls.target);

    expect(targetHealthAfter.production_writes).toBe(
      expectedReconciliation.happy.production_writes,
    );
    expect(targetHealthAfter.cutover).toBe("DISABLED");

    const completedAt = new Date().toISOString();

    const evidence = {
      evidence_type: "KMITORA_REAL_SOURCE_TARGET_GOLDEN_PATH",
      version: "1.0",
      trace_id: traceId,
      status: "PASS",
      started_at: startedAt,
      completed_at: completedAt,
      source: {
        id: source.id,
        type: source.type,
        path: goldenSourceDir,
      },
      target: {
        id: target.id,
        type: targetConfig.type,
        environment: target.environment,
        host: targetConfig.host,
        port: targetConfig.port,
        database: targetConfig.database,
        schema: targetConfig.schema,
      },
      write_results: writeResults,
      reconciliation,
      safety: {
        production_writes_before:
          targetHealthBefore.production_writes,
        production_writes_after:
          targetHealthAfter.production_writes,
        cutover: targetHealthAfter.cutover,
        production_action_executed: false,
      },
    };

    const evidencePath = await writeGoldenEvidence(evidence);

    await testInfo.attach("golden-path-evidence", {
      path: evidencePath,
      contentType: "application/json",
    });
  });
});
