import { expect, it } from "vitest";
import {
  compareModels,
  comparisonCompatibility,
  type ComparisonCandidate,
} from "../../src/core/fit/modelComparison";
import { initialSettings } from "../../src/core/fit/schema";
import { fit } from "../../src/core/fit/solve";
import { syntheticRequest } from "../support/synthetic";

function candidate(
  id: string,
  model: "line" | "quadratic" | "cubic",
  request = syntheticRequest(),
): ComparisonCandidate {
  const settings = initialSettings(model);
  return {
    id,
    label: model,
    request,
    settings,
    result: fit(request, settings),
  };
}

it("computes normalized known-variance likelihood, AIC, BIC, deltas and weights", () => {
  const request = syntheticRequest();
  const line = candidate("line", "line", request);
  const quadratic = candidate("quadratic", "quadratic", request);
  const comparison = compareModels([line, quadratic]);
  expect(comparison).toMatchObject({
    compatible: true,
    rankingCriterion: "AIC",
    reasons: [],
  });
  const metrics = comparison.metrics;
  expect(metrics).toHaveLength(2);
  for (const metric of metrics) {
    expect(metric.n).toBe(request.dataset.rows.length);
    expect(metric.likelihoodParameters).toBe(metric.modelParameters);
    expect(metric.aic.value).not.toBeNull();
    expect(metric.aicc).toEqual({
      value: null,
      reason: "not-applicable-known-variance",
    });
    expect(metric.bic.value).not.toBeNull();
    expect(metric.delta.value).toBeGreaterThanOrEqual(0);
  }
  const expectedLineLogLikelihood =
    -0.5 *
    (line.result.weightedObjective.value! +
      line.result.n * Math.log(2 * Math.PI * 0.02 ** 2));
  expect(metrics[0].logLikelihood.value).toBeCloseTo(
    expectedLineLogLikelihood,
    12,
  );
  expect(
    metrics.reduce((sum, metric) => sum + metric.akaikeWeight.value!, 0),
  ).toBeCloseTo(1, 14);
  expect(metrics[1].akaikeWeight.value).toBeGreaterThan(0.999);
});

it("counts an unknown common variance and withholds formal criteria for descriptive fits", () => {
  const request = syntheticRequest();
  request.uncertainty = {
    kind: "unknown-equal",
    errorStructure: "uncorrelated",
  };
  const line = candidate("line", "line", request);
  const quadratic = candidate("quadratic", "quadratic", request);
  const comparison = compareModels([line, quadratic]);
  expect(comparison.rankingCriterion).toBe("AICc");
  expect(comparison.metrics[0].likelihoodParameters).toBe(3);
  expect(comparison.metrics[0].logLikelihood.value).toBeCloseTo(
    (-line.result.n / 2) *
      (Math.log(2 * Math.PI) + 1 + Math.log(line.result.sse / line.result.n)),
    12,
  );

  request.dataset.assumptions.correctModel = "unknown";
  const settingsA = initialSettings("line");
  const settingsB = initialSettings("quadratic");
  const descriptive = compareModels([
    {
      id: "a",
      label: "line",
      request,
      settings: settingsA,
      result: fit(request, settingsA),
    },
    {
      id: "b",
      label: "quadratic",
      request,
      settings: settingsB,
      result: fit(request, settingsB),
    },
  ]);
  expect(descriptive.metrics[0].aicc).toEqual({
    value: null,
    reason: "unsupported-or-unaccepted-assumptions",
  });
});

it("refuses different samples, uncertainties, assignments, and assumptions", () => {
  const reference = candidate("a", "line");
  const changedRequest = structuredClone(reference.request);
  changedRequest.dataset.xColumn.label = "Different x";
  changedRequest.dataset.assumptions.correctModel = "unknown";
  changedRequest.uncertainty = {
    ...changedRequest.uncertainty,
    sigmaY: 0.04,
  } as typeof changedRequest.uncertainty;
  const changed = candidate("b", "quadratic", changedRequest);
  changed.settings.excludedIds = [changedRequest.dataset.rows[0].id];
  changed.result = fit(changedRequest, changed.settings);
  const reasons = comparisonCompatibility(reference, changed);
  expect(reasons).toEqual([
    "x/y assignments or units differ",
    "fit assumptions differ",
    "included observations, exclusions, or supplied uncertainties differ",
  ]);
  const comparison = compareModels([reference, changed]);
  expect(comparison.compatible).toBe(false);
  expect(comparison.metrics).toEqual([]);
});

it("keeps AIC and BIC but marks AICc unavailable for an undersized candidate", () => {
  const request = syntheticRequest();
  request.uncertainty = {
    kind: "unknown-equal",
    errorStructure: "uncorrelated",
  };
  request.dataset.rows = request.dataset.rows.slice(0, 5);
  const comparison = compareModels([
    candidate("line", "line", request),
    candidate("cubic", "cubic", request),
  ]);
  expect(comparison.compatible).toBe(true);
  expect(comparison.metrics[1].aic.value).not.toBeNull();
  expect(comparison.metrics[1].bic.value).not.toBeNull();
  expect(comparison.metrics[1].aicc).toEqual({
    value: null,
    reason: "insufficient-sample-for-aicc",
  });
  expect(comparison.metrics[1].akaikeWeight.reason).toBe(
    "insufficient-sample-for-aicc",
  );
  expect(comparison.metrics[0].akaikeWeight).toEqual({
    value: null,
    reason: "fewer-than-two-comparable-criteria",
  });
});

it("uses AIC for known sigmas without reversing a small-sample model ranking", () => {
  const request = syntheticRequest();
  request.uncertainty = {
    ...request.uncertainty,
    sigmaY: 1,
  } as typeof request.uncertainty;
  const xs = [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5];
  const meanSquare = xs.reduce((sum, x) => sum + x * x, 0) / xs.length;
  const quadratic = xs.map((x) => x * x - meanSquare);
  // The quadratic contribution is orthogonal to a line and has squared norm 4.
  const amplitude = Math.sqrt(
    4 / quadratic.reduce((sum, value) => sum + value * value, 0),
  );
  const cubicSlope =
    xs.reduce((sum, x) => sum + x ** 4, 0) /
    xs.reduce((sum, x) => sum + x * x, 0);
  request.dataset.rows = xs.map((x, i) => ({
    id: `row-${i}`,
    x,
    y: 2 + x + amplitude * quadratic[i] + 0.05 * (x ** 3 - cubicSlope * x),
    included: true,
    missingReason: null,
  }));
  const comparison = compareModels([
    candidate("line", "line", request),
    candidate("quadratic", "quadratic", request),
  ]);
  expect(comparison.rankingCriterion).toBe("AIC");
  const [line, curved] = comparison.metrics;
  expect(line.objective).toBeCloseTo(4.162, 12);
  expect(curved.objective).toBeCloseTo(0.162, 12);
  expect(line.delta.value).toBeCloseTo(2, 12);
  expect(curved.delta.value).toBe(0);
  expect(curved.akaikeWeight.value).toBeCloseTo(1 / (1 + Math.exp(-1)), 14);
  expect(line.aicc.reason).toBe("not-applicable-known-variance");
});

it("keeps normalized likelihoods finite when squaring a supplied sigma would overflow", () => {
  const request = syntheticRequest();
  const sigma = 6e153;
  request.uncertainty = {
    ...request.uncertainty,
    sigmaY: sigma,
  } as typeof request.uncertainty;
  const comparison = compareModels([
    candidate("line", "line", request),
    candidate("quadratic", "quadratic", request),
  ]);
  for (const metric of comparison.metrics) {
    expect(metric.logLikelihood.value).toBeCloseTo(
      -metric.n * (Math.log(sigma) + 0.5 * Math.log(2 * Math.PI)),
      9,
    );
    for (const statistic of [
      metric.logLikelihood,
      metric.aic,
      metric.bic,
      metric.delta,
      metric.akaikeWeight,
    ]) {
      expect(statistic.reason).toBeNull();
      expect(Number.isFinite(statistic.value)).toBe(true);
    }
  }
  expect(
    comparison.metrics.reduce(
      (sum, metric) => sum + metric.akaikeWeight.value!,
      0,
    ),
  ).toBeCloseTo(1, 14);
});

it("keeps unknown-scale likelihood finite when SSE divided by n would underflow", () => {
  const request = syntheticRequest();
  request.uncertainty = {
    kind: "unknown-equal",
    errorStructure: "uncorrelated",
  };
  request.dataset.rows = request.dataset.rows.map((row, i) => ({
    ...row,
    y: i === 0 ? 2e-162 : 0,
  }));
  const fitted = (["line", "quadratic"] as const).map((model) => {
    const settings = initialSettings(model);
    settings.parameters = settings.parameters.map(() => ({
      value: 0,
      fixed: true,
    }));
    return {
      id: model,
      label: model,
      request,
      settings,
      result: fit(request, settings),
    };
  });
  expect(fitted[0].result.sse).toBe(Number.MIN_VALUE);
  expect(fitted[0].result.sse / fitted[0].result.n).toBe(0);
  const comparison = compareModels(fitted);
  expect(comparison.rankingCriterion).toBe("AICc");
  for (const metric of comparison.metrics) {
    expect(Number.isFinite(metric.logLikelihood.value)).toBe(true);
    expect(metric.logLikelihood.reason).toBeNull();
    expect(metric.delta.value).toBe(0);
    expect(metric.akaikeWeight.value).toBe(0.5);
  }
});

it("does not publish nonfinite criteria or rank them as valid evidence", () => {
  const valid = candidate("line", "line");
  const invalid = candidate("quadratic", "quadratic", valid.request);
  // Defensive boundary check: production fits reject a nonfinite objective.
  invalid.result.weightedObjective.value = Infinity;
  const comparison = compareModels([valid, invalid]);
  expect(comparison.metrics[1].aic).toEqual({
    value: null,
    reason: "nonfinite-comparison-statistic",
  });
  expect(comparison.metrics[1].akaikeWeight).toEqual({
    value: null,
    reason: "nonfinite-comparison-statistic",
  });
  expect(comparison.metrics[0].akaikeWeight.reason).toBe(
    "fewer-than-two-comparable-criteria",
  );
});
