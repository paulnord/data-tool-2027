import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

test("long source notes preserve text across preview sheets and printed pages", async ({
  page,
}) => {
  const session = JSON.parse(
    readFileSync("examples/data/published/cri-rydberg.trksess", "utf8"),
  );
  const text = Array.from(
    { length: 100 },
    (_, i) =>
      `Note ${i + 1}: Preserve the published observations, units and uncertainty conventions. A fit comparison does not by itself establish that the publication is incorrect.`,
  ).join("\n\n");
  session.request.source.context = text;
  await page.goto("/");
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "long-notes.trksess",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(session)),
    });
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await page.getByRole("button", { name: "Fit selected observations" }).click();
  await expect(page.getByRole("status")).toHaveText("Fit complete");
  await page.getByRole("button", { name: "Print", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Print report" });
  const sheets = dialog.locator(".report-notes-page");
  await expect.poll(() => sheets.count()).toBeGreaterThan(2);
  expect(
    (await sheets.locator(".report-notes-text").allTextContents()).join(""),
  ).toBe(text);
  for (const sheet of await sheets.all()) {
    expect(
      await sheet.locator(".report-notes-text").evaluate((e) => e.scrollHeight),
    ).toBeLessThanOrEqual(768);
  }
  await sheets.first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/source-notes-preview.png" });
  await page.emulateMedia({ media: "print" });
  expect(
    await sheets.first().evaluate((e) => getComputedStyle(e).breakBefore),
  ).toBe("page");
  await page.pdf({
    path: "test-results/source-notes-print.pdf",
    preferCSSPageSize: true,
  });
  expect(
    (await sheets.locator(".report-notes-text").allTextContents()).join(""),
  ).toBe(text);
});
