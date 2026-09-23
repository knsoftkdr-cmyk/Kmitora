import { test, expect } from "@playwright/test";
import { hasRealTargetCredentials, targetConfig, urls } from "./helpers/env";

test.describe("real DEV target API", () => {
  test.skip(!hasRealTargetCredentials, "Set KMITORA_E2E_TARGET_DATABASE and KMITORA_E2E_TARGET_USERNAME.");

  test("test and create DEV target without production cutover", async ({ request }) => {
    const testResponse = await request.post(`${urls.target}/v1/targets/test`, { data: targetConfig });
    expect(testResponse.ok()).toBeTruthy();

    const createResponse = await request.post(`${urls.target}/v1/targets`, { data: targetConfig });
    expect([200, 201]).toContain(createResponse.status());
    const target = await createResponse.json();

    expect(target.status).toBe("connected");
    expect(target.environment).toBe("DEV");
    expect(target.password).toBeUndefined();
  });
});
