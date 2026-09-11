import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
async function openDemo(page: Page) {
  await page.goto("/");
  const panel = page.getByRole("dialog", { name: "Data", exact: true });
  await page
    .locator("input[type=file]")
    .setInputFiles("examples/data/ball-toss.trksess");
  await panel
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
}
test("fit window: known-scatter data, constraints, exclusions, save/reopen and invalid import", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openDemo(page);
  await expect(
    page.getByRole("heading", { name: /Data Tool 2027/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Fit selected observations" }).click();
  await expect(page.getByRole("status")).toHaveText("Fit complete");
  expect(
    Number(await page.getByLabel("a value", { exact: true }).inputValue()),
  ).toBeLessThan(-9);
  await expect(page.locator(".fit-diagnostics")).toContainText(
    "Inference: supported",
  );
  await page.getByLabel("Fix y0", { exact: true }).check();
  await page.getByLabel("y0 value", { exact: true }).fill("2");
  await expect(page.locator(".fit-status")).toHaveText("Results stale");
  await page.getByRole("button", { name: "Fit selected observations" }).click();
  await expect(page.locator(".parameter-result").first()).toContainText(
    "(fixed)",
  );
  await page.getByRole("button", { name: "Observations & exclusions" }).click();
  await page.getByLabel("Include row-3", { exact: true }).uncheck();
  await expect(page.locator(".fit-source")).toContainText("60 / 61");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByLabel("Include row-3", { exact: true })).toBeChecked();
  await page
    .getByLabel("Noise model", { exact: true })
    .selectOption("unknown-equal");
  await page.getByRole("button", { name: "Fit selected observations" }).click();
  await page.getByRole("button", { name: "Fit diagnostics" }).click();
  await expect(page.locator(".fit-diagnostics")).toContainText(
    "Q unavailable: unknown-noise-scale",
  );
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save session" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  const bytes = await readFile(path!);
  const saved = JSON.parse(bytes.toString());
  expect(saved.format).toBe("tracker-fit-session");
  expect(saved.request.uncertainty.kind).toBe("unknown-equal");
  await page.locator("input[type=file]").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"format":"invalid"}'),
  });
  await expect(page.getByRole("alert")).toContainText("Import rejected");
  await expect(page.locator(".fit-source")).toContainText("61 / 61");
  await page.locator("input[type=file]").setInputFiles({
    name: "analysis.trksess",
    mimeType: "application/json",
    buffer: bytes,
  });
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByLabel("Fix y0", { exact: true })).toBeChecked();
  await page.getByRole("button", { name: "Fit selected observations" }).click();
  await page.getByRole("status").filter({ hasText: "Fit complete" }).waitFor();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: ".tools/fit-window.png", fullPage: true });
  expect(errors).toEqual([]);
});
test("unsaved replacement requires visible discard; both numerical plot domains update", async ({
  page,
}) => {
  await openDemo(page);
  await page.getByLabel("y0 value", { exact: true }).fill("1");
  await page
    .locator("input[type=file]")
    .setInputFiles("examples/data/ball-toss.trksess");
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Keep or discard");
  await page.getByRole("button", { name: "Keep working" }).click();
  await expect(page.getByLabel("y0 value", { exact: true })).toHaveValue("1");
  await page
    .locator("input[type=file]")
    .setInputFiles("examples/data/ball-toss.trksess");
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Discard changes", exact: true })
    .click();
  await expect(page.getByLabel("y0 value", { exact: true })).toHaveValue("0");
  await page.getByLabel("View from").fill("0.5");
  const plots = page.locator(".fit-plot");
  await expect(plots.nth(0)).toHaveAttribute("data-x-min", "0.5");
  await expect(plots.nth(1)).toHaveAttribute("data-x-min", "0.5");
});

test("cancelled work cannot replace a newer analysis", async ({ page }) => {
  await page.route("**/*fit.worker*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    await route.continue();
  });
  await openDemo(page);
  await page.getByRole("button", { name: "Fit selected observations" }).click();
  await page.getByRole("button", { name: "Cancel fit", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Fit cancelled");
  await page.getByLabel("y0 value", { exact: true }).fill("3");
  await page.waitForTimeout(900);
  await expect(page.locator(".parameter-result")).toHaveCount(0);
  await expect(page.getByLabel("y0 value", { exact: true })).toHaveValue("3");
  await page.unroute("**/*fit.worker*");
  await page.getByRole("button", { name: "Fit selected observations" }).click();
  await expect(page.getByRole("status")).toHaveText("Fit complete");
});

test("copied report separates scalar statistics and keeps normal data tables", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openDemo(page);
  await page.getByRole("button", { name: "Fit selected observations" }).click();
  await expect(page.getByRole("status")).toHaveText("Fit complete");
  await page.getByRole("button", { name: "Copy report", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Report copied: statistics in two columns",
  );
  const text = await page.evaluate(() => navigator.clipboard.readText());
  const sections = text
    .trimEnd()
    .split(/\r?\n\r?\n/)
    .map((section) => section.split(/\r?\n/).map((row) => row.split("\t")));
  expect(text.startsWith("Dataset\t")).toBe(true);
  expect(text.indexOf("Source notes\t")).toBeGreaterThan(
    text.indexOf("Row\tx\ty\tpredicted\tresidual"),
  );
  expect(text).toContain("seed=");
  expect(sections[1][0]).toEqual([
    "Parameter",
    "Value",
    "Standard error",
    "95% lower",
    "95% upper",
  ]);
  expect(sections[2][0]).toEqual(["Statistic", "Value"]);
  expect(sections[2].every((row) => row.length === 2)).toBe(true);
  const table = new Map(sections[2].slice(1).map((row) => [row[0], row[1]]));
  expect(Number(table.get("df"))).toBe(58);
  expect(Number(table.get("n"))).toBe(61);
  expect(sections[3][0]).toEqual(["Row", "x", "y", "predicted", "residual"]);
  expect(sections[3]).toHaveLength(62);
  expect(sections[3].every((row) => row.length === 5)).toBe(true);
});

test("rectangle selection changes the fit subset and supports undo, restore and cancellation", async ({
  page,
}) => {
  await openDemo(page);
  await page.getByRole("button", { name: "Fit selected observations" }).click();
  await expect(page.getByRole("status")).toHaveText("Fit complete");
  const plot = page.getByRole("img", { name: "Data and fitted curve" });
  const box = (await plot.boundingBox())!;
  const svgWidth = await plot.evaluate(
    (el) => (el as SVGSVGElement).viewBox.baseVal.width,
  );
  const svgHeight = await plot.evaluate(
    (el) => (el as SVGSVGElement).viewBox.baseVal.height,
  );
  const point = (x: number, y: number) => ({
    x: box.x + (x / svgWidth) * box.width,
    y: box.y + (y / svgHeight) * box.height,
  });
  // Select an upper portion of the trajectory, excluding points by both x and y.
  const a = point(230, 40),
    b = point(570, 135);
  const expected = await plot.locator("circle").evaluateAll(
    (circles) =>
      circles.filter((c) => {
        const x = Number(c.getAttribute("cx")),
          y = Number(c.getAttribute("cy"));
        return x >= 230 && x <= 570 && y >= 40 && y <= 135;
      }).length,
  );
  expect(expected).toBeGreaterThan(3);
  expect(expected).toBeLessThan(61);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await expect(page.locator(".fit-selection-box")).toBeVisible();
  await page.mouse.up();
  await expect(page.locator(".fit-source")).toContainText(`${expected} / 61`);
  await expect(page.locator(".fit-status")).toHaveText("Results stale");
  await page.getByRole("button", { name: "Fit selected observations" }).click();
  await expect(page.getByRole("status")).toHaveText("Fit complete");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".fit-source")).toContainText("61 / 61");
  await page.mouse.move(b.x, b.y);
  await page.mouse.down();
  await page.mouse.move(a.x, a.y, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator(".fit-source")).toContainText(`${expected} / 61`);
  await page
    .getByRole("button", { name: "Restore points", exact: true })
    .click();
  await expect(page.locator(".fit-source")).toContainText("61 / 61");
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(page.locator(".fit-source")).toContainText("61 / 61");
});

test("a single data-point click still toggles exclusion after adding rectangle selection", async ({
  page,
}) => {
  await openDemo(page);
  const circle = page
    .getByRole("img", { name: "Data and fitted curve" })
    .locator("circle")
    .nth(20);
  await circle.click();
  await expect(page.locator(".fit-source")).toContainText("60 / 61");
  await circle.click();
  await expect(page.locator(".fit-source")).toContainText("61 / 61");
});

test("mean confidence band follows the current fit, selection and visibility toggle", async ({
  page,
}) => {
  await openDemo(page);
  const band = page.locator(".fit-confidence-band");
  await expect(band).toHaveCount(0);
  await page.getByRole("button", { name: "Fit selected observations" }).click();
  await expect(page.getByRole("status")).toHaveText("Fit complete");
  await expect(band).toHaveCount(1);
  await expect(page.locator(".fit-band-note")).toContainText(
    "not a prediction interval",
  );
  const full = await band.getAttribute("d");
  expect(full).not.toMatch(/NaN|Infinity/);
  const plot = page.getByRole("img", { name: "Data and fitted curve" }),
    box = (await plot.boundingBox())!;
  const svgWidth = await plot.evaluate(
    (el) => (el as SVGSVGElement).viewBox.baseVal.width,
  );
  const svgHeight = await plot.evaluate(
    (el) => (el as SVGSVGElement).viewBox.baseVal.height,
  );
  await page.mouse.move(
    box.x + (66 / svgWidth) * box.width,
    box.y + (19 / svgHeight) * box.height,
  );
  await page.mouse.down();
  await page.mouse.move(
    box.x + (405 / svgWidth) * box.width,
    box.y + ((svgHeight - 41) / svgHeight) * box.height,
    { steps: 8 },
  );
  await page.mouse.up();
  await expect(band).toHaveCount(0);
  await page.getByRole("button", { name: "Fit selected observations" }).click();
  await expect(page.getByRole("status")).toHaveText("Fit complete");
  await expect(band).toHaveCount(1);
  expect(await band.getAttribute("d")).not.toBe(full);
  await expect(page.locator(".fit-band-note")).toContainText(
    "Selection after inspecting",
  );
  await page
    .getByLabel("Show 95% mean confidence band", { exact: true })
    .uncheck();
  await expect(band).toHaveCount(0);
  await page
    .getByLabel("Show 95% mean confidence band", { exact: true })
    .check();
  await expect(band).toHaveCount(1);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: ".tools/fit-confidence-band.png",
    fullPage: true,
  });
});

test("compact laptop layout shows both plots and all parameter results on a short screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 980, height: 720 });
  await openDemo(page);
  await page.getByRole("button", { name: "Fit selected observations" }).click();
  await expect(page.getByRole("status")).toHaveText("Fit complete");
  for (const name of ["Data and fitted curve", "Residual plot"]) {
    const box = (await page.getByRole("img", { name }).boundingBox())!;
    expect(box.y).toBeGreaterThan(0);
    expect(box.y + box.height).toBeLessThan(720);
  }
  for (const name of ["y0", "v0", "a"]) {
    const input = page.getByLabel(`${name} value`, { exact: true });
    await expect(input).toBeVisible();
    const box = (await input.boundingBox())!;
    expect(box.y + box.height).toBeLessThan(720);
  }
  expect(
    Number(await page.getByLabel("a value", { exact: true }).inputValue()),
  ).toBeLessThan(-9);
  await page.getByLabel("Fix a", { exact: true }).check();
  expect(
    Number(await page.getByLabel("a value", { exact: true }).inputValue()),
  ).toBeLessThan(-9);
  await page.getByRole("button", { name: "Fit selected observations" }).click();
  await expect(page.getByRole("status")).toHaveText("Fit complete");
  await page.getByText("95% parameter intervals", { exact: true }).click();
  await expect(page.locator(".fit-intervals table")).toBeVisible();
  await page.getByText("95% parameter intervals", { exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  const metrics = (await page.locator(".fit-metrics").boundingBox())!;
  expect(metrics.y + metrics.height).toBeLessThan(720);
  await expect(page.locator(".fit-source h2")).toHaveText(
    "Ball toss · synthetic experiment",
  );
  await expect(page.locator(".fit-header .fit-primary")).toHaveCount(0);
  await expect(
    page
      .locator(".fit-controls")
      .getByRole("button", { name: "Fit selected observations" }),
  ).toBeVisible();
  const chart = (await page.locator(".fit-chart").boundingBox())!;
  expect(chart.y).toBeLessThan(80);
  await expect(page.locator(".fit-chart .fit-status")).toHaveText("Fitted");
  await page.screenshot({ path: ".tools/fit-compact-laptop.png" });
  await page.setViewportSize({ width: 1120, height: 820 });
  await page.screenshot({ path: ".tools/fit-roomier-laptop.png" });
  await page.setViewportSize({ width: 1280, height: 640 });
  await page.evaluate(() => window.scrollTo(0, 0));
  const residual = (await page
    .getByRole("img", { name: "Residual plot" })
    .boundingBox())!;
  expect(residual.y + residual.height).toBeLessThan(640);
});

test("Shift-drag joins separated regions and Alt-drag excludes a bad region", async ({
  page,
}) => {
  await openDemo(page);
  const plot = page.getByRole("img", { name: "Data and fitted curve" });
  const dimensions = await plot.evaluate((el) => {
    const svg = el as SVGSVGElement;
    return {
      width: svg.viewBox.baseVal.width,
      height: svg.viewBox.baseVal.height,
    };
  });
  const box = (await plot.boundingBox())!;
  const drag = async (x0: number, x1: number, modifier?: "Shift" | "Alt") => {
    if (modifier) await page.keyboard.down(modifier);
    await page.mouse.move(
      box.x + (x0 / dimensions.width) * box.width,
      box.y + (20 / dimensions.height) * box.height,
    );
    await page.mouse.down();
    await page.mouse.move(
      box.x + (x1 / dimensions.width) * box.width,
      box.y + ((dimensions.height - 40) / dimensions.height) * box.height,
      { steps: 6 },
    );
    await page.mouse.up();
    if (modifier) await page.keyboard.up(modifier);
  };
  const idsIn = (x0: number, x1: number) =>
    plot.locator("circle").evaluateAll(
      (circles, bounds) =>
        circles
          .filter((c) => {
            const x = Number(c.getAttribute("cx"));
            return x >= bounds[0] && x <= bounds[1];
          })
          .map((c) => c.getAttribute("data-row-id")!),
      [x0, x1],
    );
  const selected = () =>
    plot
      .locator("circle:not(.excluded)")
      .evaluateAll((circles) =>
        circles.map((c) => c.getAttribute("data-row-id")!),
      );
  const left = await idsIn(70, 250);
  const right = await idsIn(500, 720);
  expect(left.length).toBeGreaterThan(3);
  expect(right.length).toBeGreaterThan(3);
  await drag(70, 250);
  expect(await selected()).toEqual(left);
  await drag(500, 720, "Shift");
  expect(await selected()).toEqual([...left, ...right]);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await selected()).toEqual(left);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect(await selected()).toEqual([...left, ...right]);
  await drag(70, 250, "Alt");
  expect(await selected()).toEqual(right);
  await page.getByRole("button", { name: "Fit selected observations" }).click();
  await expect(page.locator(".fit-status")).toHaveText("Fitted");
  await page
    .getByRole("button", { name: "Restore points", exact: true })
    .click();
  expect((await selected()).length).toBe(61);
  await drag(300, 450, "Alt");
  const excluded = await idsIn(300, 450);
  expect((await selected()).length).toBe(61 - excluded.length);
  await expect(page.locator(".fit-status")).toHaveText("Results stale");
});

test("large displays use the window and display scaling preserves fit and clean graph headers", async ({
  page,
}) => {
  await page.setViewportSize({ width: 2560, height: 1440 });
  await openDemo(page);
  await page.getByRole("button", { name: "Fit selected observations" }).click();
  await expect(page.locator(".fit-status")).toHaveText("Fitted");
  const coefficient = await page
    .getByLabel("a value", { exact: true })
    .inputValue();
  const plot = page.getByRole("img", { name: "Data and fitted curve" });
  await expect
    .poll(async () => (await plot.boundingBox())!.width)
    .toBeGreaterThan(2000);
  const initial = (await plot.boundingBox())!;
  expect(initial.height).toBeGreaterThan(600);
  await page.getByLabel("Display size", { exact: true }).selectOption("1.5");
  await expect(page.locator(".fit-status")).toHaveText("Fitted");
  expect(await page.getByLabel("a value", { exact: true }).inputValue()).toBe(
    coefficient,
  );
  const toolbar = (await page.locator(".fit-chart-toolbar").boundingBox())!;
  for (const selector of [".fit-status", ".fit-band-controls"]) {
    const bounds = (await page.locator(selector).boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(toolbar.x - 1);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(
      toolbar.x + toolbar.width + 1,
    );
  }
  const status = (await page.locator(".fit-status").boundingBox())!;
  const band = (await page.locator(".fit-band-controls").boundingBox())!;
  expect(
    status.x >= band.x + band.width || status.y >= band.y + band.height,
  ).toBeTruthy();
  await page.screenshot({ path: ".tools/fit-large-display.png" });
  await page.setViewportSize({ width: 3840, height: 2160 });
  await page.getByLabel("Display size", { exact: true }).selectOption("2");
  await expect
    .poll(async () => (await plot.boundingBox())!.width)
    .toBeGreaterThan(2900);
  const residual = (await page
    .getByRole("img", { name: "Residual plot" })
    .boundingBox())!;
  expect(residual.y + residual.height).toBeLessThan(2160);
  await page.screenshot({ path: ".tools/fit-4k-display.png" });
  await page.setViewportSize({ width: 980, height: 720 });
  await page.getByLabel("Display size", { exact: true }).selectOption("1");
  await expect(page.locator(".fit-status")).toHaveText("Fitted");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(980);
});

test("new example sessions open with their models, fit and preserve sine period", async ({
  page,
}) => {
  await openDemo(page);
  for (const model of ["cubic", "quartic", "logarithmic", "sine"]) {
    await page
      .locator("input[type=file]")
      .setInputFiles(`examples/fit/${model}-demo.trksess`);
    await page
      .getByRole("button", { name: "Use these data", exact: true })
      .click();
    const discard = page.getByRole("button", {
      name: "Discard changes",
      exact: true,
    });
    if (await discard.isVisible()) await discard.click();
    await expect(page.getByLabel("Analysis", { exact: true })).toHaveValue(
      model,
    );
    await page
      .getByRole("button", { name: "Fit selected observations" })
      .click();
    await expect(page.locator(".fit-status")).toHaveText("Fitted");
    const curve = await page
      .locator(".fit-plot")
      .first()
      .locator(".curve")
      .getAttribute("d");
    expect(curve).not.toMatch(/NaN|Infinity/);
  }
  await expect(page.getByLabel("Sine period", { exact: true })).toHaveValue(
    "3",
  );
  await page.getByLabel("Sine period", { exact: true }).fill("2.8");
  await expect(page.locator(".fit-status")).toHaveText("Results stale");
  await page.getByRole("button", { name: "Fit selected observations" }).click();
  await expect(page.locator(".fit-status")).toHaveText("Fitted");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save session" }).click();
  const download = await downloadPromise;
  const saved = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(saved.settings.sinePeriod).toBe(2.8);
  await page.screenshot({ path: ".tools/fit-sine-example.png" });
});

for (const scale of ["1.25", "1.5", "2"])
  test(`point and rectangle picking at ${scale} display scale`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1800, height: 1200 });
    await openDemo(page);
    await page.getByLabel("Display size", { exact: true }).selectOption(scale);
    const plot = page.getByRole("img", { name: "Data and fitted curve" });
    await plot.scrollIntoViewIfNeeded();
    const circles = plot.locator("circle");
    await circles.nth(20).click();
    await expect(circles.nth(20)).toHaveClass(/excluded/);
    await circles.nth(20).click();
    await expect(circles.nth(20)).not.toHaveClass(/excluded/);
    const select = async (
      fraction0: number,
      fraction1: number,
      modifier?: "Shift" | "Alt",
    ) => {
      const box = (await plot.boundingBox())!;
      const x0 = Math.round(box.x + fraction0 * box.width),
        x1 = Math.round(box.x + fraction1 * box.width);
      const y0 = Math.round(box.y + 8),
        y1 = Math.round(box.y + box.height - 8);
      const expected = await circles.evaluateAll(
        (nodes, rect) =>
          nodes
            .filter((n) => {
              const b = n.getBoundingClientRect(),
                x = b.x + b.width / 2,
                y = b.y + b.height / 2;
              return (
                x >= rect.x0 && x <= rect.x1 && y >= rect.y0 && y <= rect.y1
              );
            })
            .map((n) => n.getAttribute("data-row-id")),
        { x0, x1, y0, y1 },
      );
      if (modifier) await page.keyboard.down(modifier);
      await page.mouse.move(x0, y0);
      await page.mouse.down();
      await page.mouse.move(x1, y1, { steps: 6 });
      await page.mouse.up();
      if (modifier) await page.keyboard.up(modifier);
      return expected;
    };
    const selected = () =>
      plot
        .locator("circle:not(.excluded)")
        .evaluateAll((nodes) =>
          nodes.map((n) => n.getAttribute("data-row-id")),
        );
    const left = await select(0.15, 0.4);
    expect(left.length).toBeGreaterThan(3);
    expect(await selected()).toEqual(left);
    const right = await select(0.65, 0.9, "Shift");
    expect(await selected()).toEqual([...left, ...right]);
    await select(0.15, 0.4, "Alt");
    expect(await selected()).toEqual(right);
  });

test("uncertainty editing permits unfinished numbers and commits one validated change", async ({
  page,
}) => {
  await openDemo(page);
  const input = page.getByLabel("Y uncertainty", { exact: true });
  const fitButton = page.getByRole("button", {
    name: "Fit selected observations",
  });
  await fitButton.click();
  await expect(page.locator(".fit-status")).toHaveText("Fitted");
  await input.focus();
  await input.press("End");
  await input.press("Backspace");
  await expect(input).toHaveValue("0.0");
  await expect(fitButton).toBeDisabled();
  await expect(page.locator(".fit-status")).toHaveText("Results stale");
  await input.pressSequentially("5");
  await expect(input).toHaveValue("0.05");
  await input.press("Enter");
  await fitButton.click();
  await expect(page.locator(".fit-status")).toHaveText("Fitted");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(input).toHaveValue("0.02");
  await input.fill("");
  await input.press("Tab");
  await expect(page.getByRole("alert")).toContainText("greater than zero");
  await expect(
    page.getByRole("button", { name: "Save session" }),
  ).toBeDisabled();
  await input.focus();
  await input.press("Escape");
  await expect(input).toHaveValue("0.02");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await input.fill("1e-");
  await expect(input).toHaveValue("1e-");
  await input.pressSequentially("1");
  await fitButton.click(); // Blur commits the valid draft before Fit executes.
  await expect(page.locator(".fit-status")).toHaveText("Fitted");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save session" }).click();
  const downloaded = await downloadPromise;
  const session = JSON.parse(
    await readFile((await downloaded.path())!, "utf8"),
  );
  expect(session.request.uncertainty.sigmaY).toBe(0.1);
});

test("fit-period sine recovers T, fixes it, and saves its search settings", async ({
  page,
}) => {
  await openDemo(page);
  await page
    .locator("input[type=file]")
    .setInputFiles("examples/fit/sine-fit-period-demo.trksess");
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await expect(page.getByLabel("Analysis", { exact: true })).toHaveValue(
    "sine-free-period",
  );
  await page.getByRole("button", { name: "Fit selected observations" }).click();
  await expect(page.locator(".fit-status")).toHaveText("Fitted");
  expect(
    Number(await page.getByLabel("T value", { exact: true }).inputValue()),
  ).toBeCloseTo(3, 2);
  await expect(page.getByText(/Amplitude .*Phase/)).toBeVisible();
  await page.getByLabel("Fix T", { exact: true }).check();
  await page.getByRole("button", { name: "Fit selected observations" }).click();
  await expect(page.locator(".fit-status")).toHaveText("Fitted");
  await expect(page.locator(".parameter-result").last()).toHaveText("(fixed)");
  await page.getByLabel("Fix T", { exact: true }).uncheck();
  await page.getByLabel("Minimum period", { exact: true }).fill("2.5");
  await page.getByLabel("Maximum period", { exact: true }).click();
  await page.getByRole("button", { name: "Fit selected observations" }).click();
  await expect(page.locator(".fit-status")).toHaveText("Fitted");
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save session" }).click();
  const downloaded = await pending;
  const session = JSON.parse(
    await readFile((await downloaded.path())!, "utf8"),
  );
  expect(session.engine).toBe("qr-vp-sine-2");
  expect(session.settings.periodMin).toBe(2.5);
  await page.screenshot({ path: ".tools/fit-free-period-sine.png" });
});

test("supplied error bars follow uncertainty values, selection, visibility and unknown noise", async ({
  page,
}) => {
  await openDemo(page);
  const data = page.getByRole("img", { name: "Data and fitted curve" }),
    bars = data.locator(".fit-error-bar");
  await expect(bars).toHaveCount(61);
  await expect(
    page.getByRole("img", { name: "Residual plot" }).locator(".fit-error-bar"),
  ).toHaveCount(0);
  await expect(bars.first()).toHaveAttribute("data-sigma", "0.02");
  await page.getByLabel("Y uncertainty", { exact: true }).fill("0.2");
  await page.getByLabel("Y uncertainty", { exact: true }).press("Enter");
  await expect(bars.first()).toHaveAttribute("data-sigma", "0.2");
  await page.getByRole("button", { name: "Fit selected observations" }).click();
  await expect(page.locator(".fit-status")).toHaveText("Fitted");
  const coefficient = await page
    .getByLabel("a value", { exact: true })
    .inputValue();
  await page.getByLabel("Show y error bars (±1σ)", { exact: true }).uncheck();
  await expect(bars).toHaveCount(0);
  await expect(page.locator(".fit-status")).toHaveText("Fitted");
  expect(await page.getByLabel("a value", { exact: true }).inputValue()).toBe(
    coefficient,
  );
  await page.getByLabel("Show y error bars (±1σ)", { exact: true }).check();
  await data.locator("circle").nth(20).click();
  await expect(bars.nth(20)).toHaveClass(/excluded/);
  await page
    .getByLabel("Noise model", { exact: true })
    .selectOption("unknown-equal");
  await expect(bars).toHaveCount(0);
  await expect(
    page.getByLabel("Error bars unavailable · σ unknown", { exact: true }),
  ).toBeDisabled();
  await page
    .locator("input[type=file]")
    .setInputFiles("examples/fit/error-bars-demo.trksess");
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Discard changes", exact: true })
    .click();
  await expect(bars).toHaveCount(31);
  await expect(bars.first()).toHaveAttribute("data-sigma", "0.04");
  await expect(bars.last()).toHaveAttribute(
    "data-sigma",
    "0.39999999999999997",
  );
  const lengths = await bars.evaluateAll((nodes) =>
    nodes.map((n) => {
      const numbers = n
        .getAttribute("d")!
        .match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)!
        .map(Number);
      return Math.abs(numbers[2] - numbers[1]);
    }),
  );
  expect(lengths[30] / lengths[0]).toBeCloseTo(10, 8);
  await page.getByRole("button", { name: "Fit selected observations" }).click();
  await expect(page.locator(".fit-status")).toHaveText("Fitted");
  await page.screenshot({ path: ".tools/fit-error-bars.png" });
});

test("per-row uncertainties remain available after noise/model changes and session reopen", async ({
  page,
}) => {
  await openDemo(page);
  await page
    .locator("input[type=file]")
    .setInputFiles("examples/fit/unequal-weights-demo.trksess");
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  const noise = page.getByLabel("Noise model", { exact: true });
  const bars = page
    .getByRole("img", { name: "Data and fitted curve" })
    .locator(".fit-error-bar");
  const sigmas = await bars.evaluateAll((nodes) =>
    nodes.map((n) => n.getAttribute("data-sigma")),
  );
  expect(sigmas).toHaveLength(31);
  await noise.selectOption("unknown-equal");
  await expect(noise.locator('option[value="supplied-per-row"]')).toHaveCount(
    1,
  );
  await expect(bars).toHaveCount(0);
  await page.getByLabel("Analysis", { exact: true }).selectOption("quadratic");
  await page.getByLabel("Analysis", { exact: true }).selectOption("line");
  await noise.selectOption("supplied-common");
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save session" }).click();
  const downloaded = await pending;
  const path = (await downloaded.path())!;
  const saved = JSON.parse(await readFile(path, "utf8"));
  expect(saved.request.uncertainty.kind).toBe("supplied-common");
  expect(
    Object.keys(saved.settings.retainedPerRowUncertainty.sigmaByRow),
  ).toHaveLength(31);
  await page.locator("input[type=file]").setInputFiles(path);
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await noise.selectOption("supplied-per-row");
  expect(
    await bars.evaluateAll((nodes) =>
      nodes.map((n) => n.getAttribute("data-sigma")),
    ),
  ).toEqual(sigmas);
  await page.getByRole("button", { name: "Fit selected observations" }).click();
  await expect(page.locator(".fit-status")).toHaveText("Fitted");
  await page
    .locator("input[type=file]")
    .setInputFiles("examples/fit/synthetic-session.trksess");
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Discard changes", exact: true })
    .click();
  await expect(noise.locator('option[value="supplied-per-row"]')).toHaveCount(
    0,
  );
});

test("CSV preview, corrections, pasted cells, undo and original snapshot round trip", async ({
  page,
}) => {
  await openDemo(page);
  await page.locator("input[type=file]").setInputFiles({
    name: "lab.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("t,y,sigma\n0,2,.1\n1,3,.2\n2,4,.3"),
  });
  const panel = page.getByRole("dialog", { name: "Data" });
  await expect(panel).toBeVisible();
  await panel.getByLabel("sigma column", { exact: true }).selectOption("2");
  await panel.getByText("Import options", { exact: true }).click();
  await panel.getByLabel("x unit", { exact: true }).fill("s");
  await panel.getByRole("button", { name: "Use these data" }).click();
  await expect(page.locator(".fit-source")).toContainText("3 / 3");
  await page.getByRole("button", { name: "Observations & exclusions" }).click();
  await page.getByRole("button", { name: "Edit data", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Data" });
  await editor.getByLabel("Row 2 column 3", { exact: true }).fill("0");
  await expect(
    editor.getByRole("button", { name: "Use these data" }),
  ).toBeDisabled();
  await editor.getByLabel("Row 2 column 3", { exact: true }).fill("0.4");
  await editor.getByLabel("Row 2 column 2", { exact: true }).evaluate((el) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData("text", "2.123456789012345\t.4\n3.5\t.5");
    el.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await expect(
    editor.getByLabel("Row 3 column 2", { exact: true }),
  ).toHaveValue("3.5");
  await editor
    .locator("tbody tr")
    .nth(3)
    .getByRole("button", { name: /Delete/ })
    .click();
  await editor.getByRole("button", { name: "Use these data" }).click();
  await expect(page.locator(".fit-source")).toContainText("2 / 2");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".fit-source")).toContainText("3 / 3");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save session" }).click();
  const bytes = await readFile((await (await downloaded).path())!);
  const saved = JSON.parse(bytes.toString());
  expect(saved.originalRequest.dataset.rows).toHaveLength(3);
  expect(saved.originalRequest.dataset.rows[0].y).toBe(2);
  expect(saved.request.dataset.rows[0].y).toBe(2.123456789012345);
  expect(Object.values(saved.request.uncertainty.sigmaByRow)).toEqual([
    0.4, 0.5,
  ]);
  await page.locator("input[type=file]").setInputFiles({
    name: "reopen.trksess",
    mimeType: "application/json",
    buffer: bytes,
  });
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await expect(page.locator(".fit-source")).toContainText("2 / 2");
  await expect(
    page.getByText("Original snapshot preserved", { exact: false }),
  ).toBeVisible();
});

test("pasted TSV requires review and malformed imports preserve the current data", async ({
  page,
}) => {
  await openDemo(page);
  await page.getByRole("button", { name: "Data…" }).click();
  const panel = page.getByRole("dialog", { name: "Data" });
  await panel.getByRole("button", { name: "New table" }).click();
  await panel.getByLabel("Row 1 column 1", { exact: true }).evaluate((el) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData("text", "Time\tHeight\n0\t2\n1\tbad");
    el.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await expect(
    panel.getByRole("button", { name: "Use these data" }),
  ).toBeDisabled();
  await expect(page.locator(".fit-source")).toContainText("61 / 61");
  await panel.getByLabel("Row 3 column 2", { exact: true }).fill("");
  await expect(panel).toContainText("1 with missing");
  await panel.getByRole("button", { name: "Use these data" }).click();
  await expect(page.locator(".fit-source")).toContainText("1 / 2");
});

test("data review stays reachable on a short screen at enlarged display sizes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1120, height: 720 });
  await openDemo(page);
  for (const scale of ["1", "1.5", "2"]) {
    await page.getByLabel("Display size", { exact: true }).selectOption(scale);
    await page.getByRole("button", { name: "Data…" }).click();
    const panel = page.getByRole("dialog", { name: "Data" });
    const box = await panel.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(1120);
    expect(box!.y + box!.height).toBeLessThanOrEqual(720);
    await panel.getByRole("button", { name: "Cancel", exact: true }).click();
  }
});

test("simple import hides setup, previews source columns and retains headerless first row", async ({
  page,
}) => {
  await openDemo(page);
  await page.locator("input[type=file]").setInputFiles({
    name: "measurements.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("0,2\n1,3\n2,4"),
  });
  const panel = page.getByRole("dialog", { name: "Data" });
  await expect(
    panel.getByRole("heading", { name: "Data", exact: true }),
  ).toBeVisible();
  await expect(panel.getByLabel("Delimited text")).toBeHidden();
  await expect(panel.getByLabel("Delimiter", { exact: true })).toBeHidden();
  await expect(panel.getByLabel("x unit", { exact: true })).toBeVisible();
  await expect(panel.getByLabel("Header rows", { exact: true })).toHaveValue(
    "0",
  );
  await expect(panel.locator("tbody tr")).toHaveCount(4);
  await panel.getByRole("button", { name: "Use these data" }).click();
  await expect(page.locator(".fit-source")).toContainText("3 / 3");
});

test("paste grid flags inf, keeps column assignments, repairs R heading and pastes at a cell", async ({
  page,
}) => {
  await openDemo(page);
  await page.getByRole("button", { name: "Data…" }).click();
  const panel = page.getByRole("dialog", { name: "Data" });
  await panel.getByRole("button", { name: "New table" }).click();
  await panel.getByLabel("Row 1 column 1", { exact: true }).evaluate((el) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData(
      "text",
      "time\theight\none\t0\t2\ntwo\t1\tinf\nthree\t2\t4",
    );
    el.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await expect(panel.getByLabel("x column", { exact: true })).toHaveValue("1");
  await expect(panel.getByLabel("y column", { exact: true })).toHaveValue("2");
  await panel
    .getByRole("button", { name: "Add blank row-name heading" })
    .click();
  await expect(
    panel.getByLabel("Row 3 column 3", { exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
  await expect(
    panel.getByRole("button", { name: "Use these data" }),
  ).toBeDisabled();
  await expect(panel).toContainText("not a finite number");
  await panel.getByLabel("Row 3 column 3", { exact: true }).fill("3");
  await expect(panel.getByLabel("y column", { exact: true })).toHaveValue("2");
  await panel.getByLabel("Row 4 column 2", { exact: true }).click();
  await panel.getByLabel("Row 4 column 2", { exact: true }).evaluate((el) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData("text", "2\t4\n3\t5");
    el.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await expect(panel.getByLabel("Row 5 column 3", { exact: true })).toHaveValue(
    "5",
  );
  await panel.getByRole("button", { name: "Use these data" }).click();
  await expect(page.locator(".fit-source")).toContainText("4 / 4");
});

test("plots show data only before fitting and manual curves require a parameter edit", async ({
  page,
}) => {
  await openDemo(page);
  const data = page.getByLabel("Data and fitted curve", { exact: true });
  const residual = page.getByLabel("Residual plot", { exact: true });
  await expect(data.locator("circle")).toHaveCount(61);
  await expect(data.locator(".curve")).toHaveCount(0);
  await expect(residual.locator("circle,.zero")).toHaveCount(0);
  await expect(residual).toContainText("Fit to show residuals");
  await page.getByLabel("y0 value", { exact: true }).fill("3");
  await expect(data.locator(".curve")).toHaveCount(1);
  await expect(
    page.getByText("Manual preview · not fitted", { exact: true }),
  ).toBeVisible();
  await expect(residual.locator("circle,.zero")).toHaveCount(0);
  await page.getByRole("button", { name: "Fit selected observations" }).click();
  await expect(page.getByRole("status")).toHaveText("Fit complete");
  await expect(residual.locator("circle")).toHaveCount(61);
  await page.getByLabel("Fix y0", { exact: true }).check();
  await expect(data.locator(".curve")).toHaveCount(0);
  await expect(residual.locator("circle,.zero")).toHaveCount(0);
});

test("empty datasets show guidance without default models or residual points", async ({
  page,
}) => {
  await openDemo(page);
  const request = JSON.parse(
    await readFile("examples/fit/synthetic-request.json", "utf8"),
  );
  request.dataset.rows = [];
  await page.locator("input[type=file]").setInputFiles({
    name: "empty.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(request)),
  });
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await expect(
    page.getByLabel("Data and fitted curve", { exact: true }),
  ).toContainText("Paste or open data to begin");
  await expect(
    page.locator(".fit-plot circle,.fit-plot .curve,.fit-plot .zero"),
  ).toHaveCount(0);
});

test("Data reopens the same source table, loads files in place, swaps axes and saves assignments", async ({
  page,
}) => {
  await openDemo(page);
  await expect(
    page.getByRole("button", { name: "Paste columns", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Data…", exact: true }).click();
  let panel = page.getByRole("dialog", { name: "Data", exact: true });
  await expect(panel.getByLabel("Row 2 column 1", { exact: true })).toHaveValue(
    "0",
  );
  const fileChooser = page.waitForEvent("filechooser");
  await panel.getByRole("button", { name: "Load file…", exact: true }).click();
  await (
    await fileChooser
  ).setFiles({
    name: "lab.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("id,time,height,sigma\na,0,2,.1\nb,1,3,.2\nc,2,4,.3"),
  });
  panel = page.getByRole("dialog", { name: "Data", exact: true });
  await panel.getByLabel("sigma column", { exact: true }).selectOption("3");
  await panel.getByRole("button", { name: "Use these data" }).click();
  await page.getByRole("button", { name: "Data…", exact: true }).click();
  await expect(panel.getByLabel("Row 2 column 1", { exact: true })).toHaveValue(
    "a",
  );
  await expect(panel.getByLabel("sigma column", { exact: true })).toHaveValue(
    "3",
  );
  await panel.getByLabel("x column", { exact: true }).selectOption("2");
  await panel.getByLabel("y column", { exact: true }).selectOption("1");
  await expect(panel.getByLabel("sigma column", { exact: true })).toHaveValue(
    "-1",
  );
  await panel.getByRole("button", { name: "Use these data" }).click();
  await page.getByRole("button", { name: "Data…", exact: true }).click();
  await expect(panel.getByLabel("x column", { exact: true })).toHaveValue("2");
  await expect(panel.getByLabel("y column", { exact: true })).toHaveValue("1");
  await panel.getByRole("button", { name: "Cancel", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save session" }).click();
  const bytes = await readFile((await (await download).path())!);
  const saved = JSON.parse(bytes.toString());
  expect(saved.dataTable.x).toBe(2);
  expect(saved.dataTable.cells[1][0]).toBe("a");
  expect(saved.request.dataset.rows[0]).toMatchObject({ x: 2, y: 0 });
  await page.locator("input[type=file]").setInputFiles({
    name: "reopened.trksess",
    mimeType: "application/json",
    buffer: bytes,
  });
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await page.getByRole("button", { name: "Data…", exact: true }).click();
  await expect(panel.getByLabel("x column", { exact: true })).toHaveValue("2");
  await expect(panel.getByLabel("Row 2 column 4", { exact: true })).toHaveValue(
    ".1",
  );
});

test("cell copy/paste doubles blocks, supports row selection, and preserves undo", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openDemo(page);
  await page.getByRole("button", { name: "Data…", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Data", exact: true });
  await panel.getByRole("button", { name: "New table" }).click();
  await panel.getByLabel("Row 1 column 1", { exact: true }).fill(".02");
  const modifier = process.platform === "darwin" ? "Meta" : "Control";
  for (const count of [1, 2, 4, 8]) {
    await panel.getByLabel("Row 1 column 1", { exact: true }).click();
    if (count > 1)
      await panel
        .getByLabel(`Row ${count} column 1`, { exact: true })
        .click({ modifiers: ["Shift"] });
    await page.keyboard.press(`${modifier}+c`);
    expect(
      (await page.evaluate(() => navigator.clipboard.readText())).split("\n"),
    ).toHaveLength(count);
    await panel
      .getByLabel(`Row ${count + 1} column 1`, { exact: true })
      .click();
    await page.keyboard.press(`${modifier}+v`);
    await expect(
      panel.getByLabel(`Row ${count * 2} column 1`, { exact: true }),
    ).toHaveValue(".02");
  }
  await expect(panel.locator("tbody tr")).toHaveCount(17);
  await panel.getByRole("button", { name: "Undo table change" }).click();
  await expect(panel.locator("tbody tr")).toHaveCount(9);
  await panel
    .getByRole("button", { name: "Select row 1", exact: true })
    .click();
  await panel
    .getByRole("button", { name: "Select row 2", exact: true })
    .click({ modifiers: ["Shift"] });
  await page.keyboard.press(`${modifier}+c`);
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied.split("\n")).toHaveLength(2);
  expect(copied.split("\n")[0].split("\t")).toHaveLength(1);
});

test("dragging a rectangle copies two columns and Shift-arrow extends it", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openDemo(page);
  await page.getByRole("button", { name: "Data…", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Data", exact: true });
  const start = panel.getByLabel("Row 2 column 1", { exact: true }),
    end = panel.getByLabel("Row 3 column 2", { exact: true });
  const a = await start.boundingBox(),
    b = await end.boundingBox();
  await page.mouse.move(a!.x + 10, a!.y + 10);
  await page.mouse.down();
  await page.mouse.move(b!.x + 10, b!.y + 10, { steps: 10 });
  await page.mouse.up();
  await expect(panel.locator(".fit-cell-selected")).toHaveCount(4);
  await page.keyboard.press("ControlOrMeta+c");
  expect(
    (await page.evaluate(() => navigator.clipboard.readText())).split("\n"),
  ).toHaveLength(2);
  await start.click();
  await page.keyboard.press("Shift+ArrowDown");
  await page.keyboard.press("Shift+ArrowRight");
  await expect(panel.locator(".fit-cell-selected")).toHaveCount(4);
});

test("a full page keeps the next blank paste destination reachable", async ({
  page,
}) => {
  await openDemo(page);
  await page.locator("input[type=file]").setInputFiles({
    name: "hundred.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      Array.from({ length: 100 }, (_, i) => `${i},.02`).join("\n"),
    ),
  });
  const panel = page.getByRole("dialog", { name: "Data", exact: true });
  await panel.getByRole("button", { name: "Next rows" }).click();
  await expect(
    panel.getByLabel("Row 101 column 1", { exact: true }),
  ).toHaveValue("");
});

test("table undo groups typing by cell, supports redo, and starts a new branch after edits", async ({
  page,
}) => {
  await openDemo(page);
  await page.getByRole("button", { name: "Data…", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Data", exact: true });
  const first = panel.getByLabel("Row 2 column 2", { exact: true }),
    second = panel.getByLabel("Row 3 column 2", { exact: true });
  const original = await first.inputValue(),
    originalSecond = await second.inputValue();
  const mod = process.platform === "darwin" ? "Meta" : "Control";
  await first.click();
  await first.pressSequentially("123.456");
  await expect(first).toHaveValue("123.456");
  await page.keyboard.press(`${mod}+z`);
  await expect(first).toHaveValue(original);
  await expect(
    panel.getByRole("button", { name: "Undo table change" }),
  ).toBeDisabled();
  await page.keyboard.press(`${mod}+Shift+z`);
  await expect(first).toHaveValue("123.456");
  await second.click();
  await second.pressSequentially("789.012");
  await panel.getByRole("button", { name: "Undo table change" }).click();
  await expect(second).toHaveValue(originalSecond);
  await expect(first).toHaveValue("123.456");
  await panel.getByRole("button", { name: "Undo table change" }).click();
  await expect(first).toHaveValue(original);
  await panel.getByRole("button", { name: "Redo table change" }).click();
  await expect(first).toHaveValue("123.456");
  await second.click();
  await second.pressSequentially("inf");
  await expect(
    panel.getByRole("button", { name: "Redo table change" }),
  ).toBeDisabled();
  await expect(
    panel.getByRole("button", { name: "Use these data" }),
  ).toBeDisabled();
  await page.keyboard.press(`${mod}+z`);
  await expect(second).toHaveValue(originalSecond);
  await expect(
    panel.getByRole("button", { name: "Use these data" }),
  ).toBeEnabled();
});

test("table checkpoints restore metadata and row operations without treating selections as edits", async ({
  page,
}) => {
  await openDemo(page);
  await page.getByRole("button", { name: "Data…", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Data", exact: true });
  await panel.getByLabel("Row 2 column 1", { exact: true }).click();
  await panel
    .getByLabel("Row 3 column 2", { exact: true })
    .click({ modifiers: ["Shift"] });
  await expect(
    panel.getByRole("button", { name: "Undo table change" }),
  ).toBeDisabled();
  await panel.getByText("Import options", { exact: true }).click();
  const unit = panel.getByLabel("x unit", { exact: true });
  await unit.fill("");
  await unit.pressSequentially("milliseconds");
  await panel.getByRole("button", { name: "Undo table change" }).click();
  await expect(unit).toHaveValue("s");
  await panel.getByRole("button", { name: "Redo table change" }).click();
  await expect(unit).toHaveValue("milliseconds");
  const count = await panel.locator("tbody tr").count();
  await panel.getByRole("button", { name: "Add row", exact: true }).click();
  await expect(panel.locator("tbody tr")).toHaveCount(count + 1);
  await panel.getByRole("button", { name: "Undo table change" }).click();
  await expect(panel.locator("tbody tr")).toHaveCount(count);
  await panel.getByRole("button", { name: "Redo table change" }).click();
  await expect(panel.locator("tbody tr")).toHaveCount(count + 1);
});

test("deleting an unused column preserves assignments, values and undo", async ({
  page,
}) => {
  await openDemo(page);
  await page.locator("input[type=file]").setInputFiles({
    name: "columns.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("id,time,height,sigma\na,0,2,.1\nb,1,3,.2\nc,2,4,.3"),
  });
  const panel = page.getByRole("dialog", { name: "Data", exact: true });
  await panel.getByLabel("sigma column", { exact: true }).selectOption("3");
  await panel.getByRole("button", { name: "Use these data" }).click();
  await page.getByLabel("Analysis", { exact: true }).selectOption("quadratic");
  await page.getByRole("button", { name: "Data…", exact: true }).click();
  await panel
    .getByLabel("Select column 2", { exact: true })
    .click({ button: "right" });
  await expect(
    panel.getByLabel("Delete column 2", { exact: true }),
  ).toBeDisabled();
  await panel
    .getByLabel("Select column 1", { exact: true })
    .click({ button: "right" });
  await panel.getByLabel("Delete column 1", { exact: true }).click();
  await expect(panel.getByLabel("x column", { exact: true })).toHaveValue("0");
  await expect(panel.getByLabel("sigma column", { exact: true })).toHaveValue(
    "2",
  );
  await expect(panel.getByLabel("Row 2 column 1", { exact: true })).toHaveValue(
    "0",
  );
  await panel.getByLabel("Undo table change").click();
  await expect(panel.getByLabel("Row 2 column 1", { exact: true })).toHaveValue(
    "a",
  );
  await expect(panel.getByLabel("sigma column", { exact: true })).toHaveValue(
    "3",
  );
  await panel.getByLabel("Redo table change").click();
  await panel.getByRole("button", { name: "Use these data" }).click();
  await expect(page.getByLabel("Analysis", { exact: true })).toHaveValue(
    "quadratic",
  );
  await page.getByRole("button", { name: "Data…", exact: true }).click();
  await expect(panel.getByLabel("Row 2 column 3", { exact: true })).toHaveValue(
    ".1",
  );
});

test("leading comments can be declared headings and middle text must be corrected", async ({
  page,
}) => {
  await openDemo(page);
  await page.locator("input[type=file]").setInputFiles({
    name: "comments.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "# Experiment\n# Operator\ntime,height\n0,2\n1,inf\n2,4",
    ),
  });
  const panel = page.getByRole("dialog", { name: "Data", exact: true });
  await panel.getByLabel("Header rows", { exact: true }).fill("3");
  await panel.getByLabel("x column", { exact: true }).selectOption("0");
  await panel.getByLabel("y column", { exact: true }).selectOption("1");
  await expect(
    panel.getByRole("button", { name: "Use these data" }),
  ).toBeDisabled();
  await panel.getByLabel("Row 5 column 2", { exact: true }).fill("3");
  await expect(
    panel.getByRole("button", { name: "Use these data" }),
  ).toBeEnabled();
  await expect(panel.getByLabel("Row 1 column 1", { exact: true })).toHaveValue(
    "# Experiment",
  );
});

test("imported preamble and edited source notes survive session save", async ({
  page,
}) => {
  await openDemo(page);
  await page.locator("input[type=file]").setInputFiles({
    name: "notes.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("# My experiment\ntime,height\n0,2\n1,5\n2,8"),
  });
  const panel = page.getByRole("dialog", { name: "Data", exact: true });
  await panel.getByLabel("Header rows", { exact: true }).fill("2");
  await panel.getByLabel("x column", { exact: true }).selectOption("0");
  await panel.getByLabel("y column", { exact: true }).selectOption("1");
  await panel.getByRole("button", { name: "Use these data" }).click();
  await expect(page.getByLabel("Source notes", { exact: true })).toHaveValue(
    "notes.csv\n# My experiment",
  );
  await page
    .getByLabel("Source notes", { exact: true })
    .fill("My experiment\nRepeated on Wednesday");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save session" }).click();
  const bytes = await readFile((await (await download).path())!);
  const saved = JSON.parse(bytes.toString());
  expect(saved.request.source.context).toBe(
    "My experiment\nRepeated on Wednesday",
  );
  expect(saved.dataTable.cells[0]).toEqual(["# My experiment"]);
  await page.locator("input[type=file]").setInputFiles({
    name: "notes.trksess",
    mimeType: "application/json",
    buffer: bytes,
  });
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await expect(page.getByLabel("Source notes", { exact: true })).toHaveValue(
    "My experiment\nRepeated on Wednesday",
  );
});

test("sessions open for review and Cancel preserves the current analysis", async ({
  page,
}) => {
  await openDemo(page);
  await page
    .locator("input[type=file]")
    .setInputFiles("examples/fit/cubic-demo.trksess");
  const panel = page.getByRole("dialog", { name: "Data", exact: true });
  await expect(panel).toBeVisible();
  const accept = await panel
    .getByRole("button", { name: "Use these data" })
    .boundingBox();
  const grid = await panel
    .getByRole("table", { name: "Paste data table" })
    .boundingBox();
  expect(accept!.y + accept!.height).toBeLessThan(grid!.y);
  await panel.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByLabel("Analysis", { exact: true })).toHaveValue(
    "constant-acceleration",
  );
  await page
    .locator("input[type=file]")
    .setInputFiles("examples/fit/cubic-demo.trksess");
  await panel.getByRole("button", { name: "Use these data" }).click();
  await expect(page.getByLabel("Analysis", { exact: true })).toHaveValue(
    "cubic",
  );
});

test("column headings select contents; Delete clears and context menu removes columns", async ({
  page,
}) => {
  await openDemo(page);
  await page
    .locator("input[type=file]")
    .setInputFiles("examples/fit/import-curiosities.csv");
  const panel = page.getByRole("dialog", { name: "Data", exact: true });
  await expect(panel.getByLabel("Header rows", { exact: true })).toHaveValue(
    "4",
  );
  await expect(panel.getByLabel("x column", { exact: true })).toHaveValue("1");
  await expect(panel.getByLabel("y column", { exact: true })).toHaveValue("2");
  await expect(
    panel.getByLabel("Row 4 column 2", { exact: true }),
  ).not.toHaveAttribute("aria-invalid", "true");
  const heading = panel.getByLabel("Select column 5", { exact: true });
  await heading.click();
  await expect(heading).toHaveAttribute("aria-selected", "true");
  await heading.press("Backspace");
  await expect(panel.getByLabel("Row 5 column 5", { exact: true })).toHaveValue(
    "",
  );
  await expect(panel.getByLabel("Row 5 column 4", { exact: true })).toHaveValue(
    "0.1",
  );
  await expect(panel.getByLabel("Undo table change")).toHaveAttribute(
    "title",
    /Clear cells/,
  );
  await panel.getByLabel("Undo table change").click();
  await expect(panel.getByLabel("Row 5 column 5", { exact: true })).toHaveValue(
    "ordinary row",
  );
  await heading.click({ button: "right" });
  await panel
    .getByRole("menuitem", { name: "Delete column 5", exact: true })
    .click();
  await expect(
    panel.getByLabel("Select column 5", { exact: true }),
  ).toHaveCount(0);
  await panel.getByLabel("Undo table change").click();
  await expect(panel.getByLabel("Row 5 column 5", { exact: true })).toHaveValue(
    "ordinary row",
  );
});

test("copied CSV and pasted reports start with dataset names and keep comments at the bottom", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openDemo(page);
  await page.locator("input[type=file]").setInputFiles({
    name: "experiment.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("# A useful comment\ntime,height\n0,2\n1,5\n2,8"),
  });
  const panel = page.getByRole("dialog", { name: "Data", exact: true });
  await panel.getByRole("button", { name: "Use these data" }).click();
  await page.getByRole("button", { name: "Fit selected observations" }).click();
  await expect(page.locator(".fit-status")).toHaveText("Fitted");
  await page.getByRole("button", { name: "Copy report", exact: true }).click();
  const fileReport = await page.evaluate(() => navigator.clipboard.readText());
  expect(fileReport.split("\r\n")[0]).toBe("Dataset\texperiment.csv");
  expect(fileReport.indexOf("# A useful comment")).toBeGreaterThan(
    fileReport.indexOf("Row\tx\ty\tpredicted\tresidual"),
  );
  await page.getByRole("button", { name: "Data…", exact: true }).click();
  await panel.getByRole("button", { name: "New table" }).click();
  await panel.getByLabel("Row 1 column 1", { exact: true }).evaluate((el) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData("text", "time\theight\n0\t2\n1\t5\n2\t8");
    el.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await panel.getByRole("button", { name: "Use these data" }).click();
  await page.getByRole("button", { name: "Fit selected observations" }).click();
  await expect(page.locator(".fit-status")).toHaveText("Fitted");
  await page.getByRole("button", { name: "Copy report", exact: true }).click();
  const pastedReport = await page.evaluate(() =>
    navigator.clipboard.readText(),
  );
  expect(pastedReport.split("\r\n")[0]).toBe("Dataset\tPasted data");
  for (const heading of ["Parameter\t", "Statistic\t", "Row\t"])
    expect(
      pastedReport.split("\r\n").findIndex((line) => line.startsWith(heading)),
    ).toBe(
      fileReport.split("\r\n").findIndex((line) => line.startsWith(heading)),
    );
});

test("table blocks copy between independent windows and saving names a pasted dataset", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openDemo(page);
  await page.getByRole("button", { name: "Data…", exact: true }).click();
  const source = page.getByRole("dialog", { name: "Data", exact: true });
  await source
    .getByRole("button", { name: "Select entire table", exact: true })
    .click();
  await page.keyboard.press("ControlOrMeta+c");
  expect(
    (await page.evaluate(() => navigator.clipboard.readText())).split("\n"),
  ).toHaveLength(62);

  await source.getByLabel("Row 1 column 1", { exact: true }).click();
  await source
    .getByLabel("Row 4 column 2", { exact: true })
    .click({ modifiers: ["Shift"] });
  await page.keyboard.press("ControlOrMeta+c");
  const other = await context.newPage();
  await openDemo(other);
  await other.getByRole("button", { name: "Data…", exact: true }).click();
  const destination = other.getByRole("dialog", { name: "Data", exact: true });
  await destination.getByRole("button", { name: "New table" }).click();
  await destination.getByLabel("Row 1 column 1", { exact: true }).click();
  await destination
    .getByLabel("Row 1 column 1", { exact: true })
    .press(process.platform === "darwin" ? "Meta+v" : "Control+v");
  await expect(
    destination.getByLabel("Row 2 column 2", { exact: true }),
  ).toHaveValue(
    await source.getByLabel("Row 2 column 2", { exact: true }).inputValue(),
  );
  await destination.getByRole("button", { name: "Use these data" }).click();
  await other
    .getByRole("button", { name: "Fit selected observations" })
    .click();
  await expect(other.locator(".fit-status")).toHaveText("Fitted");
  const download = other.waitForEvent("download");
  await other.getByRole("button", { name: "Save session" }).click();
  const saved = JSON.parse(
    await readFile((await (await download).path())!, "utf8"),
  );
  expect(saved.request.dataset.label).toBe("analysis");
  await other.getByRole("button", { name: "Copy report", exact: true }).click();
  expect(
    (await other.evaluate(() => navigator.clipboard.readText())).split(
      "\r\n",
    )[0],
  ).toBe("Dataset\tanalysis");
  await expect(
    source.getByLabel("Row 2 column 1", { exact: true }),
  ).toHaveValue("0");
  await other.close();
});

test("print preview includes both vector plots and results without interactive controls in print", async ({
  page,
}) => {
  await openDemo(page);
  await page.getByRole("button", { name: "Fit selected observations" }).click();
  await expect(page.locator(".fit-status")).toHaveText("Fitted");
  await page.getByRole("button", { name: "Print", exact: true }).click();
  const preview = page.getByRole("dialog", {
    name: "Print report",
    exact: true,
  });
  await expect(
    preview.getByRole("img", { name: "Data and fitted curve", exact: true }),
  ).toBeVisible();
  await expect(
    preview.getByRole("img", { name: "Residual plot", exact: true }),
  ).toBeVisible();
  await expect(preview).toContainText("Source");
  await expect(preview).toContainText("Standard error");
  await page.evaluate(() => {
    window.print = () => {
      document.documentElement.dataset.printCalled = "yes";
    };
  });
  await preview.getByRole("button", { name: "Print…", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-print-called",
    "yes",
  );
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".fit-header")).toBeHidden();
  await expect(
    preview.getByRole("button", { name: "Print…", exact: true }),
  ).toBeHidden();
  await expect(
    preview.getByRole("img", { name: "Data and fitted curve", exact: true }),
  ).toBeVisible();
  const parameterBox = await preview
    .getByRole("table", { name: "Print parameters", exact: true })
    .boundingBox();
  const statisticsBox = await preview
    .getByRole("table", { name: "Print statistics", exact: true })
    .boundingBox();
  expect(parameterBox!.x + parameterBox!.width).toBeLessThanOrEqual(
    statisticsBox!.x,
  );
  expect(Math.abs(parameterBox!.y - statisticsBox!.y)).toBeLessThan(1);
  const pdf = await page.pdf({
    path: ".tools/fit-report.pdf",
    format: "Letter",
    preferCSSPageSize: true,
    printBackground: true,
  });
  expect(pdf.length).toBeGreaterThan(10000);
  await page.emulateMedia({ media: "screen" });
  await preview
    .getByRole("button", { name: "Close preview", exact: true })
    .click();
});

test("Print works without a fit and keeps the entire framed graph inside scaled previews", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1120, height: 720 });
  await openDemo(page);
  for (const scale of ["1", "1.25", "1.5", "2"]) {
    await page.getByLabel("Display size", { exact: true }).selectOption(scale);
    await page.getByRole("button", { name: "Print", exact: true }).click();
    const preview = page.getByRole("dialog", {
      name: "Print report",
      exact: true,
    });
    await expect(preview).toContainText("Data only · no current fit");
    await expect(preview.locator("table,.curve")).toHaveCount(0);
    await expect(
      preview.getByRole("img", { name: "Residual plot", exact: true }),
    ).toHaveCount(0);
    const plot = preview.getByRole("img", {
      name: "Data and fitted curve",
      exact: true,
    });
    const p = await preview.boundingBox(),
      g = await plot.boundingBox();
    expect(p!.x).toBeGreaterThanOrEqual(0);
    expect(p!.x + p!.width).toBeLessThanOrEqual(1121);
    expect(g!.x + g!.width).toBeLessThanOrEqual(p!.x + p!.width);
    const geometry = await plot.evaluate((svg) => {
      const frame = svg.querySelector<SVGRectElement>(".fit-plot-frame")!;
      const clip = svg.querySelector<SVGRectElement>("clipPath rect")!;
      const last = [...svg.querySelectorAll<SVGCircleElement>("circle")].at(
        -1,
      )!;
      return {
        stroke: getComputedStyle(frame).stroke,
        width: getComputedStyle(frame).strokeWidth,
        clearance:
          clip.x.baseVal.value +
          clip.width.baseVal.value -
          last.cx.baseVal.value,
        radius: last.r.baseVal.value,
      };
    });
    expect(geometry.stroke).not.toBe("none");
    expect(parseFloat(geometry.width)).toBeGreaterThanOrEqual(1.5);
    expect(geometry.clearance).toBeGreaterThanOrEqual(geometry.radius);
    await preview
      .getByRole("button", { name: "Close preview", exact: true })
      .click();
  }
  await page.getByLabel("Display size", { exact: true }).selectOption("1");
  await page.getByRole("button", { name: "Print", exact: true }).click();
  await page.emulateMedia({ media: "print" });
  await page.pdf({
    path: ".tools/fit-data-only.pdf",
    format: "Letter",
    preferCSSPageSize: true,
    printBackground: true,
  });
  await page.emulateMedia({ media: "screen" });
  await page
    .getByRole("button", { name: "Close preview", exact: true })
    .click();
  await page.getByLabel("y0 value", { exact: true }).fill("3");
  await page.getByRole("button", { name: "Print", exact: true }).click();
  const manual = page.getByRole("dialog", {
    name: "Print report",
    exact: true,
  });
  await expect(manual).toContainText("Manual preview · not fitted");
  await expect(manual.locator(".curve")).toHaveCount(1);
  await expect(manual.locator("table")).toHaveCount(0);
});

test("plain column headings support dragging, modifier sets and batch menu actions", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openDemo(page);
  await page.locator("input[type=file]").setInputFiles({
    name: "sets.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("id,x,y,c,d,e\na,0,2,C0,D0,E0\nb,1,3,C1,D1,E1"),
  });
  const panel = page.getByRole("dialog", { name: "Data", exact: true });
  const heading = (n: number) =>
    panel.getByLabel(`Select column ${n}`, { exact: true });
  await expect(heading(1)).toHaveJSProperty("tagName", "TH");
  await expect(
    panel.getByRole("button", { name: "Select column 1", exact: true }),
  ).toHaveCount(0);
  const a = await heading(4).boundingBox(),
    b = await heading(6).boundingBox();
  await page.mouse.move(a!.x + a!.width / 2, a!.y + 10);
  await page.mouse.down();
  await page.mouse.move(b!.x + b!.width / 2, b!.y + 10, { steps: 8 });
  await page.mouse.up();
  for (const n of [4, 5, 6])
    await expect(heading(n)).toHaveAttribute("aria-selected", "true");
  await expect(panel.getByLabel("Undo table change")).toBeDisabled();
  await heading(5).click({ button: "right" });
  await panel.getByRole("menuitem", { name: "Copy", exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "c\td\te\nC0\tD0\tE0\nC1\tD1\tE1",
  );
  await heading(1).click();
  await heading(4).click({ modifiers: ["Alt"] });
  await heading(6).click({ modifiers: ["Alt"] });
  await heading(4).click({ modifiers: ["Alt"] });
  await expect(heading(4)).toHaveAttribute("aria-selected", "false");
  await heading(6).click({ button: "right" });
  await panel.getByRole("menuitem", { name: "Copy", exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "id\te\na\tE0\nb\tE1",
  );
  await heading(1).click({ button: "right" });
  await panel
    .getByRole("menuitem", { name: "Clear contents", exact: true })
    .click();
  await expect(panel.getByLabel("Row 2 column 1", { exact: true })).toHaveValue(
    "",
  );
  await expect(panel.getByLabel("Row 2 column 6", { exact: true })).toHaveValue(
    "",
  );
  await expect(panel.getByLabel("Row 2 column 4", { exact: true })).toHaveValue(
    "C0",
  );
  await panel.getByLabel("Undo table change").click();
  await expect(heading(6)).toHaveAttribute("aria-selected", "true");
  await heading(1).click({ button: "right" });
  await panel
    .getByRole("menuitem", { name: "Delete selected columns", exact: true })
    .click();
  await expect(panel.getByLabel("x column", { exact: true })).toHaveValue("0");
  await expect(panel.getByLabel("y column", { exact: true })).toHaveValue("1");
  await expect(panel.getByLabel("Row 2 column 3", { exact: true })).toHaveValue(
    "C0",
  );
  await expect(heading(5)).toHaveCount(0);
  await panel.getByLabel("Undo table change").click();
  await expect(panel.getByLabel("Row 2 column 6", { exact: true })).toHaveValue(
    "E0",
  );
  await panel.getByLabel("Redo table change").click();
  await expect(heading(5)).toHaveCount(0);
});

test("long print comments remain intact and continue after the fit summary", async ({
  page,
}) => {
  await openDemo(page);
  const lines = Array.from(
    { length: 100 },
    (_, i) =>
      `Comment ${i + 1}: repeated observations and experimental conditions.`,
  );
  await page.getByLabel("Source notes", { exact: true }).fill(lines.join("\n"));
  await page.getByRole("button", { name: "Fit selected observations" }).click();
  await expect(page.locator(".fit-status")).toHaveText("Fitted");
  await page.getByRole("button", { name: "Print", exact: true }).click();
  const preview = page.getByRole("dialog", {
    name: "Print report",
    exact: true,
  });
  await expect
    .poll(async () =>
      (
        await preview
          .locator(".report-notes-page .report-notes-text")
          .allTextContents()
      ).join(""),
    )
    .toBe(lines.join("\n"));
  await page.emulateMedia({ media: "print" });
  const summary = await preview.locator(".fit-print-results").boundingBox();
  const notes = await preview
    .locator(".report-notes-page")
    .first()
    .boundingBox();
  expect(notes!.y).toBeGreaterThan(summary!.y + summary!.height);
  await page.pdf({
    path: ".tools/fit-report-long-comments.pdf",
    format: "Letter",
    preferCSSPageSize: true,
    printBackground: true,
  });
});

test("axis units are editable beside assignments and label every screen and print graph", async ({
  page,
}) => {
  await openDemo(page);
  await page.getByRole("button", { name: "Data…", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Data", exact: true });
  await expect(panel.getByLabel("x unit", { exact: true })).toBeVisible();
  for (const name of ["x unit", "y unit"]) {
    const unit = panel.getByLabel(name, { exact: true });
    await expect(unit).toHaveAttribute("autocapitalize", "none");
    await expect(unit).toHaveAttribute("autocorrect", "off");
    await expect(unit).toHaveAttribute("spellcheck", "false");
    await unit.fill("m");
    await expect(unit).toHaveValue("m");
    await unit.pressSequentially("H");
    await expect(unit).toHaveValue("mH");
  }
  await panel.getByLabel("x unit", { exact: true }).fill("ms");
  await panel.getByLabel("y unit", { exact: true }).fill("cm");
  await panel.getByRole("button", { name: "Use these data" }).click();
  await page.getByRole("button", { name: "Fit selected observations" }).click();
  await expect(page.getByRole("status")).toHaveText("Fit complete");
  for (const plot of [
    page.getByRole("img", { name: "Data and fitted curve" }),
    page.getByRole("img", { name: "Residual plot" }),
  ]) {
    await expect(plot.locator(".fit-axis-label").first()).toHaveText(
      "Time [ms]",
    );
  }
  await expect(
    page
      .getByRole("img", { name: "Data and fitted curve" })
      .locator(".fit-axis-label")
      .last(),
  ).toHaveText("Height [cm]");
  await expect(
    page
      .getByRole("img", { name: "Residual plot" })
      .locator(".fit-axis-label")
      .last(),
  ).toHaveText("Residual [cm]");
  await page.getByRole("button", { name: "Print", exact: true }).click();
  const report = page.getByRole("dialog", { name: "Print report" });
  await expect(report.locator(".fit-axis-label")).toHaveText([
    "Time [ms]",
    "Height [cm]",
    "Time [ms]",
    "Residual [cm]",
  ]);
});

test("CSV units sit under column headings and can be cleared without changing measurements", async ({
  page,
}) => {
  await openDemo(page);
  await page.locator("input[type=file]").setInputFiles({
    name: "units.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Time (s),Height (cm)\n0,200\n1,300"),
  });
  const panel = page.getByRole("dialog", { name: "Data", exact: true });
  await expect(
    panel.locator("thead").getByLabel("x unit", { exact: true }),
  ).toHaveValue("s");
  await expect(
    panel.locator("thead").getByLabel("y unit", { exact: true }),
  ).toHaveValue("cm");
  await expect(
    panel.getByRole("button", { name: "Copy cells", exact: true }),
  ).toHaveCount(0);
  await panel.getByLabel("y unit", { exact: true }).fill("");
  await panel.getByRole("button", { name: "Use these data" }).click();
  await expect(
    page
      .getByRole("img", { name: "Data and fitted curve" })
      .locator(".fit-axis-label")
      .last(),
  ).toHaveText("Height");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save session" }).click();
  const saved = JSON.parse(
    await readFile((await (await download).path())!, "utf8"),
  );
  expect(saved.request.dataset.yColumn.unit).toBeNull();
  expect(saved.request.dataset.rows[0].y).toBe(200);
});

test("Data exports edited CSV with units and keeps the editor open", async ({
  page,
}) => {
  await openDemo(page);
  await page.locator("input[type=file]").setInputFiles({
    name: "sample.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "# source\nTime (s),Height (m),note\n0,2,first\n1,3,second",
    ),
  });
  const panel = page.getByRole("dialog", { name: "Data", exact: true });
  await panel
    .getByLabel("Row 3 column 2", { exact: true })
    .fill("2.123456789012345");
  await panel.getByLabel("y unit", { exact: true }).fill("cm");
  const pending = page.waitForEvent("download");
  await panel.getByRole("button", { name: "Export CSV…", exact: true }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe("sample.csv");
  const csv = await readFile((await download.path())!, "utf8");
  expect(csv).toBe(
    "# source\r\nTime (s),Height (cm),note\r\n0,2.123456789012345,first\r\n1,3,second\r\n",
  );
  await expect(panel).toBeVisible();
});

test("tables have no phantom third column and can insert, paste wider blocks, delete and undo", async ({
  page,
}) => {
  await openDemo(page);
  await page.getByRole("button", { name: "Data…", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Data", exact: true });
  await expect(panel.locator(".fit-column-heading")).toHaveCount(2);
  await panel.getByRole("button", { name: "Add column", exact: true }).click();
  await expect(panel.locator(".fit-column-heading")).toHaveCount(3);
  await panel
    .getByLabel("Select column 3", { exact: true })
    .click({ button: "right" });
  await panel
    .getByRole("menuitem", { name: "Delete column 3", exact: true })
    .click();
  await expect(panel.locator(".fit-column-heading")).toHaveCount(2);
  await panel.getByRole("button", { name: "Undo table change" }).click();
  await expect(panel.locator(".fit-column-heading")).toHaveCount(3);
  const cell = panel.getByLabel("Row 2 column 3", { exact: true });
  await cell.evaluate((element) => {
    const data = new DataTransfer();
    data.setData("text/plain", "11\t12\t13\n21\t22\t23");
    element.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await expect(panel.locator(".fit-column-heading")).toHaveCount(5);
  await expect(panel.getByLabel("Row 3 column 5", { exact: true })).toHaveValue(
    "23",
  );
  await panel
    .getByLabel("Select column 3", { exact: true })
    .click({ button: "right" });
  await panel
    .getByRole("menuitem", { name: "Delete column 3", exact: true })
    .click();
  await expect(panel.locator(".fit-column-heading")).toHaveCount(4);
  await expect(panel.getByLabel("Row 2 column 3", { exact: true })).toHaveValue(
    "12",
  );
  await panel.getByRole("button", { name: "Undo table change" }).click();
  await expect(panel.locator(".fit-column-heading")).toHaveCount(5);
  await panel
    .getByLabel("Select column 1", { exact: true })
    .click({ button: "right" });
  await panel
    .getByRole("menuitem", { name: "Insert column left", exact: true })
    .click();
  await expect(panel.getByLabel("x column", { exact: true })).toHaveValue("1");
  await expect(panel.getByLabel("y column", { exact: true })).toHaveValue("2");
  await expect(panel.getByLabel("x unit", { exact: true })).toHaveValue("s");
});

test("Millikan source columns survive noise changes, exclusions and fitting", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator("input[type=file]")
    .setInputFiles("examples/data/MillikanData.csv");
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await page
    .getByLabel("Noise model", { exact: true })
    .selectOption("supplied-common");
  await page.getByLabel("Y uncertainty", { exact: true }).fill("0.01");
  await page.getByLabel("Y uncertainty", { exact: true }).press("Enter");
  await page
    .getByLabel("Noise model", { exact: true })
    .selectOption("unknown-equal");
  await page
    .getByRole("button", { name: "Observations & exclusions", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: /^Include / })
    .first()
    .uncheck();
  await page.getByRole("button", { name: "Fit selected observations" }).click();
  await expect(page.getByRole("status")).toHaveText("Fit complete");
  await page.getByRole("button", { name: "Data…", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Data", exact: true });
  await expect(panel.getByLabel("Row 1 column 4", { exact: true })).toHaveValue(
    "mass_C (mm)",
  );
  await expect(panel.getByLabel("Row 1 column 3", { exact: true })).toHaveValue(
    "mass_A (mm)",
  );
  await expect(
    panel.getByLabel("y column", { exact: true }).locator("option"),
  ).toHaveCount(4);
});
