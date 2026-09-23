import { expect, test } from "@playwright/test";

test.describe("Understand screen button smoke coverage", () => {
  test("renders source, target, and business requirements controls", async ({
    page,
  }) => {
    await page.goto("/");

    await page
      .getByRole("button", { name: /Understand$/i })
      .first()
      .click();

    await expect(
      page.getByRole("button", { name: /Test Connection/i }).first(),
    ).toBeVisible();

    await expect(
      page.getByRole("button", { name: /Connect & Create Source/i }),
    ).toBeVisible();

    await expect(
      page.getByRole("button", { name: /Test Target Connection/i }),
    ).toBeVisible();

    await expect(
      page.getByRole("button", { name: /Connect & Create Target/i }),
    ).toBeVisible();

    await expect(
      page.getByRole("button", {
        name: /Continue to Business Requirements/i,
      }),
    ).toBeVisible();
  });

  test("business requirements remains gated when no systems are connected", async ({
    page,
  }) => {
    await page.route("**/source-api/v1/sources", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: "[]",
        });
        return;
      }

      await route.continue();
    });

    await page.route("**/target-api/v1/targets", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: "[]",
        });
        return;
      }

      await route.continue();
    });

    await page.goto("/");

    await page
      .getByRole("button", { name: /Understand$/i })
      .first()
      .click();

    const requirementsButton = page.getByRole("button", {
      name: /Continue to Business Requirements/i,
    });

    await expect(requirementsButton).toBeVisible();
    await expect(requirementsButton).toBeDisabled();
  });
});

test("Control Tower and A000 Assistant controls render", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("KMITORA Assistant")).toBeVisible();

  await expect(
    page.getByRole("button", { name: /Show Current/i }),
  ).toBeVisible();

  await expect(
    page.getByRole("button", { name: /Resolve Safe/i }),
  ).toBeVisible();
});
