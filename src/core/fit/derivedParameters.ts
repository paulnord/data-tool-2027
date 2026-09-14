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
  const scale = Math.max(1, Math.abs(sine), Math.abs(cosine));
  const zeroAmplitude = amplitude <= 64 * Number.EPSILON * scale;
  const size = result.coefficients.length;
  const amplitudeGradient = Array(size).fill(0) as number[];
  const phaseGradient = Array(size).fill(0) as number[];
  if (!zeroAmplitude) {
    amplitudeGradient[1] = sine / amplitude;
    amplitudeGradient[2] = cosine / amplitude;
    phaseGradient[1] = -cosine / (amplitude * amplitude);
    phaseGradient[2] = sine / (amplitude * amplitude);
  }
  const period =
    settings.model === "sine"
      ? (settings.sinePeriod ?? 2 * Math.PI)
      : result.coefficients[3];
  const frequencyGradient = Array(size).fill(0) as number[];
  if (settings.model !== "sine") frequencyGradient[3] = -1 / (period * period);
  const xUnit = request.dataset.xColumn.unit;
  return [
    {
      id: "amplitude",
      label: "Amplitude A = √(s² + c²)",
      value: amplitude,
      unit: request.dataset.yColumn.unit ?? "?",
      standardError: zeroAmplitude
        ? { value: null, reason: "zero-amplitude" }
        : propagated(amplitudeGradient, settings, result),
    },
    {
      id: "phase",
      label: "Phase φ = atan2(c, s)",
      value: zeroAmplitude ? null : Math.atan2(cosine, sine),
      unit: "rad",
      standardError: zeroAmplitude
        ? { value: null, reason: "zero-amplitude" }
        : propagated(phaseGradient, settings, result),
    },
    {
      id: "frequency",
      label: "Frequency f = 1/T",
      value: 1 / period,
      unit: xUnit ? `1/${xUnit}` : "1/(x unit)",
      standardError:
        settings.model === "sine"
          ? { value: null, reason: "fixed" }
          : propagated(frequencyGradient, settings, result),
    },
  ];
}
