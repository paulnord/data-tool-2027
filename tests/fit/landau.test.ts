import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import reference from "./landau-reference.json";
import {
  landauValueDerivative,
  landauValueGradient,
  LANDAU_BOOST_MODE,
  LANDAU_SCALE,
} from "../../src/core/fit/landau";
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
    JSON.parse(readFileSync("examples/data/landau.trksess", "utf8")),
  );

it("matches independent stable-distribution quadrature and has unit area and mode zero", () => {
  for (const { z, value } of reference.pdf)
    expect(Math.abs(landauValueDerivative(z).value / value - 1)).toBeLessThan(
      2e-9,
    );
  expect(Math.abs(landauValueDerivative(0).derivative)).toBeLessThan(1e-15);
  expect(landauValueDerivative(0).value).toBeGreaterThan(
    landauValueDerivative(0.01).value,
  );
  expect(landauValueDerivative(0).value).toBeGreaterThan(
    landauValueDerivative(-0.01).value,
  );
  // Simpson integration after z=tan(pi*(t-1/2)) covers both infinite tails.
  const n = 10000;
  let sum = Math.PI; // Right endpoint limit; the left endpoint tends to zero.
  for (let i = 1; i < n; i++) {
    const angle = Math.PI * (i / n - 0.5),
      z = Math.tan(angle);
    sum +=
      ((i % 2 ? 4 : 2) * landauValueDerivative(z).value * Math.PI) /
      Math.cos(angle) ** 2;
  }
  expect(sum / (3 * n)).toBeCloseTo(1, 7);
});

it("keeps values and derivatives continuous across approximation regions and handles extreme tails", () => {
  for (const u of [
    -4,
    -2,
    -1,
    0,
    1,
    2,
    4,
    8,
    16,
    32,
    64,
    256,
    65536,
    2 ** 32,
    2 ** 64,
  ]) {
    const z = (u - LANDAU_BOOST_MODE) / LANDAU_SCALE;
    const h = 1e-7 * Math.max(1, Math.abs(z));
    const center = landauValueDerivative(z),
      lo = landauValueDerivative(z - h),
      hi = landauValueDerivative(z + h);
    expect(
      Math.abs((hi.value - lo.value) / (2 * h) - center.derivative),
    ).toBeLessThan(
      1e-8 * Math.max(center.value, Math.abs(center.derivative), 1e-100),
    );
    expect(Math.abs(hi.derivative - lo.derivative)).toBeLessThan(
      1e-3 * Math.max(Math.abs(center.derivative), center.value, 1e-100),
    );
  }
  for (const z of [-Infinity, -1e300, 1e300, Infinity]) {
    expect(landauValueDerivative(z).value).toBe(0);
    expect(Math.abs(landauValueDerivative(z).derivative)).toBe(0);
  }
  expect(Number.isNaN(landauValueDerivative(NaN).value)).toBe(true);
  expect(landauValueDerivative(1e100).value * 1e100 * 1e100).toBeCloseTo(1, 12);
});

it("has accurate physical derivatives over widths, including narrow peaks", () => {
  for (const w of [1e-5, 0.2, 5, 1000]) {
    const p = [0.1, 3 * w, 0, w];
    for (const z of [-2, 0, 1, 10]) {
      const x = z * w,
        point = landauValueGradient(x, p);
      for (let j = 0; j < 4; j++) {
        const h = 1e-5 * (j < 2 ? Math.max(Math.abs(p[j]), 0.01) : w);
        const low = p.slice(),
          high = p.slice();
        low[j] -= h;
        high[j] += h;
        const numeric =
          (landauValueGradient(x, high).value -
            landauValueGradient(x, low).value) /
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
    settings = initialSettings("landau");
  expect(settings.parameters[0]).toEqual({ value: 0, fixed: true });
  const starts = suggestedParameters("landau", request, []);
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
      predict(x, "landau", p),
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

it("exports matching Landau conventions in built-in and custom Python/ROOT programs", () => {
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
    expect(generatePythonCode(description)).toContain(
      "from scipy.stats import landau as _scipy_landau",
    );
    expect(generateRootCode(description)).toContain(
      "TMath::Landau(z + (-0.222782981256408",
    );
    expect(
      generateCodeExportBundle(description).files["requirements.txt"],
    ).toContain("scipy>=1.15");
  }
});
