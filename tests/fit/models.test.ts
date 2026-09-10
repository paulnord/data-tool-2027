import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fit } from "../../src/core/fit/solve";
import {
  initialSettings,
  sessionSchema,
  settingsSchema,
  type FitSettings,
} from "../../src/core/fit/schema";
import { syntheticRequest } from "../support/synthetic";
import { meanConfidenceBand } from "../../src/core/fit/confidenceBand";
import { fitReportTsv } from "../../src/core/fit/report";

const cases: {
  model: FitSettings["model"];
  coefficients: number[];
  y: (x: number) => number;
}[] = [
  {
    model: "cubic",
    coefficients: [1, -2, 0.5, 1],
    y: (x) => 1 - 2 * x + 0.5 * x * x + x ** 3,
  },
  {
    model: "quartic",
    coefficients: [1, 0, -2, 0, 0.5],
    y: (x) => 1 - 2 * x * x + 0.5 * x ** 4,
  },
  {
    model: "logarithmic",
    coefficients: [1.5, 2],
    y: (x) => 1.5 + 2 * Math.log(x),
  },
  {
    model: "sine",
    coefficients: [1, 2, 0.75],
    y: (x) =>
      1 +
      2 * Math.sin((2 * Math.PI * x) / 3) +
      0.75 * Math.cos((2 * Math.PI * x) / 3),
  },
];
for (const demo of cases)
  it(`recovers ${demo.model}, fixed coefficients and full covariance bands; sessions round trip`, () => {
    const request = syntheticRequest();
    request.dataset.rows = Array.from({ length: 81 }, (_, i) => {
      const x =
        demo.model === "logarithmic" ? 0.2 + (7.8 * i) / 80 : -2 + (4 * i) / 80;
      return {
        id: String(i),
        x,
        y: demo.y(x),
        included: true,
        missingReason: null,
      };
    });
    const settings = initialSettings(demo.model);
    if (demo.model === "sine") settings.sinePeriod = 3;
    for (const fixed of [false, true]) {
      settings.parameters[0] = { fixed, value: demo.coefficients[0] };
      const result = fit(request, settings);
      result.coefficients.forEach((v, i) =>
        expect(v).toBeCloseTo(demo.coefficients[i], 10),
      );
      expect(result.rank).toBe(demo.coefficients.length - Number(fixed));
      const band = meanConfidenceBand([0.5, 1, 2], request, settings, result);
      expect(band.reason).toBeNull();
      band.points.forEach((p) => {
        expect(p.mean).toBeCloseTo(demo.y(p.x), 10);
        if (fixed && demo.model === "logarithmic" && p.x === 1)
          expect(p.standardError).toBe(0); // ln(1)=0: only the fixed intercept contributes.
        else expect(p.upper).toBeGreaterThan(p.lower);
      });
    }
    const session = JSON.parse(
      readFileSync(`examples/fit/${demo.model}-demo.trksess`, "utf8"),
    );
    expect(sessionSchema.parse(JSON.parse(JSON.stringify(session)))).toEqual(
      session,
    );
    const result = fit(session.request, session.settings);
    result.coefficients.forEach((v, i) =>
      expect(Math.abs(v - demo.coefficients[i])).toBeLessThan(0.12),
    );
    expect(fitReportTsv(session.request, session.settings, result)).toContain(
      "Model",
    );
  });
it("known-period sine covariance matches an orthogonal full-cycle design", () => {
  const request = syntheticRequest();
  request.dataset.rows = Array.from({ length: 60 }, (_, i) => {
    const x = i / 20;
    return {
      id: String(i),
      x,
      y: 1 + 2 * Math.sin((2 * Math.PI * x) / 3),
      included: true,
      missingReason: null,
    };
  });
  const settings = { ...initialSettings("sine"), sinePeriod: 3 };
  const result = fit(request, settings);
  expect(result.covariance![0][0]).toBeCloseTo(0.02 ** 2 / 60, 14);
  expect(result.covariance![1][1]).toBeCloseTo((2 * 0.02 ** 2) / 60, 14);
  expect(result.covariance![1][2]).toBeCloseTo(0, 14);
});
it("rejects invalid logarithmic domains, invalid periods and unidentifiable higher polynomials", () => {
  const request = syntheticRequest();
  expect(() => fit(request, initialSettings("logarithmic"))).toThrow(
    /requires x > 0/,
  );
  expect(() =>
    settingsSchema.parse({ ...initialSettings("sine"), sinePeriod: 0 }),
  ).toThrow();
  expect(() =>
    settingsSchema.parse({
      ...initialSettings("quartic"),
      parameters: initialSettings("line").parameters,
    }),
  ).toThrow();
  request.dataset.rows = request.dataset.rows.map((r) => ({ ...r, x: 1 }));
  expect(() => fit(request, initialSettings("quartic"))).toThrow(
    /Rank deficient/,
  );
});
