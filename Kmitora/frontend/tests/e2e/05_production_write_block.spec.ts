import { test, expect } from "@playwright/test";
import { hasRealTargetCredentials, targetConfig, urls } from "./helpers/env";

test.describe("production write safety", () => {
  test.skip(!hasRealTargetCredentials, "Requires a reachable non-production test database used only to exercise PROD-labelled policy.");

  test("PROD-labelled target write endpoint is denied", async ({ request }) => {
    const prodConfig = {
      ...targetConfig,
      name: "KMITORA E2E PROD-Label Safety Target",
      environment: "PROD",
    };

    const createResponse = await request.post(`${urls.target}/v1/targets`, { data: prodConfig });
    expect([200, 201]).toContain(createResponse.status());
    const target = await createResponse.json();

    const writeResponse = await request.post(
      `${urls.target}/v1/targets/${encodeURIComponent(target.id)}/write`,
      {
        data: {
          schema: targetConfig.schema,
          object: "customers",
          rows: [{ customer_id: "SHOULD_NOT_WRITE" }],
        },
      },
    );

    expect(writeResponse.status()).toBe(403);
    const health = await request.get(`${urls.target}/health`);
    const healthBody = await health.json();
    expect(healthBody.production_writes).toBe(0);
    expect(healthBody.cutover).toBe("DISABLED");
  });
});
