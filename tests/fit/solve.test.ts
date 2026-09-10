import { describe, it, expect } from "vitest";
import { fit } from "../../src/core/fit/solve";
import { initialSettings, type FitRequest } from "../../src/core/fit/schema";
import { syntheticRequest } from "../support/synthetic";
import { gammaQ, studentCritical95 } from "../../src/core/fit/probability";
function line(): FitRequest {
  const r = syntheticRequest();
  r.dataset.rows = [0, 1, 2, 3, 4].map((x, i) => ({
    id: String(i),
    x,
    y: [1.1, 2.8, 5.2, 6.9, 9.1][i],
    included: true,
    missingReason: null,
  }));
  r.uncertainty = {
    ...r.uncertainty,
    kind: "supplied-common",
    sigmaY: 0.1,
    provenance: { kind: "user-asserted", description: "test" },
  };
  return r;
}
describe("linear least squares scientific contract", () => {
  it("matches an independent closed-form line solution and known covariance", () => {
    const r = fit(line(), initialSettings("line"));
    expect(r.coefficients[0]).toBeCloseTo(1, 12);
    expect(r.coefficients[1]).toBeCloseTo(2.01, 12);
    expect(r.covariance![0][0]).toBeCloseTo(0.006, 14);
    expect(r.covariance![0][1]).toBeCloseTo(-0.002, 14);
    expect(r.covariance![1][1]).toBeCloseTo(0.001, 14);
    expect(r.df).toBe(3);
  });
  it("recovers quadratic motion with irregular observations and all fixed/free combinations", () => {
    for (let mask = 0; mask < 8; mask++) {
      const r = syntheticRequest();
      r.dataset.rows = r.dataset.rows.map((row, i) => {
        const x = 2 * (i / 60) ** 1.3;
        return { ...row, x, y: 2 + 10 * x - 4.905 * x * x };
      });
      const s = {
        ...initialSettings(),
        physicalTimeConfirmed: true,
        parameters: [2, 10, -9.81].map((value, i) => ({
          value,
          fixed: !!(mask & (1 << i)),
        })),
      };
      const result = fit(r, s);
      result.coefficients.forEach((v, i) =>
        expect(v).toBeCloseTo([2, 10, -9.81][i], 10),
      );
      expect(result.rank).toBe(3 - s.parameters.filter((p) => p.fixed).length);
    }
  });
  it("uses Student t for estimated scatter and never manufactures Q", () => {
    const r = line();
    r.uncertainty = { kind: "unknown-equal", errorStructure: "uncorrelated" };
    const f = fit(r, initialSettings("line"));
    expect(f.q.reason).toBe("unknown-noise-scale");
    expect(
      (f.intervals[0]![1] - f.coefficients[0]) / f.standardErrors[0].value!,
    ).toBeCloseTo(3.182446305284263, 10);
  });
  it("scales absolute errors without changing coefficients", () => {
    const r = line(),
      s = initialSettings("line"),
      a = fit(r, s);
    if (r.uncertainty.kind !== "supplied-common") throw Error();
    r.uncertainty.sigmaY *= 2;
    const b = fit(r, s);
    a.coefficients.forEach((v, i) =>
      expect(b.coefficients[i]).toBeCloseTo(v, 12),
    );
    expect(b.standardErrors[0].value!).toBeCloseTo(
      2 * a.standardErrors[0].value!,
      12,
    );
    expect(b.weightedObjective.value!).toBeCloseTo(
      a.weightedObjective.value! / 4,
      12,
    );
  });
  it("retains centered R² with a fixed intercept, including negative values", () => {
    const s = initialSettings("line");
    s.parameters[0] = { value: 100, fixed: true };
    const r = fit(line(), s);
    expect(r.rSquared.value).toBeLessThan(0);
  });
  it("rejects rank deficiency but permits repeated independent-variable values", () => {
    const r = line();
    r.dataset.rows = r.dataset.rows.map((row) => ({ ...row, x: 1 }));
    expect(() => fit(r, initialSettings("line"))).toThrow(/Rank deficient/);
    r.dataset.rows[0].x = 0;
    expect(fit(r, initialSettings("line")).rank).toBe(2);
  });
  it("handles exact fits, zero df, constant y and zero free parameters", () => {
    const r = line();
    r.dataset.rows = r.dataset.rows.slice(0, 2);
    const s = initialSettings("line");
    expect(fit(r, s).q.reason).toBe("zero-degrees-of-freedom");
    expect(fit(r, s).standardErrors[0].value).not.toBeNull();
    r.uncertainty = { kind: "unknown-equal", errorStructure: "uncorrelated" };
    expect(fit(r, s).standardErrors[0].reason).toBe("zero-degrees-of-freedom");
    r.dataset.rows = line().dataset.rows.map((row) => ({ ...row, y: 0 }));
    const f = fit(r, s);
    expect(f.rSquared.reason).toBe("zero-variance");
    expect(f.standardErrors[0].reason).toBe("zero-residual-scale");
    s.parameters.forEach((p) => (p.fixed = true));
    expect(fit(r, s).rank).toBe(0);
  });
  it("preserves frozen inputs and row associations across permutation/exclusion", () => {
    const r = line();
    r.uncertainty = {
      kind: "supplied-per-row",
      errorStructure: "uncorrelated",
      provenance: { kind: "user-asserted", description: "test" },
      sigmaByRow: { "0": 0.1, "1": 0.2, "2": 0.3, "3": 0.4, "4": 0.5 },
    };
    const s = { ...initialSettings("line"), excludedIds: ["2"] };
    const original = JSON.stringify(r);
    const a = fit(r, s);
    const b = fit(
      { ...r, dataset: { ...r.dataset, rows: [...r.dataset.rows].reverse() } },
      s,
    );
    a.coefficients.forEach((v, i) =>
      expect(b.coefficients[i]).toBeCloseTo(v, 12),
    );
    expect(JSON.stringify(r)).toBe(original);
    expect(a.residuals.map((r) => r.id)).not.toContain("2");
  });
  it("requires accepted assumptions and preserves descriptive objectives", () => {
    const r = line();
    r.dataset.assumptions.gaussianIndependent = "unknown";
    r.uncertainty.errorStructure = "unknown";
    const s = initialSettings("line");
    expect(fit(r, s).inference).toBe("descriptive");
    s.conditionalInference = true;
    expect(fit(r, s).inference).toBe("conditional");
    r.uncertainty.errorStructure = "known-correlated";
    const f = fit(r, s);
    expect(f.inference).toBe("descriptive");
    expect(f.q.value).toBeNull();
    expect(f.weightedObjective.value).not.toBeNull();
    expect(f.standardErrors[0].value).toBeNull();
  });
  it("transforms physical units in coefficients and the entire covariance", () => {
    const r = line(),
      s = initialSettings("line"),
      a = fit(r, s);
    const scaled = structuredClone(r);
    scaled.dataset.rows.forEach((row) => {
      row.x! *= 1000;
      row.y! *= 100;
    });
    if (scaled.uncertainty.kind === "supplied-common")
      scaled.uncertainty.sigmaY *= 100;
    const b = fit(scaled, s),
      factors = [100, 0.1];
    a.coefficients.forEach((v, i) =>
      expect(b.coefficients[i]).toBeCloseTo(v * factors[i], 9),
    );
    a.covariance!.forEach((row, i) =>
      row.forEach((v, j) =>
        expect(b.covariance![i][j]).toBeCloseTo(
          v * factors[i] * factors[j],
          10,
        ),
      ),
    );
  });
});
describe("independent probability reference checks", () => {
  it("matches NIST t quantiles and the analytic df=1 Cauchy quantile", () => {
    expect(studentCritical95(1)).toBeCloseTo(Math.tan(Math.PI * 0.475), 10);
    expect(studentCritical95(6)).toBeCloseTo(2.4469118511449692, 10);
    expect(studentCritical95(60)).toBeCloseTo(2.00029782201426, 10);
  });
  it("matches exponential and Erlang survival functions, including tails", () => {
    for (const x of [0, 0.001, 1, 10, 100]) {
      expect(gammaQ(1, x)).toBeCloseTo(Math.exp(-x), 13);
      expect(gammaQ(2, x)).toBeCloseTo(Math.exp(-x) * (1 + x), 13);
    }
    expect(gammaQ(1, 100) / Math.exp(-100)).toBeCloseTo(1, 12);
    expect(gammaQ(5, 9.153519026637573)).toBeCloseTo(0.05, 12);
  });
});

it("matches NIST Norris certified line coefficients and uncertainty", () => {
  // Public NIST StRD Norris dataset: https://www.itl.nist.gov/div898/strd/lls/data/LINKS/DATA/Norris.dat
  const pairs = [
    [0.1, 0.2],
    [338.8, 337.4],
    [118.1, 118.2],
    [888, 884.6],
    [9.2, 10.1],
    [228.1, 226.5],
    [668.5, 666.3],
    [998.5, 996.3],
    [449.1, 448.6],
    [778.9, 777],
    [559.2, 558.2],
    [0.3, 0.4],
    [0.1, 0.6],
    [778.1, 775.5],
    [668.8, 666.9],
    [339.3, 338],
    [448.9, 447.5],
    [10.8, 11.6],
    [557.7, 556],
    [228.3, 228.1],
    [998, 995.8],
    [888.8, 887.6],
    [119.6, 120.2],
    [0.3, 0.3],
    [0.6, 0.3],
    [557.6, 556.8],
    [339.3, 339.1],
    [888, 887.2],
    [998.5, 999],
    [778.9, 779],
    [10.2, 11.1],
    [117.6, 118.3],
    [228.9, 229.2],
    [668.4, 669.1],
    [449.2, 448.9],
    [0.2, 0.5],
  ];
  const r = line();
  r.dataset.rows = pairs.map(([y, x], i) => ({
    id: String(i),
    x,
    y,
    included: true,
    missingReason: null,
  }));
  r.uncertainty = { kind: "unknown-equal", errorStructure: "uncorrelated" };
  const f = fit(r, initialSettings("line"));
  expect(f.coefficients[0]).toBeCloseTo(-0.262323073774029, 10);
  expect(f.coefficients[1]).toBeCloseTo(1.00211681802045, 12);
  expect(f.standardErrors[0].value).toBeCloseTo(0.232818234301152, 11);
  expect(f.standardErrors[1].value).toBeCloseTo(0.000429796848199937, 13);
  expect(f.scatter.value).toBeCloseTo(0.884796396144373, 11);
});
it("retains a deliberate outlier and respects an incorrect fixed assertion", () => {
  const r = line(),
    settings = initialSettings("line"),
    base = fit(r, settings);
  r.dataset.rows[2].y! += 0.8;
  const outlier = fit(r, settings);
  expect(outlier.n).toBe(5);
  expect(outlier.coefficients[0]).not.toBe(base.coefficients[0]);
  expect(outlier.residuals[2].residual).toBeGreaterThan(0.5);
  settings.parameters[0] = { value: 10, fixed: true };
  const f = fit(r, settings);
  expect(f.coefficients[0]).toBe(10);
  const expected =
    r.dataset.rows.reduce((s, row) => s + row.x! * (row.y! - 10), 0) /
    r.dataset.rows.reduce((s, row) => s + row.x! ** 2, 0);
  expect(f.coefficients[1]).toBeCloseTo(expected, 12);
});
