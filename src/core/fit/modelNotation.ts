import type { FitSettings } from "./schema";
import { isNonlinearModel, nonlinearParameterUnit } from "./nonlinearModels";

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

export function modelNotationNote(model: string): string | null {
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
