import type { FitSettings } from "./schema";
import { isNonlinearModel, nonlinearParameterUnit } from "./nonlinearModels";
import { polynomialDegree } from "./polynomialModels";
import type { PolynomialBasis } from "./seriesModels";

export function modelParameterUnit(
  settings: FitSettings,
  index: number,
  xUnit: string | null,
  yUnit: string | null,
): string {
  const x = xUnit ?? "?",
    y = yUnit ?? "?";
  if (settings.model === "custom") return settings.custom!.units[index] || "?";
  if (isNonlinearModel(settings.model))
    return nonlinearParameterUnit(settings.model, index, xUnit, yUnit);
  if (settings.model === "fourier") return y;
  if (
    polynomialDegree(settings.model) !== undefined &&
    settings.polynomialBasis?.kind === "chebyshev"
  )
    return y;
  if (settings.model === "sine-free-period" && index === 3) return x;
  if (settings.model === "reciprocal" && index === 1) return `(${y})·(${x})`;
  if (
    index === 0 ||
    [
      "logarithmic",
      "sine",
      "sine-free-period",
      "exponential",
      "power-law",
    ].includes(settings.model)
  )
    return y;
  return `${y}/${x}${index > 1 ? `^${index}` : ""}`;
}

export function modelNotationNote(
  model: string,
  polynomialBasis?: PolynomialBasis,
): string | null {
  if (polynomialDegree(model) !== undefined) {
    if (polynomialBasis?.kind === "taylor")
      return "Taylor coefficients are derivatives at the fixed expansion center; the degree-i term is cᵢ(x − center)ⁱ/i!. The center is model metadata, not a fitted parameter.";
    if (polynomialBasis?.kind === "chebyshev")
      return "Chebyshev coefficients multiply Tᵢ((x − center)/scale). The center and positive scale are fixed model metadata, not fitted parameters; all coefficients have y-units.";
  }
  if (model === "fourier")
    return "The period and origin are fixed model metadata, not fitted parameters. Each harmonic has fitted sine and cosine coefficients in y-units.";
  if (model === "gaussian-shape")
    return "Sinh–arcsinh peak: A is peak height above b, μ is peak position, and w is a positive width scale (not generally a standard deviation). zₘ is the mode of h. skew = 0 is symmetric; tail = 1 retains the Gaussian tail parameter, below 1 is heavier and above 1 lighter. Derived skewness and excess kurtosis describe the normalized peak, not measurement uncertainty.";
  if (model === "sine-free-period")
    return "T is the period in x-units. Fix T to use a supplied period. Amplitude and phase are derived from the fitted sine and cosine coefficients.";
  if (model === "sigmoid")
    return "The midpoint is x0; w is a positive transition width. Positive A gives a rising transition and negative A a falling transition.";
  if (model === "exponential-decay" || model === "exponential-growth")
    return "τ is a positive time constant in x-units. Fix τ to use a supplied value; fix b to zero when no offset is needed.";
  if (model === "logarithmic")
    return "Natural logarithm of the numerical x value in the selected unit; x must be positive. Changing the x unit changes the intercept.";
  if (model === "power-law" || model === "power-law-free")
    return "Powers use the numerical x value in the selected unit; x must be positive. Changing the x unit changes the amplitude.";
  if (model === "reciprocal")
    return "Positive x only. The coefficient a has units of y × x.";
  return null;
}
