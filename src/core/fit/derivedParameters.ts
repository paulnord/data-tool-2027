import type { FitRequest, FitSettings } from "./schema";
import type { FitResult, Statistic } from "./solve";
import { gaussianShapeMoments } from "./gaussianShape";

export interface DerivedQuantity {
  id: "amplitude" | "phase" | "frequency" | "skewness" | "excessKurtosis";
  label: string;
  value: number | null;
  unit: string;
  standardError: Statistic;
}

export function fitDerivedQuantities(
  request: FitRequest,
  settings: FitSettings,
  result: FitResult,
): DerivedQuantity[] {
  if (settings.model !== "gaussian" && settings.model !== "gaussian-shape")
    return oscillationDerivedQuantities(request, settings, result);
  const shaped = settings.model === "gaussian-shape";
  const skew = shaped ? result.coefficients[4] : 0;
  const tail = shaped ? result.coefficients[5] : 1;
  const moments =
    result.coefficients[1] === 0 ? null : gaussianShapeMoments(skew, tail);
  return (["skewness", "excessKurtosis"] as const).map((id) => {
    const gradient = result.coefficients.map(() => 0);
    if (shaped && moments) {
      for (const index of [4, 5]) {
        if (settings.parameters[index].fixed) continue;
        const value = result.coefficients[index];
        const step =
          index === 5
            ? Math.min(value / 100, 1e-4 * Math.max(1, value))
            : 1e-4 * Math.max(1, Math.abs(value));
        const high = gaussianShapeMoments(
          skew + (index === 4 ? step : 0),
          tail + (index === 5 ? step : 0),
        );
        const low = gaussianShapeMoments(
          skew - (index === 4 ? step : 0),
          tail - (index === 5 ? step : 0),
        );
        gradient[index] = high && low ? (high[id] - low[id]) / (2 * step) : NaN;
      }
    }
    // Kurtosis is even in skew: zero first-order sensitivity at symmetry
    // does not mean the quantity is fixed when skew remains free.
    if (id === "excessKurtosis" && skew === 0 && shaped) gradient[4] = 0;
    const shapeFixed =
      !shaped ||
      (settings.parameters[4].fixed &&
        ((id === "skewness" && skew === 0) || settings.parameters[5].fixed));
    return {
      id,
      label:
        id === "skewness"
          ? "Peak skewness"
          : "Peak excess kurtosis (Gaussian = 0)",
      value: moments?.[id] ?? null,
      unit: "1",
      standardError: moments
        ? shapeFixed
          ? { value: null, reason: "fixed" }
          : gradient.every((v) => v === 0)
            ? { value: null, reason: "zero-derived-gradient" }
            : propagated(gradient, settings, result)
        : {
            value: null,
            reason:
              result.coefficients[1] === 0
                ? "zero-peak-amplitude"
                : "peak-moments-unresolved",
          },
    };
  });
}

function propagated(
  gradient: readonly number[],
  settings: FitSettings,
  result: FitResult,
): Statistic {
  if (gradient.some((value) => !Number.isFinite(value)))
    return { value: null, reason: "nonfinite-derived-gradient" };
  const involved = gradient.flatMap((value, i) => (value === 0 ? [] : [i]));
  if (!involved.length || involved.every((i) => settings.parameters[i].fixed))
    return { value: null, reason: "fixed" };
  if (!result.covariance) {
    const reason = involved
      .map((i) => result.standardErrors[i]?.reason)
      .find((value): value is string => !!value && value !== "fixed");
    return { value: null, reason: reason ?? "covariance-unavailable" };
  }
  let variance = 0;
  for (let i = 0; i < gradient.length; i++)
    for (let j = 0; j < gradient.length; j++)
      variance += gradient[i] * result.covariance[i][j] * gradient[j];
  if (!Number.isFinite(variance) || variance < -1e-12)
    return { value: null, reason: "invalid-propagated-variance" };
  return { value: Math.sqrt(Math.max(0, variance)), reason: null };
}

/** Amplitude/phase are reported rather than drawing origin-dependent sine/cosine parts. */
export function oscillationDerivedQuantities(
  request: FitRequest,
  settings: FitSettings,
  result: FitResult,
): DerivedQuantity[] {
  if (!["sine", "sine-free-period", "damped-sine"].includes(settings.model))
    return [];
  const [, sine, cosine] = result.coefficients;
  const amplitude = Math.hypot(sine, cosine);
  // A fixed cutoff in the Y unit would make phase availability depend on
  // whether the same observations are expressed in, for example, m or nm.
  const coefficientScale = Math.max(Math.abs(sine), Math.abs(cosine));
  const zeroAmplitude = coefficientScale === 0;
  const invalidOscillation = !Number.isFinite(coefficientScale);
  const size = result.coefficients.length;
  const amplitudeGradient = Array(size).fill(0) as number[];
  const phaseGradient = Array(size).fill(0) as number[];
  if (!zeroAmplitude && !invalidOscillation) {
    const scaledSine = sine / coefficientScale;
    const scaledCosine = cosine / coefficientScale;
    const squaredNorm = scaledSine ** 2 + scaledCosine ** 2;
    amplitudeGradient[1] = scaledSine / Math.sqrt(squaredNorm);
    amplitudeGradient[2] = scaledCosine / Math.sqrt(squaredNorm);
    phaseGradient[1] = -scaledCosine / squaredNorm / coefficientScale;
    phaseGradient[2] = scaledSine / squaredNorm / coefficientScale;
  }
  const period =
    settings.model === "sine"
      ? (settings.sinePeriod ?? 2 * Math.PI)
      : result.coefficients[3];
  const frequencyGradient = Array(size).fill(0) as number[];
  if (settings.model !== "sine") frequencyGradient[3] = -1 / period / period;
  const frequency = 1 / period;
  const xUnit = request.dataset.xColumn.unit;
  return [
    {
      id: "amplitude",
      label: "Amplitude A = √(s² + c²)",
      value: Number.isFinite(amplitude) ? amplitude : null,
      unit: request.dataset.yColumn.unit ?? "?",
      standardError: !Number.isFinite(amplitude)
        ? { value: null, reason: "nonfinite-derived-quantity" }
        : zeroAmplitude
          ? { value: null, reason: "zero-amplitude" }
          : propagated(amplitudeGradient, settings, result),
    },
    {
      id: "phase",
      label: "Phase φ = atan2(c, s)",
      value:
        zeroAmplitude || invalidOscillation ? null : Math.atan2(cosine, sine),
      unit: "rad",
      standardError: invalidOscillation
        ? { value: null, reason: "nonfinite-derived-quantity" }
        : zeroAmplitude
          ? { value: null, reason: "zero-amplitude" }
          : propagated(phaseGradient, settings, result),
    },
    {
      id: "frequency",
      label: "Frequency f = 1/T",
      value: Number.isFinite(frequency) ? frequency : null,
      unit: xUnit ? `1/${xUnit}` : "1/(x unit)",
      standardError: !Number.isFinite(frequency)
        ? { value: null, reason: "nonfinite-derived-quantity" }
        : settings.model === "sine"
          ? { value: null, reason: "fixed" }
          : propagated(frequencyGradient, settings, result),
    },
  ];
}
