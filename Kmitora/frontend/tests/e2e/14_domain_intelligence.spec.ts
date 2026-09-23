import { expect, test } from "@playwright/test";

test("A000 smart domain intelligence infers context and allocates governed agents", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");

  await page
    .getByRole("button", { name: /Domain Intelligence$/i })
    .click();

  await expect(
    page.getByRole("heading", {
      name: "Smart Business Domain Understanding",
    }),
  ).toBeVisible();

  await page
    .getByTestId("kdi-description")
    .fill(
      "Bank customer onboarding, payments, regulatory compliance, Oracle data migration, API defects and cloud modernization.",
    );

  await page.getByTestId("kdi-infer").click();

  await expect(page.getByText("Banking", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Data/).first()).toBeVisible();

  await page.getByTestId("kdi-activate").click();

  const context = page.getByTestId("kdi-context");

  await expect(context).toContainText("Banking");
  await expect(context).toContainText("Allocated agents");
  await expect(context).toContainText("Dynamic scenarios");
  await expect(context).toContainText("PROD DENIED");

  await page
    .getByRole("button", { name: "Start 13-Stage Lifecycle" })
    .click();

  await expect(
    page.getByTestId("a000-scenario-context"),
  ).toContainText("Banking");

  expect(errors).toEqual([]);
});
