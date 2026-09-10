import { test, expect } from "@playwright/test";
test("release starts with an empty table and loads a sample only on request", async ({
  page,
}) => {
  await page.goto("/");
  const panel = page.getByRole("dialog", { name: "Data", exact: true });
  await expect(panel).toBeVisible();
  await expect(panel.getByLabel("Row 2 column 1", { exact: true })).toHaveValue(
    "",
  );
  await expect(page.locator(".fit-plot circle")).toHaveCount(0);
  await expect(page).toHaveTitle("Data Tool 2027");
  await expect(page.getByLabel("Load example", { exact: true })).toHaveCount(0);
  const chooserPromise = page.waitForEvent("filechooser");
  await panel.getByRole("button", { name: "Load file…", exact: true }).click();
  await (await chooserPromise).setFiles("examples/data/ball-toss.trksess");
  await expect(panel.getByLabel("Row 2 column 1", { exact: true })).toHaveValue(
    "0",
  );
  await panel
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await expect(page.locator(".fit-source")).toContainText("61 / 61");
  await expect(page.getByLabel("Load example", { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("dialog", { name: "Data", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".fit-plot circle")).toHaveCount(0);
});
