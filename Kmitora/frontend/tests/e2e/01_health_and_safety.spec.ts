import { test, expect } from "@playwright/test";
import { expectHealthy } from "./helpers/api";
import { urls } from "./helpers/env";

test.describe("KMITORA service health and safety", () => {
  test("Core/A000 is UP and reports no production action", async ({ request }) => {
    const body = await expectHealthy(request, urls.core);
    expect((body.payload as { status?: string } | undefined)?.status).toBe("UP");
    expect(body.production_action_executed).toBe(false);
  });

  test("Source API is healthy and read-only", async ({ request }) => {
    const body = await expectHealthy(request, urls.source);
    expect(body.status).toBe("HEALTHY");
    expect(body.production_writes).toBe(0);
    expect(body.source_preview_mode).toBe("READ_ONLY");
  });

  test("Target API is healthy, read-only and cutover disabled", async ({ request }) => {
    const body = await expectHealthy(request, urls.target);
    expect(body.status).toBe("HEALTHY");
    expect(body.production_writes).toBe(0);
    expect(body.target_preview_mode).toBe("READ_ONLY");
    expect(body.cutover).toBe("DISABLED");
  });
});
