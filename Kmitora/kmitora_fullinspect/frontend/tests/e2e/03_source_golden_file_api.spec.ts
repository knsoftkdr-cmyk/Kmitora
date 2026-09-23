import { test, expect } from "@playwright/test";
import { createFileSource } from "./helpers/api";
import { goldenSourceDir, urls } from "./helpers/env";

test("golden file source can be tested, created, inventoried and previewed", async ({ request }) => {
  const source = await createFileSource(request, urls.source, goldenSourceDir);
  expect(source.type).toBe("file");
  expect(source.status).toBe("connected");
  expect(source.username).toBeUndefined();

  const objectsResponse = await request.get(
    `${urls.source}/v1/sources/${encodeURIComponent(source.id)}/objects`,
  );
  expect(objectsResponse.ok()).toBeTruthy();
  const objects = await objectsResponse.json() as Array<{ schema: string; name: string; type: string }>;

  const names = objects.map((item) => item.name);
  expect(names).toContain("customers.csv");
  expect(names).toContain("orders.csv");
  expect(names).toContain("order_items.csv");

  const preview = await request.get(
    `${urls.source}/v1/sources/${encodeURIComponent(source.id)}/preview?schema=files&object=customers.csv&limit=100`,
  );
  expect(preview.ok()).toBeTruthy();
  const body = await preview.json() as { columns: string[]; rows: unknown[] };
  expect(body.columns).toContain("customer_id");
  expect(body.rows).toHaveLength(5);
});
