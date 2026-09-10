import { test, expect, type Page } from "@playwright/test";
async function openCollision(page: Page) {
  await page.goto("/");
  await page
    .locator("input[type=file]")
    .setInputFiles("examples/data/collision.csv");
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await page.getByLabel("Analysis", { exact: true }).selectOption("collision");
  return page.getByRole("region", { name: "Collision analysis", exact: true });
}
test("integrated collision analysis retains both setups, shares report controls, and offers explicit noise modes", async ({
  page,
}) => {
  const workspace = await openCollision(page);
  await expect(
    page.getByRole("button", { name: "Collision draft…" }),
  ).toHaveCount(0);
  await expect(workspace.getByRole("img")).toHaveCount(4);
  await expect(
    page.getByRole("button", { name: "Print", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("Accept uncertainty assumptions", {
      exact: false,
    })
    .check();
  await page.getByRole("button", { name: "Fit before and after" }).click();
  await expect(workspace.getByRole("status")).toHaveText(
    "8 of 8 fits complete",
  );
  const summary = workspace.getByRole("table", {
    name: "Collision velocity summary",
  });
  await expect(summary).toContainText("±");
  await page.screenshot({
    path: "test-results/collision-workflow.png",
    fullPage: true,
  });
  await page.getByLabel("Analysis", { exact: true }).selectOption("line");
  await expect(workspace).toBeHidden();
  await page.getByRole("button", { name: "Fit selected observations" }).click();
  await expect(page.getByRole("status")).toHaveText("Fit complete");
  const slope = await page.getByLabel("m value", { exact: true }).inputValue();
  await page.getByLabel("Analysis", { exact: true }).selectOption("collision");
  await expect(summary).toBeVisible();
  await page
    .getByLabel("Position uncertainties", { exact: true })
    .selectOption("supplied");
  for (const name of [
    "Object 1 · x",
    "Object 1 · y",
    "Object 2 · x",
    "Object 2 · y",
  ])
    await page.getByLabel(`${name} uncertainty`, { exact: true }).fill("0.003");
  await page.getByRole("button", { name: "Fit before and after" }).click();
  await expect(workspace.getByRole("status")).toHaveText(
    "8 of 8 fits complete",
  );
  await page
    .getByLabel("Position uncertainties", { exact: true })
    .selectOption("estimate");
  await expect(
    page.getByLabel("Object 1 · x uncertainty", { exact: true }),
  ).toHaveCount(0);
  await expect(summary).toHaveCount(0);
  await page.getByRole("button", { name: "Fit before and after" }).click();
  await expect(workspace.getByRole("status")).toHaveText(
    "8 of 8 fits complete",
  );
  await page.emulateMedia({ media: "print" });
  await expect(workspace.locator(".collision-details")).toBeHidden();
  await expect(page.locator(".fit-header")).toBeHidden();
  const summaryPdf = await page.pdf({
    path: "test-results/collision-summary.pdf",
    format: "Letter",
    printBackground: true,
  });
  expect(
    summaryPdf.toString("latin1").match(/\/Type\s*\/Page\b/g),
  ).toHaveLength(1);
  // A4 is slightly narrower; preserve the one-page summary there too.
  const a4 = await page.addStyleTag({
    content: "@page { size: A4 portrait; margin: 15mm; }",
  });
  const a4Pdf = await page.pdf({
    path: "test-results/collision-summary-a4.pdf",
    preferCSSPageSize: true,
    printBackground: true,
  });
  expect(a4Pdf.toString("latin1").match(/\/Type\s*\/Page\b/g)).toHaveLength(1);
  await a4.evaluate((node) => node.remove());
  await page.emulateMedia({ media: "screen" });
  await page
    .getByLabel("Include fit details when printing", { exact: true })
    .check();
  await page.emulateMedia({ media: "print" });
  await expect(workspace.locator(".collision-details")).toBeVisible();
  await expect(workspace.locator(".collision-workspace")).toHaveCSS("display", "block");
  await expect(page.locator(".fit-app")).toHaveCSS("container-type", "normal");
  const detailedPdf = await page.pdf({
    path: "test-results/collision-report.pdf",
    format: "Letter",
    printBackground: true,
  });
  expect(
    detailedPdf.toString("latin1").match(/\/Type\s*\/Page\b/g),
  ).toHaveLength(5);
  await page.emulateMedia({ media: "screen" });
  await page.getByLabel("Analysis", { exact: true }).selectOption("line");
  expect(await page.getByLabel("m value", { exact: true }).inputValue()).toBe(
    slope,
  );
  await expect(page.locator(".fit-status")).toHaveText("Fitted");
});

test("shared boundaries drag and keyboard-adjust all graphs, invalidating fits", async ({
  page,
}) => {
  const workspace = await openCollision(page);
  await page.getByRole("button", { name: "Fit before and after" }).click();
  await expect(workspace.getByRole("status")).toHaveText(
    "8 of 8 fits complete",
  );
  const handle = workspace.getByRole("slider", {
    name: "x1: Before to",
    exact: true,
  });
  const original = Number(await handle.getAttribute("aria-valuenow"));
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 30, box.y + box.height / 2, {
    steps: 6,
  });
  await page.mouse.up();
  const next = Number(
    await page.getByLabel("Before to", { exact: true }).inputValue(),
  );
  expect(next).toBeLessThan(original);
  for (const column of ["x1", "y1", "x2", "y2"])
    await expect(
      workspace.getByRole("slider", {
        name: `${column}: Before to`,
        exact: true,
      }),
    ).toHaveAttribute("aria-valuenow", String(next));
  await expect(
    page.getByRole("button", { name: "Print", exact: true }),
  ).toBeDisabled();
  await handle.focus();
  await page.keyboard.press("ArrowRight");
  expect(
    Number(await page.getByLabel("Before to", { exact: true }).inputValue()),
  ).toBeGreaterThan(next);
  await page.getByLabel("After from", { exact: true }).fill("1");
  await expect(workspace.getByRole("alert")).toContainText("nonoverlapping");
  await expect(
    page.getByRole("button", { name: "Fit before and after" }),
  ).toBeDisabled();
});

test("collision is reachable with missing columns and at compact sizes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 700 });
  await page.goto("/");
  await page
    .getByRole("dialog", { name: "Data", exact: true })
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await page.getByLabel("Analysis", { exact: true }).selectOption("collision");
  await expect(page.getByRole("alert")).toContainText("Choose one time column");
  await expect(
    page.getByRole("button", { name: "Data…", exact: true }),
  ).toBeVisible();
  await page
    .locator("input[type=file]")
    .setInputFiles("examples/data/collision.csv");
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await page.getByRole("button", { name: "Fit before and after" }).click();
  const workspace = page.getByRole("region", {
    name: "Collision analysis",
    exact: true,
  });
  await expect(workspace.getByRole("status")).toHaveText(
    "8 of 8 fits complete",
  );
  expect(
    await workspace.evaluate((el) => el.scrollWidth > el.clientWidth + 1),
  ).toBe(false);
});
