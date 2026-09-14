import { expect, test, type Page } from "@playwright/test";

async function openDraft(page: Page, mode = "multi-interval") {
  await page.goto("/");
  await page
    .locator("input[type=file]")
    .setInputFiles(
      mode === "collision"
        ? "examples/data/collision.csv"
        : "examples/data/oil-drop-intervals.csv",
    );
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await page.getByLabel("Analysis", { exact: true }).selectOption(mode);
}

async function range(page: Page, from: string, to: string) {
  await page.getByLabel("Interval from", { exact: true }).fill(from);
  await page.getByLabel("Interval to", { exact: true }).fill(to);
}

test("reducing the interval count hides and restores exact settings and fitted results", async ({
  page,
}) => {
  await openDraft(page);
  await page.getByLabel("Number of intervals").selectOption("3");
  await page.getByRole("button", { name: "Interval 3", exact: true }).click();
  await range(page, "6.2", "8.8");
  await page.getByLabel("Interval name", { exact: true }).fill("Departure");
  await page
    .getByRole("button", { name: "Fit Departure", exact: true })
    .click();
  const table = page.getByRole("table", { name: /Departure.*parameters/ });
  await expect(table).toBeVisible();
  const values = await table.innerText();
  await page.getByLabel("Number of intervals").selectOption("2");
  await expect(table).toHaveCount(0);
  await page.getByLabel("Number of intervals").selectOption("3");
  await page.getByRole("button", { name: "Departure ✓", exact: true }).click();
  await expect(page.getByLabel("Interval from", { exact: true })).toHaveValue(
    "6.2",
  );
  await expect(page.getByLabel("Interval to", { exact: true })).toHaveValue(
    "8.8",
  );
  expect(await table.innerText()).toBe(values);
});

test("custom equation drafts survive interval switches and temporary hiding", async ({
  page,
}) => {
  await openDraft(page);
  await range(page, "0.2", "2.8");
  await page
    .getByLabel("Interval equation", { exact: true })
    .selectOption("custom");
  await page
    .getByLabel("Custom equation", { exact: true })
    .fill("a + b*x + c*x^2");
  await page.getByRole("button", { name: "Interval 2", exact: true }).click();
  await page
    .getByLabel("Interval equation", { exact: true })
    .selectOption("custom");
  await page
    .getByLabel("Custom equation", { exact: true })
    .fill("offset + speed*t");
  await page.getByLabel("Equation variable", { exact: true }).fill("t");
  await page.getByLabel("Number of intervals").selectOption("1");
  await expect(page.getByLabel("Custom equation", { exact: true })).toHaveValue(
    "a + b*x + c*x^2",
  );
  await expect(
    page.getByRole("button", { name: "Fit Interval 1", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Apply equation", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Fit Interval 1", exact: true }),
  ).toBeEnabled();
  await page.getByLabel("Number of intervals").selectOption("2");
  await page.getByRole("button", { name: "Interval 2", exact: true }).click();
  await expect(page.getByLabel("Custom equation", { exact: true })).toHaveValue(
    "offset + speed*t",
  );
  await expect(
    page.getByLabel("Equation variable", { exact: true }),
  ).toHaveValue("t");
});

test("interval numeric controls preserve negative and scientific notation while blocking incomplete drafts", async ({
  page,
}) => {
  await openDraft(page);
  await range(page, "0.2", "2.8");
  await page.locator(".interval-parameters > summary").click();
  const input = page.getByLabel("b interval value", { exact: true });
  const fit = page.getByRole("button", { name: "Fit Interval 1", exact: true });
  await input.fill("");
  await expect(input).toHaveValue("");
  await expect(fit).toBeDisabled();
  await input.pressSequentially("-");
  await expect(input).toHaveValue("-");
  await input.pressSequentially("2e-");
  await expect(input).toHaveValue("-2e-");
  await expect(fit).toBeDisabled();
  await input.pressSequentially("3");
  await expect(input).toHaveValue("-2e-3");
  await expect(fit).toBeEnabled();
  await input.press("Tab");
  await expect(input).toHaveValue("-0.002");
  await page.getByLabel("Fix interval b", { exact: true }).check();
  await fit.click();
  await expect(
    page.getByRole("table", { name: /Interval 1.*parameters/ }),
  ).toContainText("-0.002");
});

test("a valid interval fits independently of another interval's unfinished range", async ({
  page,
}) => {
  await openDraft(page);
  await range(page, "0.2", "2.8");
  await page.getByRole("button", { name: "Interval 2", exact: true }).click();
  await range(page, "6", "3");
  await expect(
    page.getByRole("button", { name: "Fit Interval 2", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Interval 1", exact: true }).click();
  await page
    .getByRole("button", { name: "Fit Interval 1", exact: true })
    .click();
  await expect(
    page
      .getByRole("region", { name: "Multi-interval analysis", exact: true })
      .getByRole("status"),
  ).toHaveText("Interval 1: 1 of 1 data series fitted");
});

test("applying table edits requires a choice before discarding interval work", async ({
  page,
}) => {
  await openDraft(page);
  await range(page, "0.2", "2.8");
  await page
    .getByRole("button", { name: "Fit Interval 1", exact: true })
    .click();
  const parameters = page.getByRole("table", {
    name: /Interval 1.*parameters/,
  });
  await expect(parameters).toBeVisible();
  const fittedValues = await parameters.innerText();
  const panel = page.getByRole("dialog", { name: "Data", exact: true });
  const cell = panel.getByLabel("Row 7 column 2", { exact: true });
  await page.getByRole("button", { name: "Data…", exact: true }).click();
  const originalValue = await cell.inputValue();
  await cell.fill("0.5");
  await panel
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await expect(page.getByRole("alertdialog")).toContainText(
    "Apply these data and discard the unsaved interval analyses?",
  );
  await page.getByRole("button", { name: "Keep working", exact: true }).click();
  expect(await parameters.innerText()).toBe(fittedValues);
  await expect(page.getByLabel("Interval from", { exact: true })).toHaveValue(
    "0.2",
  );
  await page.getByRole("button", { name: "Data…", exact: true }).click();
  await expect(cell).toHaveValue(originalValue);
  await cell.fill("0.5");
  await panel
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await page.getByRole("button", { name: "Apply data", exact: true }).click();
  await expect(parameters).toHaveCount(0);
  await expect(page.getByLabel("Interval from", { exact: true })).toHaveValue(
    "",
  );
  await page.getByRole("button", { name: "Data…", exact: true }).click();
  await expect(cell).toHaveValue("0.5");
  await panel.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByLabel("Analysis", { exact: true }).selectOption("line");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save session", exact: true }).click();
  await downloaded;
  expect(
    await page.evaluate(() => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    }),
  ).toBe(false);
});

for (const mode of ["multi-interval", "collision"]) {
  test(`${mode} unsaved work stays protected after saving its source in a single fit`, async ({
    page,
  }) => {
    await openDraft(page, mode);
    const protectedFromClose = () =>
      page.evaluate(() => {
        const event = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(event);
        return event.defaultPrevented;
      });
    expect(await protectedFromClose()).toBe(false);
    if (mode === "multi-interval") {
      await range(page, "0.2", "2.8");
      await page
        .getByRole("button", { name: "Fit Interval 1", exact: true })
        .click();
    } else {
      await page
        .getByRole("button", { name: "Fit before and after", exact: true })
        .click();
    }
    expect(await protectedFromClose()).toBe(true);
    await page.getByLabel("Analysis", { exact: true }).selectOption("line");
    const downloaded = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Save session", exact: true })
      .click();
    await downloaded;
    expect(await protectedFromClose()).toBe(true);
    await page.getByLabel("Analysis", { exact: true }).selectOption(mode);
    expect(await protectedFromClose()).toBe(true);
  });

  test(`${mode} remains readable on a small laptop at 200% interface size`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 900, height: 700 });
    await openDraft(page, mode);
    await page.locator(".fit-display-menu > summary").click();
    await page.getByLabel("Display size").selectOption("2");
    await page.keyboard.press("Escape");
    const controls = page.locator(
      mode === "collision" ? ".collision-setup" : ".interval-controls",
    );
    await expect(controls).toHaveCSS("position", "static");
    const graph = page
      .locator(
        mode === "collision" ? ".collision-charts svg" : ".interval-graphs svg",
      )
      .first();
    const box = (await graph.boundingBox())!;
    expect(box.width).toBeGreaterThan(700);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(901);
  });
}

test("collision raw graphs survive invalid ranges and supplied sigma guidance matches validation", async ({
  page,
}) => {
  await openDraft(page, "collision");
  const graphs = page.locator(".collision-charts svg");
  await page.getByLabel("After from", { exact: true }).fill("1");
  await expect(graphs).toHaveCount(4);
  await expect(
    page.getByRole("button", { name: "Fit before and after", exact: true }),
  ).toBeDisabled();
  await expect(
    page.locator(".collision-charts .collision-boundary"),
  ).toHaveCount(0);
  await page.getByLabel("After from", { exact: true }).fill("");
  await expect(graphs).toHaveCount(4);
  await page.getByLabel("After from", { exact: true }).fill("2.4");
  await expect(
    page.locator(".collision-charts .collision-boundary"),
  ).toHaveCount(16);
  await page
    .getByLabel("Position uncertainties", { exact: true })
    .selectOption("supplied");
  await expect(page.getByRole("alert")).toContainText(
    "all four position columns",
  );
  for (const slot of [
    "Object 1 · x",
    "Object 1 · y",
    "Object 2 · x",
    "Object 2 · y",
  ]) {
    await expect(
      page.getByLabel(`${slot} uncertainty`, { exact: true }),
    ).toHaveAttribute("placeholder", "Required");
    await page.getByLabel(`${slot} uncertainty`, { exact: true }).fill(".003");
  }
  await page
    .getByRole("button", { name: "Fit before and after", exact: true })
    .click();
  await expect(
    page
      .getByRole("region", { name: "Collision analysis", exact: true })
      .getByRole("status"),
  ).toHaveText("8 of 8 fits complete");
});
