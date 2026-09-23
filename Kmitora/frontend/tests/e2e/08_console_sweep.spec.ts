import { test, expect } from "@playwright/test";

const screens = [
  "Understand","Discover","Detect","Diagnose","Predict","Recommend","Simulate",
  "Execute","Test","Validate","Reconcile","Evidence","Learn",
  "Control Tower","Agents","1M Capability Universe","Approvals","Activity","Settings",
];

test("all lifecycle and operations screens avoid uncaught page errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");
  for (const screen of screens) {
    await page.getByRole("button", { name: new RegExp(`${screen}$`, "i") }).first().click();
    await page.waitForTimeout(100);
  }

  expect(errors).toEqual([]);
});
