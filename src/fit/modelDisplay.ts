import { polynomialDegree } from "../core/fit/polynomialModels";
import { effectivePolynomialBasis } from "../core/fit/seriesModels";
import type { FitSettings } from "../core/fit/schema";
import { formatNumber } from "./formatNumber";
import { modelLabel } from "./ModelSelector";

/** Human-facing model name for comparison tables, legends, reports and print. */
export function modelDisplayName(settings: FitSettings): string {
  const degree = polynomialDegree(settings.model);
  if (degree === undefined) return modelLabel(settings.model);
  const basis = effectivePolynomialBasis(settings.polynomialBasis);
  if (basis.kind === "power")
    return `Polynomial · degree ${degree} · powers of x`;
  if (basis.kind === "taylor")
    return `Taylor polynomial · degree ${degree} · center ${formatNumber(basis.center)}`;
  return `Chebyshev polynomial · degree ${degree} · center ${formatNumber(basis.center)}, scale ${formatNumber(basis.scale)}`;
}
