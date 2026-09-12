import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function openData(page: Page, file = "ball-toss.trksess") {
  await page.goto("/");
  await page.locator("input[type=file]").setInputFiles(`examples/data/${file}`);
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
}

async function openSize(page: Page) {
  const menu = page.locator(".fit-export-menu");
  if ((await menu.getAttribute("open")) === null)
    await menu.locator("summary").click();
  await menu
    .getByRole("menuitem", { name: "Figure size…", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Figure size", exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function applySize(
  page: Page,
  width: number,
  height: number,
  font = 9,
  dpi = 300,
) {
  const dialog = await openSize(page);
  await dialog.getByLabel("Width (mm)", { exact: true }).fill(String(width));
  await dialog.getByLabel("Height (mm)", { exact: true }).fill(String(height));
  await dialog
    .getByLabel("Label size (pt)", { exact: true })
    .fill(String(font));
  await dialog
    .getByRole("combobox", { name: "PNG resolution", exact: true })
    .selectOption(String(dpi));
  await dialog.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(dialog).toHaveCount(0);
}

async function downloadGraph(
  page: Page,
  format: "svg" | "png" | "pdf",
  testInfo?: TestInfo,
  name = "figure",
) {
  const menu = page.locator(".fit-export-menu");
  if ((await menu.getAttribute("open")) === null)
    await menu.locator("summary").click();
  const pending = page.waitForEvent("download");
  await menu
    .getByRole("menuitem", {
      name:
        format === "png"
          ? "PNG image"
          : `${format.toUpperCase()} vector graphic`,
      exact: true,
    })
    .click();
  const download = await pending;
  expect(download.suggestedFilename()).toMatch(new RegExp(`\\.${format}$`));
  if (testInfo) await download.saveAs(testInfo.outputPath(`${name}.${format}`));
  const bytes = await readFile((await download.path())!);
  await expect(page.locator(".fit-export-render")).toHaveCount(0);
  return bytes;
}

async function inspectSvg(page: Page, bytes: Buffer) {
  return page.evaluate((source) => {
    const document = new DOMParser().parseFromString(source, "image/svg+xml");
    const root = document.documentElement;
    return {
      width: root.getAttribute("width"),
      height: root.getAttribute("height"),
      viewBox: root.getAttribute("viewBox")!.split(/\s+/).map(Number),
      plots: [...root.querySelectorAll<SVGSVGElement>(":scope > svg")].map(
        (plot) => {
          const box = plot.viewBox.baseVal;
          const marker = plot.querySelector<SVGCircleElement>(
            'circle[data-marker-shape="circle"]',
          );
          return {
            label: plot.getAttribute("aria-label"),
            width: Number(plot.getAttribute("width")),
            height: Number(plot.getAttribute("height")),
            viewBox: [box.x, box.y, box.width, box.height],
            xScale: Number(plot.getAttribute("width")) / box.width,
            yScale: Number(plot.getAttribute("height")) / box.height,
            markerRadius: marker?.r.baseVal.value ?? null,
            markerCount: plot.querySelectorAll("[data-marker-shape]").length,
            modelStrokeWidths: [
              ...plot.querySelectorAll<SVGPathElement>(
                "path:not([data-marker-shape]):not([data-sigma])",
              ),
            ]
              .filter(
                (path) =>
                  path.style.fill === "none" && path.style.stroke !== "none",
              )
              .map((path) => Number.parseFloat(path.style.strokeWidth)),
            labels: [...plot.querySelectorAll<SVGTextElement>("text")].map(
              (label) => ({
                text: label.textContent,
                fontSize: Number.parseFloat(label.style.fontSize),
              }),
            ),
          };
        },
      ),
    };
  }, bytes.toString("utf8"));
}

function expectPhysicalSvg(
  graph: Awaited<ReturnType<typeof inspectSvg>>,
  width: number,
  height: number,
  font: number,
  count: number,
) {
  expect(graph.width).toBe(`${width}mm`);
  expect(graph.height).toBe(`${height}mm`);
  // Browser SVG geometry uses float32 internally; sub-millipixel roundoff is
  // harmless while the exported millimetre dimensions remain exact.
  expect(graph.viewBox[2]).toBeCloseTo((width * 96) / 25.4, 3);
  expect(graph.viewBox[3]).toBeCloseTo((height * 96) / 25.4, 3);
  expect(graph.plots).toHaveLength(count);
  expect(graph.plots.reduce((sum, plot) => sum + plot.height, 0)).toBeCloseTo(
    graph.viewBox[3],
    3,
  );
  for (const plot of graph.plots) {
    // Equal coordinate scales keep circular markers circular and fixed-size
    // labels legible when the requested aspect ratio changes.
    expect(plot.xScale).toBeCloseTo(1, 5);
    expect(plot.yScale).toBeCloseTo(1, 5);
    expect(plot.markerCount).toBeGreaterThan(2);
    expect(plot.markerRadius).toBeGreaterThan(0);
    if (plot.label === "Data and fitted curve") {
      expect(plot.modelStrokeWidths.length).toBeGreaterThan(0);
    }
    // CSS pixels convert to points at 72/96. Check emitted styles rather
    // than the stylesheet: screen rules must not override export widths.
    for (const stroke of plot.modelStrokeWidths)
      expect((stroke * 72) / 96).toBeCloseTo(0.75, 5);
    for (const label of plot.labels)
      expect(label.fontSize).toBeCloseTo((font * 96) / 72, 3);
  }
}

function expectPhysicalPng(
  bytes: Buffer,
  width: number,
  height: number,
  dpi: number,
) {
  expect(bytes.subarray(1, 4).toString()).toBe("PNG");
  expect(bytes.readUInt32BE(16)).toBe(Math.round((width * dpi) / 25.4));
  expect(bytes.readUInt32BE(20)).toBe(Math.round((height * dpi) / 25.4));
  const density = [];
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    if (bytes.toString("ascii", offset + 4, offset + 8) === "pHYs")
      density.push({
        x: bytes.readUInt32BE(offset + 8),
        y: bytes.readUInt32BE(offset + 12),
        unit: bytes[offset + 16],
      });
    offset += length + 12;
  }
  expect(density).toEqual([
    { x: Math.round(dpi / 0.0254), y: Math.round(dpi / 0.0254), unit: 1 },
  ]);
}

function expectPhysicalPdf(bytes: Buffer, width: number, height: number) {
  const source = bytes.toString("latin1");
  expect(source).toMatch(/^%PDF-/);
  expect(source.match(/\/Type\s*\/Page\b/g)).toHaveLength(1);
  expect(source).not.toMatch(/\/Subtype\s*\/Image\b/);
  expect(source).toContain("/FontFile2");
  const mediaBox = source.match(
    /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/,
  )!;
  expect(Number(mediaBox[1])).toBeCloseTo((width * 72) / 25.4, 4);
  expect(Number(mediaBox[2])).toBeCloseTo((height * 72) / 25.4, 4);
}

async function saveSession(page: Page) {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save session", exact: true }).click();
  const download = await pending;
  return JSON.parse(await readFile((await download.path())!, "utf8"));
}

async function hideResiduals(page: Page) {
  await page.locator(".fit-settings-menu summary").click();
  await page
    .getByRole("checkbox", { name: "Show residual plots", exact: true })
    .uncheck();
  await page.keyboard.press("Escape");
}

test("publication presets produce physical SVG/PDF sizes and 300/600 dpi PNGs without stretching markers, shrinking labels, or changing the fit", async ({
  page,
}, testInfo) => {
  await openData(page);
  await page
    .getByRole("button", { name: "Fit selected observations", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Fit complete");
  const saved = await saveSession(page);
  const parameters = await page.locator(".parameter-result").allTextContents();
  const liveBox = await page
    .locator('.fit-chart svg[aria-label="Data and fitted curve"]')
    .getAttribute("viewBox");
  const radii: number[] = [];
  for (const [preset, width, height, dpi] of [
    ["single", 85, 60, 300],
    ["double", 170, 100, 600],
  ] as const) {
    const dialog = await openSize(page);
    await dialog
      .getByRole("combobox", { name: "Size preset", exact: true })
      .selectOption(preset);
    await expect(dialog.getByLabel("Width (mm)", { exact: true })).toHaveValue(
      String(width),
    );
    await expect(dialog.getByLabel("Height (mm)", { exact: true })).toHaveValue(
      String(height),
    );
    await dialog
      .getByRole("combobox", { name: "PNG resolution", exact: true })
      .selectOption(String(dpi));
    await dialog.getByRole("button", { name: "Apply", exact: true }).click();
    const graph = await inspectSvg(
      page,
      await downloadGraph(page, "svg", testInfo, preset),
    );
    expectPhysicalSvg(graph, width, height, 9, 2);
    radii.push(graph.plots[0].markerRadius!);
    expect(graph.plots[1].labels.map((label) => label.text)).toContain(
      "Time [s]",
    );
    expectPhysicalPng(
      await downloadGraph(page, "png", testInfo, preset),
      width,
      height,
      dpi,
    );
    expectPhysicalPdf(
      await downloadGraph(page, "pdf", testInfo, preset),
      width,
      height,
    );
  }
  expect(radii[0]).toBeCloseTo(radii[1], 6);
  expect(await saveSession(page)).toEqual(saved);
  expect(await page.locator(".parameter-result").allTextContents()).toEqual(
    parameters,
  );
  await expect(
    page.locator('.fit-chart svg[aria-label="Data and fitted curve"]'),
  ).toHaveAttribute("viewBox", liveBox!);
  await expect(page.locator(".fit-status")).toHaveText("Fitted");
});

test("opening or cancelling figure size preserves quick exports; custom sizing validates input and respects hidden residuals", async ({
  page,
}) => {
  await openData(page);
  await page
    .getByRole("button", { name: "Fit selected observations", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Fit complete");
  const initial = await inspectSvg(page, await downloadGraph(page, "svg"));
  const firstDialog = await openSize(page);
  await firstDialog
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  expect(await inspectSvg(page, await downloadGraph(page, "svg"))).toEqual(
    initial,
  );
  await applySize(page, 120, 80, 11);
  const invalidDialog = await openSize(page);
  await expect(
    invalidDialog.getByRole("combobox", { name: "Size preset", exact: true }),
  ).toHaveValue("custom");
  await invalidDialog.getByLabel("Width (mm)", { exact: true }).fill("0");
  await invalidDialog
    .getByRole("button", { name: "Apply", exact: true })
    .click();
  await expect(invalidDialog.getByRole("alert")).toContainText("width");
  await expect(invalidDialog).toBeVisible();
  await invalidDialog
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await hideResiduals(page);
  const graph = await inspectSvg(page, await downloadGraph(page, "svg"));
  expectPhysicalSvg(graph, 120, 80, 11, 1);
  expect(graph.plots[0].label).toBe("Data and fitted curve");
  expect(graph.plots[0].labels.map((label) => label.text)).toContain(
    "Time [s]",
  );
  const savedDialog = await openSize(page);
  await expect(
    savedDialog.getByLabel("Width (mm)", { exact: true }),
  ).toHaveValue("120");
  await expect(
    savedDialog.getByLabel("Label size (pt)", { exact: true }),
  ).toHaveValue("11");
  await page.keyboard.press("Escape");
  await expect(savedDialog).toHaveCount(0);
});

test("square publication figures leave room for scientific-notation ticks while keeping data and residual frames aligned", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.locator("input[type=file]").setInputFiles({
    name: "small-signal.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Time (s),Signal (V)\n0,-0.00004\n1,-0.00001\n2,0.000015\n3,0.000039\n4,0.000061\n5,0.000092\n",
    ),
  });
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Fit selected observations", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Fit complete");
  await applySize(page, 85, 85);
  const svg = await downloadGraph(page, "svg", testInfo, "square-small-signal");
  await expect(page.getByRole("status")).toContainText(
    "Confidence band unavailable",
  );
  expectPhysicalSvg(await inspectSvg(page, svg), 85, 85, 9, 2);
  const warnings = await page.evaluate((source) => {
    const document = new DOMParser().parseFromString(source, "image/svg+xml");
    return {
      descriptions: [...document.querySelectorAll("desc")]
        .map((item) => item.textContent)
        .join(" "),
      visibleText: [...document.querySelectorAll("text")]
        .map((item) => item.textContent)
        .join(" "),
    };
  }, svg.toString("utf8"));
  expect(warnings.descriptions).toContain("Confidence band unavailable");
  expect(warnings.visibleText).not.toContain("Confidence band unavailable");
  const geometry = await page.evaluate((source) => {
    const figure = new DOMParser().parseFromString(
      source,
      "image/svg+xml",
    ).documentElement;
    const holder = document.createElement("div");
    holder.style.cssText =
      "position:fixed;left:0;top:0;background:white;z-index:10000";
    holder.append(document.importNode(figure, true));
    document.body.append(holder);
    try {
      return [...holder.querySelectorAll<SVGSVGElement>("svg > svg")].map(
        (plot) => {
          const axisTitle = plot.querySelector<SVGTextElement>(
            'text[transform*="rotate(-90)"]',
          )!;
          const title = axisTitle.getBoundingClientRect();
          const frame = plot.querySelector<SVGRectElement>(
            '[data-plot-frame="true"]',
          )!;
          return {
            frameLeft: frame.x.baseVal.value,
            frameWidth: frame.width.baseVal.value,
            ySpan: Number(plot.dataset.yMax) - Number(plot.dataset.yMin),
            titleRight: title.right,
            ticks: [
              ...plot.querySelectorAll<SVGTextElement>('[data-axis-tick="y"]'),
            ].map((tick) => ({
              text: tick.textContent,
              left: tick.getBoundingClientRect().left,
            })),
          };
        },
      );
    } finally {
      holder.remove();
    }
  }, svg.toString("utf8"));
  expect(geometry).toHaveLength(2);
  expect(geometry[0].frameLeft).toBeCloseTo(geometry[1].frameLeft, 5);
  expect(geometry[0].frameWidth).toBeCloseTo(geometry[1].frameWidth, 5);
  // Small residuals need their own range, rather than flattening against a
  // fixed minimum span in the original measurement units.
  expect(geometry[1].ySpan).toBeLessThan(0.0001);
  for (const plot of geometry) {
    expect(plot.frameWidth).toBeGreaterThan(((85 * 96) / 25.4) * 0.5);
    expect(plot.ticks.some((tick) => /e-\d/.test(tick.text ?? ""))).toBe(true);
    for (const tick of plot.ticks)
      expect(tick.left - plot.titleRight).toBeGreaterThan(4);
  }
  expectPhysicalPng(
    await downloadGraph(page, "png", testInfo, "square-small-signal"),
    85,
    85,
    300,
  );
  expectPhysicalPdf(
    await downloadGraph(page, "pdf", testInfo, "square-small-signal"),
    85,
    85,
  );
});

for (const mode of ["multi-interval", "collision"] as const) {
  test(`${mode} exports allocate physical size to all active graphs and give residual space to the main graphs when hidden`, async ({
    page,
  }) => {
    await openData(page, "collision.csv");
    await page.getByLabel("Analysis", { exact: true }).selectOption(mode);
    const workspace = page.getByRole("region", {
      name:
        mode === "collision" ? "Collision analysis" : "Multi-interval analysis",
      exact: true,
    });
    if (mode === "multi-interval") {
      await page
        .getByLabel("Number of data series", { exact: true })
        .selectOption("2");
      await page
        .getByLabel("Number of intervals", { exact: true })
        .selectOption("1");
      await page.getByLabel("Interval from", { exact: true }).fill("0.2");
      await page.getByLabel("Interval to", { exact: true }).fill("1.6");
    }
    await page
      .getByLabel("Accept uncertainty assumptions", { exact: true })
      .check();
    await page
      .getByRole("button", {
        name: mode === "collision" ? "Fit before and after" : "Fit Interval 1",
        exact: true,
      })
      .click();
    await expect(workspace.getByRole("status")).toHaveText(
      mode === "collision"
        ? "8 of 8 fits complete"
        : "Interval 1: 2 of 2 data series fitted",
    );
    if (mode === "collision")
      await workspace
        .getByRole("button", {
          name: "Show residuals and fit details",
          exact: true,
        })
        .click();
    const resultTables = workspace.locator(
      mode === "collision"
        ? ".collision-summary table"
        : ".interval-results table",
    );
    const results = await resultTables.allTextContents();
    expect(results.length).toBeGreaterThan(0);
    await applySize(page, 170, 250);
    const count = mode === "collision" ? 8 : 4;
    const graph = await inspectSvg(page, await downloadGraph(page, "svg"));
    expectPhysicalSvg(graph, 170, 250, 9, count);
    expect(
      graph.plots.filter((plot) => /residuals$/.test(plot.label!)),
    ).toHaveLength(count / 2);
    const main = graph.plots.filter((plot) => !/residuals$/.test(plot.label!));
    await hideResiduals(page);
    const hidden = await inspectSvg(page, await downloadGraph(page, "svg"));
    expectPhysicalSvg(hidden, 170, 250, 9, count / 2);
    expect(hidden.plots.some((plot) => /residuals$/.test(plot.label!))).toBe(
      false,
    );
    for (const [index, plot] of hidden.plots.entries()) {
      expect(plot.height).toBeGreaterThan(main[index].height);
      expect(plot.markerRadius).toBe(main[index].markerRadius);
      expect(plot.labels.map((label) => label.text)).toContain("Time [s]");
    }
    expect(await resultTables.allTextContents()).toEqual(results);
  });
}
