import { test, expect, type Page } from "@playwright/test";
async function open(page: Page, file = "oil-drop-intervals.csv") {
  await page.goto("/");
  await page.locator("input[type=file]").setInputFiles(`examples/data/${file}`);
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await page
    .getByLabel("Analysis tools", { exact: true })
    .selectOption("multi-interval");
  return page.getByRole("region", {
    name: "Multi-interval analysis",
    exact: true,
  });
}
async function range(page: Page, lo: string, hi: string) {
  await page.getByLabel("Interval from", { exact: true }).fill(lo);
  await page.getByLabel("Interval to", { exact: true }).fill(hi);
}
test("student chooses three ranges, fits one at a time and preserves the other results", async ({
  page,
}) => {
  const workspace = await open(page);
  await expect(
    workspace
      .getByLabel("Interval uncertainty model", { exact: true })
      .locator('option[value="estimate"]'),
  ).toHaveText("Unknown · estimate equal scatter");
  const fit = workspace.getByRole("button", {
    name: "Fit Interval 1",
    exact: true,
  });
  await expect(fit).toHaveClass(/\bfit-primary\b/);
  await expect(fit).toBeDisabled();
  await page.getByLabel("Number of intervals").selectOption("3");
  await range(page, "0.2", "2.8");
  await page
    .getByRole("checkbox", {
      name: "Accept uncertainty assumptions",
      exact: true,
    })
    .check();
  await page
    .getByRole("button", { name: "Fit Interval 1", exact: true })
    .click();
  await expect(workspace.getByRole("status")).toHaveText(
    "Interval 1: fit complete",
  );
  await page.getByRole("button", { name: "Interval 2", exact: true }).click();
  await range(page, "3.2", "5.8");
  await page
    .getByRole("button", { name: "Fit Interval 2", exact: true })
    .click();
  await expect(workspace.getByRole("status")).toHaveText(
    "Interval 2: fit complete",
  );
  await page.getByRole("button", { name: "Interval 3", exact: true }).click();
  await range(page, "6.2", "8.8");
  await page
    .getByRole("button", { name: "Fit Interval 3", exact: true })
    .click();
  await expect(workspace.getByRole("status")).toHaveText(
    "Interval 3: fit complete",
  );
  await expect(
    workspace.getByRole("table", { name: /parameters$/ }),
  ).toHaveCount(3);
  await page.screenshot({
    path: "test-results/multi-interval-workflow.png",
    fullPage: true,
  });
  const slider = workspace.getByRole("slider", {
    name: "Drop position: Interval 3 from",
    exact: true,
  });
  await slider.focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    workspace.getByRole("table", { name: /parameters$/ }),
  ).toHaveCount(2);
  await page
    .getByRole("button", { name: "Fit Interval 3", exact: true })
    .click();
  await expect(workspace.getByRole("status")).toHaveText(
    "Interval 3: fit complete",
  );
  await page
    .getByLabel("Analysis tools", { exact: true })
    .selectOption("single-fit");
  await page
    .getByLabel("Analysis tools", { exact: true })
    .selectOption("multi-interval");
  await expect(
    workspace.getByRole("table", { name: /parameters$/ }),
  ).toHaveCount(3);
  await page.emulateMedia({ media: "print" });
  const pdf = await page.pdf({
    path: "test-results/multi-interval-report.pdf",
    format: "Letter",
    printBackground: true,
  });
  expect(pdf.toString("latin1").match(/\/Type\s*\/Page\b/g)).toHaveLength(1);
  await page.emulateMedia({ media: "screen" });
  await page
    .getByLabel("Include residuals and diagnostics when printing", {
      exact: true,
    })
    .check();
  await page.emulateMedia({ media: "print" });
  await expect(
    workspace.locator(".interval-result-diagnostics").first(),
  ).toBeVisible();
  const detailed = await page.pdf({
    path: "test-results/multi-interval-details.pdf",
    format: "Letter",
    printBackground: true,
  });
  expect(detailed.toString("latin1").match(/\/Type\s*\/Page\b/g)).toHaveLength(
    4,
  );
  await page.emulateMedia({ media: "screen" });
  await expect(
    page.getByRole("button", { name: "Save session", exact: true }),
  ).toBeEnabled();
});
test("draw a range, select sine for contact, and use custom equations with case-sensitive units", async ({
  page,
}) => {
  const workspace = await open(page, "bounce-intervals.csv");
  const plot = workspace.getByRole("img", {
    name: "Position interval plot",
    exact: true,
  });
  const box = (await plot.boundingBox())!;
  // Drag from x=0.026 to x=0.044 in the graph's 600-wide viewBox.
  const xmin = Number(await plot.getAttribute("data-x-min"));
  const xmax = Number(await plot.getAttribute("data-x-max"));
  const px = (t: number) =>
    box.x + (box.width * (72 + ((t - xmin) / (xmax - xmin)) * 512)) / 600;
  await page.mouse.move(px(0.026), box.y + box.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(px(0.044), box.y + box.height * 0.4, { steps: 12 });
  await page.mouse.up();
  await expect(
    page.getByLabel("Interval from", { exact: true }),
  ).not.toHaveValue("");
  await page
    .getByLabel("Interval equation", { exact: true })
    .selectOption("sine-free-period");
  await page.getByLabel("T interval value", { exact: true }).fill("0.04");
  await page.getByLabel("Fix interval T", { exact: true }).check();
  await page
    .getByRole("button", { name: "Fit Interval 1", exact: true })
    .click();
  await expect(workspace.getByRole("status")).toHaveText(
    "Interval 1: fit complete",
  );
  await page.getByRole("button", { name: "Interval 2", exact: true }).click();
  await range(page, "0.05", "0.075");
  await page
    .getByLabel("Interval equation", { exact: true })
    .selectOption("custom");
  await page.getByLabel("Custom equation", { exact: true }).fill("y0 + v*t");
  await page.getByLabel("Equation variable", { exact: true }).fill("t");
  await page
    .getByRole("button", { name: "Apply equation", exact: true })
    .click();
  await page.getByLabel("v interval unit", { exact: true }).fill("mH");
  await expect(
    page.getByLabel("v interval unit", { exact: true }),
  ).toHaveAttribute("autocapitalize", "none");
  await page
    .getByRole("button", { name: "Fit Interval 2", exact: true })
    .click();
  await expect(workspace.getByRole("status")).toHaveText(
    "Interval 2: fit complete",
  );
  await expect(
    workspace.getByRole("table", { name: /Interval 1.*parameters/ }),
  ).toBeVisible();
  await range(page, "0.03", "0.06");
  await expect(
    page.getByRole("button", { name: "Fit Interval 2", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Fit Interval 2", exact: true })
    .click();
  await expect(workspace.getByRole("status")).toHaveText(
    "Interval 2: fit complete",
  );
});
test("multi-interval fits one selected Y series with one common uncertainty", async ({
  page,
}) => {
  const workspace = await open(page, "collision.csv");
  await expect(
    page.getByLabel("Number of data series", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByLabel("Interval Y column", { exact: true }),
  ).toHaveValue("1");
  await page.getByLabel("Interval Y column", { exact: true }).selectOption("3");
  await range(page, "0", "1.6");
  await page
    .getByRole("button", { name: "Fit Interval 1", exact: true })
    .click();
  await expect(workspace.getByRole("status")).toHaveText(
    "Interval 1: fit complete",
  );
  await page.getByLabel("Interval uncertainty model").selectOption("supplied");
  await expect(
    page.getByRole("button", { name: "Fit Interval 1", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Interval common sigma", { exact: true }).fill(".003");
  await page
    .getByRole("button", { name: "Fit Interval 1", exact: true })
    .click();
  await expect(workspace.getByRole("status")).toHaveText(
    "Interval 1: fit complete",
  );
  await expect(
    workspace.getByRole("table", { name: /parameters$/ }),
  ).toHaveCount(1);
});

test("five Millikan intervals retain separate results with Fit beside interval selection", async ({
  page,
}) => {
  const workspace = await open(page, "MillikanData.csv");
  await page.getByLabel("Number of intervals").selectOption("5");
  for (let i = 1; i <= 5; i++) {
    await page
      .getByRole("button", { name: `Interval ${i}`, exact: true })
      .click();
    const fit = page.getByRole("button", {
      name: `Fit Interval ${i}`,
      exact: true,
    });
    await fit.scrollIntoViewIfNeeded();
    const tabs = await page.locator(".interval-tabs").boundingBox();
    const button = await fit.boundingBox();
    expect(button!.y - (tabs!.y + tabs!.height)).toBeGreaterThanOrEqual(0);
    expect(button!.y - (tabs!.y + tabs!.height)).toBeLessThan(20);
    await range(page, String((i - 1) * 20), String((i - 1) * 20 + 15));
    await fit.click();
    await expect(workspace.getByRole("status")).toHaveText(
      `Interval ${i}: fit complete`,
    );
  }
  await expect(
    workspace.getByRole("table", { name: /parameters$/ }),
  ).toHaveCount(5);
  await expect(
    workspace.getByRole("table", { name: /Interval 5.*parameters/ }),
  ).toContainText("mm");
  await expect(workspace.locator('path[stroke="#187a68"]')).not.toHaveCount(0);
  await expect(workspace.locator('path[stroke="#a03856"]')).not.toHaveCount(0);
  await page.getByRole("button", { name: "Interval 1 ✓", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Fit Interval 1", exact: true }),
  ).toBeEnabled();
  await expect(
    workspace.getByRole("table", { name: /parameters$/ }),
  ).toHaveCount(5);
});
