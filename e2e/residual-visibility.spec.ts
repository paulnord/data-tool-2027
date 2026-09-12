import { test, expect, type Locator, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function openData(page: Page, file: string) {
  await page.goto("/");
  await page.locator("input[type=file]").setInputFiles(`examples/data/${file}`);
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
}

async function showResiduals(page: Page, checked: boolean) {
  const menu = page.locator(".fit-settings-menu");
  await menu.locator("summary").click();
  await menu
    .getByRole("checkbox", { name: "Show residual plots", exact: true })
    .setChecked(checked);
  await menu.locator("summary").click();
}

async function saveSession(page: Page) {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save session", exact: true }).click();
  const download = await pending;
  return JSON.parse(await readFile((await download.path())!, "utf8"));
}

async function exportPlots(page: Page) {
  await page.locator(".fit-export-menu summary").click();
  const pending = page.waitForEvent("download");
  await page
    .getByRole("menuitem", { name: "SVG vector graphic", exact: true })
    .click();
  const download = await pending;
  const source = await readFile((await download.path())!, "utf8");
  return page.evaluate((svg) => {
    const document = new DOMParser().parseFromString(svg, "image/svg+xml");
    return [...document.querySelectorAll("svg > svg")].map((plot) => ({
      label: plot.getAttribute("aria-label"),
      viewBox: plot.getAttribute("viewBox"),
      text: plot.textContent,
    }));
  }, source);
}

async function frameHeight(plot: Locator) {
  return plot
    .locator(".fit-plot-frame")
    .evaluate((frame) => frame.getBoundingClientRect().height);
}

async function svgHeight(plot: Locator) {
  return plot.evaluate((svg) => svg.getBoundingClientRect().height);
}

async function xTicks(plot: Locator) {
  return plot.evaluate((node) => {
    const svg = node as SVGSVGElement;
    return [...svg.querySelectorAll<SVGTextElement>(":scope > text")]
      .filter(
        (text) =>
          Number(text.getAttribute("y")) === svg.viewBox.baseVal.height - 30,
      )
      .map((text) => text.textContent);
  });
}

test("Settings stays inside a scaled viewport, dismisses naturally, and identifies the scope of report controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await openData(page, "collision.csv");
  const menu = page.locator(".fit-settings-menu");
  const panel = menu.locator(".fit-settings-popover");
  for (const scale of ["1", "2"]) {
    await page.locator(".fit-display-menu summary").click();
    await page.getByLabel("Display size", { exact: true }).selectOption(scale);
    await menu.locator("summary").click();
    await expect(panel).toBeVisible();
    await expect
      .poll(() =>
        panel.evaluate((node) => {
          const rect = node.getBoundingClientRect();
          return Math.max(
            0,
            -rect.left,
            rect.right - innerWidth,
            -rect.top,
            rect.bottom - innerHeight,
          );
        }),
      )
      .toBeLessThanOrEqual(1);
    await expect(
      menu.getByRole("group", { name: "Graphs", exact: true }),
    ).toBeVisible();
    await expect(
      menu.getByRole("checkbox", { name: "Statistics", exact: true }),
    ).toBeEnabled();
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(menu.locator("summary")).toBeFocused();
    await menu.locator("summary").click();
    await expect(panel).toBeVisible();
    await page.mouse.click(4, 400);
    await expect(panel).toBeHidden();
  }
  for (const mode of ["multi-interval", "collision"]) {
    await page.getByLabel("Analysis", { exact: true }).selectOption(mode);
    await menu.locator("summary").click();
    const reports = menu.getByRole("group", {
      name: "Copy report sections",
      exact: true,
    });
    await expect(reports).toContainText("Single-fit reports");
    await expect(
      reports.getByRole("checkbox", { name: "Statistics", exact: true }),
    ).toBeDisabled();
    await expect(
      reports.getByRole("button", { name: "Technical report", exact: true }),
    ).toBeDisabled();
    await expect(
      menu.getByRole("checkbox", { name: "Show residual plots", exact: true }),
    ).toBeEnabled();
    await page.keyboard.press("Escape");
  }
});

test("residual visibility reallocates the single-fit figure in the display, both print layouts, and SVG without changing the fit or session", async ({
  page,
}) => {
  await openData(page, "ball-toss.trksess");
  await page.getByRole("button", { name: "Fit selected observations" }).click();
  await expect(page.getByRole("status")).toHaveText("Fit complete");
  const saved = await saveSession(page);
  const parameters = await page.locator(".parameter-result").allTextContents();
  expect(parameters).toHaveLength(3);
  const main = page.locator(
    '.fit-chart svg[aria-label="Data and fitted curve"]',
  );
  const residual = page.locator('.fit-chart svg[aria-label="Residual plot"]');
  await expect(residual).toBeVisible();
  const originalHeight = await frameHeight(main);
  const originalTicks = await xTicks(residual);
  expect(originalTicks.length).toBeGreaterThan(2);

  await page.locator(".fit-settings-menu summary").click();
  await expect(
    page.getByRole("checkbox", { name: "Show residual plots", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByLabel("Full-page graph when printing", { exact: true }),
  ).toHaveCount(0);
  await page.locator(".fit-settings-menu summary").click();

  await page.getByRole("button", { name: "Print", exact: true }).click();
  const preview = page.getByRole("dialog", {
    name: "Print report",
    exact: true,
  });
  await expect(preview.locator(".fit-print-graphs svg.fit-plot")).toHaveCount(
    2,
  );
  const originalPrintHeight = await frameHeight(
    preview.getByRole("img", { name: "Data and fitted curve", exact: true }),
  );
  await preview
    .getByRole("button", { name: "Close preview", exact: true })
    .click();

  await showResiduals(page, false);
  await expect(residual).toHaveCount(0);
  expect(await frameHeight(main)).toBeGreaterThan(originalHeight + 30);
  await expect(main.getByText("Time [s]", { exact: true })).toHaveCount(1);
  expect(await xTicks(main)).toEqual(originalTicks);
  await expect(page.locator(".fit-status")).toHaveText("Fitted");
  expect(await page.locator(".parameter-result").allTextContents()).toEqual(
    parameters,
  );
  expect(await saveSession(page)).toEqual(saved);

  const exported = await exportPlots(page);
  expect(exported.map((plot) => plot.label)).toEqual(["Data and fitted curve"]);
  expect(exported[0].text).toContain("Time [s]");
  expect(exported[0].viewBox).toBe(await main.getAttribute("viewBox"));

  await page.getByRole("button", { name: "Print", exact: true }).click();
  const printed = preview.getByRole("img", {
    name: "Data and fitted curve",
    exact: true,
  });
  await expect(preview.locator(".fit-print-graphs svg.fit-plot")).toHaveCount(
    1,
  );
  expect(await frameHeight(printed)).toBeGreaterThan(originalPrintHeight + 20);
  for (const fullPage of [false, true]) {
    await preview
      .getByRole("checkbox", { name: "Full-page graph", exact: true })
      .setChecked(fullPage);
    for (const media of ["screen", "print"] as const) {
      await page.emulateMedia({ media });
      await expect(
        preview.locator(".fit-print-graphs svg.fit-plot"),
      ).toHaveCount(1);
      await expect(printed.getByText("Time [s]", { exact: true })).toHaveCount(
        1,
      );
      expect(await xTicks(printed)).toEqual(originalTicks);
      await expect(
        preview.getByRole("table", { name: "Print parameters", exact: true }),
      ).toBeVisible();
    }
    await page.emulateMedia({ media: "screen" });
  }
  await preview
    .getByRole("button", { name: "Close preview", exact: true })
    .click();
  await showResiduals(page, true);
  await expect(residual).toBeVisible();
  expect(await frameHeight(main)).toBeCloseTo(originalHeight, 0);
  expect(await page.locator(".parameter-result").allTextContents()).toEqual(
    parameters,
  );
});

test("the global preference omits residuals from interval diagnostics while preserving fitted tables and larger labeled graphs in print and export", async ({
  page,
}) => {
  await openData(page, "oil-drop-intervals.csv");
  await page
    .getByLabel("Analysis", { exact: true })
    .selectOption("multi-interval");
  const workspace = page.getByRole("region", {
    name: "Multi-interval analysis",
    exact: true,
  });
  await page
    .getByLabel("Number of intervals", { exact: true })
    .selectOption("1");
  await page.getByLabel("Interval from", { exact: true }).fill("0.2");
  await page.getByLabel("Interval to", { exact: true }).fill("2.8");
  await page
    .getByLabel("Accept uncertainty assumptions", { exact: true })
    .check();
  await page
    .getByRole("button", { name: "Fit Interval 1", exact: true })
    .click();
  await expect(workspace.getByRole("status")).toHaveText(
    "Interval 1: 1 of 1 data series fitted",
  );
  const main = workspace.getByRole("img", {
    name: "Drop position interval plot",
    exact: true,
  });
  const residuals = workspace.locator('svg[aria-label$="residuals"]');
  await workspace.locator(".interval-result-diagnostics summary").click();
  await expect(residuals).toHaveCount(2);
  const originalHeight = await svgHeight(main);
  const parameters = workspace.getByRole("table", { name: /parameters$/ });
  const before = await parameters.allTextContents();

  await showResiduals(page, false);
  await expect(residuals).toHaveCount(0);
  expect(await svgHeight(main)).toBeGreaterThan(originalHeight + 40);
  await expect(main.getByText("Time [s]", { exact: true })).toHaveCount(1);
  expect(await parameters.allTextContents()).toEqual(before);
  const summaryPdf = await page.pdf({
    format: "Letter",
    printBackground: true,
  });
  expect(
    summaryPdf.toString("latin1").match(/\/Type\s*\/Page\b/g),
  ).toHaveLength(1);
  await page
    .getByLabel("Include diagnostics when printing", { exact: true })
    .check();
  await page.emulateMedia({ media: "print" });
  await expect(residuals).toHaveCount(0);
  await expect(main).toBeVisible();
  await expect(main.getByText("Time [s]", { exact: true })).toHaveCount(1);
  await expect(
    workspace.locator(".interval-result-diagnostics table"),
  ).toBeVisible();
  await page.emulateMedia({ media: "screen" });
  const exported = await exportPlots(page);
  expect(exported.map((plot) => plot.label)).toEqual([
    "Drop position interval plot",
  ]);
  expect(exported[0].text).toContain("Time [s]");
  expect(exported[0].viewBox).toBe(await main.getAttribute("viewBox"));
  await showResiduals(page, true);
  await expect(residuals).toHaveCount(2);
  expect(await svgHeight(main)).toBeCloseTo(originalHeight, 0);
  expect(await parameters.allTextContents()).toEqual(before);
});

test("hidden residuals stay hidden when switching to collision analysis and printing expanded fit details", async ({
  page,
}) => {
  await openData(page, "collision.csv");
  await showResiduals(page, false);
  await page.getByLabel("Analysis", { exact: true }).selectOption("collision");
  const workspace = page.getByRole("region", {
    name: "Collision analysis",
    exact: true,
  });
  await page
    .getByLabel("Accept uncertainty assumptions", { exact: true })
    .check();
  await page
    .getByRole("button", { name: "Fit before and after", exact: true })
    .click();
  await expect(workspace.getByRole("status")).toHaveText(
    "8 of 8 fits complete",
  );
  await workspace
    .getByRole("button", { name: "Show fit details", exact: true })
    .click();
  const plots = workspace.locator(".collision-charts svg.collision-plot");
  const residuals = workspace.locator('svg[aria-label$="residuals"]');
  const summary = workspace.getByRole("table", {
    name: "Collision velocity summary",
    exact: true,
  });
  const before = await summary.textContent();
  await expect(plots).toHaveCount(4);
  await expect(residuals).toHaveCount(0);
  const hiddenHeight = await svgHeight(plots.first());
  for (const plot of await plots.all())
    await expect(plot.getByText("Time [s]", { exact: true })).toHaveCount(1);
  const exported = await exportPlots(page);
  expect(exported.map((plot) => plot.label)).toEqual([
    "x1 versus time",
    "y1 versus time",
    "x2 versus time",
    "y2 versus time",
  ]);
  for (const plot of exported) expect(plot.text).toContain("Time [s]");
  const summaryPdf = await page.pdf({
    format: "Letter",
    printBackground: true,
  });
  expect(
    summaryPdf.toString("latin1").match(/\/Type\s*\/Page\b/g),
  ).toHaveLength(1);
  const a4Style = await page.addStyleTag({
    content: "@page { size: A4 portrait; margin: 15mm; }",
  });
  const a4Pdf = await page.pdf({
    preferCSSPageSize: true,
    printBackground: true,
  });
  expect(a4Pdf.toString("latin1").match(/\/Type\s*\/Page\b/g)).toHaveLength(1);
  await a4Style.evaluate((node) => node.remove());
  await page
    .getByLabel("Include fit details when printing", { exact: true })
    .check();
  await page.emulateMedia({ media: "print" });
  await expect(residuals).toHaveCount(0);
  await expect(workspace.locator(".collision-details")).toBeVisible();
  for (const plot of await plots.all()) {
    await expect(plot).toBeVisible();
    await expect(plot.getByText("Time [s]", { exact: true })).toHaveCount(1);
  }
  await page.emulateMedia({ media: "screen" });
  await showResiduals(page, true);
  await expect(residuals).toHaveCount(4);
  expect(await svgHeight(plots.first())).toBeLessThan(hiddenHeight - 30);
  expect(await summary.textContent()).toBe(before);
  await expect(workspace.getByRole("status")).toHaveText(
    "8 of 8 fits complete",
  );
});
