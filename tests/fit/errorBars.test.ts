import { expect, it } from "vitest";
import { suppliedYErrorBars } from "../../src/core/fit/errorBars";
import { syntheticRequest } from "../support/synthetic";
it("uses supplied common uncertainty independent of fit or assumptions without mutating inputs", () => {
  const request = syntheticRequest();
  request.dataset.assumptions.gaussianIndependent = "known-false";
  request.uncertainty.errorStructure = "known-correlated";
  const before = JSON.stringify(request),
    result = suppliedYErrorBars(request);
  expect(result.bars).toHaveLength(61);
  expect(result.bars[0]).toEqual({
    id: "row-0",
    x: 0,
    lower: request.dataset.rows[0].y! - 0.02,
    upper: request.dataset.rows[0].y! + 0.02,
    sigma: 0.02,
  });
  expect(JSON.stringify(request)).toBe(before);
});
it("matches per-row uncertainties by identity, including exclusions but never invents missing uncertainties", () => {
  const request = syntheticRequest();
  request.dataset.rows = request.dataset.rows.slice(0, 3).reverse();
  request.dataset.rows[0].included = false;
  request.uncertainty = {
    kind: "supplied-per-row",
    errorStructure: "uncorrelated",
    provenance: { kind: "user-asserted", description: "fixture" },
    sigmaByRow: { "row-0": 0.1, "row-1": 0.3 },
  };
  const bars = suppliedYErrorBars(request).bars;
  expect(bars.map((b) => [b.id, b.sigma])).toEqual([
    ["row-1", 0.3],
    ["row-0", 0.1],
  ]);
  request.dataset.rows[1].x = null;
  request.dataset.rows[1].included = false;
  request.dataset.rows[1].missingReason = "missing-value";
  expect(suppliedYErrorBars(request).bars).toHaveLength(1);
  request.uncertainty = { kind: "unknown-equal", errorStructure: "unknown" };
  expect(suppliedYErrorBars(request)).toEqual({ bars: [], unavailable: 0 });
});
it("never emits infinite endpoints or accepts nonpositive supplied sigma", () => {
  const request = syntheticRequest();
  request.dataset.rows = request.dataset.rows.slice(0, 1);
  request.dataset.rows[0].y = Number.MAX_VALUE;
  if (request.uncertainty.kind !== "supplied-common") throw Error("fixture");
  request.uncertainty.sigmaY = Number.MAX_VALUE;
  expect(suppliedYErrorBars(request)).toEqual({ bars: [], unavailable: 1 });
  request.uncertainty.sigmaY = 0;
  expect(() => suppliedYErrorBars(request)).toThrow(/positive/);
});
