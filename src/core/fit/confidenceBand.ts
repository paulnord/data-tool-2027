import type { FitRequest, FitSettings } from "./schema";
import { modelGradient, predict, type FitResult } from "./solve";
import { studentCritical95 } from "./probability";
export interface MeanBandPoint {
  x: number;
  mean: number;
  standardError: number;
  lower: number;
  upper: number;
}
export interface MeanBand {
  points: MeanBandPoint[];
  reason: string | null;
}
/** Pointwise 95% intervals for the mean response, not simultaneous coverage of
 * the whole curve and not prediction intervals for new noisy measurements.
 * Var[f(x)] = phi(x)^T C phi(x), including all covariance cross terms.
 * Known absolute sigma uses z; residual-estimated sigma uses Student t(nu).
 * Validity is conditional on the model, fixed assertions and selection; the
 * covariance does not include model mismatch, x errors or selection uncertainty.
 */
export function meanConfidenceBand(
  xs: readonly number[],
  request: FitRequest,
  settings: FitSettings,
  result: FitResult,
): MeanBand {
  if (result.inference === "descriptive" || result.covariance === null)
    return {
      points: [],
      reason:
        result.standardErrors.find((e) => e.reason && e.reason !== "fixed")
          ?.reason ?? "unsupported-assumptions",
    };
  const known = request.uncertainty.kind !== "unknown-equal";
  if (!known && result.df <= 0)
    return { points: [], reason: "zero-degrees-of-freedom" };
  const critical = known ? 1.959963984540054 : studentCritical95(result.df);
  const points: MeanBandPoint[] = [];
  for (const x of xs) {
    const phi = modelGradient(x, settings, result.coefficients);
    let variance = 0,
      magnitude = 0;
    for (let i = 0; i < phi.length; i++)
      for (let j = 0; j < phi.length; j++) {
        const term = phi[i] * result.covariance[i][j] * phi[j];
        variance += term;
        magnitude += Math.abs(term);
      }
    // Permit only cancellation-sized negative roundoff, never a materially
    // negative variance from invalid covariance. Overflow suppresses the band.
    if (
      !Number.isFinite(x + variance + magnitude) ||
      variance < -32 * Number.EPSILON * magnitude
    )
      return { points: [], reason: "invalid-band-variance" };
    const standardError = Math.sqrt(Math.max(0, variance)),
      mean = predict(
        x,
        settings.model,
        result.coefficients,
        settings.sinePeriod,
        settings.shape,
        settings.custom,
      ),
      halfWidth = critical * standardError;
    const lower = mean - halfWidth,
      upper = mean + halfWidth;
    if (![mean, lower, upper].every(Number.isFinite))
      return { points: [], reason: "band-overflow" };
    points.push({ x, mean, standardError, lower, upper });
  }
  return { points, reason: null };
}
