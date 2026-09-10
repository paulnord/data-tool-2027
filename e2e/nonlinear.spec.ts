import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const cases = [
  ["exponential-decay", "tau", 2.2],
  ["power-law-free", "n", 1.7],
  ["gaussian", "sigma", 0.8],
  ["damped-sine", "T", 1.7],
  ["lorentzian", "gamma", 0.6],
] as const;
for (const [model, parameter, truth] of cases)
  test(`${model}: ordinary CSV, fit, fix parameter, print and v2 reopen`, async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .locator("input[type=file]")
      .setInputFiles(`examples/data/${model}.csv`);
    await page
      .getByRole("button", { name: "Use these data", exact: true })
      .click();
    await page.getByLabel("Analysis", { exact: true }).selectOption(model);
    await page
      .getByRole("button", { name: "Fit selected observations" })
      .click();
    await expect(page.getByRole("status")).toHaveText("Fit complete");
    expect(
      Number(
        await page
          .getByLabel(`${parameter} value`, { exact: true })
          .inputValue(),
      ),
    ).toBeCloseTo(truth, 1);
    await expect(
      page.locator(".fit-help").filter({ hasText: "starting estimates" }),
    ).toBeVisible();
    await page.getByLabel(`Fix ${parameter}`, { exact: true }).check();
    await page
      .getByLabel(`${parameter} value`, { exact: true })
      .fill(String(truth));
    await page
      .getByRole("button", { name: "Fit selected observations" })
      .click();
    await expect(page.getByRole("status")).toHaveText("Fit complete");
    const promise = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Save session", exact: true })
      .click();
    const file = await promise;
    const bytes = readFileSync((await file.path())!);
    const session = JSON.parse(bytes.toString());
    expect(session.version).toBe(2);
    expect(session.engine).toBe("qr-lm-3");
    expect(session.request.version).toBe(1);
    await page.getByRole("button", { name: "Print", exact: true }).click();
    await expect(
      page
        .getByRole("dialog", { name: "Print report" })
        .getByRole("table", { name: "Print parameters" }),
    ).toContainText(parameter);
    await page
      .getByRole("dialog", { name: "Print report" })
      .getByRole("button", { name: "Close preview", exact: true })
      .click();
    await page.locator("input[type=file]").setInputFiles({
      name: "new.trksess",
      mimeType: "application/json",
      buffer: bytes,
    });
    await page
      .getByRole("button", { name: "Use these data", exact: true })
      .click();
    await expect(
      page.getByLabel(`Fix ${parameter}`, { exact: true }),
    ).toBeChecked();
    await page
      .getByRole("button", { name: "Fit selected observations" })
      .click();
    await expect(page.getByRole("status")).toHaveText("Fit complete");
  });
