import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { syntheticRequest } from "../tests/support/synthetic";
import { initialSettings, sessionEngine } from "../src/core/fit/schema";
const reference: {
  cases: { x: number[]; y: number[]; sigma: number; start: number[] }[];
} = JSON.parse(readFileSync("tests/fit/peak-shape-reference.json", "utf8"));

function peakSession() {
  const c = reference.cases[0],
    request = syntheticRequest(),
    settings = initialSettings("gaussian");
  request.dataset.label = "Adjustable peak";
  request.dataset.rows = c.x.map((x, i) => ({
    id: String(i),
    x,
    y: c.y[i],
    included: true,
    missingReason: null,
  }));
  request.uncertainty = {
    kind: "supplied-common",
    errorStructure: "uncorrelated",
    sigmaY: c.sigma,
    provenance: { kind: "user-asserted", description: "Independent reference" },
  };
  settings.parameters = c.start
    .slice(0, 4)
    .map((value) => ({ value, fixed: false }));
  return {
    workspace: { kind: "single-fit" },
    view: { showResiduals: true, showGuides: false, showErrorBars: true },
    format: "tracker-fit-session",
    version: 7,
    engine: sessionEngine(settings),
    request,
    settings,
  };
}
async function load(page: Page, session = peakSession(), dataOnly = false) {
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: dataOnly ? "observations.json" : "peak.trksess",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(dataOnly ? session.request : session)),
    });
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
}
async function run(page: Page) {
  await page
    .getByRole("button", { name: "Fit selected observations", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Fit complete");
}
test("Gaussian shape controls fit, save v7, reopen, and return to ordinary Gaussian", async ({
  page,
}, info) => {
  await page.goto("/");
  await load(page);
  await expect(
    page.getByLabel("Allow skew", { exact: true }),
  ).not.toBeChecked();
  await expect(
    page.getByLabel("Adjust tail shape (kurtosis)", { exact: true }),
  ).not.toBeChecked();
  await page.getByLabel("Allow skew", { exact: true }).check();
  await expect(page.getByLabel("Fix tail", { exact: true })).toBeChecked();
  await page
    .getByLabel("Adjust tail shape (kurtosis)", { exact: true })
    .check();
  await page.getByLabel("skew value", { exact: true }).fill("0.36");
  await page.getByLabel("tail value", { exact: true }).fill("0.88");
  await run(page);
  const derived = page.getByRole("table", {
    name: "Derived peak quantities",
    exact: true,
  });
  await expect(derived).toContainText("1.3475");
  await expect(derived).toContainText("2.46669");
  await page.screenshot({
    path: info.outputPath("peak-shape-main.png"),
    fullPage: true,
  });
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save session", exact: true }).click();
  const bytes = readFileSync((await (await pending).path())!);
  const saved = JSON.parse(bytes.toString());
  expect(saved.version).toBe(7);
  expect(
    saved.settings.parameters.filter((p: { fixed: boolean }) => !p.fixed),
  ).toHaveLength(6);
  expect(saved.request.dataset.rows).toEqual(
    peakSession().request.dataset.rows,
  );
  await load(page, saved);
  await expect(page.getByLabel("Allow skew", { exact: true })).toBeChecked();
  await run(page);
  await page
    .getByLabel("Analysis", { exact: true })
    .selectOption("model-comparison");
  await expect(
    page.getByLabel("Candidate 1 Allow skew", { exact: true }),
  ).toBeChecked();
  await page.getByLabel("Analysis", { exact: true }).selectOption("gaussian");
  await expect(page.getByLabel("Allow skew", { exact: true })).toBeChecked();
  await page.getByLabel("Allow skew", { exact: true }).uncheck();
  await page
    .getByLabel("Adjust tail shape (kurtosis)", { exact: true })
    .uncheck();
  await expect(page.getByLabel("sigma value", { exact: true })).toBeVisible();
  await expect(page.getByLabel("tail value", { exact: true })).toHaveCount(0);
});

test("comparison retains peak controls, guides, moments and candidate session exports", async ({
  page,
}, info) => {
  await page.goto("/");
  await load(page);
  await page
    .getByLabel("Analysis", { exact: true })
    .selectOption("model-comparison");
  await page.getByLabel("Candidate 1 Allow skew", { exact: true }).check();
  await page
    .getByLabel("Candidate 1 Adjust tail shape (kurtosis)", { exact: true })
    .check();
  await page.getByLabel("Candidate 1 skew value", { exact: true }).fill("0.36");
  await page.getByLabel("Candidate 1 tail value", { exact: true }).fill("0.88");
  await page
    .getByRole("button", { name: "Refit and compare", exact: true })
    .click();
  const workspace = page.locator(".model-comparison");
  await expect(workspace.getByRole("status")).toHaveText("Comparison complete");
  await workspace.locator(".comparison-individual-results > summary").click();
  await expect(
    workspace.getByRole("table", {
      name: "Current analysis derived quantities",
      exact: true,
    }),
  ).toContainText("2.46669");
  await page.locator(".fit-settings-menu summary").click();
  await page
    .getByLabel("Show fit guides when available", { exact: true })
    .check();
  await page.locator(".fit-settings-menu summary").click();
  await expect(
    workspace.getByLabel("Fit guide labels", { exact: true }),
  ).toContainText("μ");
  await page.screenshot({
    path: info.outputPath("peak-shape-comparison.png"),
    fullPage: true,
  });
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", {
      name: "Save session",
      exact: true,
    })
    .click();
  const restored = JSON.parse(
    readFileSync((await (await pending).path())!, "utf8"),
  );
  expect(restored.version).toBe(7);
  const saved = restored.workspace.candidates[0].analysis;
  expect(saved.version).toBeUndefined();
  expect(saved.settings.model).toBe("gaussian-shape");
});

test("new data confirmation is visible over comparison and updates every candidate only after acceptance", async ({
  page,
}) => {
  await page.goto("/");
  await load(page);
  await page
    .getByLabel("Analysis", { exact: true })
    .selectOption("model-comparison");
  await page.getByLabel("Candidate 1 Allow skew", { exact: true }).check();
  await page
    .getByRole("button", { name: "Refit and compare", exact: true })
    .click();
  const workspace = page.locator(".model-comparison");
  await expect(workspace.getByRole("status")).toHaveText("Comparison complete");
  const next = peakSession();
  next.request.dataset.label = "New observations";
  next.request.dataset.rows = next.request.dataset.rows
    .slice(0, 90)
    .map((r) => ({ ...r, y: r.y! + 10 }));
  next.request.uncertainty.sigmaY = 0.1;
  await load(page, next, true);
  const confirm = page.getByRole("alertdialog", {
    name: "Unsaved analysis changes",
  });
  await expect(confirm).toBeInViewport();
  await expect(confirm).toContainText("every comparison candidate");
  await confirm.getByRole("button", { name: "Keep working" }).click();
  await expect(workspace.locator(".comparison-point")).toHaveCount(131);
  await expect(
    workspace.getByRole("table", { name: "Model comparison statistics" }),
  ).toBeVisible();
  await load(page, next, true);
  await confirm.getByRole("button", { name: "Discard changes" }).click();
  await expect(page.getByLabel("Analysis", { exact: true })).toHaveValue(
    "model-comparison",
  );
  await expect(workspace.locator(".comparison-point")).toHaveCount(90);
  for (const source of await workspace.locator(".comparison-source").all())
    await expect(source).toContainText("New observations");
  await expect(
    page.getByLabel("Candidate 1 Allow skew", { exact: true }),
  ).toBeChecked();
  await expect(
    workspace.getByRole("table", { name: "Model comparison statistics" }),
  ).toHaveCount(0);
  await expect(
    workspace.getByLabel("Comparison Y uncertainty model"),
  ).toHaveValue("supplied-common");
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "invalid.trksess",
      mimeType: "application/json",
      buffer: Buffer.from("{}"),
    });
  await expect(workspace.locator(".comparison-point")).toHaveCount(90);
});

test("interval peaks share shape controls and report derived moments", async ({
  page,
}) => {
  await page.goto("/");
  await load(page);
  await page
    .getByLabel("Analysis", { exact: true })
    .selectOption("multi-interval");
  await page
    .getByLabel("Interval equation", { exact: true })
    .selectOption("gaussian");
  await page.getByLabel("Interval from", { exact: true }).fill("-6");
  await page.getByLabel("Interval to", { exact: true }).fill("7");
  await page.getByLabel("Interval Allow skew", { exact: true }).check();
  await page
    .getByLabel("Interval Adjust tail shape (kurtosis)", { exact: true })
    .check();
  for (const [i, name] of ["b", "A", "mu", "w", "skew", "tail"].entries())
    await page
      .getByLabel(name + " interval value", { exact: true })
      .fill(String(reference.cases[0].start[i]));
  await page
    .getByRole("button", { name: "Fit Interval 1", exact: true })
    .click();
  await expect(
    page
      .getByRole("region", { name: "Multi-interval analysis", exact: true })
      .getByRole("status"),
  ).toHaveText("Interval 1: 1 of 1 data series fitted");
  await expect(
    page.getByRole("table", { name: /derived peak quantities/ }),
  ).toContainText("2.46669");
});

test("Lorentzian CSV retains original uncertainties when loaded into comparison", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Analysis", { exact: true })
    .selectOption("model-comparison");
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles("examples/data/lorentzian.csv");
  await page.getByLabel("sigma column", { exact: true }).selectOption("2");
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  const workspace = page.locator(".model-comparison");
  await expect(
    workspace.getByLabel("Comparison Y uncertainty model"),
  ).toHaveValue("supplied-per-row");
  await expect(workspace.locator(".comparison-point")).toHaveCount(81);
  await page
    .getByLabel("Candidate 1 model", { exact: true })
    .selectOption("lorentzian");
  await page
    .getByRole("button", { name: "Refit and compare", exact: true })
    .click();
  await expect(workspace.getByRole("status")).toHaveText("Comparison complete");
  await expect(
    workspace.getByRole("table", {
      name: "Model comparison statistics",
      exact: true,
    }),
  ).toContainText("0.8029819");
});
