import { describe, expect, it } from "vitest";
import { meanConfidenceBand } from "../../src/core/fit/confidenceBand";
import { customFromModel } from "../../src/core/fit/customFromModel";
import { tableForAnalysis } from "../../src/core/fit/dataTable";
import { modelParameterUnit } from "../../src/core/fit/modelNotation";
import { fitReportTsv } from "../../src/core/fit/report";
import {
  createSession,
  initialSettings,
  parameterNames,
  sessionSchema,
  settingsSchema,
} from "../../src/core/fit/schema";
import {
  effectivePolynomialBasis,
  fourierBasisValues,
  fourierParameterNames,
  polynomialBasisValues,
} from "../../src/core/fit/seriesModels";
import { fit, predict } from "../../src/core/fit/solve";
import { syntheticRequest } from "../support/synthetic";

describe("advanced linear-series bases", () => {
  it("evaluates Taylor, Chebyshev, and Fourier bases by their declared metadata", () => {
    expect(polynomialBasisValues(4, 3, { kind: "taylor", center: 2 })).toEqual([
      1,
      2,
      2,
      4 / 3,
    ]);
    const chebyshev = polynomialBasisValues(2, 4, {
      kind: "chebyshev",
      center: 1,
      scale: 2,
    });
    expect(chebyshev).toEqual([1, 0.5, -0.5, -1, -0.5]);
    const fourier = fourierBasisValues(2.25, {
      harmonics: 2,
      period: 4,
      origin: 1.25,
    });
    expect(fourier[0]).toBe(1);
    expect(fourier[1]).toBeCloseTo(1, 14);
    expect(fourier[2]).toBeCloseTo(0, 14);
    expect(fourier[3]).toBeCloseTo(0, 14);
    expect(fourier[4]).toBeCloseTo(-1, 14);

    const tinyPeriod = {
      harmonics: 1 as const,
      period: 2 ** -20,
      origin: 0,
    };
    const large = fourierBasisValues(2 ** 30, tinyPeriod),
      onePeriodLater = fourierBasisValues(
        2 ** 30 + tinyPeriod.period,
        tinyPeriod,
      );
    expect(large).toEqual([1, 0, 1]);
    expect(onePeriodLater).toEqual(large);

    const overflowScale = fourierBasisValues(5e307, {
      harmonics: 1,
      period: 1e308,
      origin: 0,
    });
    expect(overflowScale.every(Number.isFinite)).toBe(true);
    expect(overflowScale[1]).toBeCloseTo(0, 14);
    expect(overflowScale[2]).toBeCloseTo(-1, 14);

    expect(
      fourierBasisValues(1e308, {
        harmonics: 1,
        period: 1e308,
        origin: -1e308,
      }),
    ).toEqual([1, 0, 1]);
  });

  it("keeps representable Taylor and scaled Chebyshev values finite", () => {
    expect(
      polynomialBasisValues(1.8e154, 2, { kind: "taylor", center: 0 }),
    ).toEqual([1, 1.8e154, 1.62e308]);
    expect(
      polynomialBasisValues(1e308, 2, {
        kind: "chebyshev",
        center: -1e308,
        scale: 1e308,
      }),
    ).toEqual([1, 2, 7]);
  });

  it("keeps equal-degree polynomial representations in one model family", () => {
    const request = syntheticRequest();
    request.dataset.rows = Array.from({ length: 41 }, (_, i) => {
      const x = -1.5 + i / 10;
      const deterministicNoise = 0.015 * Math.sin(i * 1.7);
      return {
        id: String(i),
        x,
        y:
          1.2 -
          0.7 * x +
          0.3 * x ** 2 -
          0.08 * x ** 3 +
          0.025 * x ** 4 +
          deterministicNoise,
        included: true,
        missingReason: null,
      };
    });
    const settings = [
      { ...initialSettings("quartic"), polynomialBasis: { kind: "power" } },
      {
        ...initialSettings("quartic"),
        polynomialBasis: { kind: "taylor", center: 0.4 } as const,
      },
      {
        ...initialSettings("quartic"),
        polynomialBasis: {
          kind: "chebyshev",
          center: 0.5,
          scale: 2,
        } as const,
      },
    ].map((value) => settingsSchema.parse(value));
    const results = settings.map((setting) => fit(request, setting));

    expect(settings.map((setting) => setting.model)).toEqual([
      "quartic",
      "quartic",
      "quartic",
    ]);
    results
      .slice(1)
      .forEach((result) => expect(result.sse).toBeCloseTo(results[0].sse, 12));
    for (const x of [-1.8, -0.75, 0, 0.9, 2.3, 2.8]) {
      const predictions = results.map((result, i) =>
        predict(
          x,
          settings[i].model,
          result.coefficients,
          settings[i].sinePeriod,
          settings[i].shape,
          settings[i].custom,
          settings[i].polynomialBasis,
          settings[i].fourier,
        ),
      );
      expect(predictions[1]).toBeCloseTo(predictions[0], 11);
      expect(predictions[2]).toBeCloseTo(predictions[0], 11);
    }
  });

  it("persists fixed polynomial metadata while accepting legacy v7 power settings", () => {
    const request = syntheticRequest();
    const chebyshev = settingsSchema.parse({
      ...initialSettings("cubic"),
      polynomialBasis: { kind: "chebyshev", center: 12.5, scale: 3.25 },
    });
    const session = createSession({ request, settings: chebyshev });
    expect(
      sessionSchema.parse(JSON.parse(JSON.stringify(session))).settings
        .polynomialBasis,
    ).toEqual({ kind: "chebyshev", center: 12.5, scale: 3.25 });
    const before = JSON.stringify(chebyshev.polynomialBasis);
    fit(request, chebyshev);
    expect(JSON.stringify(chebyshev.polynomialBasis)).toBe(before);

    const implicitPower = initialSettings("quadratic");
    expect(implicitPower.polynomialBasis).toBeUndefined();
    expect(settingsSchema.parse(implicitPower).polynomialBasis).toBeUndefined();
    expect(effectivePolynomialBasis(implicitPower.polynomialBasis)).toEqual({
      kind: "power",
    });
  });

  it("canonicalizes explicit power metadata throughout newly saved v7 sessions", () => {
    const request = syntheticRequest();
    const explicitPower = settingsSchema.parse({
      ...initialSettings("quadratic"),
      polynomialBasis: { kind: "power" },
    });
    const taylor = settingsSchema.parse({
      ...initialSettings("quadratic"),
      polynomialBasis: { kind: "taylor", center: 0.5 },
    });

    const single = createSession({ request, settings: explicitPower });
    expect(single.settings.polynomialBasis).toBeUndefined();
    const importedExplicitPower = sessionSchema.parse({
      ...single,
      settings: explicitPower,
    });
    expect(importedExplicitPower.settings.polynomialBasis).toEqual({
      kind: "power",
    });

    const dataTable = tableForAnalysis({ request, settings: explicitPower });
    const multi = createSession(
      { request, settings: explicitPower, dataTable },
      {
        kind: "multi-interval",
        x: 0,
        columns: [1],
        uncertainty: "estimate",
        sigmas: [null],
        conditional: false,
        intervals: [
          {
            name: "All observations",
            range: null,
            settings: [explicitPower],
          },
        ],
        intervalCount: 1,
        activeInterval: 0,
        activeCurve: 0,
        xRange: null,
        yRanges: [null],
        includeDetails: false,
      },
    );
    expect(multi.settings.polynomialBasis).toBeUndefined();
    expect(multi.workspace.kind).toBe("multi-interval");
    if (multi.workspace.kind !== "multi-interval")
      throw Error("Wrong workspace");
    expect(
      multi.workspace.intervals[0].settings[0].polynomialBasis,
    ).toBeUndefined();

    const comparison = createSession(
      { request, settings: explicitPower, dataTable },
      {
        kind: "model-comparison",
        candidates: [
          {
            label: "Power",
            analysis: {
              request,
              settings: explicitPower,
              engine: "qr-vp-sine-2",
            },
          },
          {
            label: "Taylor",
            analysis: {
              request,
              settings: taylor,
              engine: "qr-vp-sine-2",
            },
          },
        ],
        activeCandidate: 0,
      },
    );
    expect(comparison.workspace.kind).toBe("model-comparison");
    if (comparison.workspace.kind !== "model-comparison")
      throw Error("Wrong workspace");
    expect(
      comparison.workspace.candidates[0].analysis.settings.polynomialBasis,
    ).toBeUndefined();
    expect(
      comparison.workspace.candidates[1].analysis.settings.polynomialBasis,
    ).toEqual({ kind: "taylor", center: 0.5 });
    expect(explicitPower.polynomialBasis).toEqual({ kind: "power" });
    expect(sessionSchema.parse(JSON.parse(JSON.stringify(comparison)))).toEqual(
      comparison,
    );
  });

  it("fits a fixed-period Fourier series without fitting its period or origin", () => {
    const request = syntheticRequest();
    const declared = { harmonics: 3 as const, period: 4.5, origin: 1.25 };
    const truth = [1.1, 0.8, -0.2, 0.35, 0.5, -0.12, 0.09];
    request.dataset.rows = Array.from({ length: 90 }, (_, i) => {
      const x = -2 + i * 0.1;
      return {
        id: String(i),
        x,
        y: fourierBasisValues(x, declared).reduce(
          (sum, value, j) => sum + value * truth[j],
          0,
        ),
        included: true,
        missingReason: null,
      };
    });
    const settings = settingsSchema.parse({
      ...initialSettings("fourier"),
      fourier: declared,
      parameters: truth.map(() => ({ value: 0, fixed: false })),
    });
    const before = JSON.stringify(settings.fourier);
    const result = fit(request, settings);
    result.coefficients.forEach((value, i) =>
      expect(value).toBeCloseTo(truth[i], 11),
    );
    expect(result.rank).toBe(7);
    expect(result.engine).toBe("qr-vp-sine-2");
    expect(JSON.stringify(settings.fourier)).toBe(before);
    const x = 0.37;
    expect(
      predict(
        x + declared.period,
        "fourier",
        result.coefficients,
        undefined,
        undefined,
        undefined,
        undefined,
        declared,
      ),
    ).toBeCloseTo(
      predict(
        x,
        "fourier",
        result.coefficients,
        undefined,
        undefined,
        undefined,
        undefined,
        declared,
      ),
      12,
    );
    const band = meanConfidenceBand([0, 1], request, settings, result);
    expect(band.reason).toBeNull();
    expect(band.points).toHaveLength(2);
  });

  it("validates series metadata and its parameter count strictly", () => {
    const fourier = initialSettings("fourier");
    expect(fourierParameterNames(5)).toEqual([
      "b",
      "s1",
      "c1",
      "s2",
      "c2",
      "s3",
      "c3",
      "s4",
      "c4",
      "s5",
      "c5",
    ]);
    expect(parameterNames("fourier", undefined, fourier.fourier)).toEqual([
      "b",
      "s1",
      "c1",
    ]);
    expect(
      settingsSchema.safeParse({ ...fourier, fourier: undefined }).success,
    ).toBe(false);
    expect(
      settingsSchema.safeParse({
        ...fourier,
        fourier: { harmonics: 6, period: 2, origin: 0 },
      }).success,
    ).toBe(false);
    expect(
      settingsSchema.safeParse({
        ...fourier,
        fourier: { harmonics: 2, period: 2, origin: 0 },
      }).success,
    ).toBe(false);
    expect(
      settingsSchema.safeParse({
        ...initialSettings("line"),
        polynomialBasis: { kind: "power" },
      }).success,
    ).toBe(false);
    expect(
      settingsSchema.safeParse({
        ...initialSettings("quadratic"),
        polynomialBasis: { kind: "chebyshev", center: 0, scale: 0 },
      }).success,
    ).toBe(false);
  });

  it("reports representation metadata, equations, and basis-aware units", () => {
    const request = syntheticRequest();
    const chebyshev = settingsSchema.parse({
      ...initialSettings("quadratic"),
      polynomialBasis: { kind: "chebyshev", center: 1, scale: 2 },
    });
    const chebyshevResult = fit(request, chebyshev);
    const report = fitReportTsv(request, chebyshev, chebyshevResult);
    expect(report).toContain("Polynomial representation\tchebyshev");
    expect(report).toContain("Fixed basis center\t1");
    expect(report).toContain("Fixed basis scale\t2");
    expect(modelParameterUnit(chebyshev, 2, "s", "m")).toBe("m");

    const taylor = settingsSchema.parse({
      ...initialSettings("quadratic"),
      polynomialBasis: { kind: "taylor", center: 1 },
    });
    expect(modelParameterUnit(taylor, 2, "s", "m")).toBe("m/s^2");

    const fourier = initialSettings("fourier");
    const fourierResult = fit(request, fourier);
    const fourierReport = fitReportTsv(request, fourier, fourierResult);
    expect(fourierReport).toContain("Fourier harmonics\t1");
    expect(fourierReport).toContain("Fixed Fourier origin\t0");
    expect(modelParameterUnit(fourier, 2, "s", "m")).toBe("m");
  });

  it("converts supported Taylor, Chebyshev, and Fourier forms to custom equations", () => {
    const request = syntheticRequest();
    for (const settings of [
      settingsSchema.parse({
        ...initialSettings("quadratic"),
        polynomialBasis: { kind: "taylor", center: 0.25 },
      }),
      settingsSchema.parse({
        ...initialSettings("quadratic"),
        polynomialBasis: { kind: "chebyshev", center: 0.25, scale: 1.5 },
      }),
      settingsSchema.parse({
        ...initialSettings("polynomial-7"),
        polynomialBasis: { kind: "chebyshev", center: -12.25, scale: 3.5 },
      }),
      initialSettings("fourier"),
    ]) {
      const coefficients = settings.parameters.map((_, i) => i + 0.5);
      const custom = customFromModel(settings, request, coefficients);
      const customCoefficients = custom.parameters.map(
        (parameter) => parameter.value,
      );
      expect(custom.custom!.expression.length).toBeLessThanOrEqual(1000);
      for (const x of [-0.7, 0, 1.1])
        expect(
          predict(
            x,
            "custom",
            customCoefficients,
            undefined,
            undefined,
            custom.custom,
          ),
        ).toBeCloseTo(
          predict(
            x,
            settings.model,
            coefficients,
            settings.sinePeriod,
            settings.shape,
            settings.custom,
            settings.polynomialBasis,
            settings.fourier,
          ),
          8,
        );
    }

    const fourier = settingsSchema.parse({
      ...initialSettings("fourier"),
      fourier: { harmonics: 1, period: 2 ** -20, origin: 0 },
    });
    const coefficients = [0.5, 1.25, -0.75];
    const custom = customFromModel(fourier, request, coefficients);
    expect(custom.custom!.expression).toContain("%");
    for (const x of [2 ** 30, 2 ** 30 + fourier.fourier!.period])
      expect(
        predict(x, "custom", coefficients, undefined, undefined, custom.custom),
      ).toBe(
        predict(
          x,
          "fourier",
          coefficients,
          undefined,
          undefined,
          undefined,
          undefined,
          fourier.fourier,
        ),
      );
  });

  it("converts Taylor series without overflowing an otherwise finite term", () => {
    const request = syntheticRequest();
    const settings = settingsSchema.parse({
      ...initialSettings("polynomial-7"),
      polynomialBasis: { kind: "taylor", center: 0 },
    });
    const coefficients = Array(8).fill(0) as number[];
    coefficients[7] = 1e-306;
    const custom = customFromModel(settings, request, coefficients);
    const x = 2e44;
    expect(custom.custom!.expression).not.toContain("^7");
    expect(
      predict(
        x,
        "custom",
        custom.parameters.map((parameter) => parameter.value),
        undefined,
        undefined,
        custom.custom,
      ),
    ).toBeCloseTo(
      predict(
        x,
        settings.model,
        coefficients,
        settings.sinePeriod,
        settings.shape,
        settings.custom,
        settings.polynomialBasis,
      ),
      12,
    );
  });

  it("writes negative centers and origins as explicit additions", () => {
    const request = syntheticRequest();
    const settings = [
      settingsSchema.parse({
        ...initialSettings("quadratic"),
        polynomialBasis: { kind: "taylor", center: -1.25 },
      }),
      settingsSchema.parse({
        ...initialSettings("quadratic"),
        polynomialBasis: {
          kind: "chebyshev",
          center: -2.5,
          scale: 1.75,
        },
      }),
      settingsSchema.parse({
        ...initialSettings("fourier"),
        fourier: { harmonics: 1, period: 3.75, origin: -4.5 },
      }),
    ];
    for (const original of settings) {
      const coefficients = original.parameters.map((_, i) => i + 0.75);
      const custom = customFromModel(original, request, coefficients);
      const customCoefficients = custom.parameters.map(
        (parameter) => parameter.value,
      );
      expect(custom.custom!.expression).not.toContain("--");
      expect(custom.custom!.expression).toContain(
        original.model === "fourier" ? "%" : "x+",
      );
      for (const x of [-3, -0.5, 2])
        expect(
          predict(
            x,
            "custom",
            customCoefficients,
            undefined,
            undefined,
            custom.custom,
          ),
        ).toBeCloseTo(
          predict(
            x,
            original.model,
            coefficients,
            original.sinePeriod,
            original.shape,
            original.custom,
            original.polynomialBasis,
            original.fourier,
          ),
          10,
        );
    }
  });
});
