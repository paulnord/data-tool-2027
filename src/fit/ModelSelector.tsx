import type { FitSettings } from "../core/fit/schema";
import { polynomialDegree, polynomialIds } from "../core/fit/polynomialModels";

const groups: { label: string; models: [FitSettings["model"], string][] }[] = [
  {
    label: "Exponentials",
    models: [
      ["exponential-decay", "Exponential decay"],
      ["exponential-growth", "Exponential growth"],
    ],
  },
  {
    label: "Powers and logarithms",
    models: [
      ["power-law-free", "Power law · fit exponent"],
      ["power-law", "Power law · supplied exponent"],
      ["reciprocal", "Reciprocal"],
      ["logarithmic", "Logarithmic"],
    ],
  },
  {
    label: "Oscillations",
    models: [
      ["sine-free-period", "Sinusoid"],
      ["damped-sine", "Damped oscillation"],
    ],
  },
  {
    label: "Peaks and transitions",
    models: [
      ["gaussian", "Gaussian peak"],
      ["lorentzian", "Lorentzian peak"],
      ["sigmoid", "Sigmoid · logistic"],
    ],
  },
];
export function modelLabel(model: string): string {
  const degree = polynomialDegree(model);
  if (degree !== undefined) return `Polynomial · degree ${degree}`;
  return (
    groups.flatMap((g) => g.models).find(([id]) => id === model)?.[1] ??
    (
      {
        line: "Straight line",
        custom: "Custom equation",
        sine: "Sinusoid · saved fixed period",
        exponential: "Exponential · saved fixed rate",
        "constant-acceleration": "Constant acceleration · saved model",
      } as Record<string, string>
    )[model] ??
    model
  );
}

/** Shared organization for main, comparison and interval equation controls. */
export function ModelSelector({
  label,
  ariaLabel = label,
  value,
  onChange,
  workspaces = false,
}: {
  label: string;
  ariaLabel?: string;
  value: string;
  onChange: (value: string) => void;
  workspaces?: boolean;
}) {
  const degree = polynomialDegree(value);
  return (
    <>
      <label>
        {label}
        <select
          aria-label={ariaLabel}
          value={degree ? "polynomial" : value}
          onChange={(e) =>
            onChange(
              e.target.value === "polynomial" ? "quadratic" : e.target.value,
            )
          }
        >
          <option value="line">Straight line</option>
          <option value="polynomial">Polynomial…</option>
          <option value="custom">Custom equation…</option>
          {groups.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.models.map(([model, name]) => (
                <option key={model} value={model}>
                  {name}
                </option>
              ))}
              {group.label === "Oscillations" && value === "sine" && (
                <option value="sine">Sinusoid · saved fixed period</option>
              )}
              {group.label === "Exponentials" && value === "exponential" && (
                <option value="exponential">
                  Exponential · saved fixed rate
                </option>
              )}
            </optgroup>
          ))}
          {value === "constant-acceleration" && (
            <option value="constant-acceleration">
              Constant acceleration · saved model
            </option>
          )}
          {workspaces && (
            <optgroup label="Analysis workspaces">
              <option value="multi-interval">Multi-interval fit…</option>
              <option value="collision">Collision · before and after</option>
              <option value="model-comparison">Model comparison…</option>
            </optgroup>
          )}
        </select>
      </label>
      {degree !== undefined && (
        <label>
          Polynomial degree
          <select
            aria-label={`${ariaLabel} polynomial degree`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          >
            {polynomialIds.map((model, i) => (
              <option key={model} value={model}>
                {i + 2}
                {i < 4
                  ? ` — ${["quadratic", "cubic", "quartic", "quintic"][i]}`
                  : ""}
              </option>
            ))}
          </select>
        </label>
      )}
    </>
  );
}
