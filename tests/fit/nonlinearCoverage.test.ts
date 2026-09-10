import { expect, it } from "vitest";
import reference from "./nonlinear-reference.json";
import { gaussianGenerator } from "../support/synthetic";
import { initialSettings, type FitRequest } from "../../src/core/fit/schema";
import { isNonlinearModel } from "../../src/core/fit/nonlinearModels";
import { fit } from "../../src/core/fit/solve";
for (const [index, fixture] of reference.fixtures.entries()) {
  it(`${fixture.model}: registered high-signal local 95% interval coverage over 500 experiments`, () => {
    if (!isNonlinearModel(fixture.model)) throw Error(fixture.model);
    const random = gaussianGenerator(reference.coverage.seed + index),
      counts = fixture.truth.map(() => 0);
    const settings = initialSettings(fixture.model);
    settings.parameters = fixture.initial.map((value) => ({
      value,
      fixed: false,
    }));
    for (let trial = 0; trial < reference.coverage.trials; trial++) {
      const r: FitRequest = {
        format: "tracker-fit-request",
        version: 1,
        requestId: "00000000-0000-4000-8000-000000000001",
        snapshotId: "00000000-0000-4000-8000-000000000002",
        source: {
          application: "coverage fixture",
          version: "1",
          context: null,
        },
        dataset: {
          id: "fixture",
          label: fixture.model,
          xColumn: { id: "x", label: "x", unit: null },
          yColumn: { id: "y", label: "y", unit: null },
          assumptions: {
            exactX: "asserted",
            gaussianIndependent: "asserted",
            correctModel: "asserted",
          },
          rows: fixture.x.map((x, i) => ({
            id: `row-${i}`,
            x,
            y: fixture.mean[i] + fixture.sigma[i] * random(),
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
            description: "Known generating deviations",
          },
        },
      };
      const result = fit(r, settings);
      fixture.truth.forEach((truth, j) => {
        const interval = result.intervals[j]!;
        if (interval[0] <= truth && truth <= interval[1]) counts[j]++;
      });
    }
    for (const count of counts) {
      expect(count).toBeGreaterThanOrEqual(reference.coverage.lower);
      expect(count).toBeLessThanOrEqual(reference.coverage.upper);
    }
  }, 30000);
}
