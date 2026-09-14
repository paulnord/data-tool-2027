import { test, expect, type Locator, type Page } from "@playwright/test";

async function paste(cell: Locator, text: string) {
  await cell.evaluate((input, value) => {
    const data = new DataTransfer();
    data.setData("text/plain", value);
    input.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      }),
    );
  }, text);
}

async function openEnlargedData(page: Page) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/");
  await page
    .locator("input[type=file]")
    .setInputFiles("examples/data/ball-toss.trksess");
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await page.locator(".fit-display-menu summary").click();
  await page.getByLabel("Display size", { exact: true }).selectOption("2");
  await page.locator(".fit-display-menu summary").click();
  await page.getByRole("button", { name: "Data…", exact: true }).click();
  return page.getByRole("dialog", { name: "Data", exact: true });
}

test("startup invites data entry without an error and preserves the first headerless pasted observation", async ({
  page,
}) => {
  await page.goto("/");
  const data = page.getByRole("dialog", { name: "Data", exact: true });
  await expect(data.getByRole("alert")).toHaveCount(0);
  expect(
    await data
      .getByLabel("Header rows", { exact: true })
      .evaluate((input: HTMLInputElement) => input.validity.valid),
  ).toBe(true);
  await expect(
    data.getByRole("button", { name: "Use these data", exact: true }),
  ).toBeDisabled();
  await expect(data.locator(".fit-editing-help")).not.toHaveAttribute(
    "open",
    "",
  );
  await paste(
    data.getByLabel("Row 1 column 1", { exact: true }),
    "0\t1\n1\t3\n2\t5",
  );
  await expect(data.getByLabel("Header rows", { exact: true })).toHaveValue(
    "0",
  );
  await expect(data.getByLabel("Row 1 column 1", { exact: true })).toHaveValue(
    "0",
  );
  await expect(data).toContainText("3 data rows");
  await data
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await expect(page.locator(".fit-source")).toContainText("3 / 3");
});

test("Data actions remain visible while editing at 200 percent and Examples needs only one scroll area", async ({
  page,
}) => {
  const data = await openEnlargedData(page);
  await data
    .getByLabel("Row 2 column 1", { exact: true })
    .scrollIntoViewIfNeeded();
  const useData = data.getByRole("button", {
    name: "Use these data",
    exact: true,
  });
  const header = data.locator(".fit-data-header");
  const headerRect = (await header.boundingBox())!;
  const dialogRect = (await data.boundingBox())!;
  expect(headerRect.y).toBeGreaterThanOrEqual(dialogRect.y);
  expect(headerRect.y + headerRect.height).toBeLessThan(
    dialogRect.y + dialogRect.height,
  );
  await expect(useData).toHaveCSS("color", "rgb(255, 255, 255)");

  await data.locator(".fit-examples-menu summary").click();
  const popover = data.locator(".fit-examples-popover");
  await expect(
    data.getByRole("tab", { name: "Synthetic data (14)", exact: true }),
  ).toBeVisible();
  await expect(
    data.getByRole("tab", { name: "Published data (15)", exact: true }),
  ).toBeVisible();
  await expect(
    data.getByText("Scroll for more examples ↓", { exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () => {
      const box = (await popover.boundingBox())!;
      const dialog = (await data.boundingBox())!;
      return (
        box.y >= dialog.y && box.y + box.height <= dialog.y + dialog.height
      );
    })
    .toBe(true);
  const scrollBefore = await data.evaluate((element) => element.scrollTop);
  await popover.getByRole("menuitem").last().scrollIntoViewIfNeeded();
  expect(await data.evaluate((element) => element.scrollTop)).toBe(
    scrollBefore,
  );
  await expect(
    data.getByText("Scroll for more examples ↓", { exact: true }),
  ).toBeHidden();
  await data
    .getByRole("tab", { name: "Published data (15)", exact: true })
    .click();
  await page.keyboard.press("ArrowLeft");
  await expect(
    data.getByRole("tab", { name: "Synthetic data (14)", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(
    data.getByRole("tab", { name: "Published data (15)", exact: true }),
  ).toBeFocused();
  await expect(popover.getByRole("menuitem").first()).toHaveText(
    "YMnO₃ Z-mode spin precession",
  );
  await expect(popover.getByRole("menuitem").nth(1)).toHaveText(
    "DyFeO₃ coherent spin wave",
  );
  await popover.getByRole("menuitem").first().focus();
  await page.keyboard.press("ArrowDown");
  await expect(popover.getByRole("menuitem").nth(1)).toBeFocused();
  await page.keyboard.press("End");
  await expect(popover.getByRole("menuitem").last()).toBeFocused();
  expect(await data.evaluate((element) => element.scrollTop)).toBe(
    scrollBefore,
  );
  await page.keyboard.press("Escape");
  await expect(data).toBeVisible();
  await expect(data.locator(".fit-examples-menu summary")).toBeFocused();
});

test("column menus fit the visible table and support keyboard navigation past disabled commands", async ({
  page,
}) => {
  const data = await openEnlargedData(page);
  const heading = data.getByLabel("Select column 2", { exact: true });
  await heading.scrollIntoViewIfNeeded();
  await heading.focus();
  await page.keyboard.press("Shift+F10");
  const menu = data.getByRole("menu", {
    name: "Column 2 actions",
    exact: true,
  });
  await expect(
    menu.getByRole("menuitem", { name: "Copy", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(
    menu.getByRole("menuitem", { name: "Insert column left", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("End");
  await expect(
    menu.getByRole("menuitem", { name: "Close menu", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(
    menu.getByRole("menuitem", { name: "Clear contents", exact: true }),
  ).toBeFocused();
  const box = (await menu.boundingBox())!;
  const table = (await data.locator(".fit-data-scroll").boundingBox())!;
  const dialog = (await data.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(table.x);
  expect(box.x + box.width).toBeLessThanOrEqual(table.x + table.width);
  expect(box.y + box.height).toBeLessThanOrEqual(
    Math.min(table.y + table.height, dialog.y + dialog.height),
  );
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(heading).toBeFocused();
  await data.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator(".fit-data-trigger")).toBeFocused();
});
