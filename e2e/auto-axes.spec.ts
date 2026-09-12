import { test, expect, type Locator, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function openData(page: Page, file: string) {
  await page.goto("/");
  await page.locator("input[type=file]").setInputFiles(`examples/data/${file}`);
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
}

async function applyRange(
  page: Page,
  label: string,
  axis: "X" | "Y",
  min: string,
  max: string,
  scope: Page | Locator = page,
) {
  await scope.getByLabel(`${label} ${axis} axis`, { exact: true }).click();
  await scope.getByLabel(`${label} ${axis} minimum`, { exact: true }).fill(min);
  await scope.getByLabel(`${label} ${axis} maximum`, { exact: true }).fill(max);
  await scope.getByRole("button", { name: "Apply range", exact: true }).click();
  await page.keyboard.press("Escape");
}

async function automatic(
  page: Page,
  label: string,
  axis: "X" | "Y",
  scope: Page | Locator = page,
) {
  await scope.getByLabel(`${label} ${axis} axis`, { exact: true }).click();
  await scope.getByRole("button", { name: "Auto", exact: true }).click();
  await page.keyboard.press("Escape");
}

async function expectInsetMarkers(plot: Locator) {
  const geometry = await plot.evaluate((svg) => {
    const frame = (svg.querySelector(".fit-plot-frame") ??
      svg.querySelector(":scope > rect[stroke]")) as SVGGraphicsElement;
    const bounds = frame.getBBox();
    const markers = [
      ...svg.querySelectorAll<SVGGraphicsElement>("[data-marker-shape]"),
    ];
    return {
      count: markers.length,
      inset: Math.min(
        ...markers.map((marker) => {
          const box = marker.getBBox();
          return Math.min(
            box.x - bounds.x,
            box.y - bounds.y,
            bounds.x + bounds.width - box.x - box.width,
            bounds.y + bounds.height - box.y - box.height,
          );
        }),
      ),
    };
  });
  expect(geometry.count).toBeGreaterThan(2);
  expect(geometry.inset).toBeGreaterThan(1);
}

async function expectX(plots: Locator, min: string, max: string) {
  expect(await plots.count()).toBeGreaterThan(1);
  for (const plot of await plots.all()) {
    await expect(plot).toHaveAttribute("data-x-min", min);
    await expect(plot).toHaveAttribute("data-x-max", max);
  }
}

async function exportX(page: Page) {
  await page.locator(".fit-export-menu summary").click();
  const pending = page.waitForEvent("download");
  await page
    .getByRole("menuitem", { name: "SVG vector graphic", exact: true })
    .click();
  const download = await pending;
  return page.evaluate(
    (source) => {
      const document = new DOMParser().parseFromString(source, "image/svg+xml");
      return [...document.querySelectorAll("svg > svg")].map((plot) => ({
        min: plot.getAttribute("data-x-min"),
        max: plot.getAttribute("data-x-max"),
        scale: plot.getAttribute("data-x-scale"),
      }));
    },
    await readFile((await download.path())!, "utf8"),
  );
}

async function saveSession(page: Page) {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save session", exact: true }).click();
  const download = await pending;
  return JSON.parse(await readFile((await download.path())!, "utf8"));
}

test("automatic linear and logarithmic axes keep whole markers inside the frame while manual limits remain exact and display-only", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("input[type=file]").setInputFiles({
    name: "positive-data.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Time (s),Position (m)\n1,2.2\n3,5.5\n10,21\n30,58\n100,205\n",
    ),
  });
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Fit selected observations", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Fit complete");
  const saved = await saveSession(page);
  const coefficient = await page
    .getByLabel("m value", { exact: true })
    .inputValue();
  const main = page.locator(
    '.fit-chart svg[aria-label="Data and fitted curve"]',
  );
  const residual = page.locator('.fit-chart svg[aria-label="Residual plot"]');
  const plots = page.locator(".fit-chart svg.fit-plot");
  for (const log of [false, true]) {
    for (const axis of ["X", "Y"] as const) {
      await page.getByLabel(`Data ${axis} axis`, { exact: true }).click();
      await page.getByLabel(`Log ${axis}`, { exact: true }).setChecked(log);
      await page.getByRole("button", { name: "Auto", exact: true }).click();
      await page.keyboard.press("Escape");
    }
    await expectInsetMarkers(main);
    await expectInsetMarkers(residual);
    const min = (await main.getAttribute("data-x-min"))!;
    const max = (await main.getAttribute("data-x-max"))!;
    expect(Number(min)).toBeLessThan(1);
    expect(Number(max)).toBeGreaterThan(100);
    if (log) expect(Number(min)).toBeGreaterThan(0);
    await expectX(plots, min, max);
    const exported = await exportX(page);
    expect(exported).toEqual(
      Array(2).fill({ min, max, scale: log ? "log" : "linear" }),
    );
    await page.getByRole("button", { name: "Print", exact: true }).click();
    const preview = page.getByRole("dialog", {
      name: "Print report",
      exact: true,
    });
    await expectX(preview.locator("svg.fit-plot"), min, max);
    await expectInsetMarkers(
      preview.getByRole("img", { name: "Data and fitted curve", exact: true }),
    );
    await preview
      .getByRole("button", { name: "Close preview", exact: true })
      .click();
  }
  await applyRange(page, "Data", "X", "2", "80");
  await applyRange(page, "Data", "Y", "4", "150");
  await expectX(plots, "2", "80");
  await expect(main).toHaveAttribute("data-y-min", "4");
  await expect(main).toHaveAttribute("data-y-max", "150");
  expect(await saveSession(page)).toEqual(saved);
  expect(await page.getByLabel("m value", { exact: true }).inputValue()).toBe(
    coefficient,
  );
  await expect(page.locator(".fit-status")).toHaveText("Fitted");
  await automatic(page, "Data", "X");
  await expect(main).toHaveAttribute("data-y-min", "4");
  await automatic(page, "Data", "Y");
  await expectInsetMarkers(main);
});

test("interval X menus match Y controls and share display limits without changing fit intervals or results", async ({
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
  await workspace.locator(".interval-result-diagnostics summary").click();
  const main = workspace.getByRole("img", {
    name: "Drop position interval plot",
    exact: true,
  });
  const allPlots = workspace.locator("svg.interval-plot");
  const initialMin = (await main.getAttribute("data-x-min"))!;
  const initialMax = (await main.getAttribute("data-x-max"))!;
  const parameters = workspace.getByRole("table", { name: /parameters$/ });
  const before = await parameters.allTextContents();
  for (const plot of await allPlots.all()) await expectInsetMarkers(plot);
  const xControl = page.getByLabel("Drop position X axis", { exact: true });
  const yControl = page.getByLabel("Drop position Y axis", { exact: true });
  const xBox = (await xControl.boundingBox())!;
  const yBox = (await yControl.boundingBox())!;
  expect(Math.abs(xBox.y - yBox.y)).toBeLessThan(1);
  expect(xBox.x + xBox.width).toBeLessThan(yBox.x);
  await applyRange(page, "Drop position", "Y", "-1", "1");
  await applyRange(page, "Drop position", "X", "0.1", "3.1");
  await expectX(allPlots, "0.1", "3.1");
  expect(await exportX(page)).toEqual(
    Array(2).fill({ min: "0.1", max: "3.1", scale: "linear" }),
  );
  await page
    .getByLabel("Include residuals and diagnostics when printing", {
      exact: true,
    })
    .check();
  await page.emulateMedia({ media: "print" });
  await expectX(allPlots, "0.1", "3.1");
  await page.emulateMedia({ media: "screen" });
  await expect(page.getByLabel("Interval from", { exact: true })).toHaveValue(
    "0.2",
  );
  await expect(page.getByLabel("Interval to", { exact: true })).toHaveValue(
    "2.8",
  );
  expect(await parameters.allTextContents()).toEqual(before);
  await automatic(page, "Drop position", "X");
  await expectX(allPlots, initialMin, initialMax);
  await expect(main).toHaveAttribute("data-y-min", "-1");
  await automatic(page, "Drop position", "Y");
  await expectInsetMarkers(main);
});

test("collision X limits are shared by every graph and residual while raw collision boundaries and fitted velocities stay fixed", async ({
  page,
}) => {
  await openData(page, "collision.csv");
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
    .getByRole("button", {
      name: "Show residuals and fit details",
      exact: true,
    })
    .click();
  const allPlots = workspace.locator("svg.collision-plot");
  const main = workspace.getByRole("img", {
    name: "x1 versus time",
    exact: true,
  });
  for (const plot of await allPlots.all()) await expectInsetMarkers(plot);
  const initialMin = (await main.getAttribute("data-x-min"))!;
  const initialMax = (await main.getAttribute("data-x-max"))!;
  const before = await workspace
    .getByRole("table", { name: "Collision velocity summary", exact: true })
    .textContent();
  const boundaries = await Promise.all(
    ["Before from", "Before to", "After from", "After to"].map((label) =>
      page.getByLabel(label, { exact: true }).inputValue(),
    ),
  );
  await applyRange(page, "x1", "X", "0.3", "3.7", workspace);
  await expectX(allPlots, "0.3", "3.7");
  expect(await exportX(page)).toEqual(
    Array(8).fill({ min: "0.3", max: "3.7", scale: "linear" }),
  );
  await page
    .getByLabel("Include fit details when printing", { exact: true })
    .check();
  await page.emulateMedia({ media: "print" });
  await expectX(allPlots, "0.3", "3.7");
  await page.emulateMedia({ media: "screen" });
  expect(
    await Promise.all(
      ["Before from", "Before to", "After from", "After to"].map((label) =>
        page.getByLabel(label, { exact: true }).inputValue(),
      ),
    ),
  ).toEqual(boundaries);
  expect(
    await workspace
      .getByRole("table", { name: "Collision velocity summary", exact: true })
      .textContent(),
  ).toBe(before);
  await automatic(page, "y2", "X", workspace);
  await expectX(allPlots, initialMin, initialMax);
  await expectInsetMarkers(main);
  await expect(workspace.getByRole("status")).toHaveText(
    "8 of 8 fits complete",
  );
});
