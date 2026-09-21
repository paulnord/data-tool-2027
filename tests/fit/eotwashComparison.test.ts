import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { sessionSchema } from "../../src/core/fit/schema";
import { fit } from "../../src/core/fit/solve";
import { compareModels } from "../../src/core/fit/modelComparison";

it("reproduces independent Eot-Wash likelihoods with the saved four-model workspace", () => {
  const session = sessionSchema.parse(
    JSON.parse(
      readFileSync(
        "examples/data/published/eotwash-model-comparison.trksess",
        "utf8",
      ),
    ),
  );
  if (session.workspace.kind !== "model-comparison")
    throw Error("Wrong workspace");
  const candidates = session.workspace.candidates.map(
    ({ label, analysis }, i) => {
      expect(analysis.request).toEqual(session.request);
      expect(analysis.request.dataset.rows).toHaveLength(87);
      expect(analysis.settings.excludedIds).toEqual([]);
      return {
        id: String(i),
        label,
        ...analysis,
        result: fit(analysis.request, analysis.settings),
      };
    },
  );
  const comparison = compareModels(candidates);
  expect(comparison.compatible).toBe(true);
  expect(comparison.rankingCriterion).toBe("AIC");
  // Independent SciPy least_squares calculations, retaining absolute supplied sigmas.
  const references = [
    { chi2: 85.5167185944, df: 86, aic: -571.3394775248 },
    { chi2: 82.0675395515, df: 85, aic: -572.7886565678 },
    { chi2: 70.7329770109, df: 85, aic: -584.1232191083 },
    { chi2: 70.7289180286, df: 84, aic: -582.1272780907 },
  ];
  comparison.metrics.forEach((metric, i) => {
    expect(candidates[i].result.weightedObjective.value).toBeCloseTo(
      references[i].chi2,
      5,
    );
    expect(metric.df).toBe(references[i].df);
    expect(metric.aic.value).toBeCloseTo(references[i].aic, 5);
    expect(metric.reducedChiSquared.value).toBeCloseTo(
      references[i].chi2 / references[i].df,
      6,
    );
    expect(metric.aicc.reason).toBe("not-applicable-known-variance");
    expect(candidates[i].result.inference).toBe("conditional");
  });
  expect(candidates[2].settings.parameters[2]).toEqual({
    value: (3 * Math.PI) / 4,
    fixed: true,
  });
  expect(candidates[3].settings.parameters[2].fixed).toBe(false);
  expect(comparison.metrics[2].delta.value).toBe(0);
});
