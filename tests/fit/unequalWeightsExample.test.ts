import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { sessionSchema } from "../../src/core/fit/schema";
import { fit } from "../../src/core/fit/solve";
it("paired weighting examples use identical data and recover the independently calculated weighted line", () => {
  const weighted = sessionSchema.parse(
    JSON.parse(
      readFileSync("examples/fit/unequal-weights-demo.trksess", "utf8"),
    ),
  );
  const equal = sessionSchema.parse(
    JSON.parse(
      readFileSync("examples/fit/equal-weights-comparison.trksess", "utf8"),
    ),
  );
  expect(equal.request.dataset.rows).toEqual(weighted.request.dataset.rows);
  const u = weighted.request.uncertainty;
  if (u.kind !== "supplied-per-row")
    throw Error("Expected per-row uncertainty");
  const rows = weighted.request.dataset.rows;
  const weights = rows.map((row) => 1 / u.sigmaByRow[row.id] ** 2);
  const sum = weights.reduce((a, b) => a + b, 0);
  const xbar = rows.reduce((a, r, i) => a + weights[i] * r.x!, 0) / sum;
  const ybar = rows.reduce((a, r, i) => a + weights[i] * r.y!, 0) / sum;
  const slope =
    rows.reduce(
      (a, r, i) => a + weights[i] * (r.x! - xbar) * (r.y! - ybar),
      0,
    ) / rows.reduce((a, r, i) => a + weights[i] * (r.x! - xbar) ** 2, 0);
  const result = fit(weighted.request, weighted.settings),
    control = fit(equal.request, equal.settings);
  expect(result.coefficients[0]).toBeCloseTo(ybar - slope * xbar, 12);
  expect(result.coefficients[1]).toBeCloseTo(slope, 12);
  expect(weights[0] / weights.at(-1)!).toBeCloseTo(100, 12);
  expect(
    Math.abs(control.coefficients[1] - result.coefficients[1]),
  ).toBeGreaterThan(0.01);
  expect(control.inference).toBe("descriptive");
});
