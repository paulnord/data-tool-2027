import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { strFromU8, unzipSync } from "fflate";
import { fit } from "../src/core/fit/solve";
import { initialSettings, requestSchema } from "../src/core/fit/schema";

async function openComparison(page: Page) {
  await page.goto("/");
  await page
    .getByLabel("Analysis", { exact: true })
    .selectOption("model-comparison");
  const session = JSON.parse(
    readFileSync("examples/data/ball-toss.trksess", "utf8"),
  );
  session.request.uncertainty = {
    kind: "supplied-per-row",
    errorStructure: "uncorrelated",
    provenance: {
      kind: "user-asserted",
      description: "Comparison test uncertainties",
    },
    sigmaByRow: Object.fromEntries(
      session.request.dataset.rows.map((row: { id: string }, i: number) => [
        row.id,
        i < 20 ? 0.01 : 1,
      ]),
    ),
  };
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "weighted.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(session.request)),
    });
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  return requestSchema.parse(session.request);
}
async function compare(page: Page) {
  await page
    .getByRole("button", { name: "Refit and compare", exact: true })
    .click();
  await expect(
    page.locator(".model-comparison").getByRole("status"),
  ).toHaveText("Comparison complete");
}
async function downloadZip(page: Page, name: string, menu = true) {
  if (menu) await page.locator(".fit-export-menu summary").click();
  const pending = page.waitForEvent("download");
  await page
    .getByRole(menu ? "menuitem" : "button", { name, exact: true })
    .click();
  const downloaded = await pending;
  return unzipSync(new Uint8Array(await readFile((await downloaded.path())!)));
}

test("comparison opens directly with data, uses chosen uncertainties, and preserves custom fits in exports", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const request = await openComparison(page);
  const workspace = page.locator(".model-comparison");
  const plot = workspace.getByRole("img", {
    name: "Compared fitted curves",
    exact: true,
  });
  await expect(plot).toBeVisible();
  await expect(plot.locator(".comparison-point")).toHaveCount(
    request.dataset.rows.length,
  );
  await expect(
    workspace.getByLabel("Comparison Y uncertainty model"),
  ).toHaveValue("supplied-per-row");
  const columns = workspace.getByRole("group", {
    name: "Columns and uncertainty",
    exact: true,
  });
  await expect(
    columns.getByLabel("Comparison Y uncertainty model"),
  ).toBeVisible();
  await expect(
    workspace
      .locator(".comparison-shared-controls")
      .getByLabel("Comparison Y uncertainty model"),
  ).toHaveCount(0);
  await expect(workspace.locator(".comparison-weighting")).toContainText(
    "used in the fit",
  );
  await expect(
    workspace
      .getByRole("group", { name: "Candidate 1", exact: true })
      .getByLabel("Model equation"),
  ).toContainText("y = b + m x");
  await compare(page);
  const expected = fit(request, initialSettings("line"));
  await expect(
    workspace.getByLabel("Candidate 1 b value", { exact: true }),
  ).toHaveValue(String(expected.coefficients[0]));
  const weighted = await workspace
    .getByLabel("Candidate 1 b value", { exact: true })
    .inputValue();
  await workspace
    .getByRole("checkbox", { name: "Show y error bars (±1σ)", exact: true })
    .uncheck();
  await expect(
    workspace.getByLabel("Candidate 1 b value", { exact: true }),
  ).toHaveValue(weighted);
  await workspace
    .getByLabel("Comparison Y uncertainty model")
    .selectOption("unknown-equal");
  await expect(
    workspace.getByRole("table", {
      name: "Model comparison statistics",
      exact: true,
    }),
  ).toHaveCount(0);
  await compare(page);
  expect(
    await workspace
      .getByLabel("Candidate 1 b value", { exact: true })
      .inputValue(),
  ).not.toBe(weighted);
  await workspace
    .getByLabel("Comparison Y uncertainty model")
    .selectOption("supplied-per-row");
  await workspace
    .getByRole("tab", { name: "Candidate 2", exact: true })
    .click();
  await workspace
    .getByLabel("Candidate 2 model", { exact: true })
    .selectOption("custom");
  const editor = workspace.getByRole("group", {
    name: "Candidate 2",
    exact: true,
  });
  await editor.getByLabel("Custom equation", { exact: true }).fill("b+m*x");
  await expect(
    page.getByRole("button", { name: "Refit and compare", exact: true }),
  ).toBeDisabled();
  await editor
    .getByRole("button", { name: "Apply equation", exact: true })
    .click();
  await editor.getByLabel("Candidate 2 m unit", { exact: true }).fill("mH");
  await editor.getByLabel("Candidate 2 b value", { exact: true }).fill("1");
  await compare(page);
  for (const target of ["scipy", "root"] as const) {
    const files = await downloadZip(
      page,
      target === "scipy"
        ? "Python / SciPy analysis bundle (.zip)"
        : "C++ / ROOT analysis bundle (.zip)",
    );
    const base = `model-comparison-${target}`;
    const a = JSON.parse(strFromU8(files[`${base}/candidate-1/analysis.json`]));
    const b = JSON.parse(strFromU8(files[`${base}/candidate-2/analysis.json`]));
    expect(a.uncertainty.kind).toBe("supplied-per-row");
    expect(b.fit.customEquation.expression).toBe("b+m*x");
    expect(strFromU8(files[`${base}/candidate-1/data.csv`])).toBe(
      strFromU8(files[`${base}/candidate-2/data.csv`]),
    );
  }
  const pendingSession = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save session", exact: true }).click();
  const workspaceSession = JSON.parse(
    await readFile((await (await pendingSession).path())!, "utf8"),
  );
  expect(workspaceSession.version).toBe(7);
  const saved = workspaceSession.workspace.candidates[1].analysis;
  expect(saved.settings.custom.units).toContain("mH");
  expect(saved.request.dataset.rows).toEqual(request.dataset.rows);
  await workspace
    .getByRole("button", { name: "Add model", exact: true })
    .click();
  await compare(page);
  await expect(
    workspace
      .getByRole("table", { name: "Model comparison statistics", exact: true })
      .locator("tbody tr"),
  ).toHaveCount(3);
  await page.screenshot({
    path: testInfo.outputPath("comparison-workspace.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("comparison selection uses row identities, supports scaled drag gestures, and undoes shared exclusions", async ({
  page,
}) => {
  const request = await openComparison(page);
  const workspace = page.locator(".model-comparison");
  const plot = workspace.getByRole("img", {
    name: "Compared fitted curves",
    exact: true,
  });
  const firstId = request.dataset.rows[0].id;
  await plot.locator(`.comparison-point[data-row-id="${firstId}"]`).click();
  await expect(
    plot.locator(`.comparison-point[data-row-id="${firstId}"]`),
  ).toHaveAttribute("data-included", "false");
  await workspace
    .getByText("Observations & exclusions", { exact: false })
    .first()
    .click();
  await workspace
    .getByRole("button", { name: "Undo selection", exact: true })
    .click();
  await expect(
    plot.locator(`.comparison-point[data-row-id="${firstId}"]`),
  ).toHaveAttribute("data-included", "true");
  await page.locator(".fit-display-menu summary").click();
  await page.getByLabel("Display size", { exact: true }).selectOption("1.5");
  await page.keyboard.press("Escape");
  const points = await plot
    .locator(".comparison-point")
    .evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect();
        return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      }),
    );
  const xs = points.map((p) => p.x),
    ys = points.map((p) => p.y);
  await page.mouse.move(Math.min(...xs) - 2, Math.min(...ys) - 2);
  await page.mouse.down();
  await page.mouse.move(
    (Math.min(...xs) + Math.max(...xs)) / 2,
    Math.max(...ys) + 2,
    { steps: 12 },
  );
  await page.mouse.up();
  const selected = await plot.locator('[data-included="true"]').count();
  expect(selected).toBeGreaterThan(0);
  expect(selected).toBeLessThan(request.dataset.rows.length);
  await compare(page);
  const table = workspace.getByRole("table", {
    name: "Model comparison statistics",
    exact: true,
  });
  const counts = await table
    .locator("tbody tr")
    .evaluateAll((rows) =>
      rows.map((row) => row.querySelector("td")?.textContent),
    );
  expect(counts).toEqual([String(selected), String(selected)]);
  await workspace
    .getByRole("button", { name: "Undo selection", exact: true })
    .click();
  await expect(plot.locator('[data-included="true"]')).toHaveCount(
    request.dataset.rows.length,
  );
});
