import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { initialSettings, sessionSchema } from "../../src/core/fit/schema";
import { fit, predict } from "../../src/core/fit/solve";
import { fitReportTable } from "../../src/core/fit/report";
import { fitDerivedQuantities } from "../../src/core/fit/derivedParameters";
import { modelGuideValues } from "../../src/core/fit/modelGuides";
import {
  MOYAL_FWHM,
  MOYAL_HALF_MAX_LEFT,
  MOYAL_HALF_MAX_RIGHT,
  moyalValueDerivative,
} from "../../src/core/fit/moyal";
import {
  LANDAU_FWHM,
  LANDAU_HALF_MAX_LEFT,
  LANDAU_HALF_MAX_RIGHT,
  landauValueDerivative,
} from "../../src/core/fit/landau";

for (const model of ["moyal", "landau"] as const) {
  const [factor, leftFactor, rightFactor, density] =
    model === "moyal"
      ? ([
          MOYAL_FWHM,
          MOYAL_HALF_MAX_LEFT,
          MOYAL_HALF_MAX_RIGHT,
          moyalValueDerivative,
        ] as const)
      : ([
          LANDAU_FWHM,
          LANDAU_HALF_MAX_LEFT,
          LANDAU_HALF_MAX_RIGHT,
          landauValueDerivative,
        ] as const);
  it(`${model} reports FWHM with width uncertainty, units, fixed and unavailable states`, () => {
    const { request, settings } = sessionSchema.parse(
      JSON.parse(readFileSync(`examples/data/${model}.trksess`, "utf8")),
    );
    const result = fit(request, settings);
    const quantity = fitDerivedQuantities(request, settings, result)[0];
    expect(quantity.id).toBe("fwhm");
    expect(quantity.unit).toBe(request.dataset.xColumn.unit);
    expect(fitReportTable(request, settings, result)).toContainEqual([
      quantity.label,
      quantity.value,
      request.dataset.xColumn.unit,
      quantity.standardError.value,
    ]);
    expect(quantity.value).toBeCloseTo(factor * result.coefficients[3], 12);
    expect(quantity.standardError.value).toBeCloseTo(
      factor * result.standardErrors[3].value!,
      12,
    );
    settings.parameters[3].fixed = true;
    expect(
      fitDerivedQuantities(request, settings, fit(request, settings))[0]
        .standardError.reason,
    ).toBe("fixed");
    settings.parameters[3].fixed = false;
    expect(
      fitDerivedQuantities(request, settings, {
        ...result,
        covariance: null,
      })[0].standardError.value,
    ).toBeNull();
    expect(
      fitDerivedQuantities(request, settings, {
        ...result,
        coefficients: [1, 0, 50, 5],
      })[0],
    ).toMatchObject({
      value: null,
      standardError: { reason: "zero-peak-amplitude" },
    });
  });

  it(`${model} places asymmetric FWHM boundaries at half height above any background, including dips`, () => {
    const settings = initialSettings(model);
    for (const z of [leftFactor, rightFactor])
      expect(density(z).value / density(0).value).toBeCloseTo(0.5, 13);
    for (const b of [0, 20])
      for (const A of [-150, 150]) {
        const p = [b, A, 50, 5];
        const guides = modelGuideValues(0, settings, p);
        const left = guides.find((g) => g.id === "half-max-left")!.value;
        const right = guides.find((g) => g.id === "half-max-right")!.value;
        const half = guides.find((g) => g.id === "half-height")!.value;
        expect(left).toBeLessThan(p[2]);
        expect(right).toBeGreaterThan(p[2]);
        expect(right - left).toBeCloseTo(factor * p[3], 12);
        for (const x of [left, right])
          expect(predict(x, model, p)).toBeCloseTo(half, 12);
        expect(half - b).toBeCloseTo((predict(p[2], model, p) - b) / 2, 12);
      }
    expect(
      modelGuideValues(0, settings, [0, 0, 50, 5]).map((g) => g.id),
    ).toEqual(["center"]);
  });
}
