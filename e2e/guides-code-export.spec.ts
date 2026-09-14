import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function openDamped(page: Page) {
  await page.goto("/");
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles("examples/data/damped-sine.csv");
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await page
    .getByLabel("Analysis", { exact: true })
    .selectOption("damped-sine");
  await page
    .getByRole("button", { name: "Fit selected observations", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Fit complete");
}

test("damped guides stay optional and derived quantities carry through print and SVG", async ({
  page,
}) => {
  await openDamped(page);
  await expect(
    page.getByRole("table", { name: "Derived oscillation quantities" }),
  ).toContainText("Amplitude A");
  await expect(
    page.getByRole("table", { name: "Derived oscillation quantities" }),
  ).toContainText("Frequency f");
  const plot = page.locator(
    '.fit-chart svg[aria-label="Data and fitted curve"]',
  );
  await expect(plot.locator(".model-guide")).toHaveCount(0);
  await page.locator(".fit-settings-menu summary").click();
  await page
    .getByRole("checkbox", {
      name: "Show fit guides when available",
      exact: true,
    })
    .check();
  await page.keyboard.press("Escape");
  await expect(plot.locator(".model-guide")).toHaveCount(3);
  await expect(
    plot.locator('[aria-label="Fitted baseline y = b"]'),
  ).toHaveCount(1);

  await page.locator(".fit-export-menu summary").click();
  const pending = page.waitForEvent("download");
  await page
    .getByRole("menuitem", { name: "SVG vector graphic", exact: true })
    .click();
  const svg = await readFile((await (await pending).path())!, "utf8");
  expect(svg).toContain("Fitted baseline y = b");
  expect(svg).toContain("stroke-dasharray");

  await page.getByRole("button", { name: "Print", exact: true }).click();
  const preview = page.getByRole("dialog", { name: "Print report" });
  await expect(
    preview.getByRole("table", {
      name: "Print derived oscillation quantities",
    }),
  ).toContainText("Phase φ");
  await expect(preview.locator(".model-guide")).toHaveCount(3);
});

test("exports readable SciPy and ROOT programs from the fitted view", async ({
  page,
}) => {
  await openDamped(page);
  await page.locator(".fit-settings-menu summary").click();
  await page
    .getByRole("checkbox", {
      name: "Show fit guides when available",
      exact: true,
    })
    .check();
  await page.keyboard.press("Escape");

  await page.locator(".fit-export-menu summary").click();
  let pending = page.waitForEvent("download");
  await page
    .getByRole("menuitem", { name: "Python / SciPy script", exact: true })
    .click();
  let download = await pending;
  expect(download.suggestedFilename()).toMatch(/-scipy\.py$/);
  const python = await readFile((await download.path())!, "utf8");
  expect(python).toContain("from scipy.optimize import curve_fit");
  expect(python).toContain("data_tool_fit = np.array");
  expect(python).toContain("envelope = amplitude*np.exp");
  expect(python).toContain("fig.savefig");

  await page.locator(".fit-export-menu summary").click();
  pending = page.waitForEvent("download");
  await page
    .getByRole("menuitem", { name: "C++ / ROOT macro", exact: true })
    .click();
  download = await pending;
  expect(download.suggestedFilename()).toMatch(/^data_tool_.*_root\.C$/);
  const root = await readFile((await download.path())!, "utf8");
  expect(root).toContain("TFitResultPtr fit_result");
  expect(root).toContain("upper_envelope");
  expect(root).toContain("TGraphErrors residuals");
  expect(root).toContain("TFile output(");
});
