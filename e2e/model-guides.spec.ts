import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { strFromU8, unzipSync } from "fflate";
import { syntheticRequest } from "../tests/support/synthetic";
import {
  initialSettings,
  parameterNames,
  sessionEngine,
} from "../src/core/fit/schema";
import { predict } from "../src/core/fit/solve";

for (const model of [
  "gaussian",
  "lorentzian",
  "sigmoid",
  "sine",
  "sine-free-period",
] as const) {
  test(`${model} guides follow fitted models through single, interval and comparison outputs`, async ({
    page,
  }, testInfo) => {
    const settings = initialSettings(model),
      request = syntheticRequest();
    const sine = model.startsWith("sine");
    const p = sine
      ? model === "sine"
        ? [1, 2, 0.3]
        : [1, 2, 0.3, 2.3]
      : [1, 2, 0.7, 1.2];
    settings.parameters = p.map((value) => ({ value, fixed: false }));
    if (model === "sine") settings.sinePeriod = 2.3;
    if (model === "sine-free-period") {
      settings.periodMin = 1.8;
      settings.periodMax = 2.8;
    }
    request.dataset.rows = Array.from({ length: 81 }, (_, i) => {
      const x = -3 + i / 8;
      return {
        id: String(i),
        x,
        y:
          predict(x, model, p, settings.sinePeriod) + 0.003 * Math.sin(i * 1.7),
        included: true,
        missingReason: null,
      };
    });
    await page.goto("/");
    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles({
        name: "guides.trksess",
        mimeType: "application/json",
        buffer: Buffer.from(
          JSON.stringify({
            workspace: { kind: "single-fit" },
            view: {
              showResiduals: true,
              showGuides: false,
              showErrorBars: true,
            },
            format: "tracker-fit-session",
            version: 7,
            engine: sessionEngine(settings),
            request,
            settings,
          }),
        ),
      });
    await page
      .getByRole("button", { name: "Use these data", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Fit selected observations", exact: true })
      .click();
    await expect(page.getByRole("status")).toHaveText("Fit complete");
    const plot = page.locator(
      '.fit-chart svg[aria-label="Data and fitted curve"]',
    );
    await expect(plot.locator(".model-guide")).toHaveCount(0);
    const valuesBefore = await page
      .locator('.fit-parameter input[id^="parameter-"]')
      .evaluateAll((inputs) =>
        inputs.map((input) => (input as HTMLInputElement).value),
      );
    await page.locator(".fit-settings-menu summary").click();
    await page
      .getByRole("checkbox", {
        name: "Show fit guides when available",
        exact: true,
      })
      .check();
    await page.keyboard.press("Escape");
    const count = model === "sigmoid" ? 3 : 1;
    await expect(plot.locator(".model-guide")).toHaveCount(count);
    await expect(plot.locator('[data-guide-axis="x"]')).toHaveCount(
      sine ? 0 : 1,
    );
    if (!sine) {
      const center = Number(
        await plot
          .locator('[data-guide-axis="x"]')
          .getAttribute("data-guide-value"),
      );
      const parameter = Number(
        await page
          .getByLabel(`${model === "sigmoid" ? "x0" : "mu"} value`, {
            exact: true,
          })
          .inputValue(),
      );
      expect(center).toBeCloseTo(parameter, 6);
      const geometry = await plot
        .locator('[data-guide-axis="x"]')
        .evaluate((node) => {
          const line = node as SVGLineElement;
          const frame =
            line.ownerSVGElement!.querySelector<SVGRectElement>(
              ".fit-plot-frame",
            )!;
          return {
            from: line.y1.baseVal.value,
            to: line.y2.baseVal.value,
            top: frame.y.baseVal.value,
            bottom: frame.y.baseVal.value + frame.height.baseVal.value,
          };
        });
      expect(geometry.from).toBeCloseTo(geometry.top, 3);
      expect(geometry.to).toBeCloseTo(geometry.bottom, 3);
    }
    for (const label of await plot.locator("[data-guide-label]").all()) {
      const box = await label.boundingBox(),
        frame = await plot.locator(".fit-plot-frame").boundingBox();
      expect(box!.y + box!.height).toBeLessThan(frame!.y);
    }
    expect(
      await page
        .locator('.fit-parameter input[id^="parameter-"]')
        .evaluateAll((inputs) =>
          inputs.map((input) => (input as HTMLInputElement).value),
        ),
    ).toEqual(valuesBefore);
    await plot.screenshot({ path: testInfo.outputPath(`${model}-guides.png`) });
    await page.getByRole("button", { name: "Print", exact: true }).click();
    const print = page.getByRole("dialog", {
      name: "Print report",
      exact: true,
    });
    await expect(print.locator(".model-guide")).toHaveCount(count);
    await page.keyboard.press("Escape");
    await page.locator(".fit-export-menu summary").click();
    const pending = page.waitForEvent("download");
    await page
      .getByRole("menuitem", { name: "SVG vector graphic", exact: true })
      .click();
    expect(await readFile((await (await pending).path())!, "utf8")).toContain(
      "Fit guide labels",
    );

    if (model === "gaussian") {
      await page.getByLabel("Data X axis", { exact: true }).click();
      await page.getByLabel("Data X minimum", { exact: true }).fill("3");
      await page.getByLabel("Data X maximum", { exact: true }).fill("7");
      await page
        .getByRole("button", { name: "Apply range", exact: true })
        .click();
      await page.getByLabel("Data X axis", { exact: true }).click();
      await expect(plot.locator('[data-guide-axis="x"]')).toHaveCount(0);
      expect(
        await page
          .locator('.fit-parameter input[id^="parameter-"]')
          .evaluateAll((inputs) =>
            inputs.map((input) => (input as HTMLInputElement).value),
          ),
      ).toEqual(valuesBefore);
    }
    await page
      .getByLabel("Analysis tools", { exact: true })
      .selectOption("multi-interval");
    await page
      .getByLabel("Number of intervals", { exact: true })
      .selectOption("1");
    await page.getByLabel("Interval from", { exact: true }).fill("-3");
    await page.getByLabel("Interval to", { exact: true }).fill("7");
    await page
      .getByLabel("Interval equation", { exact: true })
      .selectOption(model === "sine" ? "sine-free-period" : model);
    if (model === "sine") {
      await page.getByLabel("T interval value", { exact: true }).fill("2.3");
      await page.getByLabel("Fix interval T", { exact: true }).check();
    }
    if (model === "sine-free-period") {
      await page
        .getByLabel("Interval minimum period", { exact: true })
        .fill("1.8");
      await page
        .getByLabel("Interval maximum period", { exact: true })
        .fill("2.8");
    }
    for (const [i, name] of parameterNames(model).entries())
      await page
        .getByLabel(`${name} interval value`, { exact: true })
        .fill(String(p[i]));
    await page
      .getByRole("button", { name: "Fit Interval 1", exact: true })
      .click();
    await expect(
      page
        .getByRole("region", { name: "Multi-interval analysis", exact: true })
        .getByRole("status"),
    ).toContainText("1 of 1 data series fitted");
    const interval = page
      .locator(".interval-overview .interval-graphs svg")
      .first();
    await expect(interval.locator(".model-guide")).toHaveCount(count);
    await expect(interval.locator('[data-guide-axis="x"]')).toHaveCount(
      sine ? 0 : 1,
    );
    await page
      .getByLabel("Analysis tools", { exact: true })
      .selectOption("model-comparison");
    const workspace = page.locator(".model-comparison");
    const comparedPlot = workspace.getByRole("img", {
      name: "Compared fitted curves",
      exact: true,
    });
    await expect(comparedPlot.locator(".model-guide")).toHaveCount(0);
    if (model === "gaussian") {
      await workspace
        .getByRole("tab", { name: "Candidate 2", exact: true })
        .click();
      await workspace
        .getByLabel("Candidate 2 model", { exact: true })
        .selectOption("lorentzian");
    }
    await workspace
      .getByRole("button", { name: "Refit and compare", exact: true })
      .click();
    await expect(workspace.getByRole("status")).toHaveText(
      "Comparison complete",
    );
    const comparisonCount = count + (model === "gaussian" ? 1 : 0);
    await expect(comparedPlot.locator(".model-guide")).toHaveCount(
      comparisonCount,
    );
    for (const marker of await comparedPlot
      .locator('[data-guide-axis="x"]')
      .all()) {
      const index = Number(await marker.getAttribute("data-candidate-index"));
      const fittedCenter = Number(
        await workspace
          .getByLabel(
            `Candidate ${index + 1} ${model === "sigmoid" ? "x0" : "mu"} value`,
            { exact: true },
          )
          .inputValue(),
      );
      expect(Number(await marker.getAttribute("data-guide-value"))).toBeCloseTo(
        fittedCenter,
        6,
      );
    }
    for (const label of await comparedPlot
      .locator("[data-guide-label]")
      .all()) {
      const box = await label.boundingBox(),
        frame = await comparedPlot.locator(".fit-plot-frame").boundingBox();
      expect(box!.y + box!.height).toBeLessThan(frame!.y);
    }
    await comparedPlot.screenshot({
      path: testInfo.outputPath(`${model}-comparison-guides.png`),
    });
    const comparisonStats = workspace.getByRole("table", {
      name: "Model comparison statistics",
      exact: true,
    });
    const statisticsBefore = await comparisonStats.innerText();
    await page.getByRole("button", { name: "Print", exact: true }).click();
    const comparisonPrint = page.getByRole("dialog", {
      name: "Print model comparison",
      exact: true,
    });
    await expect(comparisonPrint.locator(".model-guide")).toHaveCount(
      comparisonCount,
    );
    await page.keyboard.press("Escape");
    await page.locator(".fit-export-menu summary").click();
    await page
      .getByRole("menuitem", { name: "Figure size…", exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "Figure size", exact: true })
      .getByRole("button", { name: "Apply", exact: true })
      .click();
    await page.locator(".fit-export-menu summary").click();
    const comparisonDownload = page.waitForEvent("download");
    await page
      .getByRole("menuitem", { name: "SVG vector graphic", exact: true })
      .click();
    const comparisonSvg = await readFile(
      (await (await comparisonDownload).path())!,
      "utf8",
    );
    const exportedGuideCount = await page.evaluate((source) => {
      const document = new DOMParser().parseFromString(source, "image/svg+xml");
      return document.querySelectorAll(
        "line[data-candidate-index], path[data-candidate-index]",
      ).length;
    }, comparisonSvg);
    expect(exportedGuideCount).toBe(comparisonCount);
    expect(comparisonSvg).toContain("Fit guide labels");
    if (model === "gaussian") {
      for (const target of ["scipy", "root"] as const) {
        await page.locator(".fit-export-menu summary").click();
        const zipDownload = page.waitForEvent("download");
        await page
          .getByRole("menuitem", {
            name:
              target === "scipy"
                ? "Python / SciPy analysis bundle (.zip)"
                : "C++ / ROOT analysis bundle (.zip)",
            exact: true,
          })
          .click();
        const zip = unzipSync(
          new Uint8Array(await readFile((await (await zipDownload).path())!)),
        );
        for (const candidate of [1, 2]) {
          const metadata = JSON.parse(
            strFromU8(
              zip[
                `model-comparison-${target}/candidate-${candidate}/analysis.json`
              ],
            ),
          );
          expect(metadata.view.showGuides).toBe(true);
        }
      }
    }
    await page.locator(".fit-settings-menu summary").click();
    await page
      .getByRole("checkbox", {
        name: "Show fit guides when available",
        exact: true,
      })
      .uncheck();
    await page.keyboard.press("Escape");
    await expect(
      interval.locator(".model-guide,[data-guide-label]"),
    ).toHaveCount(0);
    await expect(
      comparedPlot.locator(".model-guide,[data-guide-label]"),
    ).toHaveCount(0);
    expect(await comparisonStats.innerText()).toBe(statisticsBefore);
  });
}
