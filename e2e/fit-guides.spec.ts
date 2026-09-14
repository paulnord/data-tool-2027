import { test, expect, type Locator, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { syntheticDampedIntervalsFile } from "./support/dampedIntervals";

async function useData(page: Page, file: string) {
  await page.goto("/");
  await page.locator("input[type=file]").setInputFiles(file);
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
}

async function fit(page: Page) {
  await page
    .getByRole("button", { name: "Fit selected observations", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Fit complete");
}

async function xRange(page: Page, lo: number, hi: number) {
  const summary = page.getByLabel("Data X axis", { exact: true });
  await summary.click();
  await page.getByLabel("Data X minimum", { exact: true }).fill(String(lo));
  await page.getByLabel("Data X maximum", { exact: true }).fill(String(hi));
  await page.getByRole("button", { name: "Apply range", exact: true }).click();
  await summary.click();
}

async function saveSession(page: Page) {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save session", exact: true }).click();
  return JSON.parse(await readFile((await (await pending).path())!, "utf8"));
}

async function curveSpans(plot: Locator) {
  return plot.evaluate((svg) => {
    const frame = svg.querySelector<SVGRectElement>(".fit-plot-frame")!;
    const minimum = Number(svg.getAttribute("data-x-min"));
    const maximum = Number(svg.getAttribute("data-x-max"));
    const value = (position: number) =>
      minimum +
      ((position - frame.x.baseVal.value) / frame.width.baseVal.value) *
        (maximum - minimum);
    return [...svg.querySelectorAll<SVGPathElement>("path[data-fit-part]")].map(
      (path) => ({
        part: path.getAttribute("data-fit-part"),
        first: value(path.getPointAtLength(0).x),
        last: value(path.getPointAtLength(path.getTotalLength()).x),
        dash: getComputedStyle(path).strokeDasharray,
      }),
    );
  });
}

test("fit extensions use the included observation span, not view limits or interior exclusions", async ({
  page,
}) => {
  const session = JSON.parse(
    await readFile("examples/data/ball-toss.trksess", "utf8"),
  );
  const rows = session.request.dataset.rows;
  session.settings.excludedIds = rows
    .filter(
      (_: unknown, index: number) => index < 10 || index > 50 || index === 30,
    )
    .map((row: { id: string }) => row.id);
  await page.goto("/");
  await page.locator("input[type=file]").setInputFiles({
    name: "selected-span.trksess",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(session)),
  });
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  const plot = page.getByRole("img", {
    name: "Data and fitted curve",
    exact: true,
  });
  await expect(plot.locator("[data-fit-part]")).toHaveCount(0);
  await fit(page);
  const saved = await saveSession(page);
  const coefficient = await page
    .getByLabel("a value", { exact: true })
    .inputValue();
  await xRange(page, -1, 3);
  const spans = await curveSpans(plot);
  const support = [rows[10].x, rows[50].x];
  const extension = (support[1] - support[0]) * 0.1;
  const fitted = spans.filter((part) => part.part === "fitted");
  const tails = spans
    .filter((part) => part.part === "extrapolation")
    .sort((a, b) => a.first - b.first);
  expect(fitted).toHaveLength(1);
  expect(tails).toHaveLength(2);
  expect(fitted[0].first).toBeCloseTo(support[0], 5);
  expect(fitted[0].last).toBeCloseTo(support[1], 5);
  expect(fitted[0].dash).toBe("none");
  expect(tails[0].first).toBeCloseTo(support[0] - extension, 5);
  expect(tails[0].last).toBeCloseTo(support[0], 5);
  expect(tails[1].first).toBeCloseTo(support[1], 5);
  expect(tails[1].last).toBeCloseTo(support[1] + extension, 5);
  expect(tails.every((tail) => tail.dash !== "none")).toBe(true);
  await expect(plot.locator("[data-mean-position]")).toHaveCount(0);
  const bandSpan = await plot
    .locator(".fit-confidence-band")
    .evaluate((band) => {
      const svg = band.ownerSVGElement!;
      const frame = svg.querySelector<SVGRectElement>(".fit-plot-frame")!;
      const bounds = (band as SVGGraphicsElement).getBBox();
      const min = Number(svg.getAttribute("data-x-min")),
        max = Number(svg.getAttribute("data-x-max"));
      const value = (x: number) =>
        min +
        ((x - frame.x.baseVal.value) / frame.width.baseVal.value) * (max - min);
      return [value(bounds.x), value(bounds.x + bounds.width)];
    });
  expect(bandSpan[0]).toBeCloseTo(support[0], 5);
  expect(bandSpan[1]).toBeCloseTo(support[1], 5);
  const residual = page.getByRole("img", {
    name: "Residual plot",
    exact: true,
  });
  await expect(
    residual.locator(
      "[data-fit-part],[data-mean-position],.fit-confidence-band",
    ),
  ).toHaveCount(0);
  // Residual markers describe actual rows, including excluded observations shown
  // by the existing single-fit view; extending a curve must not invent samples.
  await expect(residual.locator("[data-row-id].point")).toHaveCount(
    rows.length,
  );
  await expect(page.locator(".fit-source")).toContainText("40 / 61");
  await expect(page.locator(".fit-status")).toHaveText("Fitted");
  expect(await page.getByLabel("a value", { exact: true }).inputValue()).toBe(
    coefficient,
  );
  expect(await saveSession(page)).toEqual(saved);
  await xRange(page, 0.5, 1.5);
  await expect(plot.locator('[data-fit-part="extrapolation"]')).toHaveCount(0);
});

async function enableMeanGuides(page: Page) {
  await page.locator(".fit-settings-menu summary").click();
  await page
    .getByRole("checkbox", {
      name: "Show fit guides when available",
      exact: true,
    })
    .check();
  await page.keyboard.press("Escape");
}

test("the damped mean-position guide uses fitted b and disappears with stale results", async ({
  page,
}) => {
  await useData(page, "examples/data/damped-sine.csv");
  await page
    .getByLabel("Analysis", { exact: true })
    .selectOption("damped-sine");
  const plot = page.getByRole("img", {
    name: "Data and fitted curve",
    exact: true,
  });
  await expect(plot.locator("[data-mean-position]")).toHaveCount(0);
  await fit(page);
  const baseline = Number(
    await page.getByLabel("b value", { exact: true }).inputValue(),
  );
  await expect(plot.locator("line[data-mean-position]")).toHaveCount(0);
  await enableMeanGuides(page);
  const guide = plot.locator("line[data-mean-position]");
  await expect(guide).toHaveCount(1);
  expect(Number(await guide.getAttribute("data-mean-position"))).toBeCloseTo(
    baseline,
    7,
  );
  const drawnValue = await guide.evaluate((line) => {
    const svg = line.ownerSVGElement!;
    const frame = svg.querySelector<SVGRectElement>(".fit-plot-frame")!;
    const min = Number(svg.getAttribute("data-y-min")),
      max = Number(svg.getAttribute("data-y-max"));
    const y = Number(line.getAttribute("y1"));
    return (
      min +
      (1 - (y - frame.y.baseVal.value) / frame.height.baseVal.value) *
        (max - min)
    );
  });
  expect(drawnValue).toBeCloseTo(baseline, 7);
  await page.getByRole("button", { name: "Print", exact: true }).click();
  const preview = page.getByRole("dialog", {
    name: "Print report",
    exact: true,
  });
  expect(
    Number(
      await preview
        .locator("line[data-mean-position]")
        .getAttribute("data-mean-position"),
    ),
  ).toBeCloseTo(baseline, 7);
  await expect(
    preview
      .getByRole("img", { name: "Residual plot", exact: true })
      .locator("[data-mean-position],[data-fit-part]"),
  ).toHaveCount(0);
  await preview
    .getByRole("button", { name: "Close preview", exact: true })
    .click();
  await page
    .getByLabel("b value", { exact: true })
    .fill(String(baseline + 0.1));
  await expect(page.locator(".fit-status")).toHaveText("Results stale");
  await expect(
    plot.locator(
      '[data-mean-position],[data-fit-part="fitted"],[data-fit-part="extrapolation"]',
    ),
  ).toHaveCount(0);
});

test("physical SVG exports retain mean guides and dashed extensions without extrapolated residuals", async ({
  page,
}, testInfo) => {
  await useData(page, "examples/data/damped-sine.csv");
  await page
    .getByLabel("Analysis", { exact: true })
    .selectOption("damped-sine");
  await fit(page);
  await enableMeanGuides(page);
  await xRange(page, -2, 12);
  const before = await page.locator(".parameter-result").allTextContents();
  const menu = page.locator(".fit-export-menu");
  await menu.locator("summary").click();
  await menu
    .getByRole("menuitem", { name: "Figure size…", exact: true })
    .click();
  const sizing = page.getByRole("dialog", { name: "Figure size", exact: true });
  await sizing.getByLabel("Width (mm)", { exact: true }).fill("85");
  await sizing.getByLabel("Height (mm)", { exact: true }).fill("60");
  await sizing.getByRole("button", { name: "Apply", exact: true }).click();
  await menu.locator("summary").click();
  const pending = page.waitForEvent("download");
  await menu
    .getByRole("menuitem", { name: "SVG vector graphic", exact: true })
    .click();
  const download = await pending;
  await download.saveAs(testInfo.outputPath("damped-guides.svg"));
  const source = await readFile((await download.path())!, "utf8");
  const result = await page.evaluate((text) => {
    const doc = new DOMParser().parseFromString(text, "image/svg+xml");
    const root = doc.documentElement;
    const plots = [...root.querySelectorAll<SVGSVGElement>(":scope > svg")];
    const frame = (plot: SVGSVGElement) => {
      const rect = plot.querySelector<SVGRectElement>(
        'rect[vector-effect="non-scaling-stroke"]',
      )!;
      return [rect.x.baseVal.value, rect.width.baseVal.value];
    };
    return {
      width: root.getAttribute("width"),
      height: root.getAttribute("height"),
      guides: plots[0].querySelectorAll("line[data-mean-position]").length,
      tails: [
        ...plots[0].querySelectorAll<SVGElement>(
          '[data-fit-part="extrapolation"]',
        ),
      ].map((path) => path.style.strokeDasharray),
      residualExtras: plots[1].querySelectorAll(
        "[data-fit-part],[data-mean-position]",
      ).length,
      frames: plots.map(frame),
    };
  }, source);
  expect(result.width).toBe("85mm");
  expect(result.height).toBe("60mm");
  expect(result.guides).toBe(1);
  expect(result.tails).toHaveLength(2);
  expect(result.tails.every((dash) => dash && dash !== "none")).toBe(true);
  expect(result.residualExtras).toBe(0);
  expect(result.frames[0][0]).toBeCloseTo(result.frames[1][0], 5);
  expect(result.frames[0][1]).toBeCloseTo(result.frames[1][1], 5);
  expect(await page.locator(".parameter-result").allTextContents()).toEqual(
    before,
  );
});

test("synthetic time intervals fit independently and keep distinct monochrome guides", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page
    .locator("input[type=file]")
    .setInputFiles(syntheticDampedIntervalsFile);
  await page.getByLabel("x column", { exact: true }).selectOption("2");
  await page.getByLabel("y column", { exact: true }).selectOption("1");
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await page
    .getByLabel("Analysis", { exact: true })
    .selectOption("multi-interval");
  const workspace = page.getByRole("region", {
    name: "Multi-interval analysis",
    exact: true,
  });
  await page
    .getByLabel("Number of intervals", { exact: true })
    .selectOption("2");
  const ranges = [
    [0, 1400],
    [1800, 4500],
  ];
  for (let index = 0; index < ranges.length; index++) {
    if (index)
      await page
        .getByRole("button", { name: "Interval 2", exact: true })
        .click();
    // Cover both user orders: choose the equation after a selected range, and
    // choose it first before the interval has any numeric limits.
    if (index)
      await page
        .getByLabel("Interval equation", { exact: true })
        .selectOption("damped-sine");
    await page
      .getByLabel("Interval from", { exact: true })
      .fill(String(ranges[index][0]));
    await page
      .getByLabel("Interval to", { exact: true })
      .fill(String(ranges[index][1]));
    if (!index)
      await page
        .getByLabel("Interval equation", { exact: true })
        .selectOption("damped-sine");
    await page
      .getByRole("button", { name: `Fit Interval ${index + 1}`, exact: true })
      .click();
    await expect(workspace.getByRole("status")).toHaveText(
      `Interval ${index + 1}: 1 of 1 data series fitted`,
    );
  }
  const plots = workspace.locator(
    ".interval-overview .interval-graphs svg.interval-plot",
  );
  const main = plots.first();
  await expect(main.locator('[data-fit-part="fitted"]')).toHaveCount(2);
  const baselines = await main
    .locator("line[data-mean-position]")
    .evaluateAll((lines) =>
      lines.map((line) => Number(line.getAttribute("data-mean-position"))),
    );
  expect(baselines).toHaveLength(2);
  expect(baselines[0]).toBeCloseTo(0.625, 5);
  expect(baselines[1]).toBeCloseTo(-0.35, 5);
  await expect(
    plots.nth(1).locator("[data-fit-part],[data-mean-position]"),
  ).toHaveCount(0);
  await expect(plots.nth(1).locator("[data-marker-shape]")).toHaveCount(
    279 + 536,
  );
  const tables = workspace.getByRole("table", { name: /parameters$/ });
  const resultsBeforeAppearance = await tables.allTextContents();
  await page.locator(".fit-display-menu summary").click();
  await page
    .getByRole("combobox", { name: "Colors", exact: true })
    .selectOption("mono");
  await page.locator(".fit-display-menu summary").click();
  const patterns = await main
    .locator('path[data-fit-part="extrapolation"]')
    .evaluateAll((paths) =>
      paths.map((path) => ({
        interval: path.getAttribute("data-interval-index"),
        dash: getComputedStyle(path).strokeDasharray,
        opacity: Number(getComputedStyle(path).opacity),
      })),
    );
  const first = patterns.find((path) => path.interval === "0")!;
  const second = patterns.find((path) => path.interval === "1")!;
  expect(first.dash).not.toBe("none");
  expect(second.dash).not.toBe("none");
  expect(first.dash).not.toBe(second.dash);
  expect(patterns.every((path) => path.opacity > 0 && path.opacity < 1)).toBe(
    true,
  );
  expect(await tables.allTextContents()).toEqual(resultsBeforeAppearance);
  await expect(main.locator("line[data-mean-position]")).toHaveCount(2);
  await workspace
    .locator(".interval-overview .interval-graphs")
    .screenshot({ path: testInfo.outputPath("synthetic-interval-guides.png") });
});
