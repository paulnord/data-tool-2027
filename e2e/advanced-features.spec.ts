import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.use({ storageState: { cookies: [], origins: [] } });

async function loadExample(page: Page) {
  await page.goto("/");
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles("examples/data/ball-toss.trksess");
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
}

async function advancedCheckbox(page: Page) {
  const menu = page.locator(".fit-settings-menu");
  if (!(await menu.evaluate((element) => (element as HTMLDetailsElement).open)))
    await menu.locator("summary").click();
  return page.getByLabel("Show advanced models and analysis tools", {
    exact: true,
  });
}

test("advanced models and tools are device-only opt-ins", async ({ page }) => {
  await loadExample(page);

  const tools = page.getByLabel("Analysis tools", { exact: true });
  const models = page.getByLabel("Model", { exact: true });
  await expect(tools.locator("option")).toHaveCount(1);
  await expect(
    page.getByText("More analyses: Settings → Advanced features", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(models.locator('option[value="power-law-free"]')).toHaveCount(1);
  for (const model of [
    "custom",
    "power-law",
    "reciprocal",
    "logarithmic",
    "sigmoid",
    "fourier",
  ])
    await expect(models.locator(`option[value="${model}"]`)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Edit as custom equation", exact: true }),
  ).toHaveCount(0);

  await models.selectOption("line");
  await page
    .getByRole("button", { name: "Fit selected observations", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Fit complete");

  await models.selectOption("gaussian");
  await expect(page.getByLabel("Allow skew", { exact: true })).toHaveCount(0);

  const advanced = await advancedCheckbox(page);
  await expect(advanced).not.toBeChecked();
  await advanced.check();
  await expect(tools.locator("option")).toHaveCount(4);
  await expect(
    page.getByText("More analyses: Settings → Advanced features", {
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(models.locator('option[value="custom"]')).toHaveCount(1);
  await expect(models.locator('option[value="fourier"]')).toHaveCount(1);
  await expect(page.getByLabel("Allow skew", { exact: true })).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(await advancedCheckbox(page)).toBeChecked();
});

test("turning the opt-in off preserves an active advanced analysis", async ({
  page,
}) => {
  await loadExample(page);
  const advanced = await advancedCheckbox(page);
  await advanced.check();
  await page.locator(".fit-settings-menu summary").click();

  await page.getByLabel("Model", { exact: true }).selectOption("custom");
  const tools = page.getByLabel("Analysis tools", { exact: true });
  await tools.selectOption("model-comparison");
  await expect(
    page.getByLabel("Candidate 1 model", { exact: true }),
  ).toHaveValue("custom");

  await (await advancedCheckbox(page)).uncheck();
  await expect(tools).toHaveValue("model-comparison");
  await expect(
    page.getByText("More analyses: Settings → Advanced features", {
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(tools.locator('option[value="model-comparison"]')).toHaveCount(
    1,
  );
  await expect(tools.locator('option[value="multi-interval"]')).toHaveCount(0);
  await expect(
    page.getByLabel("Candidate 1 model", { exact: true }),
  ).toHaveValue("custom");
  await expect(
    page
      .locator("fieldset:not([hidden])")
      .getByLabel("Custom equation", { exact: true }),
  ).toBeVisible();

  await tools.selectOption("single-fit");
  await expect(tools.locator("option")).toHaveCount(1);
  await expect(
    page.getByText("More analyses: Settings → Advanced features", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Model", { exact: true })).toHaveValue("custom");
  await expect(
    page
      .locator("aside.fit-controls")
      .getByLabel("Custom equation", { exact: true }),
  ).toBeVisible();
});

test("an advanced session reopens on an opted-out device", async ({
  page,
  browser,
}) => {
  await loadExample(page);
  const advanced = await advancedCheckbox(page);
  await advanced.check();
  await page.locator(".fit-settings-menu summary").click();
  await page.getByLabel("Model", { exact: true }).selectOption("fourier");
  await page.getByLabel("Fourier harmonics", { exact: true }).selectOption("2");

  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save session", exact: true }).click();
  const download = await downloading;
  const session = await readFile((await download.path())!);

  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const fresh = await context.newPage();
  await fresh.goto(new URL("/", page.url()).href);
  await fresh.locator('input[type="file"]').first().setInputFiles({
    name: "advanced-fourier.trksess",
    mimeType: "application/json",
    buffer: session,
  });
  await fresh
    .getByRole("button", { name: "Use these data", exact: true })
    .click();

  await expect(await advancedCheckbox(fresh)).not.toBeChecked();
  await expect(fresh.getByLabel("Model", { exact: true })).toHaveValue(
    "fourier",
  );
  await expect(
    fresh.getByLabel("Fourier harmonics", { exact: true }),
  ).toHaveValue("2");
  await expect(fresh.getByLabel("s2 value", { exact: true })).toBeVisible();
  await context.close();
});
