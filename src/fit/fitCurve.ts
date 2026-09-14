import type { FitSettings } from "../core/fit/schema";
import { predict, type FitResult } from "../core/fit/solve";
import { plotScale } from "./plotScale";

export type CurvePoint = { x: number; y: number };
type Range = [number, number];

/** Display-only curves. Actual fitted observations define the supported span. */
export function sampleFittedCurve(
  settings: FitSettings,
  result: FitResult,
  domain: Range,
  logX = false,
) {
  const xs = result.residuals
    .map((point) => point.x)
    .filter((value) => Number.isFinite(value));
  const support: Range | null = xs.length
    ? [
        xs.reduce((lo, x) => Math.min(lo, x), Infinity),
        xs.reduce((hi, x) => Math.max(hi, x), -Infinity),
      ]
    : null;
  const baseline =
    settings.model === "damped-sine" && Number.isFinite(result.coefficients[0])
      ? result.coefficients[0]
      : null;
  let samplingUnavailable = false;
  const sample = (range: Range): CurvePoint[] => {
    const [lo, hi] = range;
    if (!(Number.isFinite(lo) && Number.isFinite(hi) && hi > lo)) return [];
    const period =
      settings.model === "sine"
        ? settings.sinePeriod
        : ["sine-free-period", "damped-sine"].includes(settings.model)
          ? result.coefficients[3]
          : null;
    const cycles = period === null ? 0 : (hi - lo) / (period ?? NaN);
    if (!Number.isFinite(cycles) || cycles < 0 || cycles > 800) {
      samplingUnavailable = true;
      return [];
    }
    const count = Math.max(160, Math.ceil(cycles * 40) + 1);
    const scale = plotScale(range, logX);
    // Uniform log sampling alone aliases oscillations at the high-X end.
    // Combine phase-resolving physical samples with display samples so the
    // compressed cycles and the broad low-X region are both represented.
    const sampleXs =
      logX && period !== null
        ? [
            ...new Set([
              ...Array.from(
                { length: count },
                (_, i) => lo + ((hi - lo) * i) / (count - 1),
              ),
              ...Array.from({ length: 160 }, (_, i) => scale.value(i / 159)),
            ]),
          ].sort((a, b) => a - b)
        : Array.from({ length: count }, (_, i) => scale.value(i / (count - 1)));
    return sampleXs.map((x) => {
      return {
        x,
        y: predict(
          x,
          settings.model,
          result.coefficients,
          settings.sinePeriod,
          settings.shape,
          settings.custom,
        ),
      };
    });
  };
  if (!support || support[0] === support[1])
    return {
      support,
      fitted: [],
      before: [],
      after: [],
      baseline,
      samplingUnavailable,
    };
  // A log display must not redefine which observations supported the fit.
  // A span crossing zero has no finite logarithmic width, so use its X width
  // for the extension and clip it to the strictly positive viewing domain.
  const scale = plotScale(support, logX && support[0] > 0);
  const lower = Math.max(domain[0], scale.value(-0.1));
  const upper = Math.min(domain[1], scale.value(1.1));
  return {
    support,
    fitted: sample([
      Math.max(domain[0], support[0]),
      Math.min(domain[1], support[1]),
    ]),
    before: sample([lower, Math.min(domain[1], support[0])]),
    after: sample([Math.max(domain[0], support[1]), upper]),
    baseline,
    samplingUnavailable,
  };
}

/** Faint broken tails remain distinguishable across monochrome interval fits. */
export function extensionDash(index = 0) {
  return [
    "8 5",
    "8 4 1 4",
    "8 4 1 3 1 4",
    "8 4 1 3 1 3 1 4",
    "8 4 1 3 1 3 1 3 1 4",
  ][index % 5];
}
