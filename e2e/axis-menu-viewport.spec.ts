import { test, expect } from "@playwright/test";

test("axis menus keep their full controls reachable at 200% without scrolling the page", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/");
  await page
    .locator("input[type=file]")
    .setInputFiles("examples/data/published/dyfeo3-spin-wave.trksess");
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await page.getByRole("button", { name: "Fit selected observations" }).click();
  await expect(page.getByRole("status")).toHaveText("Fit complete");
  await page.locator(".fit-display-menu summary").click();
  await page.getByLabel("Display size", { exact: true }).selectOption("2");
  await page.keyboard.press("Escape");
  for (const axis of ["X", "Y"]) {
    const trigger = page
      .locator(".fit-chart .fit-axis-controls summary")
      .filter({ hasText: `${axis} axis` });
    await trigger.click();
    const panel = page.locator(
      ".fit-chart .y-axis-controls[open] .y-axis-panel",
    );
    await expect
      .poll(() =>
        panel.evaluate((el) => {
          const rect = el.getBoundingClientRect();
          return Math.max(
            0,
            11 - rect.top,
            rect.bottom - innerHeight + 11,
            11 - rect.left,
            rect.right - innerWidth + 11,
          );
        }),
      )
      .toBe(0);
    const pageScroll = await page.evaluate(() => scrollY);
    await panel
      .getByRole("button", { name: "Apply range", exact: true })
      .scrollIntoViewIfNeeded();
    const apply = await panel
      .getByRole("button", { name: "Apply range", exact: true })
      .boundingBox();
    expect(apply!.y).toBeGreaterThanOrEqual(0);
    expect(apply!.y + apply!.height).toBeLessThanOrEqual(768);
    expect(await page.evaluate(() => scrollY)).toBe(pageScroll);
    await panel
      .getByRole("button", { name: "Auto", exact: true })
      .scrollIntoViewIfNeeded();
    await expect(
      panel.getByRole("button", { name: "Auto", exact: true }),
    ).toBeInViewport();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
  }
});
