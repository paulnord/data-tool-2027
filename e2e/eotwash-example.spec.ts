import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("gravity session opens all four comparison models with Advanced off", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles("examples/data/published/eotwash-model-comparison.trksess");
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await expect(page.getByLabel("Analysis tools", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Back to single fit", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Refit and compare", exact: true })
    .click();
  await expect(
    page.locator(".model-comparison").getByRole("status"),
  ).toHaveText("Comparison complete");
  const rows = page
    .getByRole("table", { name: "Model comparison statistics", exact: true })
    .locator("tbody tr");
  await expect(rows).toHaveCount(4);
  for (let i = 0; i < 4; i++) {
    const cells = rows.nth(i).locator("td");
    await expect(cells.nth(0)).toHaveText("87");
    await expect(cells.nth(1)).toHaveText(String([86, 85, 85, 84][i]));
    expect(
      Number((await cells.nth(7).innerText()).replace("−", "-")),
    ).toBeCloseTo([-571.339478, -572.788657, -584.123219, -582.127278][i], 1);
  }
  const statistics = await rows.allTextContents();
  const plot = page.locator(
    ".comparison-workspace > .comparison-plot-wrap .comparison-plot",
  );
  await page.getByLabel("Comparison X axis", { exact: true }).click();
  await page.getByLabel("Comparison X minimum", { exact: true }).fill("0.06");
  await page.getByLabel("Comparison X maximum", { exact: true }).fill("0.5");
  await page
    .getByRole("button", { name: "Apply range", exact: true })
    .filter({ visible: true })
    .click();
  await expect(plot).toHaveAttribute("data-x-min", "0.06");
  await expect(plot).toHaveAttribute("data-x-max", "0.5");
  await page
    .locator(".comparison-workspace > .comparison-plot-wrap")
    .getByLabel("Log X", { exact: true })
    .check();
  await expect(plot).toHaveAttribute("data-x-scale", "log");
  await page.getByLabel("Comparison Y axis", { exact: true }).click();
  await page.getByLabel("Comparison Y minimum", { exact: true }).fill("-0.02");
  await page.getByLabel("Comparison Y maximum", { exact: true }).fill("0.02");
  await page
    .getByRole("button", { name: "Apply range", exact: true })
    .filter({ visible: true })
    .click();
  await expect(plot).toHaveAttribute("data-y-min", "-0.02");
  await expect(plot).toHaveAttribute("data-y-max", "0.02");
  await page
    .locator(".comparison-workspace > .comparison-plot-wrap")
    .getByLabel("Log Y", { exact: true })
    .check();
  await expect(plot).toHaveAttribute("data-y-scale", "log");
  await expect(
    page.getByText(/nonpositive observation\(s\) cannot be shown/),
  ).toBeVisible();
  expect(await rows.allTextContents()).toEqual(statistics);
  expect(
    await plot
      .locator("circle")
      .evaluateAll((points) =>
        points.every(
          (point) =>
            Number.isFinite(Number(point.getAttribute("cx"))) &&
            Number.isFinite(Number(point.getAttribute("cy"))),
        ),
      ),
  ).toBe(true);
});
