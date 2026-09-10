import { it, expect } from "vitest";
import { meanConfidenceBand } from "../../src/core/fit/confidenceBand";
import { initialSettings } from "../../src/core/fit/schema";
import { fit } from "../../src/core/fit/solve";
import { syntheticRequest, gaussianGenerator } from "../support/synthetic";
import reference from "./reference.json";
function line() {
  const r = syntheticRequest();
  r.dataset.rows = [0, 1, 2, 3, 4].map((x, i) => ({
    id: String(i),
    x,
    y: 1 + 2 * x + [0.1, -0.2, 0.2, -0.1, 0.1][i],
    included: true,
    missingReason: null,
  }));
  r.uncertainty = {
    kind: "supplied-common",
    sigmaY: 0.1,
    errorStructure: "uncorrelated",
    provenance: { kind: "user-asserted", description: "test" },
  };
  return r;
}
it("uses the full covariance and matches the analytic straight-line mean standard error", () => {
  const r = line(),
    s = initialSettings("line"),
    f = fit(r, s),
    before = JSON.stringify(f),
    band = meanConfidenceBand([0, 2, 6], r, s, f);
  band.points.forEach((p) => {
    const se = 0.1 * Math.sqrt(1 / 5 + (p.x - 2) ** 2 / 10);
    expect(p.standardError).toBeCloseTo(se, 13);
    expect(p.upper - p.mean).toBeCloseTo(1.959963984540054 * se, 13);
  });
  expect(band.points[1].standardError).toBeLessThan(
    Math.sqrt(f.covariance![0][0] + 4 * f.covariance![1][1]),
  );
  expect(JSON.stringify(f)).toBe(before);
});
it("uses Student t with estimated noise and handles fixed, zero-df and unsupported cases", () => {
  const r = line(),
    s = initialSettings("line");
  r.uncertainty = { kind: "unknown-equal", errorStructure: "uncorrelated" };
  let f = fit(r, s);
  let p = meanConfidenceBand([2], r, s, f).points[0];
  expect((p.upper - p.mean) / p.standardError).toBeCloseTo(
    3.182446305284263,
    10,
  );
  s.parameters[0] = { value: 1, fixed: true };
  f = fit(r, s);
  expect(meanConfidenceBand([0], r, s, f).points[0].standardError).toBe(0);
  r.dataset.rows = r.dataset.rows.slice(1, 2);
  f = fit(r, s);
  expect(meanConfidenceBand([2], r, s, f).reason).toBe(
    "zero-degrees-of-freedom",
  );
  const correlated = line();
  correlated.uncertainty.errorStructure = "known-correlated";
  correlated.dataset.assumptions.gaussianIndependent = "unknown";
  expect(
    meanConfidenceBand([2], correlated, s, fit(correlated, s)).points,
  ).toEqual([]);
});
it("quadratic extrapolation widens after fitting only one side and respects physical units", () => {
  const r = syntheticRequest(),
    s = {
      ...initialSettings(),
      physicalTimeConfirmed: true,
      excludedIds: r.dataset.rows
        .filter((row) => row.x! > 1)
        .map((row) => row.id),
    };
  const band = meanConfidenceBand([0.5, 2], r, s, fit(r, s));
  expect(band.points[1].standardError).toBeGreaterThan(
    10 * band.points[0].standardError,
  );
  const converted = structuredClone(r);
  converted.dataset.rows.forEach((row) => (row.y! *= 100));
  if (converted.uncertainty.kind === "supplied-common")
    converted.uncertainty.sigmaY *= 100;
  const scaled = meanConfidenceBand([0.5, 2], converted, s, fit(converted, s));
  band.points.forEach((p, i) => {
    expect(scaled.points[i].lower).toBeCloseTo(p.lower * 100, 9);
    expect(scaled.points[i].upper).toBeCloseTo(p.upper * 100, 9);
  });
});
it("suppresses invalid covariance and nonfinite extrapolation without manufacturing precision", () => {
  const r = line(),
    s = initialSettings("line"),
    f = fit(r, s);
  expect(
    meanConfidenceBand([0], r, s, {
      ...f,
      covariance: [
        [-1, 0],
        [0, 1],
      ],
    }).reason,
  ).toBe("invalid-band-variance");
  expect(meanConfidenceBand([Infinity], r, s, f).points).toEqual([]);
});
for (const known of [true, false])
  it(`10,000 mean-curve coverage trials: ${known ? "known" : "estimated"} sigma`, () => {
    const r = line(),
      s = initialSettings("line"),
      xs = [0, 2, 6],
      covered = [0, 0, 0];
    if (!known)
      r.uncertainty = { kind: "unknown-equal", errorStructure: "uncorrelated" };
    for (let k = 0; k < reference.M; k++) {
      const noise = gaussianGenerator(known ? 113000000 + k : 114000000 + k);
      r.dataset.rows.forEach((row) => (row.y = 1 + 2 * row.x! + 0.1 * noise()));
      meanConfidenceBand(xs, r, s, fit(r, s)).points.forEach((p, i) => {
        const truth = 1 + 2 * p.x;
        covered[i] += Number(p.lower <= truth && p.upper >= truth);
      });
    }
    covered.forEach((count) => {
      expect(count).toBeGreaterThanOrEqual(reference.coverageBounds[0]);
      expect(count).toBeLessThanOrEqual(reference.coverageBounds[1]);
    });
  }, 30000);
