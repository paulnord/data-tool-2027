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
  await page.locator("input[type=file]").setInputFiles({
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
  async function expectAlignedPlots() {
    const plots = dialog.locator("svg.fit-plot");
    await expect(plots).toHaveCount(2);
    await expect
      .poll(async () => {
        const frames = await plots
          .locator(".fit-plot-frame")
          .evaluateAll((nodes) =>
            nodes.map((node) => {
              const rect = node.getBoundingClientRect();
              return { left: rect.left, right: rect.right };
            }),
          );
        return Math.max(
          Math.abs(frames[0].left - frames[1].left),
          Math.abs(frames[0].right - frames[1].right),
        );
      })
      .toBeLessThan(0.5);
    for (const attribute of ["data-x-min", "data-x-max", "data-x-scale"]) {
      expect(await plots.nth(0).getAttribute(attribute)).toBe(
        await plots.nth(1).getAttribute(attribute),
      );
    }
  }
  await expectAlignedPlots();
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
  await expectAlignedPlots();
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
