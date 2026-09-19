import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const reference: {
  fixtures: { model: string; x: number[]; y: number[]; start: number[] }[];
} = JSON.parse(readFileSync("tests/fit/extended-model-reference.json", "utf8"));
import { syntheticRequest } from "../tests/support/synthetic";
import {
  initialSettings,
  sessionEngine,
  type FitSettings,
} from "../src/core/fit/schema";

test("polynomial family and degree selector are shared by main, comparison and intervals", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles("examples/data/ball-toss.trksess");
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  const main = page.getByLabel("Model", { exact: true });
  await expect(main.locator('option[value="exponential"]')).toHaveCount(0);
  await expect(main.locator('option[value="sine"]')).toHaveCount(0);
  expect(
    await main
      .locator("option")
      .evaluateAll((options) =>
        options.slice(0, 3).map((o) => (o as HTMLOptionElement).value),
      ),
  ).toEqual(["line", "polynomial", "custom"]);
  await main.selectOption("polynomial");
  const degree = page.getByLabel("Model polynomial degree", { exact: true });
  await expect(degree.locator("option")).toHaveCount(9);
  await degree.selectOption("polynomial-10");
  await expect(page.getByLabel("c10 value", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Edit as custom equation", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Fit selected observations", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Fit complete");
  const tools = page.getByLabel("Analysis tools", { exact: true });
  await expect(main.locator('option[value="model-comparison"]')).toHaveCount(0);
  await expect(main.locator('option[value="multi-interval"]')).toHaveCount(0);
  await expect(main.locator('option[value="collision"]')).toHaveCount(0);
  expect(
    await tools
      .locator("option")
      .evaluateAll((options) =>
        options.map((option) => (option as HTMLOptionElement).value),
      ),
  ).toEqual(["single-fit", "model-comparison", "multi-interval", "collision"]);
  await tools.selectOption("model-comparison");
  await expect(tools).toBeFocused();
  const candidate = page.getByLabel("Candidate 1 model", { exact: true });
  await expect(candidate).toHaveValue("polynomial");
  await expect(
    page.getByLabel("Candidate 1 model polynomial degree", { exact: true }),
  ).toHaveValue("polynomial-10");
  await tools.selectOption("multi-interval");
  await expect(tools).toBeFocused();
  await page
    .getByLabel("Interval equation", { exact: true })
    .selectOption("polynomial");
  await page
    .getByLabel("Interval equation polynomial degree", { exact: true })
    .selectOption("polynomial-10");
  await expect(page.locator(".interval-equation-preview")).toContainText(
    "c₁₀ x¹⁰",
  );
  await tools.selectOption("collision");
  await expect(tools).toBeFocused();
  await tools.selectOption("single-fit");
  await expect(tools).toBeFocused();
  await expect(main).toHaveValue("polynomial");
  await expect(degree).toHaveValue("polynomial-10");
});

for (const model of ["exponential-growth", "sigmoid"] as const)
  test(`${model} fits, fixes shape, saves v7 and reopens without changing the equation`, async ({
    page,
  }) => {
    const fixture = reference.fixtures.find((f) => f.model === model)!;
    const request = syntheticRequest(),
      settings = initialSettings(model);
    request.dataset.rows = fixture.x.map((x, i) => ({
      id: String(i),
      x,
      y: fixture.y[i],
      included: true,
      missingReason: null,
    }));
    settings.parameters = fixture.start.map((value) => ({
      value,
      fixed: false,
    }));
    const session = {
      workspace: { kind: "single-fit" },
      view: { showResiduals: true, showGuides: false, showErrorBars: true },
      format: "tracker-fit-session",
      version: 7,
      engine: sessionEngine(settings),
      settings,
      request,
    };
    await page.goto("/");
    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles({
        name: "model.trksess",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(session)),
      });
    await page
      .getByRole("button", { name: "Use these data", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Fit selected observations", exact: true })
      .click();
    await expect(page.getByRole("status")).toHaveText("Fit complete");
    const shape = model === "sigmoid" ? "w" : "tau";
    await page.getByLabel(`Fix ${shape}`, { exact: true }).check();
    const downloaded = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Save session", exact: true })
      .click();
    const bytes = readFileSync((await (await downloaded).path())!);
    expect(JSON.parse(bytes.toString()).version).toBe(7);
    await page.locator('input[type="file"]').first().setInputFiles({
      name: "saved.trksess",
      mimeType: "application/json",
      buffer: bytes,
    });
    await page
      .getByRole("button", { name: "Use these data", exact: true })
      .click();
    await expect(page.getByLabel("Model", { exact: true })).toHaveValue(model);
    await expect(
      page.getByLabel(`Fix ${shape}`, { exact: true }),
    ).toBeChecked();
  });

test("reference symbols are absent from built-in equations and reports; old fixed-rate sessions stay editable", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles("examples/data/ball-toss.trksess");
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  for (const model of [
    "logarithmic",
    "reciprocal",
    "power-law",
    "power-law-free",
  ] as const) {
    await page.getByLabel("Model", { exact: true }).selectOption(model);
    await expect(page.locator("body")).not.toContainText("xref");
  }
  await page.getByLabel("Model", { exact: true }).selectOption("reciprocal");
  await expect(page.locator(".fit-equation")).toHaveText("y = b + a/x");
  await expect(page.locator('label[for="parameter-a"]')).toContainText("·");
  const settings: FitSettings = initialSettings("exponential"),
    request = syntheticRequest();
  settings.shape = 0.4;
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "legacy.trksess",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          workspace: { kind: "single-fit" },
          view: { showResiduals: true, showGuides: false, showErrorBars: true },
          format: "tracker-fit-session",
          version: 7,
          engine: sessionEngine(settings),
          settings,
          request,
        }),
      ),
    });
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  const discard = page.getByRole("button", {
    name: "Discard changes",
    exact: true,
  });
  if (await discard.isVisible()) await discard.click();
  await expect(page.getByLabel("Supplied shape", { exact: true })).toHaveValue(
    "0.4",
  );
  await expect(page.getByLabel("Model", { exact: true })).toHaveValue(
    "exponential",
  );
});
