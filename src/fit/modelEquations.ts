import { polynomialExpressions } from "../core/fit/polynomialModels";
import { polynomialDegree } from "../core/fit/polynomialModels";
import {
  nonlinearModelIds,
  nonlinearModels,
} from "../core/fit/nonlinearModels";
import type { FitSettings } from "../core/fit/schema";
import { effectivePolynomialBasis } from "../core/fit/seriesModels";
const digits = (value: number, alphabet: string) =>
  String(value).replace(/\d/g, (digit) => alphabet[Number(digit)]);
export const equations = {
  ...(Object.fromEntries(
    Object.entries(
      polynomialExpressions(
        (i) =>
          `c${digits(i, "₀₁₂₃₄₅₆₇₈₉")}${i ? ` x${i > 1 ? digits(i, "⁰¹²³⁴⁵⁶⁷⁸⁹") : ""}` : ""}`,
      ),
    ).map(([model, expression]) => [model, `y = ${expression}`]),
  ) as ReturnType<typeof polynomialExpressions>),
  ...(Object.fromEntries(
    nonlinearModelIds.map((m) => [m, nonlinearModels[m].equation]),
  ) as Record<(typeof nonlinearModelIds)[number], string>),
  line: "y = b + m x",
  sine: "y = b + s sin(2πx/T) + c cos(2πx/T)",
  "sine-free-period": "y = b + s sin(2πx/T) + c cos(2πx/T)",
  exponential: "y = b + a exp(kx)",
  "power-law": "y = b + a x^p",
  reciprocal: "y = b + a/x",
  logarithmic: "y = b + a ln(x)",
  "constant-acceleration": "y = y₀ + v₀ t + ½ a t²",
};

export function modelEquation(settings: FitSettings): string {
  const degree = polynomialDegree(settings.model);
  if (degree !== undefined) {
    const basis = effectivePolynomialBasis(settings.polynomialBasis);
    if (basis.kind === "taylor")
      return `y = Σᵢ₌₀${superscript(degree)} cᵢ (x − x₀)ⁱ/i!`;
    if (basis.kind === "chebyshev")
      return `y = Σᵢ₌₀${superscript(degree)} cᵢ Tᵢ((x − x₀)/s)`;
  }
  if (settings.model === "fourier")
    return `y = b + Σₖ₌₁${superscript(settings.fourier?.harmonics ?? 1)} [sₖ sin(2πk(x − x₀)/T) + cₖ cos(2πk(x − x₀)/T)]`;
  return equations[settings.model as keyof typeof equations] ?? settings.model;
}

function superscript(value: number): string {
  return String(value).replace(/\d/g, (digit) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[Number(digit)]);
}
