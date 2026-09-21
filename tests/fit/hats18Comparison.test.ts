import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { sessionSchema } from "../../src/core/fit/schema";
import { fit } from "../../src/core/fit/solve";
import { compareModels } from "../../src/core/fit/modelComparison";

it("preserves the published HATS-18 comparison while holding out the two 2024 timings", () => {
  const session = sessionSchema.parse(
    JSON.parse(
      readFileSync(
        "examples/data/published/hats18-model-comparison.trksess",
        "utf8",
      ),
    ),
  );
  if (session.workspace.kind !== "model-comparison")
    throw Error("Wrong workspace");
  expect(session.request.dataset.rows).toHaveLength(34);
  expect(
    session.dataTable!.cells.slice(-2).map((row) => row.slice(3, 6)),
  ).toEqual([
    ["2164", "2460439.60668", "0.00082"],
    ["2189", "2460460.55349", "0.00086"],
  ]);
  const heldOut = session.request.dataset.rows.slice(-2).map((row) => row.id);
  const candidates = session.workspace.candidates.map(
    ({ label, analysis }, i) => {
      expect(analysis.request).toEqual(session.request);
      expect(analysis.settings.excludedIds).toEqual(heldOut);
      expect(analysis.settings.parameters.every((p) => !p.fixed)).toBe(true);
      const result = fit(analysis.request, analysis.settings);
      const uncertainty = analysis.request.uncertainty;
      if (uncertainty.kind !== "supplied-per-row")
        throw Error("Missing timing errors");
      const original = fit(
        {
          ...analysis.request,
          uncertainty: {
            ...uncertainty,
            sigmaByRow: Object.fromEntries(
              Object.entries(uncertainty.sigmaByRow).filter(
                ([id]) => !heldOut.includes(id),
              ),
            ),
          },
          dataset: {
            ...analysis.request.dataset,
            rows: analysis.request.dataset.rows.slice(0, 32),
          },
        },
        { ...analysis.settings, excludedIds: [] },
      );
      expect(result.coefficients).toEqual(original.coefficients);
      expect(result.weightedObjective).toEqual(original.weightedObjective);
      const all = fit(analysis.request, {
        ...analysis.settings,
        excludedIds: [],
      });
      expect(all.n).toBe(34);
      expect(all.df).toBe(32 - i);
      return { id: String(i), label, ...analysis, result };
    },
  );
  const comparison = compareModels(candidates);
  expect(comparison.compatible).toBe(true);
  comparison.metrics.forEach((m, i) => {
    expect(m.n).toBe(32);
    expect(m.df).toBe(30 - i);
    expect(m.objective).toBeCloseTo(
      [57.2950127634, 57.1018620267, 54.8707220926][i],
      7,
    );
    expect(Number((m.objective + 2 * m.modelParameters).toFixed(1))).toBe(
      [61.3, 63.1, 62.9][i],
    );
    expect(
      Number((m.objective + m.modelParameters * Math.log(m.n)).toFixed(1)),
    ).toBe([64.2, 67.5, 68.7][i]);
  });
});
