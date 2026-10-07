import { fitReportTable } from "../../src/core/fit/report";
import { fitDerivedQuantities } from "../../src/core/fit/derivedParameters";
import {
  MOYAL_FWHM,
  MOYAL_HALF_MAX_LEFT,
  MOYAL_HALF_MAX_RIGHT,
} from "../../src/core/fit/moyal";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import reference from "./moyal-reference.json";
import {
  moyalValueDerivative,
  moyalValueGradient,
} from "../../src/core/fit/moyal";
import {
  initialSettings,
  sessionSchema,
  sessionEngine,
} from "../../src/core/fit/schema";
import { fit, modelGradient, predict } from "../../src/core/fit/solve";
import { suggestedParameters } from "../../src/core/fit/nonlinearModels";
import { customFromModel } from "../../src/core/fit/customFromModel";
import { customValueGradient } from "../../src/core/fit/customEquation";
import { modelParameterUnit } from "../../src/core/fit/modelNotation";
import { modelGuideValues } from "../../src/core/fit/modelGuides";
import {
  buildCodeExportDescription,
  generateCodeExportBundle,
  generatePythonCode,
  generateRootCode,
} from "../../src/core/fit/codeExport";

const example = () =>
  sessionSchema.parse(
    JSON.parse(readFileSync("examples/data/moyal.trksess", "utf8")),
  );

it("matches SciPy density references and has unit area and mode zero", () => {
  for (const { z, value } of reference.pdf)
    expect(Math.abs(moyalValueDerivative(z).value / value - 1)).toBeLessThan(
      2e-13,
    );
  expect(Math.abs(moyalValueDerivative(0).derivative)).toBeLessThan(1e-15);
  expect(moyalValueDerivative(0).value).toBeGreaterThan(
    moyalValueDerivative(0.01).value,
  );
  expect(moyalValueDerivative(0).value).toBeGreaterThan(
    moyalValueDerivative(-0.01).value,
  );
  // Simpson integration after z=tan(pi*(t-1/2)) covers both infinite tails.
  const n = 10000;
  let sum = 0; // Both transformed endpoint limits are zero.
  for (let i = 1; i < n; i++) {
    const angle = Math.PI * (i / n - 0.5),
      z = Math.tan(angle);
    sum +=
      ((i % 2 ? 4 : 2) * moyalValueDerivative(z).value * Math.PI) /
      Math.cos(angle) ** 2;
  }
  expect(sum / (3 * n)).toBeCloseTo(1, 7);
});

it("has accurate density derivatives and handles extreme tails", () => {
  for (const z of [-7, -3, -1, -1e-8, 0, 1e-8, 1, 10, 100, 1000]) {
    const h = 1e-6;
    const center = moyalValueDerivative(z);
    const numeric =
      (moyalValueDerivative(z + h).value - moyalValueDerivative(z - h).value) /
      (2 * h);
    expect(Math.abs(numeric - center.derivative)).toBeLessThan(
      1e-6 * Math.max(center.value, Math.abs(center.derivative), 1e-300),
    );
  }
  for (const z of [-Infinity, -1e300, 1e300, Infinity]) {
    expect(moyalValueDerivative(z).value).toBe(0);
    expect(Math.abs(moyalValueDerivative(z).derivative)).toBe(0);
  }
  expect(Number.isNaN(moyalValueDerivative(NaN).value)).toBe(true);
});

it("has accurate physical derivatives over widths, including narrow peaks", () => {
  for (const w of [1e-5, 0.2, 5, 1000]) {
    const p = [0.1, 3 * w, 0, w];
    for (const z of [-2, 0, 1, 10]) {
      const x = z * w,
        point = moyalValueGradient(x, p);
      for (let j = 0; j < 4; j++) {
        const h = 1e-5 * (j < 2 ? Math.max(Math.abs(p[j]), 0.01) : w);
        const low = p.slice(),
          high = p.slice();
        low[j] -= h;
        high[j] += h;
        const numeric =
          (moyalValueGradient(x, high).value -
            moyalValueGradient(x, low).value) /
          (2 * h);
        expect(Math.abs(point.gradient[j] - numeric)).toBeLessThan(
          1e-6 * Math.max(1, Math.abs(point.gradient[j])),
        );
      }
    }
  }
});

for (const expected of reference.cases)
  it(`matches SciPy fit and covariance with fixed indices ${expected.fixed}`, () => {
    const { request, settings } = example();
    settings.parameters = reference.initial.map((value, j) => ({
      value: expected.fixed.includes(j) ? reference.truth[j] : value,
      fixed: expected.fixed.includes(j),
    }));
    const result = fit(request, settings);
    result.coefficients.forEach((v, j) =>
      expect(v).toBeCloseTo(expected.coefficients[j], 5),
    );
    expect(result.weightedObjective.value!).toBeCloseTo(expected.objective, 7);
    const free = settings.parameters.flatMap((p, j) => (p.fixed ? [] : [j]));
    free.forEach((j, a) =>
      free.forEach((k, b) =>
        expect(
          Math.abs(result.covariance![j][k] - expected.covariance[a][b]),
        ).toBeLessThan(2e-6 * Math.abs(expected.covariance[a][b]) + 1e-9),
      ),
    );
    const reversed = fit(
      {
        ...request,
        dataset: {
          ...request.dataset,
          rows: request.dataset.rows.slice().reverse(),
        },
      },
      settings,
    );
    result.coefficients.forEach((v, j) =>
      expect(reversed.coefficients[j]).toBeCloseTo(v, 7),
    );
  });

it("fits from suggested starts, preserves fixed background, and rejects nonpositive widths", () => {
  const { request } = example(),
    settings = initialSettings("moyal");
  expect(settings.parameters[0]).toEqual({ value: 0, fixed: true });
  const starts = suggestedParameters("moyal", request, []);
  settings.parameters = settings.parameters.map((p, j) => ({
    ...p,
    value: starts[j],
  }));
  expect(fit(request, settings).coefficients[2]).toBeCloseTo(
    reference.cases[1].coefficients[2],
    5,
  );
  for (const w of [0, -1]) {
    settings.parameters[3].value = w;
    expect(() => fit(request, settings)).toThrow(/positive/);
  }
});

it("preserves values and gradients in custom equations and specifies units and peak guides", () => {
  const { request, settings } = example(),
    custom = customFromModel(settings, request);
  const p = settings.parameters.map((p) => p.value),
    cp = custom.parameters.map((p) => p.value);
  for (const x of [30, 50, 100]) {
    expect(customValueGradient(x, custom.custom!, cp).value).toBeCloseTo(
      predict(x, "moyal", p),
      12,
    );
    const gradient = customValueGradient(x, custom.custom!, cp).gradient;
    const original = modelGradient(x, settings, p);
    const names = ["b", "A", "mpv", "w"];
    custom.custom!.names.forEach((name, j) =>
      expect(gradient[j]).toBeCloseTo(original[names.indexOf(name)], 11),
    );
  }
  expect(modelParameterUnit(settings, 1, "keV", "V")).toBe("(V)·(keV)");
  expect(modelGuideValues(50, settings, p)[0].value).toBe(p[2]);
  expect(
    sessionSchema.parse({
      ...example(),
      settings: custom,
      engine: sessionEngine(custom),
    }).settings.model,
  ).toBe("custom");
});

it("exports matching Moyal conventions in built-in and custom Python/ROOT programs", () => {
  const { request, settings } = example();
  for (const s of [settings, customFromModel(settings, request)]) {
    const description = buildCodeExportDescription(
      request,
      s,
      fit(request, s),
      {
        mode: "linear",
        xRange: [25, 160],
        yRange: null,
        showResiduals: true,
        showGuides: true,
        showErrorBars: true,
      },
    );
    expect(generatePythonCode(description)).toContain("def moyal_pdf(z):");
    expect(generateRootCode(description)).toContain(
      "double moyal_pdf(double z)",
    );
    expect(
      generateCodeExportBundle(description).files["requirements.txt"],
    ).toContain("scipy");
  }
});

it("reports FWHM with width uncertainty, units, fixed and unavailable states", () => {
  const { request, settings } = example();
  const result = fit(request, settings);
  const quantity = fitDerivedQuantities(request, settings, result)[0];
  expect(quantity.id).toBe("fwhm");
  expect(quantity.unit).toBe("channel");
  expect(fitReportTable(request, settings, result)).toContainEqual([
    quantity.label,
    quantity.value,
    "channel",
    quantity.standardError.value,
  ]);
  expect(quantity.value).toBeCloseTo(MOYAL_FWHM * result.coefficients[3], 12);
  expect(quantity.standardError.value).toBeCloseTo(
    MOYAL_FWHM * result.standardErrors[3].value!,
    12,
  );
  settings.parameters[3].fixed = true;
  expect(
    fitDerivedQuantities(request, settings, fit(request, settings))[0]
      .standardError.reason,
  ).toBe("fixed");
  settings.parameters[3].fixed = false;
  expect(
    fitDerivedQuantities(request, settings, { ...result, covariance: null })[0]
      .standardError.value,
  ).toBeNull();
  expect(
    fitDerivedQuantities(request, settings, {
      ...result,
      coefficients: [1, 0, 50, 5],
    })[0],
  ).toMatchObject({
    value: null,
    standardError: { reason: "zero-peak-amplitude" },
  });
});

it("places asymmetric FWHM boundaries at half height above any background, including dips", () => {
  const settings = initialSettings("moyal");
  for (const z of [MOYAL_HALF_MAX_LEFT, MOYAL_HALF_MAX_RIGHT])
    expect(z + Math.exp(-z)).toBeCloseTo(1 + 2 * Math.log(2), 14);
  for (const b of [0, 20])
    for (const A of [-150, 150]) {
      const p = [b, A, 50, 5];
      const guides = modelGuideValues(0, settings, p);
      const left = guides.find((g) => g.id === "half-max-left")!.value;
      const right = guides.find((g) => g.id === "half-max-right")!.value;
      const half = guides.find((g) => g.id === "half-height")!.value;
      expect(left).toBeLessThan(p[2]);
      expect(right).toBeGreaterThan(p[2]);
      expect(right - left).toBeCloseTo(MOYAL_FWHM * p[3], 12);
      for (const x of [left, right])
        expect(predict(x, "moyal", p)).toBeCloseTo(half, 12);
      expect(half - b).toBeCloseTo((predict(p[2], "moyal", p) - b) / 2, 12);
    }
  expect(modelGuideValues(0, settings, [0, 0, 50, 5]).map((g) => g.id)).toEqual(
    ["center"],
  );
});

it("uses integer channel counts and Poisson error estimates, with a stated empty-channel convention", () => {
  const { request, settings } = example();
  expect(request.uncertainty.kind).toBe("supplied-per-row");
  if (request.uncertainty.kind !== "supplied-per-row") return;
  expect(request.dataset.rows.some((row) => row.y === 0)).toBe(true);
  for (const row of request.dataset.rows) {
    expect(Number.isInteger(row.x)).toBe(true);
    expect(Number.isInteger(row.y)).toBe(true);
    expect(row.y).toBeGreaterThanOrEqual(0);
    expect(request.uncertainty.sigmaByRow[row.id]).toBe(
      Math.sqrt(Math.max(row.y!, 1)),
    );
  }
  expect(fit(request, settings).inference).toBe("conditional");
});
