import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { z } from "zod/v4";
import Ajv from "ajv";
import reference from "./peak-shape-reference.json";
import {
  gaussianShapeMoments,
  gaussianShapeValueGradient,
} from "../../src/core/fit/gaussianShape";
import {
  initialSettings,
  sessionSchema,
  sessionV5Schema,
  sessionVersion,
} from "../../src/core/fit/schema";
import { withPeakShape } from "../../src/core/fit/peakShapeSettings";
import { fitDerivedQuantities } from "../../src/core/fit/derivedParameters";
import { fit } from "../../src/core/fit/solve";
import { syntheticRequest } from "../support/synthetic";

describe("adjustable Gaussian peak", () => {
  it("distinguishes a fixed moment from vanishing first-order sensitivity", () => {
    const request = syntheticRequest(),
      settings = initialSettings("gaussian-shape");
    const p = [1, 3, 0, 1, 0, 1];
    settings.parameters = p.map((value, i) => ({ value, fixed: i === 5 }));
    request.dataset.rows = Array.from({ length: 81 }, (_, i) => {
      const x = (i - 40) / 10;
      return {
        id: String(i),
        x,
        y: gaussianShapeValueGradient(x, p).value,
        included: true,
        missingReason: null,
      };
    });
    const result = fit(request, settings);
    const atSymmetry = { ...result, coefficients: p };
    expect(
      fitDerivedQuantities(request, settings, atSymmetry)[1].standardError
        .reason,
    ).toBe("zero-derived-gradient");
    settings.parameters[4].fixed = true;
    expect(
      fitDerivedQuantities(request, settings, atSymmetry)[1].standardError
        .reason,
    ).toBe("fixed");
    expect(
      fitDerivedQuantities(request, settings, {
        ...atSymmetry,
        coefficients: [1, 0, 0, 1, 0, 1],
      })[1].standardError.reason,
    ).toBe("zero-peak-amplitude");
  });
  it("publishes a separate strict v5 structural schema", () => {
    const { title, $comment, ...published } = JSON.parse(
      readFileSync("schemas/tracker-fit-session.v5.json", "utf8"),
    );
    expect(published).toEqual(
      z.toJSONSchema(sessionV5Schema, { target: "draft-7" }),
    );
    const validate = new Ajv({ strict: false, validateFormats: false }).compile(
      published,
    );
    const session = {
      format: "tracker-fit-session",
      version: 5,
      engine: "qr-lm-3",
      request: syntheticRequest(),
      settings: initialSettings("gaussian-shape"),
    };
    expect(validate(session)).toBe(true);
    expect(validate({ ...session, version: 4 })).toBe(false);
    expect(validate({ ...session, engine: "qr-vp-sine-2" })).toBe(false);
    expect(
      sessionSchema.safeParse({
        ...session,
        settings: {
          ...session.settings,
          parameters: session.settings.parameters.slice(0, 5),
        },
      }).success,
    ).toBe(false);
  });
  it("preserves the Gaussian limit, peak height and position for either sign", () => {
    for (const amplitude of [-3, 3]) {
      for (const x of [-8, -1, 0.3, 2, 10])
        expect(
          gaussianShapeValueGradient(x, [1, amplitude, 0.3, 1.2, 0, 1]).value,
        ).toBe(1 + amplitude * Math.exp(-0.5 * ((x - 0.3) / 1.2) ** 2));
      for (const [e, d] of [
        [0.7, 0.6],
        [-0.4, 1.8],
        [0, 2],
      ]) {
        const p = [1, amplitude, 0.3, 1.2, e, d];
        expect(gaussianShapeValueGradient(0.3, p).value).toBe(1 + amplitude);
        expect(gaussianShapeValueGradient(0.3, p).gradient[2]).toBeCloseTo(
          0,
          12,
        );
        for (const x of [-2, 0, 1, 4])
          expect(
            Math.abs(gaussianShapeValueGradient(x, p).value - 1),
          ).toBeLessThan(Math.abs(amplitude));
      }
    }
  });
  it("matches independent central-difference sensitivities including mode recentering", () => {
    for (const p of [
      [1, 3, 0.3, 1.2, 0.6, 0.8],
      [1, -2, 0.3, 1.2, -0.5, 1.4],
      [1, 3, 0.3, 1.2, 0, 1],
    ])
      for (const x of [-2, 0, 1, 3]) {
        const actual = gaussianShapeValueGradient(x, p);
        for (let i = 0; i < 6; i++) {
          const h = 1e-5,
            a = p.slice(),
            b = p.slice();
          a[i] += h;
          b[i] -= h;
          const numeric =
            (gaussianShapeValueGradient(x, a).value -
              gaussianShapeValueGradient(x, b).value) /
            (2 * h);
          expect(actual.gradient[i]).toBeCloseTo(numeric, 6);
        }
      }
  });
  it("toggles options immutably, counts only enabled parameters, and validates session v5", () => {
    const plain = initialSettings("gaussian"),
      original = structuredClone(plain);
    const skew = withPeakShape(plain, "skew", true),
      both = withPeakShape(skew, "tail", true);
    expect(skew.parameters.filter((p) => !p.fixed)).toHaveLength(5);
    expect(both.parameters.filter((p) => !p.fixed)).toHaveLength(6);
    expect(
      withPeakShape(withPeakShape(both, "skew", false), "tail", false),
    ).toEqual(plain);
    expect(plain).toEqual(original);
    const session = {
      format: "tracker-fit-session",
      version: sessionVersion(both),
      engine: "qr-lm-3",
      request: syntheticRequest(),
      settings: both,
    };
    expect(sessionSchema.parse(session).version).toBe(5);
    expect(sessionSchema.safeParse({ ...session, version: 4 }).success).toBe(
      false,
    );
    const invalid = structuredClone(session);
    invalid.settings.parameters[5].value = 0;
    expect(sessionSchema.safeParse(invalid).success).toBe(false);
  });
  for (const c of reference.cases)
    it(`agrees with independent SciPy ${c.name} fit and moment integration`, () => {
      const settings = initialSettings("gaussian-shape"),
        request = syntheticRequest();
      settings.parameters = c.start.map((value, i) => ({
        value,
        fixed: c.fixed.includes(i),
      }));
      request.uncertainty = {
        kind: "supplied-common",
        errorStructure: "uncorrelated",
        sigmaY: c.sigma,
        provenance: {
          kind: "user-asserted",
          description: "Reference uncertainties",
        },
      };
      request.dataset.rows = c.x.map((x, i) => ({
        id: String(i),
        x,
        y: c.y[i],
        included: true,
        missingReason: null,
      }));
      const result = fit(request, settings);
      result.coefficients.forEach((v, i) =>
        expect(v).toBeCloseTo(c.fitted[i], 5),
      );
      result.covariance!.forEach((row, i) =>
        row.forEach((v, j) => expect(v).toBeCloseTo(c.covariance[i][j], 5)),
      );
      const moments = gaussianShapeMoments(
        result.coefficients[4],
        result.coefficients[5],
      )!;
      expect(moments.skewness).toBeCloseTo(c.moments[0], 5);
      expect(moments.excessKurtosis).toBeCloseTo(c.moments[1], 5);
      const derived = fitDerivedQuantities(request, settings, result);
      expect(derived).toHaveLength(2);
      for (const q of derived) {
        if (q.id === "skewness" && c.fixed.includes(4))
          expect(q.standardError.reason).toBe("fixed");
        else
          expect(q.standardError.value).toBeCloseTo(
            c.momentErrors[q.id === "skewness" ? 0 : 1],
            4,
          );
      }
    });
});
