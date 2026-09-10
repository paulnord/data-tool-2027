import { expect, it } from "vitest";
import reference from "./nonlinear-reference.json";
import { fit, modelGradient, predict } from "../../src/core/fit/solve";
import {
  initialSettings,
  sessionSchema,
  sessionV1Schema,
  sessionV2Schema,
  type FitRequest,
} from "../../src/core/fit/schema";
import {
  isNonlinearModel,
  nonlinearModelIds,
  nonlinearModels,
  suggestedParameters,
} from "../../src/core/fit/nonlinearModels";
import { meanConfidenceBand } from "../../src/core/fit/confidenceBand";
const requestFor = (
  fixture: (typeof reference.fixtures)[number],
): FitRequest => ({
  format: "tracker-fit-request",
  version: 1,
  requestId: "00000000-0000-4000-8000-000000000001",
  snapshotId: "00000000-0000-4000-8000-000000000002",
  source: {
    application: "Independent SciPy reference",
    version: reference.scipy,
    context: reference.generator,
  },
  dataset: {
    id: "test",
    label: fixture.model,
    xColumn: { id: "x", label: "x", unit: "s" },
    yColumn: { id: "y", label: "y", unit: "V" },
    assumptions: {
      exactX: "asserted",
      gaussianIndependent: "asserted",
      correctModel: "asserted",
    },
    rows: fixture.x.map((x, i) => ({
      id: `row-${i}`,
      x,
      y: fixture.y[i],
      included: true,
      missingReason: null,
    })),
  },
  uncertainty: {
    kind: "supplied-per-row",
    errorStructure: "uncorrelated",
    sigmaByRow: Object.fromEntries(
      fixture.sigma.map((s, i) => [`row-${i}`, s]),
    ),
    provenance: {
      kind: "user-asserted",
      description: "Known generating Gaussian deviations",
    },
  },
});
for (const fixture of reference.fixtures) {
  const model = fixture.model;
  if (!isNonlinearModel(model)) throw Error(model);
  it(`${model}: matches independent SciPy optima and SVD covariance, including fixed coefficients`, () => {
    const r = requestFor(fixture),
      before = JSON.stringify(r);
    for (const expected of fixture.cases) {
      const settings = initialSettings(model);
      settings.parameters = settings.parameters.map((_, j) => ({
        value: expected.fixed.includes(j)
          ? fixture.truth[j]
          : fixture.initial[j],
        fixed: expected.fixed.includes(j),
      }));
      const original = JSON.stringify(settings);
      const result = fit(r, settings);
      result.coefficients.forEach((v, j) =>
        expect(v).toBeCloseTo(expected.coefficients[j], 6),
      );
      expect(result.weightedObjective.value!).toBeCloseTo(
        expected.objective,
        7,
      );
      const free = settings.parameters.flatMap((p, j) => (p.fixed ? [] : [j]));
      free.forEach((j, a) =>
        free.forEach((k, b) =>
          expect(
            Math.abs(result.covariance![j][k] - expected.covariance[a][b]),
          ).toBeLessThan(1e-9 + Math.abs(expected.covariance[a][b]) * 2e-5),
        ),
      );
      expected.fixed.forEach((j) =>
        expect(result.standardErrors[j]).toEqual({
          value: null,
          reason: "fixed",
        }),
      );
      expect(result.rank).toBe(free.length);
      expect(result.df).toBe(fixture.x.length - free.length);
      const nonlinearFree = free.some(
        (j) => j >= nonlinearModels[model].linear,
      );
      if (nonlinearFree)
        expect(result.q.reason).toBe("nonlinear-reference-distribution");
      expect(JSON.stringify(settings)).toBe(original);
      const band = meanConfidenceBand([fixture.x[10]], r, settings, result);
      expect(band.reason).toBeNull();
      expect(band.points[0].standardError).toBeGreaterThan(0);
    }
    expect(JSON.stringify(r)).toBe(before);
  });
  it(`${model}: analytic derivatives, row permutation, exclusions, unknown scatter and all-fixed evaluation`, () => {
    const r = requestFor(fixture),
      settings = initialSettings(model);
    settings.parameters = settings.parameters.map((_, j) => ({
      value: fixture.initial[j],
      fixed: false,
    }));
    const x = fixture.x[17],
      gradient = modelGradient(x, settings, fixture.truth);
    gradient.forEach((v, j) => {
      const h = 1e-5 * Math.max(1, Math.abs(fixture.truth[j])),
        lo = fixture.truth.slice(),
        hi = fixture.truth.slice();
      lo[j] -= h;
      hi[j] += h;
      expect(v).toBeCloseTo(
        (predict(x, model, hi) - predict(x, model, lo)) / (2 * h),
        6,
      );
    });
    const original = fit(r, settings),
      permuted = fit(
        {
          ...r,
          dataset: { ...r.dataset, rows: r.dataset.rows.slice().reverse() },
        },
        settings,
      );
    original.coefficients.forEach((v, j) =>
      expect(permuted.coefficients[j]).toBeCloseTo(v, 7),
    );
    settings.excludedIds = ["row-0"];
    expect(fit(r, settings).n).toBe(r.dataset.rows.length - 1);
    settings.excludedIds = [];
    const unknown = fit(
      {
        ...r,
        uncertainty: { kind: "unknown-equal", errorStructure: "uncorrelated" },
      },
      settings,
    );
    expect(unknown.scatter.value).toBeGreaterThan(0);
    expect(unknown.covariance).not.toBeNull();
    const descriptive = fit(
      {
        ...r,
        dataset: {
          ...r.dataset,
          assumptions: {
            exactX: "unknown",
            gaussianIndependent: "unknown",
            correctModel: "unknown",
          },
        },
      },
      settings,
    );
    expect(descriptive.covariance).toBeNull();
    settings.parameters = settings.parameters.map((_, j) => ({
      value: fixture.truth[j],
      fixed: true,
    }));
    const fixed = fit(r, settings);
    expect(fixed.rank).toBe(0);
    expect(fixed.coefficients).toEqual(fixture.truth);
  });
  it(`${model}: data-based starts converge for the classroom fixture and sessions use v2`, () => {
    const r = requestFor(fixture),
      settings = initialSettings(model);
    settings.parameters = suggestedParameters(model, r, []).map((value) => ({
      value,
      fixed: false,
    }));
    const result = fit(r, settings);
    result.coefficients.forEach((v, j) =>
      expect(v).toBeCloseTo(fixture.cases[0].coefficients[j], 5),
    );
    const session = {
      format: "tracker-fit-session",
      version: 2,
      engine: "qr-lm-3",
      request: r,
      settings,
    };
    expect(
      sessionSchema.parse(JSON.parse(JSON.stringify(session))).version,
    ).toBe(2);
    expect(
      sessionV1Schema.safeParse({
        ...session,
        version: 1,
        engine: "qr-vp-sine-2",
      }).success,
    ).toBe(false);
    expect(
      sessionV2Schema.safeParse({
        ...session,
        settings: { ...settings, excludedIds: ["not-a-row"] },
      }).success,
    ).toBe(false);
  });
}
it("new model domains, positivity and rank loss fail explicitly", () => {
  for (const model of nonlinearModelIds) {
    const fixture = reference.fixtures.find((f) => f.model === model)!,
      r = requestFor(fixture),
      settings = initialSettings(model);
    for (const index of nonlinearModels[model].positive) {
      const invalid = structuredClone(settings);
      invalid.parameters[index].value = 0;
      expect(() => fit(r, invalid)).toThrow();
    }
    const flat = {
      ...r,
      dataset: {
        ...r.dataset,
        rows: r.dataset.rows.map((row) => ({ ...row, y: 0 })),
      },
    };
    settings.parameters = settings.parameters.map((_, j) => ({
      value: j < nonlinearModels[model].linear ? 0 : fixture.truth[j],
      fixed: false,
    }));
    expect(() => fit(flat, settings)).toThrow(/Rank deficient|converge/);
  }
  const f = reference.fixtures[1],
    r = requestFor(f);
  r.dataset.rows[0].x = 0;
  expect(() => fit(r, initialSettings("power-law-free"))).toThrow(/x > 0/);
});

it.each(reference.fixtures)(
  "$model: unit scaling transforms coefficients and full covariance",
  (fixture) => {
    const model = fixture.model;
    if (!isNonlinearModel(model)) throw Error(model);
    const r = requestFor(fixture),
      settings = initialSettings(model);
    settings.parameters = fixture.initial.map((value) => ({
      value,
      fixed: false,
    }));
    const original = fit(r, settings),
      factor = 1000;
    const scaled = structuredClone(r);
    scaled.dataset.rows.forEach((row) => (row.x! *= factor));
    scaled.dataset.xColumn.unit = "ms";
    const transform = (p: number[]) =>
      p.map((value, j) =>
        model === "power-law-free"
          ? j === 1
            ? value / factor ** p[2]
            : value
          : j >= nonlinearModels[model].linear
            ? value * factor
            : value,
      );
    const p0 = transform(fixture.initial);
    settings.parameters = p0.map((value) => ({ value, fixed: false }));
    const result = fit(scaled, settings),
      expected = transform(original.coefficients);
    expected.forEach((v, j) =>
      expect(Math.abs(result.coefficients[j] - v)).toBeLessThan(
        1e-7 + Math.abs(v) * 1e-6,
      ),
    );
    const jac = expected.map((_, j) =>
      expected.map((_, k) =>
        j === k
          ? model === "power-law-free"
            ? j === 1
              ? factor ** -original.coefficients[2]
              : 1
            : j >= nonlinearModels[model].linear
              ? factor
              : 1
          : 0,
      ),
    );
    if (model === "power-law-free") jac[1][2] = -expected[1] * Math.log(factor);
    for (let j = 0; j < expected.length; j++)
      for (let k = 0; k < expected.length; k++) {
        let cov = 0;
        for (let a = 0; a < expected.length; a++)
          for (let b = 0; b < expected.length; b++)
            cov += jac[j][a] * original.covariance![a][b] * jac[k][b];
        expect(Math.abs(result.covariance![j][k] - cov)).toBeLessThan(
          1e-9 + Math.abs(cov) * 2e-5,
        );
      }
  },
);
