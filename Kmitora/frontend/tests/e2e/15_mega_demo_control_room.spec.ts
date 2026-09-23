import { expect, test } from "@playwright/test";

test("Mega Demo Control Room replays backend evidence and exposes safety", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");

  await page
    .getByRole("button", { name: /Mega Demo Control Room$/i })
    .click();

  await expect(
    page.getByRole("heading", { name: "Mega Enterprise Control Room" }),
  ).toBeVisible();

  await expect(page.getByText("PROD DENIED", { exact: true })).toBeVisible();

  await page.getByTestId("mega-replay").click();

  await expect(page.getByTestId("mega-check-groups")).toContainText(
    "Health",
  );

  await expect(page.getByTestId("mega-check-count")).toContainText(
    "/121",
  );

  await expect(page.getByText(/A000 ORCHESTRATION/i)).toBeVisible();
  await expect(page.getByText(/DIGITAL TWIN/i)).toBeVisible();
  await expect(page.getByText(/CAPABILITY UNIVERSE/i)).toBeVisible();
  await expect(page.getByText(/FINAL ASSURANCE/i)).toBeVisible();

  expect(errors).toEqual([]);
});
