import { test, expect } from "@playwright/test";

const lifecycle = [
  ["01", "Understand"],
  ["02", "Discover"],
  ["03", "Detect"],
  ["04", "Diagnose"],
  ["05", "Predict"],
  ["06", "Recommend"],
  ["07", "Simulate"],
  ["08", "Execute"],
  ["09", "Test"],
  ["10", "Validate"],
  ["11", "Reconcile"],
  ["12", "Evidence"],
  ["13", "Learn"],
] as const;

test("sidebar exposes the exact 13-stage lifecycle in order", async ({ page }) => {
  await page.goto("/");
  const sidebar = page.locator(".sidebar");
  await expect(sidebar).toBeVisible();

  const labels = await sidebar.locator(".kmSidebarGroup").first().locator(".navItem span:last-child").allTextContents();
  expect(labels).toEqual(lifecycle.map(([, label]) => label));
});

for (const [number, label] of lifecycle) {
  test(`stage ${number} ${label} opens without uncaught page error`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("/");
    await page.getByRole("button", { name: new RegExp(`${label}$`, "i") }).first().click();

    await expect(page.locator(".navItem.active")).toContainText(label);
    expect(errors).toEqual([]);
  });
}
