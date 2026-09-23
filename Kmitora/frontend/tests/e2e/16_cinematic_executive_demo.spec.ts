import { expect, test } from "@playwright/test";

test("Cinematic Executive Demo supports scenario presets and presentation controls", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");

  await page
    .getByRole("button", { name: "Cinematic Executive Demo", exact: true })
    .click();

  await expect(
    page.getByText("Cinematic Demo Mode", { exact: true }),
  ).toBeVisible();

  await expect(page.getByTestId("cinematic-stage")).toBeVisible();
  await expect(page.getByText("PROD DENIED", { exact: true })).toBeVisible();

  await page
    .getByTestId("cinematic-scenario")
    .selectOption("healthcare-platform");

  await expect(
    page.getByTestId("cinematic-industry"),
  ).toHaveText("Healthcare & Life Sciences");

  await page.getByRole("button", { name: "Next scene" }).click();

  await expect(
    page.getByRole("heading", { name: "Start with the client context" }),
  ).toBeVisible();

  await page.getByTestId("cinematic-play").click();
  await expect(page.getByTestId("cinematic-play")).toContainText("Pause");

  expect(errors).toEqual([]);
});
