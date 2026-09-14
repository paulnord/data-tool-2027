import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { FitSession } from "../src/core/fit/schema";

async function saveSession(page: Page) {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save session", exact: true }).click();
  const file = await pending;
  const bytes = await readFile((await file.path())!);
  return { bytes, session: JSON.parse(bytes.toString()) as FitSession };
}

test("imported observations use readable row numbers while exclusions and saved sessions retain stable IDs", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page.locator("input[type=file]").setInputFiles({
    name: "generated-data.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Time (s),Signal (V)\n0,1\n1,3.1\n2,4.9\n3,7.1\n4,8.9\n5,11\n",
    ),
  });
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  const before = await saveSession(page);
  const ids = before.session.request.dataset.rows.map(
    (row: { id: string }) => row.id,
  );
  expect(ids).toHaveLength(6);
  expect(ids.every((id: string) => /^[0-9a-f-]{36}$/i.test(id))).toBe(true);
  expect(before.session.dataTable?.rowIds.slice(1)).toEqual(ids);
  await page
    .getByRole("button", { name: "Fit selected observations", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Fit complete");
  const markerTitles = page.locator(".fit-chart [data-row-id] title");
  await expect(markerTitles).toHaveCount(12);
  expect(
    (await markerTitles.allTextContents()).every((title) =>
      /^Row [1-6]: /.test(title),
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Observations & exclusions", exact: true })
    .click();
  const labels = page.locator(
    ".fit-table-wrap > table tbody tr td:nth-child(2)",
  );
  await expect(labels).toHaveText(["1", "2", "3", "4", "5", "6"]);
  await page
    .getByRole("checkbox", { name: "Include row 2", exact: true })
    .uncheck();
  await page
    .getByRole("button", { name: "Fit selected observations", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Fit complete");
  await expect(page.locator(".fit-chart .point.excluded title")).toHaveText([
    /Row 2: .*\(excluded from fit\)/,
    /Row 2: .*\(excluded from fit\)/,
  ]);
  await page.locator(".fit-settings-menu summary").click();
  await page
    .getByRole("button", { name: "Technical report", exact: true })
    .click();
  await page.getByRole("button", { name: "Copy report", exact: true }).click();
  const report = await page.evaluate(() => navigator.clipboard.readText());
  const observations = report
    .split(/\r?\n\r?\n/)
    .find((part) => part.startsWith("Row\tx\ty\tpredicted\tresidual"))!;
  expect(
    observations
      .split(/\r?\n/)
      .slice(1)
      .map((line) => line.split("\t")[0]),
  ).toEqual(["1", "3", "4", "5", "6"]);
  for (const id of ids) expect(observations).not.toContain(id);
  const after = await saveSession(page);
  expect(after.session.request.dataset.rows).toEqual(
    before.session.request.dataset.rows,
  );
  expect(after.session.dataTable).toEqual(before.session.dataTable);
  expect(after.session.settings.excludedIds).toEqual([ids[1]]);
  await page.locator("input[type=file]").setInputFiles({
    name: "saved.trksess",
    mimeType: "application/json",
    buffer: after.bytes,
  });
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await expect(labels).toHaveText(["1", "2", "3", "4", "5", "6"]);
  await expect(
    page.getByRole("checkbox", { name: "Include row 2", exact: true }),
  ).not.toBeChecked();
});
