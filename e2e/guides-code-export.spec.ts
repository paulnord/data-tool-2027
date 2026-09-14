import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { strFromU8, unzipSync } from "fflate";

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

test("exports a CSV-backed SciPy and ROOT analysis bundle", async ({
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
  const pending = page.waitForEvent("download");
  await page
    .getByRole("menuitem", {
      name: "SciPy / ROOT analysis bundle (.zip)",
      exact: true,
    })
    .click();
  const download = await pending;
  expect(download.suggestedFilename()).toMatch(/-analysis-bundle\.zip$/);
  const bytes = await readFile((await download.path())!);
  const archive = unzipSync(new Uint8Array(bytes));
  const files = Object.fromEntries(
    Object.entries(archive).map(([path, contents]) => [
      path.replace(/^[^/]+\//, ""),
      strFromU8(contents),
    ]),
  );
  expect(Object.keys(files).sort()).toEqual([
    "README.md",
    "analysis.json",
    "data.csv",
    "fit_root.C",
    "fit_scipy.py",
  ]);

  expect(files["data.csv"]).toMatch(
    /^row_id,x,y,sigma,included,missing_reason\r?\n/,
  );
  const metadata = JSON.parse(files["analysis.json"]);
  expect(metadata).toMatchObject({
    format: "data-tool-analysis-bundle",
    version: 1,
    fit: { model: "damped-sine" },
    view: { showGuides: true },
  });

  const python = files["fit_scipy.py"];
  expect(python).toContain("from scipy.optimize import curve_fit");
  expect(python).toContain("reader = csv.DictReader(handle)");
  expect(python).not.toContain("x_all = np.array([");
  expect(python).toContain("envelope = amplitude*np.exp");
  expect(python).toContain("fig.savefig");

  const root = files["fit_root.C"];
  expect(root).toContain("std::ifstream input(csv_path)");
  expect(root).not.toContain("const std::vector<double> x_all = {");
  expect(root).toContain("ROOT::Fit::Fitter fitter");
  expect(root).toContain("TFitResult fit_result = run_fit()");
  expect(root).toContain("upper_envelope");
  expect(root).toContain("TGraphErrors residuals");
  expect(root).toContain("TFile output(");
  expect(files["README.md"]).toContain("--data another-run.csv");
});
