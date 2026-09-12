import { test, expect, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

async function setDisplaySize(page: Page, scale: string) {
  const summary = page.locator(".fit-display-menu summary");
  await summary.click();
  await page.getByLabel("Display size", { exact: true }).selectOption(scale);
  await summary.click();
}

async function openBallToss(page: Page, fit = true) {
  await page.goto("/");
  await page
    .locator("input[type=file]")
    .setInputFiles("examples/data/ball-toss.trksess");
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  if (fit) {
    await page
      .getByRole("button", { name: "Fit selected observations" })
      .click();
    await expect(page.getByRole("status")).toHaveText("Fit complete");
  }
}

async function enableFullPage(page: Page) {
  const preview = await openPrint(page);
  await preview
    .getByRole("checkbox", { name: "Full-page graph", exact: true })
    .check();
  await preview
    .getByRole("button", { name: "Close preview", exact: true })
    .click();
}

async function openPrint(page: Page) {
  await page.getByRole("button", { name: "Print", exact: true }).click();
  const preview = page.getByRole("dialog", {
    name: "Print report",
    exact: true,
  });
  await expect(preview).toBeVisible();
  return preview;
}

async function expectPageFrames(preview: Locator) {
  const pages = preview.locator(".fit-print-page");
  await expect(pages.first()).toBeVisible();
  const geometry = await pages.evaluateAll((sheets) =>
    sheets.map((sheet) => {
      const page = sheet.getBoundingClientRect();
      const content = sheet.querySelector<HTMLElement>(
        ".fit-print-page-content",
      )!;
      const bounds = content.getBoundingClientRect();
      return {
        paperRatio: page.width / page.height,
        contentRatio: bounds.width / bounds.height,
        contentOverflow: Math.max(
          content.scrollHeight - content.clientHeight,
          content.scrollWidth - content.clientWidth,
        ),
        rowOverflow: Math.max(
          0,
          ...[...content.querySelectorAll("tr")].map((row) => {
            const rect = row.getBoundingClientRect();
            return Math.max(bounds.top - rect.top, rect.bottom - bounds.bottom);
          }),
        ),
      };
    }),
  );
  for (const sheet of geometry) {
    expect(sheet.paperRatio).toBeCloseTo(8.5 / 11, 3);
    expect(sheet.contentRatio).toBeCloseTo(7.5 / 10, 3);
    expect(sheet.contentOverflow).toBeLessThanOrEqual(1);
    expect(sheet.rowOverflow).toBeLessThanOrEqual(1);
  }
}

async function expectPlotPair(
  preview: Locator,
  rotated: boolean,
  xLabel = "Time [s]",
) {
  const plots = preview.locator(".fit-print-graphs svg.fit-plot");
  await expect(plots).toHaveCount(2);
  // Measure the drawn frames, not the equal-width outer SVG elements: mismatched
  // aspect ratios can letterbox each SVG by a different amount.
  await expect
    .poll(async () =>
      plots.locator(".fit-plot-frame").evaluateAll((frames, isRotated) => {
        const [data, residual] = frames.map((frame) =>
          frame.getBoundingClientRect(),
        );
        // Media changes can briefly collapse both frames; matching zero-sized
        // rectangles is not evidence that the print layout has settled.
        if (
          !data ||
          !residual ||
          !(data.width > 0 && data.height > 0) ||
          !(residual.width > 0 && residual.height > 0)
        )
          return Infinity;
        return isRotated
          ? Math.max(
              Math.abs(data.top - residual.top),
              Math.abs(data.bottom - residual.bottom),
            )
          : Math.max(
              Math.abs(data.left - residual.left),
              Math.abs(data.right - residual.right),
            );
      }, rotated),
    )
    .toBeLessThan(0.5);
  const geometry = await plots
    .locator(".fit-plot-frame")
    .evaluateAll((frames, isRotated) => {
      const [data, residual] = frames.map((frame) =>
        frame.getBoundingClientRect(),
      );
      return {
        ratio: isRotated
          ? data.width / residual.width
          : data.height / residual.height,
        gapFraction: isRotated
          ? (residual.left - data.right) / data.height
          : (residual.top - data.bottom) / data.width,
      };
    }, rotated);
  expect(geometry.ratio).toBeGreaterThan(2.6);
  expect(geometry.ratio).toBeLessThan(3.4);
  expect(geometry.gapFraction).toBeGreaterThan(0.008);
  expect(geometry.gapFraction).toBeLessThan(0.04);
  const scales = await plots.evaluateAll((nodes) =>
    nodes.map((node) => {
      const matrix = (node as SVGSVGElement).getScreenCTM()!;
      return {
        x: Math.hypot(matrix.a, matrix.b),
        y: Math.hypot(matrix.c, matrix.d),
      };
    }),
  );
  for (const scale of scales) expect(scale.x).toBeCloseTo(scale.y, 4);
  expect(scales[0].x).toBeCloseTo(scales[1].x, 4);
  for (const attribute of ["data-x-min", "data-x-max", "data-x-scale"]) {
    expect(await plots.nth(0).getAttribute(attribute)).toBe(
      await plots.nth(1).getAttribute(attribute),
    );
  }
  await expect(plots.nth(0).getByText(xLabel, { exact: true })).toHaveCount(0);
  await expect(plots.nth(1).getByText(xLabel, { exact: true })).toHaveCount(1);
  await expect(
    preview.getByRole("heading", { name: "Residuals", exact: true }),
  ).toHaveCount(0);
}

async function expectRotatedSheet(preview: Locator) {
  const geometry = await preview
    .locator(".fit-print-graph-sheet")
    .evaluate((sheet) => {
      const content = sheet.querySelector<HTMLElement>(
        ".fit-print-graph-content",
      )!;
      const outer = sheet.getBoundingClientRect();
      const inner = content.getBoundingClientRect();
      const matrix = new DOMMatrix(getComputedStyle(content).transform);
      return {
        sheetWidth: outer.width,
        sheetHeight: outer.height,
        insetLeft: inner.left - outer.left,
        insetTop: inner.top - outer.top,
        insetRight: outer.right - inner.right,
        insetBottom: outer.bottom - inner.bottom,
        childOverflow: Math.max(
          0,
          ...[...content.children].map((child) => {
            const rect = child.getBoundingClientRect();
            return Math.max(
              outer.left - rect.left,
              outer.top - rect.top,
              rect.right - outer.right,
              rect.bottom - outer.bottom,
            );
          }),
        ),
        matrix: { a: matrix.a, b: matrix.b, c: matrix.c, d: matrix.d },
      };
    });
  expect(geometry.sheetHeight).toBeGreaterThan(geometry.sheetWidth);
  for (const inset of [
    geometry.insetLeft,
    geometry.insetTop,
    geometry.insetRight,
    geometry.insetBottom,
  ]) {
    expect(inset).toBeGreaterThanOrEqual(-1);
  }
  expect(geometry.matrix.a).toBeCloseTo(0, 4);
  expect(geometry.matrix.d).toBeCloseTo(0, 4);
  expect(geometry.matrix.b).toBeLessThan(0);
  expect(geometry.matrix.c).toBeGreaterThan(0);
  expect(geometry.matrix.b).toBeCloseTo(-geometry.matrix.c, 4);
  expect(geometry.childOverflow).toBeLessThanOrEqual(1);
  await expect(preview.locator(".fit-print-graph-content table")).toHaveCount(
    0,
  );
  await expect(
    preview
      .locator(".fit-print-details")
      .getByRole("table", { name: "Print parameters", exact: true }),
  ).toHaveCount(1);
}

test("standard print preview keeps both frames aligned with a short residual and shared x axis", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await openBallToss(page);
  for (const scale of ["1", "1.5", "2"]) {
    await setDisplaySize(page, scale);
    const preview = await openPrint(page);
    await expectPlotPair(preview, false);
    await expectPageFrames(preview);
    await page.emulateMedia({ media: "print" });
    await expectPlotPair(preview, false);
    await page.emulateMedia({ media: "screen" });
    await preview
      .getByRole("button", { name: "Close preview", exact: true })
      .click();
  }
});

test("full-page graph rotates counterclockwise as one aligned figure on portrait paper and moves details to the next page", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await openBallToss(page);
  for (const scale of ["1", "1.5", "2"]) {
    await setDisplaySize(page, scale);
    const preview = await openPrint(page);
    const fullPage = preview.getByRole("checkbox", {
      name: "Full-page graph",
      exact: true,
    });
    if (scale === "1") {
      await expect(fullPage).not.toBeChecked();
      await expectPlotPair(preview, false);
      await fullPage.check();
      await expectPlotPair(preview, true);
      await expectRotatedSheet(preview);
      await fullPage.uncheck();
      await expectPlotPair(preview, false);
      await page.emulateMedia({ media: "print" });
      await expectPlotPair(preview, false);
      await expect(preview.locator(".fit-print-details")).toHaveCSS(
        "break-before",
        "auto",
      );
      await page.emulateMedia({ media: "screen" });
      await preview
        .getByRole("button", { name: "Close preview", exact: true })
        .click();
      await page.locator(".fit-settings-menu summary").click();
      await expect(
        page.getByLabel("Full-page graph when printing", { exact: true }),
      ).toHaveCount(0);
      await page.locator(".fit-settings-menu summary").click();
      await openPrint(page);
      await expect(fullPage).not.toBeChecked();
      await fullPage.check();
    }
    await expect(fullPage).toBeChecked();
    await expectPlotPair(preview, true);
    await expectRotatedSheet(preview);
    await expectPageFrames(preview);
    const box = (await preview.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(1367);
    if (scale === "1") {
      await preview
        .locator(".fit-print-graph-sheet")
        .screenshot({ path: testInfo.outputPath("full-page-preview.png") });
    }
    await page.emulateMedia({ media: "print" });
    await expectPlotPair(preview, true);
    await expectRotatedSheet(preview);
    await expect(preview.locator(".fit-print-details")).toHaveCSS(
      "break-before",
      "page",
    );
    if (scale === "1") {
      const pdf = await page.pdf({
        path: testInfo.outputPath("full-page.pdf"),
        preferCSSPageSize: true,
        printBackground: true,
      });
      const source = pdf.toString("latin1");
      expect(source.match(/\/Type\s*\/Page\b/g)!.length).toBe(
        await preview.locator(".fit-print-page").count(),
      );
      const mediaBoxes = [
        ...source.matchAll(
          /\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/g,
        ),
      ];
      expect(mediaBoxes.length).toBeGreaterThan(0);
      for (const box of mediaBoxes) {
        expect(box.slice(1).map(Number)).toEqual([0, 0, 612, 792]);
      }
    }
    await page.emulateMedia({ media: "screen" });
    await preview
      .getByRole("button", { name: "Close preview", exact: true })
      .click();
  }
});

test("data-only printing retains the x axis with and without a full-page graph", async ({
  page,
}) => {
  await openBallToss(page, false);
  for (const fullPage of [false, true]) {
    if (fullPage) await enableFullPage(page);
    const preview = await openPrint(page);
    for (const media of ["screen", "print"] as const) {
      await page.emulateMedia({ media });
      await expect(
        preview.locator(".fit-print-graphs svg.fit-plot"),
      ).toHaveCount(1);
      await expect(
        preview
          .getByRole("img", { name: "Data and fitted curve", exact: true })
          .getByText("Time [s]", { exact: true }),
      ).toHaveCount(1);
      await expect(preview.locator("table")).toHaveCount(0);
    }
    await page.emulateMedia({ media: "screen" });
    await preview
      .getByRole("button", { name: "Close preview", exact: true })
      .click();
  }
});

test("log-axis notices preserve the tight shared-axis gap in standard and full-page reports", async ({
  page,
}) => {
  await openBallToss(page);
  await page.getByLabel("Data X axis", { exact: true }).click();
  await page.getByLabel("Log X", { exact: true }).check();
  await page.getByLabel("Data X axis", { exact: true }).click();
  for (const fullPage of [false, true]) {
    if (fullPage) await enableFullPage(page);
    const preview = await openPrint(page);
    for (const media of ["screen", "print"] as const) {
      await page.emulateMedia({ media });
      await expectPlotPair(preview, fullPage, "Time (log scale) [s]");
      await expect(preview).toContainText("nonpositive");
      if (fullPage) await expectRotatedSheet(preview);
    }
    await page.emulateMedia({ media: "screen" });
    await preview
      .getByRole("button", { name: "Close preview", exact: true })
      .click();
  }
});

test("published damped-sine report keeps the rotated graph and five-parameter tables inside portrait pages", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/");
  await page
    .locator("input[type=file]")
    .setInputFiles("examples/data/published/dyfeo3-spin-wave.trksess");
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await page.getByRole("button", { name: "Fit selected observations" }).click();
  await expect(page.getByRole("status")).toHaveText("Fit complete");
  await enableFullPage(page);
  const preview = await openPrint(page);
  for (const media of ["screen", "print"] as const) {
    await page.emulateMedia({ media });
    await expectPlotPair(preview, true, "Pump-probe delay [ps]");
    await expectRotatedSheet(preview);
    await expect(
      preview
        .getByRole("table", { name: "Print parameters", exact: true })
        .locator("tbody tr"),
    ).toHaveCount(5);
    const overflow = await preview
      .locator(".fit-print-details")
      .evaluate((details) => details.scrollWidth - details.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  }
  await expect(page.locator("html")).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  await page.pdf({
    path: testInfo.outputPath("damped-sine-full-page.pdf"),
    preferCSSPageSize: true,
    printBackground: true,
  });
});

test("a long dataset title stays complete inside the rotated graph page", async ({
  page,
}) => {
  const session = JSON.parse(
    readFileSync("examples/data/ball-toss.trksess", "utf8"),
  );
  const title =
    "Ball toss: repeated measurements of vertical position over time, with independent uncertainties and a constant-acceleration fit, comparing the fitted trajectory and residual structure across the full observation interval";
  session.request.dataset.label = title;
  await page.goto("/");
  await page.locator("input[type=file]").setInputFiles({
    name: "long-title.trksess",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(session)),
  });
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await page.getByRole("button", { name: "Fit selected observations" }).click();
  await expect(page.getByRole("status")).toHaveText("Fit complete");
  await enableFullPage(page);
  const preview = await openPrint(page);
  for (const media of ["screen", "print"] as const) {
    await page.emulateMedia({ media });
    await expect(preview.locator(".fit-print-graph-content h1")).toHaveText(
      title,
    );
    await expectPlotPair(preview, true);
    await expectRotatedSheet(preview);
  }
});
