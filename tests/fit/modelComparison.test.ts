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

it("computes normalized Gaussian likelihood, AICc, BIC, deltas and weights", () => {
  const request = syntheticRequest();
  const line = candidate("line", "line", request);
  const quadratic = candidate("quadratic", "quadratic", request);
  const comparison = compareModels([line, quadratic]);
  expect(comparison).toMatchObject({ compatible: true, reasons: [] });
  const metrics = comparison.metrics;
  expect(metrics).toHaveLength(2);
  for (const metric of metrics) {
    expect(metric.n).toBe(request.dataset.rows.length);
    expect(metric.likelihoodParameters).toBe(metric.modelParameters);
    expect(metric.aic.value).not.toBeNull();
    expect(metric.aicc.value).not.toBeNull();
    expect(metric.bic.value).not.toBeNull();
    expect(metric.deltaAicc.value).toBeGreaterThanOrEqual(0);
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
  request.dataset.rows = request.dataset.rows.slice(0, 4);
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
    reason: "fewer-than-two-comparable-aicc",
  });
});
