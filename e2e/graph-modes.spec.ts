import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
test("log modes preserve fits and session data, use original tick units, and print matching axes", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("input[type=file]").setInputFiles({
    name: "decades.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("X (s),Y (m)\n-1,-10\n0,0\n1,10\n10,100\n100,1000\n"),
  });
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await page.getByRole("button", { name: "Fit selected observations" }).click();
  await expect(page.getByRole("status")).toHaveText("Fit complete");
  const value = await page.getByLabel("m value", { exact: true }).inputValue();
  const plot = page.getByRole("img", {
    name: "Data and fitted curve",
    exact: true,
  });
  const residual = page.getByRole("img", {
    name: "Residual plot",
    exact: true,
  });
  for (const [mode, x, y, count] of [
    ["log-x", "log", "linear", 3],
    ["log-y", "linear", "log", 3],
    ["log-log", "log", "log", 3],
    ["linear", "linear", "linear", 5],
  ] as const) {
    await page.getByLabel("Graph mode").selectOption(mode);
    await expect(plot).toHaveAttribute("data-x-scale", x);
    await expect(plot).toHaveAttribute("data-y-scale", y);
    await expect(residual).toHaveAttribute("data-y-scale", "linear");
    await expect(plot.locator("circle")).toHaveCount(count);
    expect(await page.getByLabel("m value", { exact: true }).inputValue()).toBe(
      value,
    );
    await expect(page.getByRole("status")).toHaveText("Fit complete");
    expect(await plot.innerHTML()).not.toMatch(/NaN|Infinity/);
  }
  await page.getByLabel("Graph mode").selectOption("log-log");
  const positions = await plot
    .locator("circle")
    .evaluateAll((nodes) => nodes.map((n) => Number(n.getAttribute("cx"))));
  expect(positions[1] - positions[0]).toBeCloseTo(
    positions[2] - positions[1],
    5,
  );
  await expect(page.getByRole("note").first()).toContainText(
    "fit inclusion is unchanged",
  );
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save session", exact: true }).click();
  const saved = JSON.parse(
    readFileSync((await (await download).path())!, "utf8"),
  );
  expect(saved.version).toBe(1);
  expect(saved.request.dataset.rows.map((r: { y: number }) => r.y)).toEqual([
    -10, 0, 10, 100, 1000,
  ]);
  expect(saved.settings.excludedIds).toEqual([]);
  await page.getByRole("button", { name: "Print", exact: true }).click();
  await expect(
    page
      .getByRole("dialog", { name: "Print report" })
      .getByRole("img", { name: "Data and fitted curve", exact: true }),
  ).toHaveAttribute("data-y-scale", "log");
});

test("empty and entirely nonpositive data remain usable in logarithmic modes", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Graph mode").selectOption("log-log");
  const plot = page.getByRole("img", {
    name: "Data and fitted curve",
    exact: true,
  });
  expect(await plot.innerHTML()).not.toMatch(/NaN|Infinity/);
  await page.locator("input[type=file]").setInputFiles({
    name: "negative.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("X,Y\n-2,-3\n-1,0\n"),
  });
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await expect(plot.locator("circle")).toHaveCount(0);
  expect(await plot.innerHTML()).not.toMatch(/NaN|Infinity/);
  await page.getByLabel("Graph mode").selectOption("linear");
  await expect(plot.locator("circle")).toHaveCount(2);
});

test("logarithmic selection and intervals crossing zero use the displayed coordinates", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator("input[type=file]")
    .setInputFiles("examples/data/ball-toss.trksess");
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await page.getByLabel("Y uncertainty", { exact: true }).fill("5");
  await page.getByLabel("Y uncertainty", { exact: true }).press("Enter");
  await page.getByRole("button", { name: "Fit selected observations" }).click();
  await expect(page.getByRole("status")).toHaveText("Fit complete");
  await page.getByLabel("Graph mode").selectOption("log-log");
  const plot = page.getByRole("img", {
    name: "Data and fitted curve",
    exact: true,
  });
  await expect(page.getByRole("note").first()).toContainText(
    "clipped at the lower plot edge",
  );
  expect(await plot.innerHTML()).not.toMatch(/NaN|Infinity/);
  await expect(plot.locator(".fit-confidence-band")).toBeVisible();
  await page.screenshot({ path: "test-results/log-graph.png" });
  const circles = await plot
    .locator("circle")
    .evaluateAll((nodes) =>
      nodes.map((n) => ({
        x: Number(n.getAttribute("cx")),
        y: Number(n.getAttribute("cy")),
      })),
    );
  const xs = circles.map((p) => p.x).sort((a, b) => a - b);
  const left = xs[Math.floor(xs.length / 4)],
    right = xs[Math.floor((xs.length * 3) / 4)];
  const box = (await plot.boundingBox())!;
  const size = await plot.evaluate((el) => ({
    w: (el as SVGSVGElement).viewBox.baseVal.width,
    h: (el as SVGSVGElement).viewBox.baseVal.height,
  }));
  const expected = circles.filter((p) => p.x > left && p.x < right).length;
  await page.mouse.move(
    box.x + ((left + 0.01) / size.w) * box.width,
    box.y + (19 / size.h) * box.height,
  );
  await page.mouse.down();
  await page.mouse.move(
    box.x + ((right - 0.01) / size.w) * box.width,
    box.y + ((size.h - 53) / size.h) * box.height,
    { steps: 8 },
  );
  await page.mouse.up();
  await expect(plot.locator("circle:not(.excluded)")).toHaveCount(expected);
});
