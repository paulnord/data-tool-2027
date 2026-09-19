import { test, expect, type Page } from "@playwright/test";

async function openData(page: Page) {
  await page.goto("/");
  await page
    .locator("input[type=file]")
    .setInputFiles("examples/data/ball-toss.trksess");
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
}

async function openSize(page: Page) {
  await page.locator(".fit-export-menu > summary").click();
  await page
    .getByRole("menuitem", { name: "Figure size…", exact: true })
    .click();
  return page.getByRole("dialog", { name: "Figure size", exact: true });
}

test("dialog shortcuts stay in the dialog and Escape restores a visible trigger", async ({
  page,
}) => {
  await openData(page);
  await page.getByRole("button", { name: "Data…", exact: true }).click();
  const data = page.getByRole("dialog", { name: "Data", exact: true });
  const draft = data.getByLabel("Row 2 column 2", { exact: true });
  await draft.fill("99");
  await draft.press("ControlOrMeta+p");
  await expect(page.getByRole("dialog", { name: "Print report" })).toHaveCount(
    0,
  );
  await expect(draft).toHaveValue("99");
  await draft.press("Escape");
  await expect(data).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Data…", exact: true }),
  ).toBeFocused();

  const value = page.getByLabel("y0 value", { exact: true });
  await value.fill("3");
  const sizing = await openSize(page);
  await sizing.getByLabel("Size preset").focus();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(value).toHaveValue("3");
  await page.keyboard.press("Escape");
  await expect(sizing).toHaveCount(0);
  await expect(page.locator(".fit-export-menu > summary")).toBeFocused();

  await page.evaluate(() => {
    window.print = () => {
      document.body.dataset.printCalls = String(
        Number(document.body.dataset.printCalls ?? 0) + 1,
      );
    };
  });
  await page.getByRole("button", { name: "Print", exact: true }).click();
  const preview = page.getByRole("dialog", { name: "Print report" });
  await preview
    .getByRole("button", { name: "Print…", exact: true })
    .press("ControlOrMeta+p");
  await expect(page.locator("body")).toHaveAttribute("data-print-calls", "1");
  await page.keyboard.press("Escape");
  await expect(preview).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Print", exact: true }),
  ).toBeFocused();
});

test("pending custom equation clearly suspends reports and figure exports", async ({
  page,
}) => {
  await openData(page);
  await page.getByLabel("Model", { exact: true }).selectOption("custom");
  await page.getByRole("button", { name: "Fit selected observations" }).click();
  await expect(page.getByRole("status")).toHaveText("Fit complete");
  await page.getByLabel("Custom equation", { exact: true }).fill("y0 + v0*t");
  await expect(page.locator(".fit-status")).toHaveText(
    "Equation edits pending",
  );
  for (const name of ["Save session", "Copy report", "Print"])
    await expect(
      page.getByRole("button", { name, exact: true }),
    ).toBeDisabled();
  await page.locator(".fit-export-menu > summary").click();
  for (const name of ["SVG vector graphic", "PNG image", "PDF vector graphic"])
    await expect(
      page.getByRole("menuitem", { name, exact: true }),
    ).toBeDisabled();
  await page.keyboard.press("Escape");
  await page.keyboard.press("ControlOrMeta+p");
  await expect(page.getByRole("dialog", { name: "Print report" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Discard equation edits" }).click();
  await expect(
    page.getByRole("button", { name: "Copy report", exact: true }),
  ).toBeEnabled();
});

test("export menus support arrow keys and failed imports explain preserved work", async ({
  page,
}) => {
  await openData(page);
  const trigger = page.locator(".fit-export-menu > summary");
  await trigger.focus();
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("menuitem", { name: "SVG vector graphic" }),
  ).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitem", { name: "PNG image" })).toBeFocused();
  await page.keyboard.press("End");
  await expect(
    page.getByRole("menuitem", { name: "Figure size…" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await page.getByRole("button", { name: "Data…", exact: true }).click();
  await page.locator("input[type=file]").setInputFiles({
    name: "broken.trksess",
    mimeType: "application/json",
    buffer: Buffer.from("{broken"),
  });
  const data = page.getByRole("dialog", { name: "Data", exact: true });
  await expect(data.getByRole("alert")).toContainText(
    "Import rejected: broken.trksess. Your current data were kept.",
  );
  await expect(data.getByRole("alert").locator("details")).not.toHaveAttribute(
    "open",
    "",
  );
  await expect(data.getByLabel("Row 2 column 1", { exact: true })).toHaveValue(
    "0",
  );
});

test("help text follows the interface size and its close action remains reachable", async ({
  page,
}) => {
  await openData(page);
  await page.setViewportSize({ width: 900, height: 700 });
  await page.locator(".fit-display-menu > summary").click();
  await page.getByLabel("Display size", { exact: true }).selectOption("2");
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", {
      name: "Accept uncertainty assumptions",
      exact: true,
    })
    .click();
  const guide = page.getByRole("dialog", {
    name: "Fitting and its assumptions",
  });
  await expect(guide).toBeVisible();
  expect(
    await guide.evaluate((element) => getComputedStyle(element).fontSize),
  ).toBe("30px");
  const close = guide.getByRole("button", { name: "Close guide" });
  const bounds = (await close.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(900);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(700);
  await close.click();
  await expect(guide).toHaveCount(0);
});
