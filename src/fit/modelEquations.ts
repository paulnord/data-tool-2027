import { polynomialExpressions } from "../core/fit/polynomialModels";
import {
  nonlinearModelIds,
  nonlinearModels,
} from "../core/fit/nonlinearModels";
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
