import { it, expect } from "vitest";
import reference from "./reference.json";
import { fit } from "../../src/core/fit/solve";
import { syntheticRequest, gaussianGenerator } from "../support/synthetic";
import { initialSettings, type FitSettings } from "../../src/core/fit/schema";
function within(value: number, bounds: number[], label: string) {
  expect(value, label).toBeGreaterThanOrEqual(bounds[0]);
  expect(value, label).toBeLessThanOrEqual(bounds[1]);
}
// Gates, independent covariance and quantiles are frozen in reference.json.
// No result from the production solver generates an acceptance boundary.
for (const scenario of reference.scenarios)
  it(`10,000 experiments: ${scenario.name}`, () => {
    const request = syntheticRequest(),
      settings = initialSettings(scenario.model as FitSettings["model"]);
    settings.physicalTimeConfirmed = true;
    settings.parameters = scenario.truth.map((value, i) => ({
      value,
      fixed: scenario.fixed && i === 0,
    }));
    request.dataset.rows = scenario.x.map((x, i) => ({
      id: String(i),
      x,
      y: 0,
      included: true,
      missingReason: null,
    }));
    request.uncertainty = scenario.known
      ? {
          kind: "supplied-per-row",
          errorStructure: "uncorrelated",
          provenance: {
            kind: "user-asserted",
            description: "Known synthetic generation",
          },
          sigmaByRow: Object.fromEntries(
            scenario.sigma.map((v, i) => [String(i), v]),
          ),
        }
      : { kind: "unknown-equal", errorStructure: "uncorrelated" };
    const p = scenario.free.length,
      means = Array(p).fill(0),
      m2 = Array(p).fill(0),
      coverage = Array(p).fill(0);
    let objective = 0,
      qCount = 0,
      scaleSum = 0;
    for (let k = 0; k < reference.M; k++) {
      const noise = gaussianGenerator(scenario.seedBase + k);
      request.dataset.rows.forEach((row, i) => {
        const x = row.x!;
        row.y =
          scenario.truth[0] +
          scenario.truth[1] * x +
          (scenario.truth.length === 3 ? (scenario.truth[2] * x * x) / 2 : 0) +
          scenario.sigma[i] * noise();
      });
      const result = fit(request, settings);
      scenario.free.forEach((j, a) => {
        const value = result.coefficients[j],
          delta = value - means[a];
        means[a] += delta / (k + 1);
        m2[a] += delta * (value - means[a]);
        const interval = result.intervals[j]!;
        coverage[a] += Number(
          interval[0] <= scenario.truth[j] && interval[1] >= scenario.truth[j],
        );
        if (scenario.known)
          scenario.free.forEach((l, b) =>
            expect(
              Math.abs(result.covariance![j][l] - scenario.covariance[a][b]),
            ).toBeLessThan(
              1e-10 * Math.max(1e-10, Math.abs(scenario.covariance[a][b])),
            ),
          );
      });
      if (scenario.known) {
        objective += result.weightedObjective.value!;
        qCount += Number(result.q.value! < 0.05);
      } else {
        expect(result.q.value).toBeNull();
        const j = scenario.free[0];
        scaleSum += result.covariance![j][j] / scenario.covariance[0][0];
      }
    }
    scenario.free.forEach((j, a) => {
      expect(
        Math.abs(means[a] - scenario.truth[j]),
        `bias ${j}`,
      ).toBeLessThanOrEqual(
        reference.biasLimit *
          Math.sqrt(scenario.covariance[a][a] / reference.M),
      );
      within(
        m2[a] / scenario.covariance[a][a],
        reference.varianceBounds,
        `variance ${j}`,
      );
      within(coverage[a], reference.coverageBounds, `coverage ${j}`);
    });
    if (scenario.known) {
      within(objective, scenario.objectiveBounds, "sum chi²");
      within(qCount, reference.qCountBounds, "Q < .05");
    } else
      within(
        scaleSum / reference.M,
        scenario.reportedScaleBounds,
        "mean covariance scale",
      );
  }, 120000);
it("10,000 wrong-model and correlated-error experiments match independent projections", () => {
  const request = syntheticRequest(),
    line = initialSettings("line"),
    quadratic = { ...initialSettings(), physicalTimeConfirmed: true };
  let objective = 0;
  const mean = [0, 0, 0],
    m2 = [0, 0, 0];
  for (let k = 0; k < reference.M; k++) {
    const normal = gaussianGenerator(91027000 + k);
    request.uncertainty = {
      kind: "supplied-common",
      sigmaY: 0.02,
      errorStructure: "uncorrelated",
      provenance: { kind: "user-asserted", description: "Synthetic" },
    };
    request.dataset.assumptions.gaussianIndependent = "asserted";
    request.dataset.rows.forEach((r) => {
      r.y = 2 + 10 * r.x! - 4.905 * r.x! ** 2 + 0.02 * normal();
    });
    objective += fit(request, line).weightedObjective.value!;
    let error = 0.02 * normal();
    request.dataset.rows.forEach((r, i) => {
      if (i) error = 0.7 * error + 0.02 * Math.sqrt(1 - 0.7 ** 2) * normal();
      r.y = 2 + 10 * r.x! - 4.905 * r.x! ** 2 + error;
    });
    request.uncertainty.errorStructure = "known-correlated";
    request.dataset.assumptions.gaussianIndependent = "unknown";
    const f = fit(request, quadratic);
    expect(f.inference).toBe("descriptive");
    expect(f.covariance).toBeNull();
    f.coefficients.forEach((v, j) => {
      const delta = v - mean[j];
      mean[j] += delta / (k + 1);
      m2[j] += delta * (v - mean[j]);
    });
  }
  within(objective, reference.mismatch.objectiveBounds, "noncentral objective");
  m2.forEach((v, j) =>
    within(
      v / reference.arCovariance[j][j],
      reference.varianceBounds,
      `AR1 variance ${j}`,
    ),
  );
}, 120000);
