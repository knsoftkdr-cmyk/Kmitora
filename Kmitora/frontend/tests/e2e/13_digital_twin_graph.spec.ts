import { expect, test } from "@playwright/test";

test.describe("advanced live A000 Digital Twin Graph", () => {
  test("loads live graph, selects risk node, and runs governed analyses", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) =>
      errors.push(error.message),
    );

    await page.goto("/");

    await page
      .getByRole("button", {
        name: /Digital Twin Graph$/i,
      })
      .click();

    await expect(
      page.getByRole("heading", {
        name: "Digital Twin Graph",
      }),
    ).toBeVisible();

    await expect(
      page.getByTestId("digital-twin-graph"),
    ).toBeVisible();

    await expect(
      page.getByText(/A000 LIVE PROJECTION/i),
    ).toBeVisible();

    await expect(
      page.getByText(/PROD DENIED/i),
    ).toBeVisible();

    await page
      .getByLabel("Search digital twin")
      .fill("risk");

    const riskNode = page.getByRole("button", {
      name: "Select Quality / Failure Risk",
    });

    await expect(riskNode).toBeVisible();
    await riskNode.click();

    await expect(
      page.getByTestId("dtg-selected-name"),
    ).toHaveText("Quality / Failure Risk");

    await page.getByTestId("dtg-impact").click();

    await expect(
      page.getByTestId("dtg-impact-result"),
    ).toContainText(/downstream nodes/i);

    await page.getByTestId("dtg-rca").click();

    await expect(
      page.getByTestId("dtg-rca-result"),
    ).toContainText(/REFERENCE|evidence validation/i);

    await page.getByTestId("dtg-simulate").click();

    await expect(
      page.getByTestId("dtg-simulation-result"),
    ).toContainText(
      "READ_ONLY_REFERENCE_PROJECTION",
    );

    await expect(
      page.getByTestId("dtg-simulation-result"),
    ).toContainText(/Target write: false/i);

    await page.getByTestId("dtg-compare").click();

    await expect(
      page.getByTestId("dtg-comparison"),
    ).toContainText("SOURCE / CURRENT");

    await expect(
      page.getByTestId("dtg-comparison"),
    ).toContainText("TARGET / EXPECTED");

    expect(errors).toEqual([]);
  });
});
