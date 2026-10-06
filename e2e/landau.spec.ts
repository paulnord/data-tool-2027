import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

test("Landau example opens with Advanced off, fits and round-trips its uncertainties", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("data-tool-2027.advanced-features", "false"),
  );
  await page.goto("/");
  await page.getByText("Examples", { exact: true }).click();
  await page
    .getByRole("menuitem", { name: "Landau peak", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await expect(page.getByLabel("Model", { exact: true })).toHaveValue("landau");
  await expect(page.getByLabel("Fix b", { exact: true })).toBeChecked();
  await expect(page.getByLabel("b value", { exact: true })).toHaveValue("0");
  await page.getByRole("button", { name: "Fit selected observations" }).click();
  await expect(page.getByRole("status")).toHaveText("Fit complete");
  expect(
    Number(await page.getByLabel("mpv value", { exact: true }).inputValue()),
  ).toBeCloseTo(50, 0);
  expect(
    Number(await page.getByLabel("w value", { exact: true }).inputValue()),
  ).toBeCloseTo(5, 1);
  await page.screenshot({
    path: "test-results/landau-example.png",
    fullPage: true,
  });
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save session", exact: true }).click();
  const bytes = readFileSync((await (await downloaded).path())!);
  const saved = JSON.parse(bytes.toString());
  expect(saved.version).toBe(7);
  expect(saved.request.uncertainty.kind).toBe("supplied-per-row");
  expect(Object.keys(saved.request.uncertainty.sigmaByRow)).toHaveLength(101);
  await page.reload();
  await page.locator("input[type=file]").setInputFiles({
    name: "landau.trksess",
    mimeType: "application/json",
    buffer: bytes,
  });
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await page.getByRole("button", { name: "Fit selected observations" }).click();
  await expect(page.getByRole("status")).toHaveText("Fit complete");
});

test("choosing Landau for ordinary data fixes its background and supports custom conversion", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator("input[type=file]")
    .setInputFiles("examples/data/landau.csv");
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await page.getByLabel("Model", { exact: true }).selectOption("landau");
  await expect(page.getByLabel("Fix b", { exact: true })).toBeChecked();
  await page.getByRole("button", { name: "Fit selected observations" }).click();
  await expect(page.getByRole("status")).toHaveText("Fit complete");
  const mpv = await page.getByLabel("mpv value", { exact: true }).inputValue();
  await page.getByRole("button", { name: "Edit as custom equation" }).click();
  await expect(page.getByLabel("Custom equation", { exact: true })).toHaveValue(
    "b+A/w*landau((x-mpv)/w)",
  );
  expect(
    Number(await page.getByLabel("mpv value", { exact: true }).inputValue()),
  ).toBeCloseTo(Number(mpv), 5);
  await page.getByRole("button", { name: "Fit selected observations" }).click();
  await expect(page.getByRole("status")).toHaveText("Fit complete");
});
