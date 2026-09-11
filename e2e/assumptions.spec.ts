import { test, expect } from "@playwright/test";
test("assumptions sit below Fit; hover and click explain without accepting", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator("input[type=file]")
    .setInputFiles("examples/data/constant-speed.csv");
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  const fit = page.getByRole("button", { name: "Fit selected observations" });
  const check = page.getByRole("checkbox", {
    name: "Accept uncertainty assumptions",
    exact: true,
  });
  const help = page.getByRole("button", {
    name: "Accept uncertainty assumptions",
    exact: true,
  });
  const fitBox = (await fit.boundingBox())!,
    checkBox = (await check.boundingBox())!;
  expect(checkBox.y).toBeGreaterThan(fitBox.y + fitBox.height);
  expect(checkBox.y - (fitBox.y + fitBox.height)).toBeLessThan(35);
  await help.hover();
  await expect(page.getByRole("tooltip")).toContainText(
    "X (or time) is treated as exact",
  );
  await expect(page.getByRole("tooltip").getByRole("listitem")).toHaveCount(4);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await help.click();
  const guide = page.getByRole("dialog", {
    name: "Fitting and its assumptions",
  });
  await expect(guide).toBeVisible();
  await expect(check).not.toBeChecked();
  await expect(
    guide
      .locator("#guide-residuals")
      .getByRole("link", { name: /NIST: checking/ }),
  ).toHaveAttribute(
    "href",
    "https://www.itl.nist.gov/div898/handbook/pmd/section4/pmd44.htm",
  );
  await expect(guide).toContainText("unknown scatter, not zero error");
  const references = guide.locator("#guide-references");
  await expect(references).toContainText("For EA-4/02 calibration work");
  await expect(
    references.getByRole("link", { name: /JCGM GUM:/ }),
  ).toHaveAttribute("href", "https://doi.org/10.59161/JCGM100-2008E");
  await expect(
    references.getByRole("link", { name: /EA-4\/02:/ }),
  ).toHaveAttribute(
    "href",
    "https://european-accreditation.org/wp-content/uploads/2018/10/EA-4-02.pdf",
  );

  await page.screenshot({ path: "test-results/assumptions-guide.png" });
  await guide.getByRole("button", { name: "Close guide" }).click();
  await expect(help).toBeFocused();
  await check.check();
  await fit.click();
  await expect(page.getByRole("status")).toHaveText("Fit complete");
  await expect(page.locator(".fit-diagnostic-details")).toContainText(
    "conditional",
  );
});
test("collision uses the same assumptions control and guide on a compact screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 700 });
  await page.goto("/");
  await page
    .locator("input[type=file]")
    .setInputFiles("examples/data/collision.csv");
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await page.getByLabel("Analysis", { exact: true }).selectOption("collision");
  const fit = page.getByRole("button", { name: "Fit before and after" });
  await fit.scrollIntoViewIfNeeded();
  const check = page.getByRole("checkbox", {
    name: "Accept uncertainty assumptions",
    exact: true,
  });
  const fitBox = (await fit.boundingBox())!,
    checkBox = (await check.boundingBox())!;
  expect(checkBox.y - (fitBox.y + fitBox.height)).toBeGreaterThanOrEqual(0);
  expect(checkBox.y - (fitBox.y + fitBox.height)).toBeLessThan(35);
  const help = page.getByRole("button", {
    name: "Accept uncertainty assumptions",
    exact: true,
  });
  await help.focus();
  await expect(page.getByRole("tooltip")).toBeVisible();
  const tip = (await page.getByRole("tooltip").boundingBox())!;
  expect(tip.x).toBeGreaterThanOrEqual(0);
  expect(tip.x + tip.width).toBeLessThanOrEqual(900);
  await page.keyboard.press("Enter");
  const guide = page.getByRole("dialog", {
    name: "Fitting and its assumptions",
  });
  await expect(guide).toBeVisible();
  expect(await guide.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(
    false,
  );
  await page.keyboard.press("Escape");
  await expect(guide).toHaveCount(0);
  await expect(check).not.toBeChecked();
});
test("rollover avoids its label and retains selectable text after keyboard focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 700 });
  await page.goto("/");
  await page
    .locator("input[type=file]")
    .setInputFiles("examples/data/constant-speed.csv");
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  const help = page.getByRole("button", {
    name: "Accept uncertainty assumptions",
    exact: true,
  });
  await help.focus();
  const tip = page.getByRole("tooltip");
  await expect(tip).toBeVisible();
  const anchor = (await help.boundingBox())!,
    box = (await tip.boundingBox())!;
  expect(
    box.y + box.height <= anchor.y - 7 || box.y >= anchor.y + anchor.height + 7,
  ).toBe(true);
  await expect(tip).toHaveCSS("user-select", "text");
  const text = tip.getByRole("listitem").first();
  const rect = (await text.boundingBox())!;
  await page.mouse.move(rect.x + 2, rect.y + rect.height / 2);
  await page.mouse.down();
  await page.mouse.move(rect.x + 170, rect.y + rect.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect
    .poll(() => page.evaluate(() => window.getSelection()?.toString()))
    .toContain("treated");
  await page.mouse.move(20, 20);
  // Moving out must not remove the selected text before the user can copy it.
  await page.waitForTimeout(400);
  await expect(tip).toBeVisible();
  await help.click();
  await expect(
    page.getByRole("dialog", { name: "Fitting and its assumptions" }),
  ).toBeVisible();
});
