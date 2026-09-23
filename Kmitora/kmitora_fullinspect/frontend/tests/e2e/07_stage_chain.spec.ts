import { test, expect } from "@playwright/test";

const chain = [
  ["Detect", "Diagnose"],
  ["Diagnose", "Predict"],
  ["Predict", "Recommend"],
  ["Recommend", "Simulate"],
  ["Simulate", "Execute"],
  ["Test", "Validate"],
] as const;

for (const [current, next] of chain) {
  test(`${current} Continue button routes to ${next}`, async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: new RegExp(`${current}$`, "i") }).first().click();
    await page.getByRole("button", { name: new RegExp(`Continue to ${next}`, "i") }).click();
    await expect(page.locator(".navItem.active")).toContainText(next);
  });
}
