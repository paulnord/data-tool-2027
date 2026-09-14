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
