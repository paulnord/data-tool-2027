import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
test("custom equation fits, preserves units, prints and round trips", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator("input[type=file]")
    .setInputFiles("examples/data/constant-speed.csv");
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await page.getByLabel("Analysis", { exact: true }).selectOption("custom");
  await page.getByLabel("Equation variable", { exact: true }).fill("t");
  await page.getByLabel("Custom equation", { exact: true }).fill("y0 + v0*t");
  const fit = page.getByRole("button", { name: "Fit selected observations" });
  await expect(fit).toBeDisabled();
  await page
    .getByRole("button", { name: "Apply equation", exact: true })
    .click();
  await page.getByLabel("y0 unit", { exact: true }).fill("m");
  await page.getByLabel("v0 unit", { exact: true }).fill("mH");
  await expect(page.getByLabel("v0 unit", { exact: true })).toHaveAttribute(
    "autocapitalize",
    "none",
  );
  await page
    .getByRole("checkbox", {
      name: "Accept uncertainty assumptions",
      exact: true,
    })
    .check();
  await fit.click();
  await expect(page.getByRole("status")).toHaveText("Fit complete");
  await page.screenshot({ path: "test-results/custom-equation.png" });
  await page.getByRole("button", { name: "Print", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Print report" }),
  ).toContainText("y = y0 + v0*t");
  await expect(
    page.getByRole("table", { name: "Print parameters" }),
  ).toContainText("mH");
  await page.getByRole("button", { name: "Close preview" }).click();
  const promise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save session", exact: true }).click();
  const file = (await (await promise).path())!;
  const saved = JSON.parse(readFileSync(file, "utf8"));
  expect(saved.version).toBe(3);
  expect(saved.settings.custom.units).toEqual(["m", "mH"]);
  await page.reload();
  await page.locator("input[type=file]").setInputFiles({
    name: "custom.trksess",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(saved)),
  });
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await expect(page.getByLabel("Custom equation", { exact: true })).toHaveValue(
    "y0 + v0*t",
  );
  await fit.click();
  await expect(page.getByRole("status")).toHaveText("Fit complete");
  await page
    .getByLabel("Custom equation", { exact: true })
    .fill("y0 + window.x");
  await expect(
    page.getByRole("button", { name: "Apply equation", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Save session", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Discard equation edits" }).click();
  await expect(fit).toBeEnabled();
});
test("convert an existing fit and report invalid equation domains", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator("input[type=file]")
    .setInputFiles("examples/data/constant-speed.csv");
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await page.getByLabel("Analysis", { exact: true }).selectOption("line");
  await page.getByRole("button", { name: "Fit selected observations" }).click();
  await expect(page.getByRole("status")).toHaveText("Fit complete");
  const slope = await page.getByLabel("m value", { exact: true }).inputValue();
  await page.getByRole("button", { name: "Edit as custom equation" }).click();
  expect(
    Number(await page.getByLabel("m value", { exact: true }).inputValue()),
  ).toBeCloseTo(Number(slope), 5);
  await page
    .getByLabel("Custom equation", { exact: true })
    .fill("a*ln(x-1000)");
  await page
    .getByRole("button", { name: "Apply equation", exact: true })
    .click();
  await page.getByRole("button", { name: "Fit selected observations" }).click();
  await expect(page.getByRole("alert")).toContainText("Equation is undefined");
});
test("dependent parameters show student guidance with collapsed technical details", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator("input[type=file]")
    .setInputFiles("examples/data/constant-speed.csv");
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await page.getByLabel("Analysis", { exact: true }).selectOption("custom");
  await page
    .getByLabel("Custom equation", { exact: true })
    .fill("a + b*x + c*x^2 + d*x^2");
  await page
    .getByRole("button", { name: "Apply equation", exact: true })
    .click();
  await page.getByRole("button", { name: "Fit selected observations" }).click();
  const error = page.getByRole("alert");
  await expect(error).toContainText(
    "These data cannot determine all four free parameters independently.",
  );
  await expect(error).toContainText("Try fixing one parameter");
  const technical = error.getByText(
    "Rank deficient: 3 independent columns for 4 free parameters",
    { exact: true },
  );
  await expect(technical).not.toBeVisible();
  await error.getByText("Details", { exact: true }).click();
  await expect(technical).toBeVisible();
  await page.getByLabel("Fix d", { exact: true }).check();
  await page.getByRole("button", { name: "Fit selected observations" }).click();
  await expect(page.getByRole("status")).toHaveText("Fit complete");
  await expect(error).toHaveCount(0);
});
