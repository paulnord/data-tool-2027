import { expect, it } from "vitest";
import { initialSettings } from "../../src/core/fit/schema";
import { fit, predict } from "../../src/core/fit/solve";
import { sampleFittedCurve, sampleModelCurve } from "../../src/fit/fitCurve";
import { plotPath } from "../../src/fit/plotScale";
import { syntheticRequest } from "../support/synthetic";

it("keeps log-axis extensions positive and proportional to the displayed span", () => {
  const request = syntheticRequest();
  request.dataset.rows = [1, 2, 5, 10, 100].map((x, i) => ({
    id: String(i),
    x,
    y: 3 + 2 * x,
    included: true,
    missingReason: null,
  }));
  const settings = initialSettings("line");
  const result = fit(request, settings);
  const original = JSON.stringify({ request, settings, result });
  const curve = sampleFittedCurve(settings, result, [0.1, 1000], true);
  expect(curve.support).toEqual([1, 100]);
  expect(curve.before[0].x).toBeCloseTo(10 ** -0.2, 12);
  expect(curve.after.at(-1)!.x).toBeCloseTo(10 ** 2.2, 10);
  for (const point of [...curve.before, ...curve.fitted, ...curve.after]) {
    expect(point.x).toBeGreaterThan(0);
    expect(point.y).toBeCloseTo(3 + 2 * point.x, 10);
  }
  expect(curve.baseline).toBeNull();
  expect(JSON.stringify({ request, settings, result })).toBe(original);
});

it("leaves an invalid model domain blank when an extension crosses it", () => {
  const request = syntheticRequest();
  request.dataset.rows = [0.01, 0.1, 0.2, 0.5, 1].map((x, i) => ({
    id: String(i),
    x,
    y: 2 + 3 * Math.log(x),
    included: true,
    missingReason: null,
  }));
  const settings = initialSettings("logarithmic");
  const result = fit(request, settings);
  const curve = sampleFittedCurve(settings, result, [-1, 2]);
  expect(
    curve.before.some((point) => point.x < 0 && !Number.isFinite(point.y)),
  ).toBe(true);
  const path = plotPath(
    curve.before,
    (x) => x,
    (y) => y,
  ).trim();
  expect(path).toMatch(/^M/);
  expect(path).not.toMatch(/NaN|Infinity/);
  expect(Number(path.match(/^M([^,]+)/)![1])).toBeGreaterThan(0);
});

it("does not call interpolation extrapolation when log axes hide fitted observations", () => {
  const request = syntheticRequest();
  request.dataset.rows = [-1, 0, 1, 2].map((x, i) => ({
    id: String(i),
    x,
    y: 3 + 2 * x,
    included: true,
    missingReason: null,
  }));
  const settings = initialSettings("line");
  const result = fit(request, settings);
  const curve = sampleFittedCurve(settings, result, [0.1, 10], true);
  expect(curve.support).toEqual([-1, 2]);
  expect(curve.fitted[0].x).toBeCloseTo(0.1, 12);
  expect(curve.fitted.at(-1)!.x).toBeCloseTo(2, 12);
  expect(curve.before).toEqual([]);
  expect(curve.after[0].x).toBeCloseTo(2, 12);
  expect(curve.after.at(-1)!.x).toBeCloseTo(2.3, 12);
});

it("marks the damped model offset even when the observed sample average differs", () => {
  const settings = initialSettings("damped-sine");
  settings.parameters = [4, 2, 1, 6, 20].map((value) => ({
    value,
    fixed: true,
  }));
  const request = syntheticRequest();
  request.dataset.rows = [0, 0.2, 0.4, 0.6, 0.8].map((x, i) => ({
    id: String(i),
    x,
    y: predict(
      x,
      settings.model,
      settings.parameters.map((p) => p.value),
    ),
    included: true,
    missingReason: null,
  }));
  const result = fit(request, settings);
  const curve = sampleFittedCurve(settings, result, [-0.2, 1]);
  expect(curve.baseline).toBe(4);
  expect(
    request.dataset.rows.reduce((sum, row) => sum + row.y!, 0) /
      request.dataset.rows.length,
  ).toBeGreaterThan(5);
  const distant = sampleFittedCurve(settings, result, [5, 10]);
  expect([distant.before, distant.fitted, distant.after]).toEqual([[], [], []]);
});

it("resolves oscillator cycles at the high end of a broad logarithmic view", () => {
  const settings = initialSettings("damped-sine");
  const coefficients = [4, 2, 1, 2, 400];
  settings.parameters = coefficients.map((value) => ({ value, fixed: true }));
  const request = syntheticRequest();
  request.dataset.rows = [1e-9, 1, 10, 100, 1000].map((x, i) => ({
    id: String(i),
    x,
    y: predict(x, settings.model, coefficients),
    included: true,
    missingReason: null,
  }));
  const result = fit(request, settings);
  const curve = sampleFittedCurve(settings, result, [1e-9, 1000], true);
  const gaps = curve.fitted
    .slice(1)
    .map((point, i) => point.x - curve.fitted[i].x);
  expect(Math.max(...gaps)).toBeLessThanOrEqual(2 / 40 + 1e-10);
  expect(curve.samplingUnavailable).toBe(false);
  expect(
    sampleFittedCurve(settings, result, [1e-9, 10000]).samplingUnavailable,
  ).toBe(false);
});

it("samples comparison curves across the complete requested domain", () => {
  const settings = initialSettings("line");
  const request = syntheticRequest();
  request.dataset.rows = [2, 3, 4].map((x, i) => ({
    id: String(i),
    x,
    y: 1 + 2 * x,
    included: true,
    missingReason: null,
  }));
  const result = fit(request, settings);
  const curve = sampleModelCurve(settings, result, [0, 10]);
  expect(curve.points[0].x).toBe(0);
  expect(curve.points.at(-1)!.x).toBe(10);
  expect(curve.points).toHaveLength(160);
  expect(curve.samplingUnavailable).toBe(false);
});

it("adapts full-domain Fourier sampling and refuses impractical density", () => {
  const settings = initialSettings("fourier");
  settings.fourier = { harmonics: 3, period: 2, origin: 0 };
  const result = {
    coefficients: [0, 1, 0, 0, 0, 0, 0],
    residuals: [],
  } as unknown as ReturnType<typeof fit>;
  const curve = sampleModelCurve(settings, result, [0, 10]);
  expect(curve.points).toHaveLength(601);
  expect(curve.points[0].x).toBe(0);
  expect(curve.points.at(-1)!.x).toBe(10);
  expect(curve.samplingUnavailable).toBe(false);
  expect(sampleModelCurve(settings, result, [0, 1000])).toEqual({
    points: [],
    samplingUnavailable: true,
  });
});
