import {
  test,
  expect,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";

async function downloadGraph(
  page: Page,
  testInfo: TestInfo,
  label: string,
  extension: string,
) {
  const menu = page.locator(".fit-export-menu");
  if ((await menu.getAttribute("open")) === null)
    await menu.locator("summary").click();
  const pending = page.waitForEvent("download");
  await menu.getByRole("menuitem", { name: label, exact: true }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toMatch(new RegExp(`\\.${extension}$`));
  const path = testInfo.outputPath(`figure.${extension}`);
  await download.saveAs(path);
  return readFile(path);
}

test("SVG, PNG, and cropped vector PDF downloads preserve graph geometry, appearance, and scientific labels", async ({
  page,
}, testInfo) => {
  const session = JSON.parse(
    readFileSync("examples/data/ball-toss.trksess", "utf8"),
  );
  session.request.dataset.xColumn.unit = "µs";
  session.request.dataset.yColumn.unit = "mH";
  await page.goto("/");
  await page.locator("input[type=file]").setInputFiles({
    name: "scientific-labels.trksess",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(session)),
  });
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await page.getByRole("button", { name: "Fit selected observations" }).click();
  await expect(page.getByRole("status")).toHaveText("Fit complete");
  await page
    .getByLabel("Show 95% mean confidence band", { exact: true })
    .check();
  await page.getByLabel("Show y error bars (±1σ)", { exact: true }).check();
  await page.locator(".fit-display-menu summary").click();
  await page
    .getByRole("combobox", { name: "Colors", exact: true })
    .selectOption("muted");
  await page
    .getByRole("combobox", { name: "Marker size", exact: true })
    .selectOption("large");
  await page
    .getByRole("combobox", { name: "Marker style", exact: true })
    .selectOption("diamond");
  await page.locator(".fit-display-menu summary").click();
  const originalMarker = await page
    .getByRole("img", { name: "Data and fitted curve", exact: true })
    .locator('[data-marker-shape="diamond"]')
    .nth(20)
    .evaluate((marker) => {
      const box = (marker as SVGGraphicsElement).getBBox();
      return {
        x: box.x + box.width / 2,
        y: box.y + box.height / 2,
        fill: getComputedStyle(marker).fill,
      };
    });
  const svgBytes = await downloadGraph(
    page,
    testInfo,
    "SVG vector graphic",
    "svg",
  );
  const source = svgBytes.toString();
  expect(source).toContain("Time [µs]");
  expect(source).toContain("Height [mH]");
  expect(source).not.toMatch(/<style[\s>]|class=|var\(--|100vh/);
  const graph = await page.evaluate((svg) => {
    const document = new DOMParser().parseFromString(svg, "image/svg+xml");
    const root = document.documentElement;
    const plots = [...root.querySelectorAll<SVGSVGElement>(":scope > svg")];
    const frames = plots.map((plot) => {
      const frame = plot.querySelector<SVGRectElement>(
        'rect[vector-effect="non-scaling-stroke"]',
      )!;
      const scale =
        Number(plot.getAttribute("width")) / plot.viewBox.baseVal.width;
      return {
        left: Number(plot.getAttribute("x")) + frame.x.baseVal.value * scale,
        width: frame.width.baseVal.value * scale,
        top: Number(plot.getAttribute("y")) + frame.y.baseVal.value * scale,
        height: frame.height.baseVal.value * scale,
      };
    });
    const marker = plots[0].querySelector<SVGElement>(
      '[data-marker-shape="diamond"]',
    )!;
    return {
      width: Number(root.getAttribute("width")),
      height: Number(root.getAttribute("height")),
      plotCount: plots.length,
      frames,
      markerShape: marker.tagName,
      markerFill: marker.style.fill,
      markerCount: root.querySelectorAll('[data-marker-shape="diamond"]')
        .length,
      errorBars: root.querySelectorAll("[data-sigma]").length,
      bands: root.querySelectorAll(
        '[aria-label="Pointwise 95% confidence band for the mean curve"]',
      ).length,
      clipReferences: [...root.querySelectorAll("[clip-path]")].map(
        (element) => {
          const match = element
            .getAttribute("clip-path")!
            .match(/^url\(#(.+)\)$/);
          return !!match && !!document.getElementById(match[1]);
        },
      ),
    };
  }, source);
  expect(graph.plotCount).toBe(2);
  expect(graph.frames[0].left).toBeCloseTo(graph.frames[1].left, 5);
  expect(graph.frames[0].width).toBeCloseTo(graph.frames[1].width, 5);
  const gap =
    graph.frames[1].top - graph.frames[0].top - graph.frames[0].height;
  expect(gap).toBeGreaterThan(10);
  expect(gap).toBeLessThan(18);
  expect(graph.markerShape).toBe("path");
  expect(graph.markerFill).toBe(originalMarker.fill);
  expect(graph.markerCount).toBe(122);
  expect(graph.errorBars).toBe(61);
  expect(graph.bands).toBe(1);
  expect(graph.clipReferences).toEqual([true, true]);
  const png = await downloadGraph(page, testInfo, "PNG image", "png");
  expect(png.subarray(1, 4).toString()).toBe("PNG");
  expect(png.readUInt32BE(16)).toBe(Math.ceil(graph.width * 3));
  expect(png.readUInt32BE(20)).toBe(Math.ceil(graph.height * 3));
  const pixels = await page.evaluate(
    async ({ base64, marker, width, height }) => {
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const bitmap = await createImageBitmap(
        new Blob([bytes], { type: "image/png" }),
      );
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d")!;
      context.drawImage(bitmap, 0, 0);
      const sample = (x: number, y: number) => [
        ...context.getImageData(x, y, 1, 1).data,
      ];
      const result = {
        background: sample(0, 0),
        marker: sample(
          Math.round((marker.x * bitmap.width) / width),
          Math.round((marker.y * bitmap.height) / height),
        ),
      };
      bitmap.close();
      return result;
    },
    {
      base64: png.toString("base64"),
      marker: originalMarker,
      width: graph.width,
      height: graph.height,
    },
  );
  expect(pixels.background).toEqual([255, 255, 255, 255]);
  expect(pixels.marker).toEqual([79, 120, 101, 255]);
  const pdf = await downloadGraph(page, testInfo, "PDF vector graphic", "pdf");
  const pdfSource = pdf.toString("latin1");
  expect(pdfSource.startsWith("%PDF-")).toBe(true);
  expect(pdfSource.match(/\/Type\s*\/Page\b/g)).toHaveLength(1);
  expect(pdfSource).not.toMatch(/\/Subtype\s*\/Image\b/);
  expect(pdfSource).toContain("/FontFile2");
  expect(pdfSource).toContain("/ToUnicode");
  const mediaBox = pdfSource.match(
    /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/,
  )!;
  expect(Number(mediaBox[1])).toBeCloseTo(graph.width * 0.75, 4);
  expect(Number(mediaBox[2])).toBeCloseTo(graph.height * 0.75, 4);
  await expect(
    page.getByRole("dialog", { name: "Print report", exact: true }),
  ).toHaveCount(0);
});

async function expectExportedActivePlots(
  page: Page,
  testInfo: TestInfo,
  plots: Locator,
  count: number,
) {
  await expect(plots).toHaveCount(count);
  const live = await plots.evaluateAll((nodes) =>
    nodes.map((node) => ({
      label: node.getAttribute("aria-label"),
      viewBox: node.getAttribute("viewBox"),
      points: [
        ...node.querySelectorAll<SVGCircleElement>("circle[data-marker-shape]"),
      ].map((point) => ({
        x: point.cx.baseVal.value,
        y: point.cy.baseVal.value,
        radius: point.r.baseVal.value,
        fill: getComputedStyle(point).fill,
      })),
      paths: [...node.querySelectorAll("path")].map((path) =>
        path.getAttribute("d"),
      ),
    })),
  );
  expect(live.some((plot) => plot.points.length > 0)).toBe(true);
  await expect(page.locator(".fit-header .fit-export-menu")).toBeVisible();
  const bytes = await downloadGraph(
    page,
    testInfo,
    "SVG vector graphic",
    "svg",
  );
  const exported = await page.evaluate((source) => {
    const document = new DOMParser().parseFromString(source, "image/svg+xml");
    return [...document.documentElement.querySelectorAll(":scope > svg")].map(
      (node) => ({
        label: node.getAttribute("aria-label"),
        viewBox: node.getAttribute("viewBox"),
        points: [
          ...node.querySelectorAll<SVGCircleElement>(
            "circle[data-marker-shape]",
          ),
        ].map((point) => ({
          x: point.cx.baseVal.value,
          y: point.cy.baseVal.value,
          radius: point.r.baseVal.value,
          fill: point.style.fill,
        })),
        paths: [...node.querySelectorAll("path")].map((path) =>
          path.getAttribute("d"),
        ),
      }),
    );
  }, bytes.toString());
  expect(exported).toEqual(live);
  expect(exported.map((plot) => plot.label)).not.toContain(
    "Data and fitted curve",
  );
  expect(exported.map((plot) => plot.label)).not.toContain("Residual plot");
}

test("header graph export uses the active multi-interval overview without hidden single fits or duplicate diagnostics", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page
    .locator("input[type=file]")
    .setInputFiles("examples/data/collision.csv");
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
    .getByLabel("Number of data series", { exact: true })
    .selectOption("2");
  await page
    .getByLabel("Data series 1 column", { exact: true })
    .selectOption("1");
  await page
    .getByLabel("Data series 2 column", { exact: true })
    .selectOption("3");
  await page
    .getByLabel("Number of intervals", { exact: true })
    .selectOption("1");
  await page.getByLabel("Interval from", { exact: true }).fill("0.2");
  await page.getByLabel("Interval to", { exact: true }).fill("1.8");
  await page
    .getByRole("checkbox", {
      name: "Accept uncertainty assumptions",
      exact: true,
    })
    .check();
  await page
    .getByRole("button", { name: "Fit Interval 1", exact: true })
    .click();
  await expect(workspace.getByRole("status")).toHaveText(
    "Interval 1: 2 of 2 data series fitted",
  );
  await workspace
    .locator(".interval-result-diagnostics summary")
    .first()
    .click();
  await expect(
    workspace.locator(".interval-result-diagnostics[open] svg"),
  ).toBeVisible();
  await expect(page.locator(".fit-chart")).toBeHidden();
  await expect(page.locator(".collision-dialog")).toBeHidden();
  const plots = workspace.locator(".interval-graphs svg.interval-plot");
  expect(
    await plots.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("aria-label")),
    ),
  ).toEqual([
    "x1 interval plot",
    "x1 residuals",
    "x2 interval plot",
    "x2 residuals",
  ]);
  await expectExportedActivePlots(page, testInfo, plots, 4);
});

test("header graph export uses collision graphs and includes residuals only when expanded", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page
    .locator("input[type=file]")
    .setInputFiles("examples/data/collision.csv");
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await page.getByLabel("Analysis", { exact: true }).selectOption("collision");
  const workspace = page.getByRole("region", {
    name: "Collision analysis",
    exact: true,
  });
  await page
    .getByRole("checkbox", {
      name: "Accept uncertainty assumptions",
      exact: true,
    })
    .check();
  await page
    .getByRole("button", { name: "Fit before and after", exact: true })
    .click();
  await expect(workspace.getByRole("status")).toHaveText(
    "8 of 8 fits complete",
  );
  await expect(page.locator(".fit-chart")).toBeHidden();
  await expect(page.locator(".multi-interval")).toBeHidden();
  const main = workspace.locator(".collision-charts svg.collision-plot");
  expect(
    await main.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("aria-label")),
    ),
  ).toEqual([
    "x1 versus time",
    "y1 versus time",
    "x2 versus time",
    "y2 versus time",
  ]);
  await expect(workspace.locator(".collision-details")).toBeHidden();
  await expectExportedActivePlots(page, testInfo, main, 4);
  await workspace
    .getByRole("button", {
      name: "Show residuals and fit details",
      exact: true,
    })
    .click();
  const expanded = workspace.locator("svg.collision-plot");
  await expectExportedActivePlots(page, testInfo, expanded, 8);
});
