import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

async function load(page: Page, scale = 1) {
  const session = JSON.parse(
    readFileSync("examples/data/ball-toss.trksess", "utf8"),
  );
  for (const row of session.request.dataset.rows)
    if (row.y !== null) row.y *= scale;
  session.request.uncertainty.sigmaY *= scale;
  for (const parameter of session.settings.parameters) parameter.value *= scale;
  await page.goto("/");
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "comparison-source.trksess",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(session)),
    });
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await page
    .getByLabel("Analysis", { exact: true })
    .selectOption("model-comparison");
}

test("comparison drafts and results survive navigation and each staged source can be refreshed explicitly", async ({
  page,
}) => {
  await load(page);
  const workspace = page.locator(".model-comparison");
  const first = workspace.locator("fieldset").nth(0);
  const second = workspace.locator("fieldset").nth(1);
  await first.getByLabel("Label", { exact: true }).fill("My first fit");
  await second.getByLabel("Label", { exact: true }).fill("My second fit");
  await second.getByLabel("Candidate 2 model").selectOption("quartic");
  await page
    .getByRole("button", { name: "Refit and compare", exact: true })
    .click();
  await expect(workspace.getByRole("status")).toHaveText("Comparison complete");
  const before = await workspace
    .getByRole("table", { name: "Model comparison statistics" })
    .textContent();
  await page.getByLabel("Analysis", { exact: true }).selectOption("line");
  await expect(workspace).not.toBeVisible();
  // A new main dataset must not silently edit or discard staged comparisons.
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles("examples/data/sine-demo.trksess");
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  const discard = page.getByRole("button", {
    name: "Discard changes",
    exact: true,
  });
  if (await discard.isVisible()) await discard.click();
  await page
    .getByLabel("Analysis", { exact: true })
    .selectOption("model-comparison");
  await expect(first.getByLabel("Label", { exact: true })).toHaveValue(
    "My first fit",
  );
  await expect(second.getByLabel("Candidate 2 model")).toHaveValue("quartic");
  expect(
    await workspace
      .getByRole("table", { name: "Model comparison statistics" })
      .textContent(),
  ).toBe(before);
  await expect(first.locator(".comparison-source")).toContainText("Ball toss");
  await first
    .getByRole("button", { name: "Use current analysis", exact: true })
    .click();
  await expect(workspace.locator(".comparison-warning")).toBeVisible();
  await second
    .getByRole("button", { name: "Use current analysis", exact: true })
    .click();
  await expect(workspace.locator(".comparison-warning")).toHaveCount(0);
  await expect(
    workspace.getByRole("table", { name: "Model comparison statistics" }),
  ).toHaveCount(0);
  await expect(first.getByLabel("Candidate 1 model")).toHaveValue("sine");
  await expect(second.getByLabel("Candidate 2 model")).toHaveValue("sine");
  await page
    .getByRole("button", { name: "Refit and compare", exact: true })
    .click();
  await expect(workspace.getByRole("status")).toHaveText("Comparison complete");
});

test("comparison frames share their X scale, expose small residuals, and give hidden residual space to the data", async ({
  page,
}, testInfo) => {
  await load(page, 1e-8);
  await page
    .getByRole("button", { name: "Refit and compare", exact: true })
    .click();
  await expect(
    page.locator(".model-comparison").getByRole("status"),
  ).toHaveText("Comparison complete");
  for (const [width, height] of [
    [1440, 1000],
    [800, 700],
  ]) {
    await page.setViewportSize({ width, height });
    const geometry = await page
      .locator(".comparison-plot-wrap")
      .evaluate((wrapper) => {
        const plots = [...wrapper.querySelectorAll("svg")];
        const frames = plots.map((plot) =>
          plot.querySelector(".comparison-frame")!.getBoundingClientRect(),
        );
        const positions = [
          ...plots[1].querySelectorAll(
            ".comparison-residual-1,.comparison-residual-2",
          ),
        ].map((el) =>
          Number(el.getAttribute("cy") ?? Number(el.getAttribute("y")) + 2.7),
        );
        return {
          left: frames.map((frame) => frame.left),
          width: frames.map((frame) => frame.width),
          frameRatio: frames[0].height / frames[1].height,
          gapRatio: (frames[1].top - frames[0].bottom) / frames[0].height,
          span: Math.max(...positions) - Math.min(...positions),
          mainXLabels: plots[0].querySelectorAll('[data-axis-label="x"]')
            .length,
          residualXLabels: plots[1].querySelectorAll('[data-axis-label="x"]')
            .length,
        };
      });
    // Responsive SVG heights round to browser subpixels independently.
    expect(Math.abs(geometry.left[0] - geometry.left[1])).toBeLessThan(0.1);
    expect(Math.abs(geometry.width[0] - geometry.width[1])).toBeLessThan(0.1);
    expect(geometry.frameRatio).toBeCloseTo(3, 2);
    expect(geometry.gapRatio).toBeLessThan(0.08);
    expect(geometry.span).toBeGreaterThan(20);
    expect(geometry.mainXLabels).toBe(0);
    expect(geometry.residualXLabels).toBe(1);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator(".comparison-plot-wrap").screenshot({
    path: testInfo.outputPath("comparison-paired.png"),
  });
  const frame = page.locator(".comparison-plot .comparison-frame");
  const before = (await frame.boundingBox())!.height;
  await page.locator(".fit-settings-menu summary").click();
  await page
    .getByRole("checkbox", { name: "Show residual plots", exact: true })
    .uncheck();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("img", { name: "Compared residuals", exact: true }),
  ).toHaveCount(0);
  expect((await frame.boundingBox())!.height).toBeGreaterThan(before);
  await expect(
    page.locator('.comparison-plot [data-axis-label="x"]'),
  ).toHaveText("Time [s]");
  await page
    .locator(".model-comparison")
    .screenshot({ path: testInfo.outputPath("comparison-data-only.png") });
});
