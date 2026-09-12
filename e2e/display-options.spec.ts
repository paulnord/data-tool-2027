import { test, expect, type Locator, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function openData(page: Page, file = "ball-toss.trksess") {
  await page.goto("/");
  await page.locator("input[type=file]").setInputFiles(`examples/data/${file}`);
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
}

async function openDisplay(page: Page) {
  const menu = page.locator(".fit-display-menu");
  await menu.locator("summary").click();
  await expect(menu).toHaveAttribute("open", "");
  return menu;
}

async function savedSession(page: Page) {
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save session", exact: true }).click();
  const download = await downloaded;
  return JSON.parse(await readFile((await download.path())!, "utf8"));
}

async function markerAppearance(marker: Locator) {
  return marker.evaluate((element) => {
    const bounds = (element as SVGGraphicsElement).getBBox();
    return {
      shape: element.getAttribute("data-marker-shape"),
      fill: getComputedStyle(element).fill,
      stroke: getComputedStyle(element).stroke,
      width: bounds.width,
      height: bounds.height,
    };
  });
}

test("Display presents one compact menu with keyboard and outside-click dismissal", async ({
  page,
}) => {
  await openData(page);
  const menu = page.locator(".fit-display-menu");
  const summary = menu.locator("summary");
  await expect(summary).toHaveText("Display ▾");
  await expect(
    page.getByRole("combobox", { name: "Colors", exact: true }),
  ).toBeHidden();
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(menu).toHaveAttribute("open", "");
  await expect(
    menu.getByRole("group", { name: "Graph appearance" }),
  ).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Display size", { exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).not.toHaveAttribute("open", "");
  await expect(summary).toBeFocused();
  await summary.click();
  await menu
    .getByRole("combobox", { name: "Colors", exact: true })
    .selectOption("muted");
  await expect(menu).toHaveAttribute("open", "");
  await page.getByRole("heading", { name: /^Data Tool 2027/ }).click();
  await expect(menu).not.toHaveAttribute("open", "");
});

test("appearance updates both plots and printing without changing a fitted session", async ({
  page,
}) => {
  await openData(page);
  await page
    .getByRole("button", { name: "Fit selected observations", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Fit complete");
  const coefficient = await page
    .getByLabel("a value", { exact: true })
    .inputValue();
  const originalSession = await savedSession(page);
  const data = page.getByRole("img", {
    name: "Data and fitted curve",
    exact: true,
  });
  const residual = page.getByRole("img", {
    name: "Residual plot",
    exact: true,
  });
  const curve = await data.locator(".curve").getAttribute("d");
  const marker = data.locator(".point[data-row-id]").nth(20);
  const initialAppearance = await markerAppearance(marker);
  expect(initialAppearance.stroke).toBe("none");
  const menu = await openDisplay(page);
  await menu
    .getByRole("combobox", { name: "Colors", exact: true })
    .selectOption("mono");
  await menu
    .getByRole("combobox", { name: "Marker size", exact: true })
    .selectOption("large");
  await menu
    .getByRole("combobox", { name: "Marker style", exact: true })
    .selectOption("square");
  await menu.locator("summary").click();
  const changed = await markerAppearance(marker);
  expect(changed.shape).toBe("square");
  expect(changed.width).toBeCloseTo(initialAppearance.width * 1.4, 4);
  expect(changed.fill).not.toBe(initialAppearance.fill);
  expect(
    await markerAppearance(residual.locator(".point[data-row-id]").nth(20)),
  ).toEqual(changed);
  await expect(page.locator(".fit-status")).toHaveText("Fitted");
  await expect(page.getByRole("status")).toHaveText("Session saved");
  expect(await page.getByLabel("a value", { exact: true }).inputValue()).toBe(
    coefficient,
  );
  expect(await data.locator(".curve").getAttribute("d")).toBe(curve);
  expect(await savedSession(page)).toEqual(originalSession);

  await page.getByRole("button", { name: "Print", exact: true }).click();
  const preview = page.getByRole("dialog", {
    name: "Print report",
    exact: true,
  });
  for (const graph of await preview.locator("svg.fit-plot").all()) {
    expect(
      await markerAppearance(graph.locator(".point[data-row-id]").nth(20)),
    ).toEqual(changed);
  }
  await page.emulateMedia({ media: "print" });
  expect(
    await markerAppearance(preview.locator(".point[data-row-id]").nth(20)),
  ).toEqual(changed);
});

test("every alternative marker still picks the exact observation at enlarged display size", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1800, height: 1200 });
  await openData(page);
  for (const shape of ["open-circle", "square", "diamond", "triangle"]) {
    const menu = await openDisplay(page);
    await menu.getByLabel("Display size", { exact: true }).selectOption("1.5");
    await menu
      .getByRole("combobox", { name: "Marker style", exact: true })
      .selectOption(shape);
    await menu.locator("summary").click();
    const marker = page
      .getByRole("img", { name: "Data and fitted curve", exact: true })
      .locator('.point[data-row-id="row-21"]');
    await expect(marker).toHaveAttribute("data-marker-shape", shape);
    if (shape === "open-circle") {
      await expect(marker).toHaveCSS("fill", "none");
      await expect(marker).not.toHaveCSS("stroke", "none");
    }
    await marker.click();
    await expect(marker).toHaveClass(/excluded/);
    await expect(page.locator(".fit-source")).toContainText("60 / 61");
    await marker.click();
    await expect(marker).not.toHaveClass(/excluded/);
    await expect(page.locator(".fit-source")).toContainText("61 / 61");
  }
});

test("Reset appearance restores graph defaults while retaining interface size", async ({
  page,
}) => {
  await openData(page);
  const marker = page
    .getByRole("img", { name: "Data and fitted curve", exact: true })
    .locator(".point[data-row-id]")
    .nth(20);
  const original = await markerAppearance(marker);
  const menu = await openDisplay(page);
  await menu.getByLabel("Display size", { exact: true }).selectOption("1.25");
  await menu
    .getByRole("combobox", { name: "Colors", exact: true })
    .selectOption("muted");
  await menu
    .getByRole("combobox", { name: "Marker size", exact: true })
    .selectOption("small");
  await menu
    .getByRole("combobox", { name: "Marker style", exact: true })
    .selectOption("diamond");
  expect((await markerAppearance(marker)).fill).not.toBe(original.fill);
  await menu
    .getByRole("button", { name: "Reset appearance", exact: true })
    .click();
  await expect(menu.getByLabel("Display size", { exact: true })).toHaveValue(
    "1.25",
  );
  await expect(
    menu.getByRole("combobox", { name: "Colors", exact: true }),
  ).toHaveValue("color");
  await expect(
    menu.getByRole("combobox", { name: "Marker size", exact: true }),
  ).toHaveValue("medium");
  await expect(
    menu.getByRole("combobox", { name: "Marker style", exact: true }),
  ).toHaveValue("circle");
  expect(await markerAppearance(marker)).toEqual(original);
  await expect(menu).toHaveAttribute("open", "");
});

test("all display controls remain reachable on a small laptop at enlarged interface sizes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 980, height: 720 });
  await openData(page);
  const menu = await openDisplay(page);
  for (const scale of ["1", "1.5", "2"]) {
    await menu.getByLabel("Display size", { exact: true }).selectOption(scale);
    const popup = menu.locator(".fit-display-popover");
    await expect
      .poll(async () => {
        const box = (await popup.boundingBox())!;
        return Math.max(-box.x, box.x + box.width - 980);
      })
      .toBeLessThanOrEqual(1);
    for (const label of ["Colors", "Marker size", "Marker style"]) {
      const control = menu.getByRole("combobox", { name: label, exact: true });
      await control.scrollIntoViewIfNeeded();
      const bounds = (await control.boundingBox())!;
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(721);
    }
    await menu
      .getByRole("button", { name: "Reset appearance", exact: true })
      .click();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(980);
  }
});

for (const mode of ["collision", "multi-interval"]) {
  test(`the same appearance menu styles ${mode} graphs`, async ({ page }) => {
    await openData(page, "collision.csv");
    await page.getByLabel("Analysis", { exact: true }).selectOption(mode);
    const workspace = page.getByRole("region", {
      name:
        mode === "collision" ? "Collision analysis" : "Multi-interval analysis",
      exact: true,
    });
    const marker = workspace.locator("svg [data-marker-shape]").first();
    const original = await markerAppearance(marker);
    const menu = await openDisplay(page);
    await menu
      .getByRole("combobox", { name: "Marker style", exact: true })
      .selectOption("triangle");
    await menu
      .getByRole("combobox", { name: "Marker size", exact: true })
      .selectOption("large");
    await menu
      .getByRole("combobox", { name: "Colors", exact: true })
      .selectOption("mono");
    await menu.locator("summary").click();
    const changed = await markerAppearance(marker);
    expect(changed.shape).toBe("triangle");
    expect(changed.width).toBeGreaterThan(original.width);
    expect(changed.fill).not.toBe(original.fill);
    await expect(
      workspace.locator(
        'svg [data-marker-shape]:not([data-marker-shape="triangle"])',
      ),
    ).toHaveCount(0);
  });
}
