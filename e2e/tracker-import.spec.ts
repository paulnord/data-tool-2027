import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { zipSync, strToU8 } from "fflate";
const xml = readFileSync("tests/fixtures/tracker/calibrated.trk", "utf8");
test("Tracker track review preserves calibration, timing choice and source table through session save", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("input[type=file]").setInputFiles({
    name: "cart.trk",
    mimeType: "application/xml",
    buffer: Buffer.from(xml),
  });
  const review = page.getByRole("dialog", { name: "Import Tracker data" });
  await expect(review).toBeVisible();
  await expect(review).toContainText("2 saved positions in 3 clip steps");
  await review.getByRole("checkbox").check();
  await review.getByRole("button", { name: "Review data" }).click();
  const data = page.getByRole("dialog", { name: "Data", exact: true });
  await expect(data.getByLabel("Row 2 column 4", { exact: true })).toHaveValue(
    "80.00000000000000",
  );
  await expect(data.getByLabel("Row 2 column 6", { exact: true })).toHaveValue(
    "0.5",
  );
  await data
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await expect(page.locator(".fit-source")).toContainText("2 / 3");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save session", exact: true }).click();
  const download = await downloadPromise;
  const saved = JSON.parse(readFileSync((await download.path())!, "utf8"));
  expect(saved.format).toBe("tracker-fit-session");
  expect(saved.request.source.context).toContain(
    "User explicitly assumed uniform timing",
  );
  expect(saved.dataTable.cells[1][3]).toBe("80.00000000000000");
  expect(saved.request.dataset.rows[1].included).toBe(false);
  await page.locator("input[type=file]").setInputFiles({
    name: "reopened.trksess",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(saved)),
  });
  await expect(data.getByLabel("Row 2 column 6", { exact: true })).toHaveValue(
    "0.5",
  );
});
test("TRZ track selection and cancellation preserve existing work; invalid imports do too", async ({
  page,
}) => {
  await page.goto("/");
  const data = page.getByRole("dialog", { name: "Data", exact: true });
  await page
    .locator("input[type=file]")
    .setInputFiles("examples/data/constant-speed.csv");
  const existing = await data
    .getByLabel("Row 3 column 2", { exact: true })
    .inputValue();
  const archive = zipSync({
    "one.trk": strToU8(xml),
    "two.trk": strToU8(xml.replace("Cart &amp; spring", "Second cart")),
    "video.mp4": new Uint8Array([255, 0]),
  });
  await page.locator("input[type=file]").setInputFiles({
    name: "lab.trz",
    mimeType: "application/zip",
    buffer: Buffer.from(archive),
  });
  const review = page.getByRole("dialog", { name: "Import Tracker data" });
  await expect(
    review.getByLabel("Tracker track").locator("option"),
  ).toHaveCount(2);
  await review.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(data.getByLabel("Row 3 column 2", { exact: true })).toHaveValue(
    existing,
  );
  await page.locator("input[type=file]").setInputFiles({
    name: "broken.trk",
    mimeType: "application/xml",
    buffer: Buffer.from("<object>"),
  });
  await expect(data.getByRole("alert")).toContainText("Import rejected");
  await expect(data.getByLabel("Row 3 column 2", { exact: true })).toHaveValue(
    existing,
  );
  await page.locator("input[type=file]").setInputFiles({
    name: "lab.trz",
    mimeType: "application/zip",
    buffer: Buffer.from(archive),
  });
  await review.getByLabel("Tracker track").selectOption("1");
  await review.getByRole("button", { name: "Review data" }).click();
  await expect(data.getByLabel("Row 1 column 1", { exact: true })).toHaveValue(
    "Frame",
  );
  await data
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await expect(page.locator(".fit-source")).toContainText("Second cart");
});
test("classroom CSV files require an explicit fit and reopen unchanged", async ({
  page,
}) => {
  await page.goto("/");
  const data = page.getByRole("dialog", { name: "Data", exact: true });
  await page
    .locator("input[type=file]")
    .setInputFiles("examples/data/constant-speed.csv");
  await expect(data.getByLabel("Row 3 column 1", { exact: true })).toHaveValue(
    "0.0",
  );
  await data
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await expect(page.locator(".fit-source")).toContainText("11 / 11");
  await expect(page.locator(".fit-plot .fit-curve")).toHaveCount(0);
  await page.getByRole("button", { name: "Fit selected observations" }).click();
  await expect(page.getByRole("status")).toHaveText("Fit complete");
  const savedSlope = await page
    .getByLabel("m value", { exact: true })
    .inputValue();
  await page
    .locator("input[type=file]")
    .setInputFiles("examples/data/constant-speed.csv");
  await expect(data.getByLabel("Row 3 column 1", { exact: true })).toHaveValue(
    "0.0",
  );
  await data
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await page.getByRole("button", { name: "Fit selected observations" }).click();
  await expect(page.getByRole("status")).toHaveText("Fit complete");
  await expect(page.getByLabel("m value", { exact: true })).toHaveValue(
    savedSlope,
  );
});
