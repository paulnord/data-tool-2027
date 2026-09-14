import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { z } from "zod/v4";
import Ajv from "ajv";
import reference from "./extended-model-reference.json";
import { syntheticRequest } from "../support/synthetic";
import { fit, predict, modelGradient } from "../../src/core/fit/solve";
import {
  initialSettings,
  sessionSchema,
  sessionV4Schema,
  sessionVersion,
  sessionEngine,
  type FitSettings,
} from "../../src/core/fit/schema";
import {
  isNonlinearModel,
  suggestedParameters,
} from "../../src/core/fit/nonlinearModels";
import { fitReportTsv } from "../../src/core/fit/report";

for (const fixture of reference.fixtures) {
  const model = fixture.model as FitSettings["model"];
  it(`${model}: agrees with independent SciPy optimum and SVD covariance, including fixed coefficients`, () => {
    const request = syntheticRequest();
    request.dataset.rows = fixture.x.map((x, i) => ({
      id: String(i),
      x,
      y: fixture.y[i],
      included: true,
      missingReason: null,
    }));
    request.uncertainty = {
      kind: "supplied-per-row",
      errorStructure: "uncorrelated",
      provenance: { kind: "user-asserted", description: "Reference sigma" },
      sigmaByRow: Object.fromEntries(
        fixture.sigma.map((v, i) => [String(i), v]),
      ),
    };
    for (const expected of fixture.cases) {
      const settings = initialSettings(model);
      settings.parameters = fixture.start.map((value, i) => ({
        value: expected.fixed.includes(i) ? fixture.truth[i] : value,
        fixed: expected.fixed.includes(i),
      }));
      const before = JSON.stringify({ request, settings });
      const result = fit(request, settings);
      expect(result.weightedObjective.value).toBeCloseTo(expected.objective, 8);
      result.coefficients.forEach((value, i) =>
        expect(value).toBeCloseTo(expected.coefficients[i], 6),
      );
      const free = settings.parameters.flatMap((p, i) => (p.fixed ? [] : [i]));
      free.forEach((i, a) =>
        free.forEach((j, b) =>
          expect(
            Math.abs(result.covariance![i][j] - expected.covariance[a][b]),
          ).toBeLessThan(1e-9 + Math.abs(expected.covariance[a][b]) * 2e-5),
        ),
      );
      expect(result.rank).toBe(free.length);
      expect(result.df).toBe(fixture.x.length - free.length);
      expect(JSON.stringify({ request, settings })).toBe(before);
      const session = {
        format: "tracker-fit-session",
        version: sessionVersion(settings),
        engine: sessionEngine(settings),
        request,
        settings,
      };
      expect(session.version).toBe(4);
      expect(sessionSchema.parse(JSON.parse(JSON.stringify(session)))).toEqual(
        session,
      );
      for (const version of [1, 2, 3])
        expect(sessionSchema.safeParse({ ...session, version }).success).toBe(
          false,
        );
      expect(fitReportTsv(request, settings, result)).not.toMatch(
        /undefined|xref/,
      );
    }
    if (isNonlinearModel(model)) {
      const settings = initialSettings(model);
      settings.parameters = suggestedParameters(model, request, []).map(
        (value) => ({ value, fixed: false }),
      );
      fit(request, settings).coefficients.forEach((v, i) =>
        expect(v).toBeCloseTo(fixture.cases[0].coefficients[i], 5),
      );
      const x = fixture.x[17];
      modelGradient(x, settings, fixture.truth).forEach((v, i) => {
        const lo = fixture.truth.slice(),
          hi = fixture.truth.slice(),
          h = 1e-5;
        lo[i] -= h;
        hi[i] += h;
        expect(v).toBeCloseTo(
          (predict(x, model, hi) - predict(x, model, lo)) / (2 * h),
          7,
        );
      });
    }
  });
}

it("v4 has a separate strict schema; invalid engines, parameter counts, widths and rank are rejected", () => {
  const {
    title: _,
    $comment: __,
    ...published
  } = JSON.parse(readFileSync("schemas/tracker-fit-session.v4.json", "utf8"));
  expect(published).toEqual(
    z.toJSONSchema(sessionV4Schema, { target: "draft-7" }),
  );
  const settings = initialSettings("polynomial-10"),
    request = syntheticRequest();
  const session = {
    format: "tracker-fit-session",
    version: 4,
    engine: sessionEngine(settings),
    settings,
    request,
  };
  expect(
    new Ajv({ strict: false, validateFormats: false }).compile(published)(
      session,
    ),
  ).toBe(true);
  expect(
    sessionSchema.safeParse({ ...session, engine: "qr-lm-3" }).success,
  ).toBe(false);
  expect(() =>
    fit(request, { ...settings, parameters: settings.parameters.slice(1) }),
  ).toThrow();
  request.dataset.rows = request.dataset.rows.slice(0, 10);
  expect(() => fit(request, settings)).toThrow(/Rank deficient/);
  const sigmoid = initialSettings("sigmoid");
  sigmoid.parameters[3].value = 0;
  expect(() => fit(request, sigmoid)).toThrow(/positive/);
  expect(predict(-1e308, "sigmoid", [1, 2, 0, 1e-308])).toBe(1);
  expect(predict(1e308, "sigmoid", [1, 2, 0, 1e-308])).toBe(3);
  expect(predict(0, "sigmoid", [3, -2, 0, 1])).toBe(2);
});
