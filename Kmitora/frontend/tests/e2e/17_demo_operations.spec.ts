import { expect, test } from "@playwright/test";

test("Demo Operations exposes supervisor controls, preflight and safety state", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");

  await page
    .getByRole("button", { name: "Demo Operations", exact: true })
    .click();

  await expect(
    page.getByRole("heading", { name: "Frontend-Controlled Demo Operations" }),
  ).toBeVisible();

  await expect(page.getByTestId("demo-preflight")).toBeVisible();
  await expect(page.getByTestId("demo-start")).toBeVisible();
  await expect(page.getByTestId("demo-restart-backend")).toBeVisible();
  await expect(page.getByTestId("demo-restart-frontend")).toBeVisible();
  await expect(page.getByTestId("demo-restart-all")).toBeVisible();
  await expect(page.getByTestId("demo-stop")).toBeVisible();

  await page.getByTestId("demo-preflight").click();

  await expect(
    page.getByTestId("demo-preflight-results"),
  ).toContainText("Certified build SHA-256");

  await expect(
    page.getByText("Production writes: DENIED", { exact: true }),
  ).toBeVisible();

  expect(errors).toEqual([]);
});
