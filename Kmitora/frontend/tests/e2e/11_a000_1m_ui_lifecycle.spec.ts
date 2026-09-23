import { expect, test } from "@playwright/test";

const lifecycle = [
  "Understand",
  "Discover",
  "Detect",
  "Diagnose",
  "Predict",
  "Recommend",
  "Simulate",
  "Execute",
  "Test",
  "Validate",
  "Reconcile",
  "Evidence",
  "Learn",
] as const;

test.describe("A000 one-million capability universe UI", () => {
  test("lookup, safe activation, learning, and lifecycle context are UI-driven", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) =>
      pageErrors.push(error.message),
    );

    await page.goto("/");

    await page
      .getByRole("button", {
        name: /1M Capability Universe$/i,
      })
      .click();

    await expect(
      page.getByRole("heading", {
        name: /1,000,000 governed capability scenarios/i,
      }),
    ).toBeVisible();

    const serialInput = page.getByTestId(
      "a000-serial-input",
    );
    await serialInput.fill("825251");
    await page.getByTestId("a000-lookup").click();

    const scenarioCard = page.getByTestId(
      "a000-scenario-card",
    );

    await expect(scenarioCard).toContainText(
      "KMITORA-0825251",
    );
    await expect(scenarioCard).toContainText(
      "KQA-000001",
    );
    await expect(scenarioCard).toContainText(
      "Autonomous QA orchestration",
    );
    await expect(scenarioCard).toContainText(
      "Production write: DENIED",
    );
    await expect(scenarioCard).toContainText(
      "Cutover: DENIED",
    );

    await page.getByTestId("a000-run-one").click();

    const outcome = page.getByTestId("a000-outcome");
    await expect(outcome).toContainText("PASS");
    await expect(outcome).toContainText(
      /Production write\s*false/i,
    );
    await expect(outcome).toContainText(
      /Cutover\s*false/i,
    );
    await expect(outcome).toContainText(
      /Policy bypass\s*false/i,
    );
    await expect(outcome).toContainText(
      /Rollback\/evidence\s*true/i,
    );

    await expect(
      page.getByTestId("a000-learning"),
    ).toContainText(
      "ELIGIBLE_FOR_VERIFIED_PROMOTION",
    );

    await page
      .getByTestId("a000-carry-lifecycle")
      .click();

    await expect(
      page.locator(".navItem.active"),
    ).toContainText("Understand");

    for (const stage of lifecycle) {
      await page
        .getByRole("button", {
          name: new RegExp(`${stage}$`, "i"),
        })
        .first()
        .click();

      const context = page.getByTestId(
        "a000-scenario-context",
      );

      await expect(context).toContainText(
        "KMITORA-0825251",
      );
      await expect(context).toContainText(
        "KQA-000001",
      );
      await expect(context).toContainText(
        /PROD DENIED/i,
      );
    }

    expect(pageErrors).toEqual([]);
  });

  test("final master serial maps to KQA-174750 through the UI", async ({
    page,
  }) => {
    await page.goto("/");

    await page
      .getByRole("button", {
        name: /1M Capability Universe$/i,
      })
      .click();

    await page
      .getByTestId("a000-serial-input")
      .fill("1000000");

    await page.getByTestId("a000-lookup").click();

    const scenarioCard = page.getByTestId(
      "a000-scenario-card",
    );

    await expect(scenarioCard).toContainText(
      "KMITORA-1000000",
    );
    await expect(scenarioCard).toContainText(
      "KQA-174750",
    );
    await expect(scenarioCard).toContainText(
      "Continuous certification",
    );
  });

  test("UI batch activation remains governed and bounded", async ({
    page,
  }) => {
    await page.goto("/");

    await page
      .getByRole("button", {
        name: /1M Capability Universe$/i,
      })
      .click();

    const start = page.getByLabel("Start serial");
    const end = page.getByLabel("End serial");

    await start.fill("825251");
    await end.fill("825260");

    await page
      .getByRole("button", {
        name: "Run Governed Batch",
      })
      .click();

    const result = page.getByTestId(
      "a000-batch-result",
    );

    await expect(result).toContainText(
      '"executed": 10',
    );
    await expect(result).toContainText(
      '"passed": 10',
    );
    await expect(result).toContainText(
      '"failed": 0',
    );
    await expect(result).toContainText(
      '"status": "PASS"',
    );
    await expect(result).toContainText(
      '"production_write_executed": false',
    );
    await expect(result).toContainText(
      '"production_cutover_executed": false',
    );
  });
});
