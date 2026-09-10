import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fit, modelGradient, predict } from "../../src/core/fit/solve";
import { initialSettings, sessionSchema } from "../../src/core/fit/schema";
import { syntheticRequest, gaussianGenerator } from "../support/synthetic";
import { meanConfidenceBand } from "../../src/core/fit/confidenceBand";
import { searchPeriod } from "../../src/core/fit/periodSearch";
import reference from "./sine-reference.json";
const settings = () => ({
  ...initialSettings("sine-free-period"),
  periodMin: 1.5,
  periodMax: 6,
});
function request(noisy = true) {
  const r = syntheticRequest();
  r.dataset.rows = reference.x.map((x, i) => ({
    id: String(i),
    x,
    y: noisy
      ? reference.y[i]
      : 1 +
        2 * Math.sin((2 * Math.PI * x) / 3) +
        0.75 * Math.cos((2 * Math.PI * x) / 3),
    included: true,
    missingReason: null,
  }));
  if (r.uncertainty.kind === "supplied-common") r.uncertainty.sigmaY = 0.05;
  return r;
}
it("matches independent SciPy period, residual objective and full local covariance", () => {
  const s = settings(),
    r = request(),
    result = fit(r, s);
  result.coefficients.forEach((v, i) =>
    expect(v).toBeCloseTo(reference.coefficients[i], 6),
  );
  expect(result.sse).toBeCloseTo(reference.sse, 11);
  result.covariance!.forEach((row, i) =>
    row.forEach((v, j) => expect(v).toBeCloseTo(reference.covariance[i][j], 9)),
  );
  expect(result.df).toBe(57);
  expect(result.q.reason).toBe("nonlinear-reference-distribution");
  const band = meanConfidenceBand([0, 4, 10], r, s, result);
  expect(band.reason).toBeNull();
  expect(band.points.every((p) => p.standardError > 0)).toBe(true);
  expect(result.warnings.join(" ")).toContain("local linear approximation");
});
it("recovers noiseless period without depending on a starting guess and respects fixed parameters", () => {
  const r = request(false),
    s = settings();
  s.parameters[3].value = 5.5;
  let result = fit(r, s);
  expect(result.coefficients[3]).toBeCloseTo(3, 8);
  s.parameters[0] = { value: 1, fixed: true };
  result = fit(r, s);
  expect(result.coefficients[3]).toBeCloseTo(3, 8);
  expect(result.standardErrors[0].reason).toBe("fixed");
  s.parameters[3] = { value: 3, fixed: true };
  result = fit(r, s);
  expect(result.coefficients[1]).toBeCloseTo(2, 10);
  expect(result.rank).toBe(2);
  expect(result.standardErrors[3].reason).toBe("fixed");
});
it("Jacobian includes the period derivative with the correct sign", () => {
  const s = settings(),
    c = [1, 2, 0.75, 3];
  for (const x of [0.1, 2, 7]) {
    const gradient = modelGradient(x, s, c);
    c.forEach((_, j) => {
      const a = c.slice(),
        b = c.slice();
      a[j] += 1e-5;
      b[j] -= 1e-5;
      expect(gradient[j]).toBeCloseTo(
        (predict(x, s.model, a) - predict(x, s.model, b)) / 2e-5,
        7,
      );
    });
  }
});
it("flags boundaries and sampled aliases and rejects zero-amplitude period claims", () => {
  const s = { ...settings(), periodMin: 2.9, periodMax: 2.99 };
  const boundary = fit(request(false), s);
  expect(boundary.covariance).toBeNull();
  expect(boundary.standardErrors[3].reason).toBe("period-at-search-boundary");
  const r = request(false);
  r.dataset.rows = Array.from({ length: 20 }, (_, x) => ({
    id: String(x),
    x,
    y:
      1 +
      2 * Math.sin((2 * Math.PI * x) / 5) +
      0.75 * Math.cos((2 * Math.PI * x) / 5),
    included: true,
    missingReason: null,
  }));
  const alias = fit(r, { ...settings(), periodMin: 1.1, periodMax: 6 });
  expect(alias.standardErrors[3].reason).toBe("competing-period-minima");
  r.dataset.rows = r.dataset.rows.map((row) => ({ ...row, y: 1 }));
  expect(() => fit(r, settings())).toThrow(/unidentifiable/);
  expect(() => searchPeriod(0, 2, 1, () => 0)).toThrow();
  expect(() => searchPeriod(0.00001, 20, 9, () => 0)).toThrow(/too broad/);
});
it("new nonlinear sessions round trip with engine provenance", () => {
  const session = JSON.parse(
    readFileSync("examples/fit/sine-fit-period-demo.trksess", "utf8"),
  );
  expect(sessionSchema.parse(JSON.parse(JSON.stringify(session)))).toEqual(
    session,
  );
  expect(fit(session.request, session.settings).coefficients[3]).toBeCloseTo(
    3,
    2,
  );
});
it("1000 high-signal irregular sine trials check approximate period interval coverage", () => {
  const normal = gaussianGenerator(902710),
    s = { ...settings(), periodMin: 2.5, periodMax: 3.5 };
  let covered = 0;
  for (let trial = 0; trial < 1000; trial++) {
    const r = request(false);
    r.dataset.rows = r.dataset.rows.map((row) => ({
      ...row,
      y: row.y! + 0.05 * normal(),
    }));
    const result = fit(r, s),
      interval = result.intervals[3]!;
    if (interval[0] <= 3 && interval[1] >= 3) covered++;
  }
  expect(covered).toBeGreaterThanOrEqual(reference.coverageBounds[0]);
  expect(covered).toBeLessThanOrEqual(reference.coverageBounds[1]);
}, 60000);
it("additional equations recover coefficients and preserve shape settings in files", () => {
  for (const [model, coefficients] of [
    ["exponential", [0.5, 3]],
    ["power-law", [1, 0.8]],
    ["reciprocal", [1, 2]],
  ] as const) {
    const session = JSON.parse(
      readFileSync("examples/fit/" + model + "-demo.trksess", "utf8"),
    );
    expect(sessionSchema.parse(session)).toEqual(session);
    const result = fit(session.request, session.settings);
    result.coefficients.forEach((v, i) =>
      expect(Math.abs(v - coefficients[i])).toBeLessThan(0.1),
    );
    const r = session.request;
    r.dataset.rows = r.dataset.rows.map((row: { x: number }) => ({
      ...row,
      y:
        model === "exponential"
          ? 0.5 + 3 * Math.exp(-0.7 * row.x)
          : model === "power-law"
            ? 1 + 0.8 * row.x ** 1.5
            : 1 + 2 / row.x,
    }));
    fit(r, session.settings).coefficients.forEach((v, i) =>
      expect(v).toBeCloseTo(coefficients[i], 10),
    );
  }
});
