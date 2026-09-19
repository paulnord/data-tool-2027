import { test, expect } from "@playwright/test";

test("compares refitted candidates and safely stages two session files", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles("examples/data/ball-toss.trksess");
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await page
    .getByLabel("Analysis tools", { exact: true })
    .selectOption("model-comparison");
  await expect(
    page.getByRole("heading", { name: "Model comparison" }),
  ).toBeVisible();

  const loaders = page.locator('.comparison-file input[type="file"]');
  await loaders.nth(0).setInputFiles("examples/data/ball-toss.trksess");
  await loaders.nth(1).setInputFiles("examples/data/sine-demo.trksess");
  const warning = page.locator(".comparison-warning");
  await expect(warning).toContainText("Comparison currently blocked");
  await expect(warning).toContainText("included observations");

  await loaders.nth(1).setInputFiles({
    name: "broken.trksess",
    mimeType: "application/json",
    buffer: Buffer.from("not json"),
  });
  await expect(page.getByRole("alert")).toContainText("was not changed");
  await expect(
    page.getByLabel("Candidate 2 model", { exact: true }),
  ).toHaveValue("sine");

  await loaders.nth(1).setInputFiles("examples/data/ball-toss.trksess");
  await page.getByRole("tab", { name: "Candidate 2", exact: true }).click();
  await page
    .getByLabel("Candidate 2 model", { exact: true })
    .selectOption("line");
  const compare = page.getByRole("button", { name: "Refit and compare" });
  await expect(compare).toHaveClass(/\bfit-primary\b/);
  await compare.click();
  await expect(page.getByRole("status")).toHaveText("Comparison complete");
  const table = page.getByRole("table", {
    name: "Model comparison statistics",
  });
  await expect(table).toBeVisible();
  await expect(table.locator("tbody tr")).toHaveCount(2);
  await expect(table).toContainText("Akaike");
  await expect(
    table.getByRole("columnheader", { name: "ΔAIC", exact: true }),
  ).toBeVisible();
  await expect(table.locator("tbody")).toContainText("Not applicable");
  await expect(
    table.locator("tbody tr").nth(1).locator("td").nth(10),
  ).toHaveText(/^(0|[0-9.]+e-\d+)$/);
  await expect(
    page.getByRole("img", { name: "Compared fitted curves" }),
  ).toBeVisible();
  await expect(page.locator(".comparison-tick")).not.toHaveCount(0);
  await expect(
    page.getByRole("group", { name: "Candidate 2", exact: true }),
  ).toContainText("Fitted parameters");
  await expect(
    page.getByRole("img", { name: "Compared residuals" }),
  ).toBeVisible();
  const copy = page.getByRole("button", { name: "Copy report", exact: true });
  await expect(copy).toBeEnabled();
  await copy.click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain("delta AIC\t");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    "χ²/df (reduced chi-squared)",
  );
  await page.setViewportSize({ width: 800, height: 700 });
  await expect(
    page.getByRole("heading", { name: "Model comparison" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    ),
  ).toBeLessThanOrEqual(1);

  await page
    .getByLabel("Analysis tools", { exact: true })
    .selectOption("single-fit");
  await page.getByLabel("Model", { exact: true }).selectOption("polynomial");
  await expect(page.getByLabel("Model", { exact: true })).toHaveValue(
    "polynomial",
  );
  await expect(page.getByLabel("m value", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("c2 value", { exact: true })).toBeVisible();
});
