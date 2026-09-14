import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function openData(page: Page) {
  await page.goto("/");
  await page
    .locator("input[type=file]")
    .setInputFiles("examples/data/ball-toss.trksess");
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
}

test("parameters accept incremental negative and scientific notation without saving partial numbers", async ({
  page,
}) => {
  await openData(page);
  const value = page.getByLabel("y0 value", { exact: true });
  const fit = page.getByRole("button", { name: "Fit selected observations" });
  const save = page.getByRole("button", { name: "Save session", exact: true });
  await value.fill("");
  await expect(value).toHaveValue("");
  await expect(fit).toBeDisabled();
  await expect(save).toBeDisabled();
  await value.pressSequentially("-");
  await expect(value).toHaveValue("-");
  await value.pressSequentially("2.5");
  await expect(value).toHaveValue("-2.5");
  await expect(fit).toBeEnabled();
  await value.fill("1");
  await value.pressSequentially("e-");
  await expect(value).toHaveValue("1e-");
  await expect(save).toBeDisabled();
  await value.pressSequentially("3");
  await expect(value).toHaveValue("1e-3");
  await value.press("Enter");
  await expect(value).toHaveValue("0.001");
  const downloading = page.waitForEvent("download");
  await save.click();
  const session = JSON.parse(
    await readFile((await (await downloading).path())!, "utf8"),
  );
  expect(session.settings.parameters[0].value).toBe(0.001);
  await value.fill("-");
  await value.press("Escape");
  await expect(value).toHaveValue("0.001");
  await expect(fit).toBeEnabled();
  await value.fill("1e999");
  await value.blur();
  await expect(value).toHaveValue("0.001");
  await expect(page.getByRole("alert")).toContainText(
    "last valid value was restored",
  );
  await fit.click();
  await expect(page.getByRole("status")).toHaveText("Fit complete");
  const fittedValue = await value.inputValue();
  await value.fill("");
  await expect(value).toHaveValue("");
  await value.press("Escape");
  await expect(value).toHaveValue(fittedValue);
});

test("supplied sine period can be edited naturally and rejects zero", async ({
  page,
}) => {
  await openData(page);
  await page.getByLabel("Analysis", { exact: true }).selectOption("sine");
  const period = page.getByLabel("Sine period", { exact: true });
  await period.fill("");
  await expect(period).toHaveValue("");
  await period.pressSequentially("1e-1");
  await period.press("Enter");
  await expect(period).toHaveValue("0.1");
  await period.fill("0");
  await expect(
    page.getByRole("button", { name: "Fit selected observations" }),
  ).toBeDisabled();
  await period.blur();
  await expect(period).toHaveValue("0.1");
  await expect(page.getByRole("alert")).toContainText(
    "period must be greater than zero",
  );
});

test("text undo stays in source notes and analysis history has one set of controls", async ({
  page,
}) => {
  await openData(page);
  const value = page.getByLabel("y0 value", { exact: true });
  await value.fill("3");
  const notes = page.getByLabel("Source notes", { exact: true });
  const original = await notes.inputValue();
  await notes.focus();
  await notes.press("End");
  await notes.pressSequentially("Q");
  await notes.press("ControlOrMeta+z");
  await expect(value).toHaveValue("3");
  await expect(notes).toHaveValue(original);
  const undo = page.getByRole("button", { name: /Undo/ });
  await expect(undo).toHaveCount(1);
  await undo.click();
  await expect(value).toHaveValue("0");
  await expect(page.getByRole("status")).toHaveText("Analysis change undone");
  const identifiers = page.locator(".fit-source details");
  await expect(identifiers.locator("p")).toBeHidden();
  await identifiers.locator("summary").click();
  await expect(identifiers.locator("p")).toContainText("Snapshot ID:");
});
