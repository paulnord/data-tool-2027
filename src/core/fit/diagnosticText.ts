import type { FitRequest } from "./schema";

/** Presentation only: stable diagnostic codes remain in fit results and sessions. */
const statisticReasons: Readonly<Record<string, string>> = {
  fixed: "Fixed parameter",
  "supplied-uncertainty":
    "Uses supplied absolute y uncertainty instead of residual-estimated scatter",
  "unknown-noise-scale": "No absolute y uncertainty was supplied",
  "unsupported-assumptions":
    "Required inference assumptions are unconfirmed or contradicted",
  "zero-degrees-of-freedom": "No residual degrees of freedom",
  "zero-residual-scale":
    "Residual scatter is zero; uncertainty cannot be estimated reliably",
  "zero-variance": "The included y values have zero computed variance",
  "nonlinear-reference-distribution":
    "An exact chi-square reference distribution is not available for this nonlinear fit",
  "period-at-search-boundary":
    "The best period is at a search limit; widen or reconsider the range",
  "competing-period-minima":
    "Several periods fit similarly; the period is ambiguous",
  "invalid-band-variance":
    "The confidence band variance is invalid or outside the numeric range",
  "band-overflow": "The confidence band exceeds the numeric range",
  "zero-amplitude":
    "The fitted oscillation amplitude is zero; phase and linearized uncertainty are undefined",
  "nonfinite-derived-quantity":
    "The derived quantity exceeds the numeric range",
  "nonfinite-derived-gradient":
    "The sensitivity of the derived quantity exceeds the numeric range",
  "covariance-unavailable": "The fitted parameter covariance is unavailable",
  "invalid-propagated-variance":
    "The propagated variance is invalid or outside the numeric range",
  "peak-moments-unresolved":
    "Peak moment integration did not converge within the numerical tolerance",
  "zero-derived-gradient":
    "First-order sensitivity vanishes; a reliable local standard error is unavailable",
  "zero-peak-amplitude":
    "A zero-height peak has no defined normalized shape moments",
};

/** Keep an unfamiliar code visible rather than inventing an explanation for it. */
export function statisticReasonText(reason: string | null | undefined): string {
  if (!reason) return "Unavailable";
  return Object.hasOwn(statisticReasons, reason)
    ? statisticReasons[reason]
    : reason;
}

export function errorStructureText(
  structure: FitRequest["uncertainty"]["errorStructure"],
): string {
  return {
    uncorrelated: "Uncorrelated",
    "known-correlated": "Known correlations",
    unknown: "Unknown",
  }[structure];
}
