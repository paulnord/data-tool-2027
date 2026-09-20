import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";

const cavendish = "examples/data/cavendish/cavendish-multi-interval.trksess";
async function load(page: Page, file: string | object) {
  await page.goto("/");
  await review(page, file);
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
}
async function review(page: Page, file: string | object) {
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles(
      typeof file === "string"
        ? file
        : {
            name: "workspace.trksess",
            mimeType: "application/json",
            buffer: Buffer.from(JSON.stringify(file)),
          },
    );
}
async function save(page: Page) {
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save session", exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.trksess$/);
  return JSON.parse(await readFile((await file.path())!, "utf8"));
}
async function settings(page: Page, label: string, checked: boolean) {
  await page.locator(".fit-settings-menu summary").click();
  await page.getByLabel(label, { exact: true }).setChecked(checked);
  await page.locator(".fit-settings-menu summary").click();
}
test("retired session versions are rejected without replacing the current interval setup", async ({
  page,
}) => {
  await load(page, cavendish);
  await page.getByLabel("Interval from", { exact: true }).fill("100");
  const current = JSON.parse(
    readFileSync("examples/data/ball-toss.trksess", "utf8"),
  );
  for (const version of [1, 2, 3, 4, 5, 6, 8]) {
    await review(page, { ...current, version });
    await expect(page.locator(".fit-error")).toContainText(
      "This build opens session version 7 only",
    );
    await expect(
      page.getByRole("button", { name: "Use these data", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByLabel("Analysis tools", { exact: true }),
    ).toHaveValue("multi-interval");
    await expect(page.getByLabel("Interval from", { exact: true })).toHaveValue(
      "100",
    );
  }
});
test("single-fit sessions preserve view preferences and protect unsaved view changes", async ({
  page,
}) => {
  await load(page, "examples/data/ball-toss.trksess");
  await save(page);
  const unsaved = () =>
    page.evaluate(() => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    });
  expect(await unsaved()).toBe(false);
  await settings(page, "Show residual plots", false);
  expect(await unsaved()).toBe(true);
  await settings(page, "Show fit guides when available", true);
  const saved = await save(page);
  expect(saved.workspace).toEqual({ kind: "single-fit" });
  expect(saved.view).toEqual({
    showResiduals: false,
    showGuides: true,
    showErrorBars: true,
  });
  expect(await unsaved()).toBe(false);
  await load(page, cavendish);
  await review(page, saved);
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await expect(page.getByLabel("Model", { exact: true })).toHaveValue(
    saved.settings.model,
  );
  await expect(page.getByLabel("Analysis tools", { exact: true })).toHaveValue(
    "single-fit",
  );
  expect(await save(page)).toEqual(saved);
});
test("changing columns during session review validates the resulting analysis and solver", async ({
  page,
}) => {
  await load(page, cavendish);
  await review(page, "examples/data/published/ba137m-decay.trksess");
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await page.getByLabel("X analysis column", { exact: true }).selectOption("1");
  await page.getByLabel("Y analysis column", { exact: true }).selectOption("0");
  await expect(page.getByLabel("Model", { exact: true })).toHaveValue("line");
  await expect(page.getByLabel("Analysis tools", { exact: true })).toHaveValue(
    "single-fit",
  );
  const saved = await save(page);
  expect(saved.version).toBe(7);
  expect(saved.engine).toBe("qr-vp-sine-2");
  expect(saved.request.dataset.rows[0]).toMatchObject({ x: 173.8, y: 0 });
  expect(saved.dataTable.x).toBe(1);
  expect(saved.dataTable.y).toBe(0);
});
test("Cavendish session opens both intervals in seconds and saves a complete restorable workspace", async ({
  page,
  context,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await load(page, cavendish);
  const workspace = page.getByRole("region", {
    name: "Multi-interval analysis",
    exact: true,
  });
  await expect(workspace).toBeVisible();
  await expect(
    page.getByLabel("Interval X column", { exact: true }),
  ).toHaveValue("5");
  await expect(page.getByLabel("Interval from", { exact: true })).toHaveValue(
    "0",
  );
  await expect(page.getByLabel("Interval to", { exact: true })).toHaveValue(
    "1400",
  );
  await expect(
    workspace.getByRole("table", { name: /parameters$/ }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Fit Oscillation 1", exact: true })
    .click();
  await expect(workspace.getByRole("status")).toHaveText(
    "Oscillation 1: fit complete",
  );
  await page.getByRole("button", { name: /^Oscillation 2$/ }).click();
  await expect(page.getByLabel("Interval from", { exact: true })).toHaveValue(
    "1800",
  );
  await page
    .getByRole("button", { name: "Fit Oscillation 2", exact: true })
    .click();
  await expect(workspace.getByRole("status")).toHaveText(
    "Oscillation 2: fit complete",
  );
  await expect(
    workspace.getByRole("table", { name: /parameters$/ }),
  ).toHaveCount(2);
  await expect(
    workspace.getByLabel("Fit guide labels", { exact: true }),
  ).toContainText("0.615553");
  await expect(
    workspace.getByLabel("Fit guide labels", { exact: true }),
  ).toContainText("0.824980");
  await page.screenshot({
    path: info.outputPath("cavendish-workspace.png"),
    fullPage: true,
  });
  await page.getByLabel("Fix interval T", { exact: true }).check();
  await page.getByLabel("T interval value", { exact: true }).fill("640");
  await settings(page, "Show residual plots", false);
  for (const [axis, lo, hi] of [
    ["X", "-100", "4700"],
    ["Y", "-0.1", "1.5"],
  ]) {
    await workspace.getByLabel(`x ${axis} axis`, { exact: true }).click();
    await workspace.getByLabel(`x ${axis} minimum`, { exact: true }).fill(lo);
    await workspace.getByLabel(`x ${axis} maximum`, { exact: true }).fill(hi);
    await workspace
      .getByRole("button", { name: "Apply range", exact: true })
      .click();
    await workspace.getByLabel(`x ${axis} axis`, { exact: true }).click();
  }
  const original = JSON.parse(readFileSync(cavendish, "utf8"));
  const saved = await save(page);
  expect(saved.version).toBe(7);
  expect(saved.dataTable).toEqual(original.dataTable);
  expect(saved.request).toEqual(original.request);
  expect(saved.workspace.activeInterval).toBe(1);
  expect(saved.workspace.xRange).toEqual([-100, 4700]);
  expect(saved.workspace.yRanges).toEqual([[-0.1, 1.5]]);
  expect(
    await page.evaluate(() => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    }),
  ).toBe(false);
  expect(saved.workspace.intervals[1].settings[0].parameters[3]).toEqual({
    value: 640,
    fixed: true,
  });
  expect(saved.view.showGuides).toBe(true);
  expect(saved.view.showResiduals).toBe(false);
  const reopened = await context.newPage();
  await load(reopened, cavendish);
  await review(reopened, saved);
  await reopened
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await expect(
    reopened.getByLabel("Interval from", { exact: true }),
  ).toHaveValue("1800");
  await expect(
    reopened.getByLabel("Fix interval T", { exact: true }),
  ).toBeChecked();
  await expect(
    reopened.getByLabel("T interval value", { exact: true }),
  ).toHaveValue("640");
  await expect(
    reopened.getByRole("table", { name: /parameters$/ }),
  ).toHaveCount(0);
  expect(await save(reopened)).toEqual(saved);
  await reopened.close();
  expect(errors).toEqual([]);
});
test("invalid interval drafts and malformed workspace files preserve existing work", async ({
  page,
}) => {
  await load(page, cavendish);
  const workspace = page.getByRole("region", {
    name: "Multi-interval analysis",
    exact: true,
  });
  await page.getByLabel("Interval from", { exact: true }).fill("");
  await page.getByRole("button", { name: "Save session", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Complete or clear both limits",
  );
  await page.getByLabel("Interval from", { exact: true }).fill("0");
  const corrupted = JSON.parse(readFileSync(cavendish, "utf8"));
  corrupted.workspace.columns = [99];
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "broken.trksess",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(corrupted)),
    });
  await expect(page.getByRole("alert")).toContainText(
    "Your current data were kept",
  );
  await expect(workspace).toBeVisible();
  await expect(page.getByLabel("Interval to", { exact: true })).toHaveValue(
    "1400",
  );
  await page
    .getByLabel("Interval equation", { exact: true })
    .selectOption("custom");
  await page.getByLabel("Custom equation", { exact: true }).fill("b +");
  await page.getByRole("button", { name: "Save session", exact: true }).click();
  await expect(page.locator(".fit-error")).toContainText(
    "Apply or restore the custom equation",
  );
});
test("comparison saves all candidates, custom units, shared uncertainty and the selected panel", async ({
  page,
  context,
}) => {
  await load(page, "examples/data/ball-toss.trksess");
  await page
    .getByLabel("Analysis tools", { exact: true })
    .selectOption("model-comparison");
  await page
    .getByLabel("Candidate 1 model", { exact: true })
    .selectOption("custom");
  await page.getByLabel("Candidate 1 m unit", { exact: true }).fill("mH");
  await page.getByLabel("Candidate 1 b value", { exact: true }).fill("2");
  await page.getByLabel("Candidate 1 Fix b", { exact: true }).check();
  await page
    .getByLabel("Comparison Y uncertainty model", { exact: true })
    .selectOption("supplied-common");
  await page
    .getByLabel("Comparison Y uncertainty", { exact: true })
    .fill("0.03");
  await page.getByRole("button", { name: "Add model", exact: true }).click();
  await page
    .getByLabel("Candidate 3 model", { exact: true })
    .selectOption("gaussian");
  const saved = await save(page);
  expect(saved.workspace.kind).toBe("model-comparison");
  expect(saved.workspace.candidates).toHaveLength(3);
  expect(saved.workspace.activeCandidate).toBe(2);
  expect(
    saved.workspace.candidates[0].analysis.settings.custom.units,
  ).toContain("mH");
  expect(saved.workspace.candidates[0].analysis.settings.parameters[0]).toEqual(
    { value: 2, fixed: true },
  );
  expect(
    saved.workspace.candidates.every(
      (c: { analysis: { request: { uncertainty: { sigmaY: number } } } }) =>
        c.analysis.request.uncertainty.sigmaY === 0.03,
    ),
  ).toBe(true);
  const reopened = await context.newPage();
  await load(reopened, cavendish);
  await review(reopened, saved);
  await reopened
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await expect(
    reopened.getByRole("heading", { name: "Model comparison", exact: true }),
  ).toBeVisible();
  await expect(
    reopened.getByLabel("Analysis tools", { exact: true }),
  ).toHaveValue("model-comparison");
  await expect(
    reopened.getByRole("tab", { name: "Candidate 3", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    reopened.getByLabel("Candidate 3 model", { exact: true }),
  ).toHaveValue("gaussian");
  expect(await save(reopened)).toEqual(saved);
  await reopened.getByRole("tab", { name: "Candidate 1", exact: true }).click();
  await expect(
    reopened.getByLabel("Candidate 1 m unit", { exact: true }),
  ).toHaveValue("mH");
  await expect(
    reopened.getByLabel("Candidate 1 Fix b", { exact: true }),
  ).toBeChecked();
  await reopened.close();
});
test("collision setup reopens with four channels, windows and supplied uncertainties", async ({
  page,
  context,
}) => {
  await load(page, "examples/data/collision.csv");
  await page
    .getByLabel("Analysis tools", { exact: true })
    .selectOption("collision");
  const workspace = page.getByRole("region", {
    name: "Collision analysis",
    exact: true,
  });
  await expect(workspace).toBeVisible();
  await page
    .getByLabel("Position uncertainties", { exact: true })
    .selectOption("supplied");
  for (const name of [
    "Object 1 · x",
    "Object 1 · y",
    "Object 2 · x",
    "Object 2 · y",
  ])
    await page.getByLabel(`${name} uncertainty`, { exact: true }).fill("0.003");
  const saved = await save(page);
  expect(saved.workspace.sigmas).toEqual([0.003, 0.003, 0.003, 0.003]);
  expect(saved.workspace.kind).toBe("collision");
  expect(saved.workspace.columns).toHaveLength(4);
  const reopened = await context.newPage();
  await load(reopened, cavendish);
  await review(reopened, saved);
  await reopened
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await expect(
    reopened.getByRole("region", { name: "Collision analysis", exact: true }),
  ).toBeVisible();
  await expect(
    reopened.getByLabel("Analysis tools", { exact: true }),
  ).toHaveValue("collision");
  expect(await save(reopened)).toEqual(saved);
  await reopened.close();
});

for (const mode of ["multi-interval", "model-comparison", "collision"]) {
  test(`opening a single-fit session from ${mode} restores its saved setup`, async ({
    page,
  }) => {
    await load(page, "examples/data/collision.csv");
    await page.getByLabel("Analysis tools", { exact: true }).selectOption(mode);
    const saved = JSON.parse(
      readFileSync("examples/data/published/ba137m-decay.trksess", "utf8"),
    );
    await review(page, saved);
    await expect(
      page.getByLabel("Analysis tools", { exact: true }),
    ).toHaveValue(mode);
    await page
      .getByRole("button", { name: "Use these data", exact: true })
      .click();
    await expect(page.getByLabel("Model", { exact: true })).toHaveValue(
      "custom",
    );
    await expect(
      page.getByLabel("Analysis tools", { exact: true }),
    ).toHaveValue("single-fit");
    await expect(
      page.getByLabel("Custom equation", { exact: true }),
    ).toHaveValue(saved.settings.custom.expression);
    await expect(page.getByLabel("T12 value", { exact: true })).toHaveValue(
      "2.6",
    );
    await expect(
      page.getByLabel("Y uncertainty source", { exact: true }),
    ).toHaveValue("column:2");
    const restored = await save(page);
    expect(restored.version).toBe(7);
    expect(restored.settings).toEqual(saved.settings);
    expect(restored.request).toEqual(saved.request);
    expect(restored.workspace).toEqual({ kind: "single-fit" });
    // Previously visited candidate controls must not survive the new session.
    await page
      .getByLabel("Analysis tools", { exact: true })
      .selectOption("model-comparison");
    await expect(
      page.getByLabel("Candidate 1 model", { exact: true }),
    ).toHaveValue("custom");
    await expect(
      page.getByLabel("Candidate 1 T12 value", { exact: true }),
    ).toHaveValue("2.6");
  });
}

test("canceling session review or keeping unsaved intervals preserves their setup until replacement is accepted", async ({
  page,
}) => {
  await load(page, cavendish);
  await page.getByLabel("Interval from", { exact: true }).fill("100");
  const single = "examples/data/published/ba137m-decay.trksess";
  await review(page, single);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByLabel("Interval from", { exact: true })).toHaveValue(
    "100",
  );
  await review(page, single);
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  const confirm = page.getByRole("alertdialog", {
    name: "Unsaved analysis changes",
  });
  await expect(confirm).toContainText("Open the saved analysis setup");
  await confirm
    .getByRole("button", { name: "Keep working", exact: true })
    .click();
  await expect(page.getByLabel("Analysis tools", { exact: true })).toHaveValue(
    "multi-interval",
  );
  await expect(page.getByLabel("Interval from", { exact: true })).toHaveValue(
    "100",
  );
  await review(page, single);
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await confirm
    .getByRole("button", { name: "Discard changes", exact: true })
    .click();
  await expect(page.getByLabel("Model", { exact: true })).toHaveValue("custom");
  await expect(page.getByLabel("Analysis tools", { exact: true })).toHaveValue(
    "single-fit",
  );
  await expect(page.getByLabel("T12 value", { exact: true })).toHaveValue(
    "2.6",
  );
});
