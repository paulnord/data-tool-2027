import { expect, it } from "vitest";
import { oscillationDerivedQuantities } from "../../src/core/fit/derivedParameters";
import { modelGuideValues } from "../../src/core/fit/modelGuides";
import { initialSettings } from "../../src/core/fit/schema";
import { fit, predict, type FitResult } from "../../src/core/fit/solve";
import { syntheticRequest } from "../support/synthetic";

function result(coefficients: number[], covariance: number[][]): FitResult {
  return {
    engine: "qr-lm-3",
    coefficients,
    covariance,
    standardErrors: coefficients.map((_, i) => ({
      value: Math.sqrt(covariance[i][i]),
      reason: null,
    })),
    intervals: coefficients.map(() => null),
    residuals: [],
    n: 20,
    rank: coefficients.length,
    df: 20 - coefficients.length,
    sse: 1,
    rms: 1 / Math.sqrt(20),
    scatter: { value: 1, reason: null },
    weightedObjective: { value: 1, reason: null },
    reducedObjective: { value: 1 / 15, reason: null },
    q: { value: null, reason: "nonlinear-reference-distribution" },
    rSquared: { value: 0.9, reason: null },
    inference: "supported",
    warnings: [],
    rankTolerance: 1e-12,
    diagonalRatio: 2,
  };
}

it("evaluates damped-oscillation baseline and symmetric amplitude envelopes", () => {
  const settings = initialSettings("damped-sine");
  const guides = modelGuideValues(2, settings, [3, 4, -3, 2, 5]);
  const radius = 5 * Math.exp(-2 / 5);
  expect(guides.map((guide) => guide.id)).toEqual([
    "baseline",
    "upper-envelope",
    "lower-envelope",
  ]);
  expect(guides[0].value).toBe(3);
  expect(guides[1].value).toBeCloseTo(3 + radius, 14);
  expect(guides[2].value).toBeCloseTo(3 - radius, 14);
  expect(modelGuideValues(2, initialSettings("line"), [3, 4])).toEqual([]);
});

it("propagates the full covariance into amplitude, phase, and frequency", () => {
  const request = syntheticRequest();
  const settings = initialSettings("damped-sine");
  const covariance = Array.from({ length: 5 }, () => Array(5).fill(0));
  covariance[1][1] = 0.09;
  covariance[2][2] = 0.16;
  covariance[1][2] = covariance[2][1] = 0.03;
  covariance[3][3] = 0.04;
  const derived = oscillationDerivedQuantities(
    request,
    settings,
    result([1, 3, 4, 2, 8], covariance),
  );
  expect(derived.map((quantity) => quantity.id)).toEqual([
    "amplitude",
    "phase",
    "frequency",
  ]);
  expect(derived[0].value).toBe(5);
  expect(derived[0].standardError.value).toBeCloseTo(
    Math.sqrt((9 * 0.09 + 16 * 0.16 + 24 * 0.03) / 25),
    14,
  );
  expect(derived[1].value).toBeCloseTo(Math.atan2(4, 3), 14);
  expect(derived[1].standardError.value).toBeCloseTo(
    Math.sqrt((16 * 0.09 + 9 * 0.16 - 24 * 0.03) / 625),
    14,
  );
  expect(derived[2].value).toBe(0.5);
  expect(derived[2].standardError.value).toBeCloseTo(0.05, 14);
  expect(derived[0].unit).toBe("m");
  expect(derived[2].unit).toBe("1/s");
});

it("marks phase as undefined at zero amplitude and supplied frequency as fixed", () => {
  const request = syntheticRequest();
  const damped = initialSettings("damped-sine");
  const zero = result(
    [1, 0, 0, 2, 8],
    Array.from({ length: 5 }, () => Array(5).fill(0)),
  );
  const quantities = oscillationDerivedQuantities(request, damped, zero);
  expect(quantities[1]).toMatchObject({
    value: null,
    standardError: { value: null, reason: "zero-amplitude" },
  });

  const sine = initialSettings("sine");
  sine.sinePeriod = 4;
  const supplied = oscillationDerivedQuantities(
    request,
    sine,
    result(
      [1, 2, 1],
      [
        [0.1, 0, 0],
        [0, 0.1, 0],
        [0, 0, 0.1],
      ],
    ),
  );
  expect(supplied[2]).toMatchObject({
    value: 0.25,
    standardError: { value: null, reason: "fixed" },
  });
});

it("keeps fitted phase and propagated uncertainty invariant when Y units change", () => {
  const inUnits = (scale: number, unit: string) => {
    const request = syntheticRequest();
    request.dataset.yColumn.unit = unit;
    request.uncertainty = {
      ...request.uncertainty,
      sigmaY: 1e-16 * scale,
    } as typeof request.uncertainty;
    request.dataset.rows = Array.from({ length: 20 }, (_, i) => {
      const x = i / 10;
      return {
        id: `row-${i}`,
        x,
        y:
          (2e-15 +
            3e-15 * Math.sin(2 * Math.PI * x) +
            4e-15 * Math.cos(2 * Math.PI * x) +
            1e-16 * Math.sin(17 * i)) *
          scale,
        included: true,
        missingReason: null,
      };
    });
    const settings = initialSettings("sine");
    settings.sinePeriod = 1;
    return oscillationDerivedQuantities(
      request,
      settings,
      fit(request, settings),
    );
  };
  const meters = inUnits(1, "m");
  const nanometers = inUnits(1e9, "nm");
  expect(meters[0].value).toBeGreaterThan(0);
  expect(meters[0].value).toBeLessThan(1e-14);
  expect(meters[0].standardError.reason).toBeNull();
  expect(meters[0].standardError.value! * 1e9).toBeCloseTo(
    nanometers[0].standardError.value!,
    20,
  );
  expect(meters[1].value).toBeCloseTo(0.926494728299927, 13);
  expect(meters[1].value).toBeCloseTo(nanometers[1].value!, 14);
  expect(meters[1].standardError.value).toBeCloseTo(0.006327585482687, 14);
  expect(meters[1].standardError.value).toBeCloseTo(
    nanometers[1].standardError.value!,
    14,
  );
});

it("returns unavailable derived values for nonfinite inputs without calling them fixed", () => {
  const covariance = Array.from({ length: 5 }, () => Array(5).fill(0));
  const quantities = oscillationDerivedQuantities(
    syntheticRequest(),
    initialSettings("damped-sine"),
    result([1, NaN, 0, Number.MIN_VALUE, 8], covariance),
  );
  for (const quantity of quantities) {
    expect(quantity.value).toBeNull();
    expect(quantity.standardError).toEqual({
      value: null,
      reason: "nonfinite-derived-quantity",
    });
  }
});

it("peak center guides follow the symmetric fitted extremum for positive and negative peaks", () => {
  for (const model of ["gaussian", "lorentzian"] as const) {
    for (const A of [4, -4]) {
      const p = [1, A, -2, 0.7];
      const before = [...p];
      const center = modelGuideValues(13, initialSettings(model), p)[0];
      expect(center.axis).toBe("x");
      expect(predict(center.value, model, p)).toBe(1 + A);
      expect(predict(center.value - 0.5, model, p)).toBeCloseTo(
        predict(center.value + 0.5, model, p),
        14,
      );
      expect(p).toEqual(before);
    }
  }
});
it("sine mean guides bisect opposite phases for both period parameterizations", () => {
  for (const model of ["sine", "sine-free-period"] as const) {
    const settings = initialSettings(model),
      p = model === "sine" ? [3, 4, -2] : [3, 4, -2, 2.3];
    settings.sinePeriod = 2.3;
    const mean = modelGuideValues(0.12, settings, p)[0];
    expect(mean.axis).not.toBe("x");
    expect(
      (predict(0.12, model, p, 2.3) + predict(0.12 + 2.3 / 2, model, p, 2.3)) /
        2,
    ).toBeCloseTo(mean.value, 14);
  }
});
it("sigmoid center is halfway between its asymptotes for rising and falling curves", () => {
  for (const A of [4, -4]) {
    const p = [5, A, 2, 0.5];
    const guides = modelGuideValues(0, initialSettings("sigmoid"), p);
    const center = guides.find((g) => g.axis === "x")!;
    const levels = guides.filter((g) => !g.axis).map((g) => g.value);
    expect(predict(center.value, "sigmoid", p)).toBe(
      (levels[0] + levels[1]) / 2,
    );
    expect(predict(center.value - 100, "sigmoid", p)).toBe(levels[0]);
    expect(predict(center.value + 100, "sigmoid", p)).toBe(levels[1]);
  }
});
