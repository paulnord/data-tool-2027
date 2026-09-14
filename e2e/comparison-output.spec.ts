import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function compare(page: Page) {
  await page.goto("/");
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles("examples/data/ball-toss.trksess");
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await page
    .getByLabel("Analysis", { exact: true })
    .selectOption("model-comparison");
  await expect(
    page.getByRole("button", { name: "Copy report", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Refit and compare", exact: true })
    .click();
  await expect(
    page.locator(".model-comparison").getByRole("status"),
  ).toHaveText("Comparison complete");
}

async function download(page: Page, label: string) {
  await page.locator(".fit-export-menu summary").click();
  const waiting = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: label, exact: true }).click();
  return await waiting;
}

test("comparison toolbar copies reduced chi-squared, shows supplied errors, and prints measured pages", async ({
  page,
  context,
}, testInfo) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await compare(page);
  const table = page.getByRole("table", {
    name: "Model comparison statistics",
    exact: true,
  });
  await expect(
    table.getByRole("columnheader", { name: "χ²/df", exact: true }),
  ).toBeVisible();
  const cells = await table
    .locator("tbody tr")
    .first()
    .locator("td")
    .allTextContents();
  const num = (s: string) => Number(s.replaceAll(",", ""));
  expect(num(cells[5])).toBeCloseTo(num(cells[4]) / num(cells[1]), 5);
  const graph = page.getByRole("img", {
    name: "Compared fitted curves",
    exact: true,
  });
  await expect(graph.locator(".comparison-error-bar")).toHaveCount(61);
  const before = await table.innerText();
  await page
    .getByRole("checkbox", { name: "Show y error bars (±1σ)", exact: true })
    .uncheck();
  await expect(graph.locator(".comparison-error-bar")).toHaveCount(0);
  await page
    .getByRole("checkbox", { name: "Show y error bars (±1σ)", exact: true })
    .check();
  expect(await table.innerText()).toBe(before);
  await page.getByRole("button", { name: "Copy report", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain("χ²/df (reduced chi-squared)");
  await page.getByRole("button", { name: "Print", exact: true }).click();
  const preview = page.getByRole("dialog", {
    name: "Print model comparison",
    exact: true,
  });
  await expect(preview.locator(".fit-print-page").first()).toBeVisible();
  await expect(
    preview.getByRole("table", { name: "Printed model comparison statistics" }),
  ).toContainText("χ²/df");
  await expect(preview.locator(".comparison-error-bar")).toHaveCount(61);
  await preview
    .locator(".fit-print-pages")
    .screenshot({ path: testInfo.outputPath("comparison-preview.png") });
  await page.pdf({
    path: testInfo.outputPath("comparison-report.pdf"),
    preferCSSPageSize: true,
    printBackground: true,
  });
  await page.emulateMedia({ media: "screen" });
  await preview
    .getByRole("checkbox", { name: "Full-page graph", exact: true })
    .check();
  await expect
    .poll(() => preview.locator(".fit-print-page").count())
    .toBeGreaterThanOrEqual(2);
  await expect(preview.locator(".fit-print-page").first()).not.toContainText(
    "Degrees of freedom df",
  );
  await page.emulateMedia({ media: "print" });
  await page.pdf({
    path: testInfo.outputPath("comparison-full-page.pdf"),
    preferCSSPageSize: true,
    printBackground: true,
  });
  await page.emulateMedia({ media: "screen" });
  await preview
    .getByRole("button", { name: "Close preview", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Print", exact: true }),
  ).toBeFocused();
});

test("comparison toolbar exports labeled SVG PNG and PDF with physical sizing and hidden residuals", async ({
  page,
}, testInfo) => {
  await compare(page);
  const quick = await download(page, "SVG vector graphic");
  const svg = await readFile((await quick.path())!, "utf8");
  expect(svg).toContain("Supplied y uncertainty:");
  expect(svg).toContain("Compared residuals");
  expect(svg).toContain("1: constant-acceleration");
  expect(svg).toContain("2: line");
  await page.locator(".fit-export-menu summary").click();
  await page
    .getByRole("menuitem", { name: "Figure size…", exact: true })
    .click();
  const size = page.getByRole("dialog", { name: "Figure size", exact: true });
  await size.getByRole("button", { name: "Apply", exact: true }).click();
  const sized = await download(page, "SVG vector graphic");
  const sizedPath = testInfo.outputPath("comparison-sized.svg");
  await sized.saveAs(sizedPath);
  const sizedSvg = await readFile(sizedPath, "utf8");
  expect(sizedSvg).toContain('width="85mm"');
  expect(sizedSvg).toContain('height="60mm"');
  expect(sizedSvg).toContain("Supplied y uncertainty:");
  const png = await download(page, "PNG image");
  await png.saveAs(testInfo.outputPath("comparison-sized.png"));
  const bytes = await readFile((await png.path())!);
  expect(bytes.readUInt32BE(16)).toBe(1004);
  expect(bytes.readUInt32BE(20)).toBe(709);
  const pdf = await download(page, "PDF vector graphic");
  await pdf.saveAs(testInfo.outputPath("comparison-sized.pdf"));
  expect((await readFile((await pdf.path())!)).subarray(0, 5).toString()).toBe(
    "%PDF-",
  );
  await page.locator(".fit-settings-menu summary").click();
  await page
    .getByRole("checkbox", { name: "Show residual plots", exact: true })
    .uncheck();
  await page.keyboard.press("Escape");
  const dataOnly = await download(page, "SVG vector graphic");
  const dataSvg = await readFile((await dataOnly.path())!, "utf8");
  expect(dataSvg).not.toContain("Compared residuals");
  expect(dataSvg).toContain("Time [s]");
  expect(dataSvg).toContain("Supplied y uncertainty:");
});
