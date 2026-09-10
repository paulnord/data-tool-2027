import { expect, it } from "vitest";
import {
  customIsLinear,
  customValueGradient,
  inspectEquation,
} from "../../src/core/fit/customEquation";
import {
  initialSettings,
  sessionSchema,
  sessionVersion,
  sessionEngine,
  type FitSettings,
} from "../../src/core/fit/schema";
import { fit } from "../../src/core/fit/solve";
import { syntheticRequest } from "../support/synthetic";
import { meanConfidenceBand } from "../../src/core/fit/confidenceBand";
import { fitReportTsv } from "../../src/core/fit/report";
import reference from "./nonlinear-reference.json";
function settings(
  expression: string,
  values: number[],
  variable = "x",
): FitSettings {
  const names = inspectEquation(expression, variable).names;
  return {
    ...initialSettings("custom"),
    custom: { expression, variable, names, units: names.map(() => "mH") },
    parameters: values.map((value) => ({ value, fixed: false })),
  };
}
it("parses powers, signs, constants and case-sensitive names without executing code", () => {
  const s = settings("-x^2 + a*2^-2 + A + sin(pi/2) + ln(e)", [4, 3]);
  expect(customValueGradient(2, s.custom!, [4, 3])).toEqual({
    value: 2,
    gradient: [0.25, 1],
  });
  expect(
    customValueGradient(0, settings("a*2^3^2", [1]).custom!, [1]).value,
  ).toBe(512);
  for (const text of [
    "a+globalThis.x",
    "a+random()",
    "a;alert(1)",
    "a+constructor(x)",
    "a+2x",
    "a+sin",
    "a + (x",
    "a+1e999",
    "a + x = 2",
    "a+sqrt(x,x)",
  ])
    expect(() => inspectEquation(text, "x")).toThrow();
  expect(() =>
    inspectEquation("(".repeat(60) + "a" + ")".repeat(60), "x"),
  ).toThrow();
});
it("uses QR for affine free parameters and preserves weighted covariance and bands", () => {
  const r = syntheticRequest(),
    old = JSON.stringify(r);
  const s = settings("y0 + v0*t + 0.5*a*t^2", [10, -2, 5], "t");
  const baseline = { ...initialSettings(), physicalTimeConfirmed: true };
  const result = fit(r, s),
    expected = fit(r, baseline);
  result.coefficients.forEach((v, i) =>
    expect(v).toBeCloseTo(expected.coefficients[i], 11),
  );
  result.covariance!.forEach((row, i) =>
    row.forEach((v, j) =>
      expect(v).toBeCloseTo(expected.covariance![i][j], 12),
    ),
  );
  expect(result.q).toEqual(expected.q);
  expect(meanConfidenceBand([0.5, 1], r, s, result).points).toEqual(
    meanConfidenceBand([0.5, 1], r, baseline, expected).points,
  );
  expect(JSON.stringify(r)).toBe(old);
  expect(fitReportTsv(r, s, result)).toContain("y = y0 + v0*t + 0.5*a*t^2");
  expect(fitReportTsv(r, s, result)).toContain("v0: mH");
});
it("handles offsets, fixed parameters and rank deficiency", () => {
  const r = syntheticRequest();
  const s = settings("b + m*x + 3", [1, 2]);
  s.parameters[0].fixed = true;
  const result = fit(r, s);
  expect(result.coefficients[0]).toBe(1);
  expect(result.standardErrors[0].reason).toBe("fixed");
  expect(result.df).toBe(result.n - 1);
  expect(() => fit(r, settings("a*x+b*x", [1, 1]))).toThrow(/Rank deficient/);
  expect(() => fit(r, settings("a*ln(x)", [1]))).toThrow(/undefined.*x = 0/);
  const decay = settings("b+A*exp(-x/tau)", [0, 1, 2]);
  expect(customIsLinear(decay.custom!, [0, 1])).toBe(true);
  expect(customIsLinear(decay.custom!, [0, 1, 2])).toBe(false);
});
it("matches independently calculated SciPy nonlinear optimum and covariance", () => {
  const fixture = reference.fixtures.find(
    (f) => f.model === "exponential-decay",
  )!;
  const r = syntheticRequest();
  r.dataset.rows = fixture.x.map((x, i) => ({
    id: `row-${i}`,
    x,
    y: fixture.y[i],
    included: true,
    missingReason: null,
  }));
  r.uncertainty = {
    kind: "supplied-per-row",
    errorStructure: "uncorrelated",
    provenance: { kind: "user-asserted", description: "Independent fixture" },
    sigmaByRow: Object.fromEntries(
      fixture.sigma.map((v, i) => [`row-${i}`, v]),
    ),
  };
  const builtin = initialSettings("exponential-decay");
  const s = settings(
    "b + A*exp(-x/tau)",
    builtin.parameters.map((p) => p.value),
  );
  const actual = fit(r, s),
    expected = fixture.cases[0];
  actual.coefficients.forEach((v, i) =>
    expect(v).toBeCloseTo(expected.coefficients[i], 7),
  );
  actual.covariance!.forEach((row, i) =>
    row.forEach((v, j) => expect(v).toBeCloseTo(expected.covariance![i][j], 8)),
  );
  expect(actual.q.reason).toBe("nonlinear-reference-distribution");
  expect(actual.warnings.join(" ")).toContain("local optimizer");
  r.dataset.assumptions.exactX = "known-false";
  s.conditionalInference = true;
  expect(fit(r, s).covariance).toBeNull();
});
it("round trips v3 strictly and rejects reinterpretation by v1/v2", () => {
  const s = settings("b+m*x", [1, 2]);
  const session = {
    format: "tracker-fit-session",
    version: sessionVersion(s),
    engine: sessionEngine(s),
    settings: s,
    request: syntheticRequest(),
  };
  expect(sessionSchema.parse(JSON.parse(JSON.stringify(session)))).toEqual(
    session,
  );
  for (const version of [1, 2, 4])
    expect(sessionSchema.safeParse({ ...session, version }).success).toBe(
      false,
    );
  expect(
    sessionSchema.safeParse({
      ...session,
      settings: { ...s, custom: { ...s.custom, names: ["m", "b"] } },
    }).success,
  ).toBe(false);
  expect(
    sessionSchema.safeParse({
      ...session,
      settings: { ...s, custom: { ...s.custom, expression: "a+window.x" } },
    }).success,
  ).toBe(false);
});

it("converts every built-in equation without changing its curve or fixed values", async () => {
  const { customFromModel } =
    await import("../../src/core/fit/customFromModel");
  const { settingsV2Schema } = await import("../../src/core/fit/schema");
  const { predict } = await import("../../src/core/fit/solve");
  for (const model of settingsV2Schema.shape.model.options) {
    const original = initialSettings(model);
    if (
      !model.includes("free") &&
      original.parameters.every((p) => p.value === 0)
    )
      original.parameters.forEach((p, i) => (p.value = i + 1));
    const converted = customFromModel(original, syntheticRequest());
    for (const x of [0.5, 1, 2])
      expect(
        customValueGradient(
          x,
          converted.custom!,
          converted.parameters.map((p) => p.value),
        ).value,
      ).toBeCloseTo(
        predict(
          x,
          model,
          original.parameters.map((p) => p.value),
          original.sinePeriod,
          original.shape,
        ),
        10,
      );
  }
});
