import { test, expect, type Page, type Locator } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { FitSession } from "../src/core/fit/schema";
import { syntheticDampedIntervalsFile } from "./support/dampedIntervals";

async function useImportedData(page: Page) {
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
}

async function openIntervals(page: Page) {
  await page
    .getByLabel("Analysis tools", { exact: true })
    .selectOption("multi-interval");
  return page.getByRole("region", {
    name: "Multi-interval analysis",
    exact: true,
  });
}

async function range(page: Page, from: number, to: number) {
  await page.getByLabel("Interval from", { exact: true }).fill(String(from));
  await page.getByLabel("Interval to", { exact: true }).fill(String(to));
}

async function parameter(table: Locator, name: string) {
  return Number(
    await table
      .getByRole("row")
      .filter({
        has: table.page().getByRole("rowheader", { name, exact: true }),
      })
      .getByRole("cell")
      .first()
      .innerText(),
  );
}

async function starts(page: Page) {
  return Promise.all(
    ["b", "s", "c", "T", "tau"].map((name) =>
      page.getByLabel(`${name} interval value`, { exact: true }).inputValue(),
    ),
  );
}

async function save(page: Page): Promise<FitSession> {
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save session", exact: true }).click();
  return JSON.parse(
    await readFile((await (await downloading).path())!, "utf8"),
  );
}

test("synthetic intervals fit in frame coordinates with data-scaled starts", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator("input[type=file]")
    .setInputFiles(syntheticDampedIntervalsFile);
  await useImportedData(page);
  const workspace = await openIntervals(page);
  await expect(
    page.getByLabel("Interval X column", { exact: true }),
  ).toHaveValue("0");
  await expect(
    page.getByLabel("Interval Y column", { exact: true }),
  ).toHaveValue("1");
  await range(page, 69, 349);
  await page
    .getByLabel("Interval equation", { exact: true })
    .selectOption("damped-sine");
  expect(
    Number(
      await page.getByLabel("T interval value", { exact: true }).inputValue(),
    ),
  ).toBeGreaterThan(100);
  await expect(
    page.getByLabel("tau interval value", { exact: true }),
  ).toHaveValue("280");
  await expect(
    workspace.getByRole("table", { name: /parameters$/ }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Fit Interval 1", exact: true })
    .click();
  await expect(workspace.getByRole("status")).toHaveText(
    "Interval 1: fit complete",
  );
  const first = workspace.getByRole("table", {
    name: /Interval 1.*parameters/,
  });
  // The synthetic generator defines these values in Frame coordinates.
  expect(await parameter(first, "b")).toBeCloseTo(0.625, 5);
  expect(await parameter(first, "T")).toBeCloseTo(128, 2);
  expect(await parameter(first, "tau")).toBeCloseTo(240, 2);
  await page.getByRole("button", { name: "Interval 2", exact: true }).click();
  await page
    .getByLabel("Interval equation", { exact: true })
    .selectOption("damped-sine");
  await range(page, 429, 969);
  await expect(
    page.getByLabel("tau interval value", { exact: true }),
  ).toHaveValue("540");
  await page
    .getByRole("button", { name: "Fit Interval 2", exact: true })
    .click();
  await expect(workspace.getByRole("status")).toHaveText(
    "Interval 2: fit complete",
  );
  const second = workspace.getByRole("table", {
    name: /Interval 2.*parameters/,
  });
  expect(await parameter(second, "b")).toBeCloseTo(-0.35, 5);
  expect(await parameter(second, "T")).toBeCloseTo(160, 2);
  expect(await parameter(second, "tau")).toBeCloseTo(500, 2);
  await expect(first).toBeVisible();
});

test("a nonlinear interval starts from its selected observations and preserves manual or fixed starts", async ({
  page,
}) => {
  const csv = [
    "Time (s),First (m),Second (m)",
    ...Array.from({ length: 201 }, (_, i) => {
      const t = i / 10;
      const first =
        0.4 +
        Math.exp(-t / 15) *
          (2 * Math.sin(Math.PI * t) + 0.6 * Math.cos(Math.PI * t));
      const second =
        -3 +
        Math.exp(-t / 7) *
          (0.3 * Math.sin((2 * Math.PI * t) / 3) +
            0.1 * Math.cos((2 * Math.PI * t) / 3));
      // A different regime outside the chosen interval must not determine its starts.
      return [
        t,
        first + (t > 10 ? 1000 : 0),
        second - (t > 10 ? 2000 : 0),
      ].join(",");
    }),
  ].join("\n");
  await page.goto("/");
  await page.locator("input[type=file]").setInputFiles({
    name: "two-oscillations.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await useImportedData(page);
  const before = await save(page);
  const workspace = await openIntervals(page);
  await page
    .getByLabel("Interval equation", { exact: true })
    .selectOption("damped-sine");
  await range(page, 0, 10);
  const first = (await starts(page)).map(Number);
  expect(first[0]).toBeGreaterThan(0);
  expect(first[0]).toBeLessThan(1);
  expect(first[3]).toBeCloseTo(2, 1);
  expect(first[4]).toBe(10);
  await expect(
    workspace.getByRole("table", { name: /parameters$/ }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Fit Interval 1", exact: true })
    .click();
  await expect(workspace.getByRole("status")).toHaveText(
    "Interval 1: fit complete",
  );
  expect(
    await parameter(
      workspace.getByRole("table", {
        name: "Interval 1 First parameters",
        exact: true,
      }),
      "T",
    ),
  ).toBeCloseTo(2, 5);
  await page.getByLabel("T interval value", { exact: true }).fill("2.125");
  await page.getByLabel("Fix interval T", { exact: true }).check();
  const manual = await starts(page);
  await range(page, 2, 10);
  expect(await starts(page)).toEqual(manual);
  await expect(
    page.getByLabel("Fix interval T", { exact: true }),
  ).toBeChecked();
  await page.getByLabel("Fix interval tau", { exact: true }).check();
  await range(page, 3, 10);
  expect(await starts(page)).toEqual(manual);
  await expect(
    page.getByLabel("Fix interval tau", { exact: true }),
  ).toBeChecked();
  await page
    .getByLabel("Analysis tools", { exact: true })
    .selectOption("single-fit");
  const after = await save(page);
  expect(after.request.dataset.rows).toEqual(before.request.dataset.rows);
  expect(after.dataTable).toEqual(before.dataTable);
});

test("a legacy v7 multi-series interval session remains importable and round-trips", async ({
  page,
  context,
}) => {
  const csv = [
    "Time (s),First (m),Second (m)",
    "0,0,2",
    "1,1,4",
    "2,2,6",
    "3,3,8",
  ].join("\n");
  await page.goto("/");
  await page.locator("input[type=file]").setInputFiles({
    name: "legacy-multi-series.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await useImportedData(page);
  await openIntervals(page);
  await range(page, 0, 3);
  const legacy = structuredClone(await save(page));
  if (legacy.workspace.kind !== "multi-interval")
    throw new Error("Expected a multi-interval session");
  legacy.workspace.columns = [1, 2];
  legacy.workspace.yRanges = [null, null];
  legacy.workspace.sigmas = [null, null];
  legacy.workspace.activeCurve = 1;
  for (const interval of legacy.workspace.intervals)
    interval.settings = [
      interval.settings[0],
      structuredClone(interval.settings[0]),
    ];

  const reopened = await context.newPage();
  await reopened.goto("/");
  await reopened.locator("input[type=file]").setInputFiles({
    name: "legacy-multi-series.trksess",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(legacy)),
  });
  await useImportedData(reopened);
  const workspace = reopened.getByRole("region", {
    name: "Multi-interval analysis",
    exact: true,
  });
  await expect(workspace).toContainText(
    "Legacy multi-series session · existing series are preserved",
  );
  await expect(
    reopened.getByLabel("Number of data series", { exact: true }),
  ).toHaveCount(0);
  await expect(
    reopened.getByLabel("Data series 1 column", { exact: true }),
  ).toHaveValue("1");
  await expect(
    reopened.getByLabel("Data series 2 column", { exact: true }),
  ).toHaveValue("2");
  await expect(
    reopened
      .getByLabel("Interval uncertainty model", { exact: true })
      .locator('option[value="estimate"]'),
  ).toHaveText("Estimate scatter separately");
  await reopened
    .getByRole("button", { name: "Fit Interval 1", exact: true })
    .click();
  await expect(workspace.getByRole("status")).toHaveText(
    "Interval 1: 2 of 2 legacy data series fitted",
  );
  const roundTrip = await save(reopened);
  if (roundTrip.workspace.kind !== "multi-interval")
    throw new Error("Expected a multi-interval session");
  expect(roundTrip.workspace.columns).toEqual([1, 2]);
  expect(roundTrip.workspace.sigmas).toEqual([null, null]);
  expect(roundTrip.workspace.activeCurve).toBe(1);
  expect(roundTrip.workspace.intervals[0].settings).toHaveLength(2);
  await reopened.close();
});
