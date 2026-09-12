import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { unzipSync } from "fflate";

test("hosted application fits locally and downloads reusable sessions and vector PDFs at Chromebook screen size", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const errors: string[] = [];
  const workers: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("worker", (w) => workers.push(w.url()));
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: /Data Tool 2027/ }),
  ).toBeVisible();
  await page
    .locator("input[type=file]")
    .setInputFiles("examples/data/ball-toss.trksess");
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await page.getByRole("button", { name: "Fit selected observations" }).click();
  await expect(page.locator(".fit-status")).toHaveText("Fitted");
  await page.getByRole("button", { name: "Copy report", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain("Parameter");
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save session" }).click();
  const downloaded = await pending;
  const data = await readFile((await downloaded.path())!, "utf8");
  expect(JSON.parse(data).format).toBe("tracker-fit-session");
  await page.locator("input[type=file]").setInputFiles({
    name: "saved.trksess",
    mimeType: "application/json",
    buffer: Buffer.from(data),
  });
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await page.getByRole("button", { name: "Fit selected observations" }).click();
  await expect(page.locator(".fit-status")).toHaveText("Fitted");
  const fontResponse = page.waitForResponse((response) =>
    new URL(response.url()).pathname.endsWith(".ttf"),
  );
  const pendingPdf = page.waitForEvent("download");
  await page.locator(".fit-header .fit-export-menu summary").click();
  await page
    .getByRole("menuitem", { name: "PDF vector graphic", exact: true })
    .click();
  const [font, pdfDownload] = await Promise.all([fontResponse, pendingPdf]);
  expect(font.ok()).toBe(true);
  expect(new URL(font.url()).pathname).toMatch(
    /^\/data-tool-2027\/assets\/DejaVuSans-[^/]+\.ttf$/,
  );
  expect(pdfDownload.suggestedFilename()).toMatch(/\.pdf$/);
  const pdf = (await readFile((await pdfDownload.path())!)).toString("latin1");
  expect(pdf.startsWith("%PDF-")).toBe(true);
  expect(pdf.match(/\/Type\s*\/Page\b/g)).toHaveLength(1);
  expect(pdf).not.toMatch(/\/Subtype\s*\/Image\b/);
  expect(pdf).toContain("/FontFile2");
  expect(pdf).toContain("/ToUnicode");
  expect(
    workers.some((url) => url.includes("/data-tool-2027/assets/fit.worker-")),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("both multi-fit workers load correctly from the hosted subdirectory", async ({
  page,
}) => {
  await page.goto("./");
  await page
    .locator("input[type=file]")
    .setInputFiles("examples/data/collision.csv");
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await page.getByLabel("Analysis", { exact: true }).selectOption("collision");
  await page.getByRole("button", { name: "Fit before and after" }).click();
  await expect(
    page
      .getByRole("region", { name: "Collision analysis", exact: true })
      .getByRole("status"),
  ).toHaveText("8 of 8 fits complete");
  await page
    .getByLabel("Analysis", { exact: true })
    .selectOption("multi-interval");
  await page.getByLabel("Interval from", { exact: true }).fill("0");
  await page.getByLabel("Interval to", { exact: true }).fill("1.6");
  await page
    .getByRole("button", { name: "Fit Interval 1", exact: true })
    .click();
  await expect(
    page
      .getByRole("region", { name: "Multi-interval analysis", exact: true })
      .getByRole("status"),
  ).toHaveText("Interval 1: 1 of 1 data series fitted");
});

test("app metadata and ordinary example downloads are available", async ({
  request,
}) => {
  const manifest = await request.get("manifest.webmanifest");
  expect(manifest.ok()).toBe(true);
  expect((await manifest.json()).start_url).toBe("./");
  expect((await request.get("app-icon.svg")).ok()).toBe(true);
  const examples = await request.get("examples.zip");
  expect(examples.ok()).toBe(true);
  const files = unzipSync(new Uint8Array(await examples.body()));
  expect(files["Data Tool examples/ball-toss.csv"]).toBeDefined();
  expect(files["Data Tool examples/bounce-intervals.csv"]).toBeDefined();
});
