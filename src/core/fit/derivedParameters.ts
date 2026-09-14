import type { FitRequest, FitSettings } from "./schema";
import type { FitResult, Statistic } from "./solve";

export interface DerivedQuantity {
  id: "amplitude" | "phase" | "frequency";
  label: string;
  value: number | null;
  unit: string;
  standardError: Statistic;
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
