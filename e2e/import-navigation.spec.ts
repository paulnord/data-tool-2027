import { test, expect } from "@playwright/test";

test("Examples closes on an outside click or Escape without canceling table edits", async ({
  page,
}) => {
  await page.goto("/");
  const data = page.getByRole("dialog", { name: "Data", exact: true });
  const cell = data.getByLabel("Row 1 column 1", { exact: true });
  await cell.fill("27");
  const menu = data.locator(".fit-examples-menu");
  const summary = menu.locator("summary");
  await summary.click();
  await expect(menu).toHaveAttribute("open", "");
  await data.getByRole("heading", { name: "Data", exact: true }).click();
  await expect(menu).not.toHaveAttribute("open", "");
  await expect(cell).toHaveValue("27");
  await summary.click();
  await page.keyboard.press("Escape");
  await expect(menu).not.toHaveAttribute("open", "");
  await expect(summary).toBeFocused();
  await expect(data).toBeVisible();
  await expect(cell).toHaveValue("27");
});

test("keyboard table navigation crosses row pages without losing focus or a selection", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("input[type=file]").setInputFiles({
    name: "long-table.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      Array.from({ length: 205 }, (_, row) => `${row},${row * 2}`).join("\n"),
    ),
  });
  const data = page.getByRole("dialog", { name: "Data", exact: true });
  const row100 = data.getByLabel("Row 100 column 1", { exact: true });
  const row101 = data.getByLabel("Row 101 column 1", { exact: true });
  await row100.focus();
  await page.keyboard.press("Enter");
  await expect(row101).toBeFocused();
  await expect(row101).toHaveValue("100");
  await page.keyboard.press("ArrowUp");
  await expect(row100).toBeFocused();
  await page.keyboard.press("Shift+ArrowDown");
  await expect(row101).toBeFocused();
  await expect(data).toContainText("Selected rows 100–101, columns 1–1");
  await page.keyboard.press("Shift+ArrowUp");
  await expect(row100).toBeFocused();
  await expect(data).toContainText("Selected rows 100–100, columns 1–1");
  await expect(row100).toHaveValue("99");
});
