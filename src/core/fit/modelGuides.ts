import type { FitSettings } from "./schema";

export interface ModelGuideValue {
  id: string;
  label: string;
  value: number;
  /** Omitted for y(x) guides; vertical markers carry an x coordinate. */
  axis?: "x";
  /** Constant references get a compact legend entry. */
  symbol?: string;
}

/** Optional visual references supplied by a model, never additional fitted terms. */
export function modelGuideValues(
  x: number,
  settings: FitSettings,
  coefficients: readonly number[],
): ModelGuideValue[] {
  const baselineGuide: ModelGuideValue = {
    id: "baseline",
    label: "Fitted baseline y = b",
    value: coefficients[0],
    symbol: "b",
  };
  if (settings.model === "sine" || settings.model === "sine-free-period")
    return [baselineGuide];
  if (
    settings.model === "gaussian" ||
    settings.model === "lorentzian" ||
    settings.model === "gaussian-shape"
  )
    return [
      {
        id: "center",
        label: "Fitted peak center x = μ",
        value: coefficients[2],
        axis: "x",
        symbol: "μ",
      },
    ];
  if (settings.model === "sigmoid")
    return [
      {
        id: "center",
        label: "Fitted sigmoid midpoint x = x₀ (y = b + A/2)",
        value: coefficients[2],
        axis: "x",
        symbol: "x₀",
      },
      { ...baselineGuide, label: "Sigmoid asymptote y = b" },
      {
        id: "asymptote",
        label: "Sigmoid asymptote y = b + A",
        value: coefficients[0] + coefficients[1],
        symbol: "b + A",
      },
    ];
  if (settings.model !== "damped-sine") return [];
  const [baseline, sine, cosine, , decayTime] = coefficients;
  const envelope = Math.hypot(sine, cosine) * Math.exp(-x / decayTime);
  return [
    {
      id: "baseline",
      label: "Fitted baseline y = b",
      value: baseline,
      symbol: "b",
    },
    {
      id: "upper-envelope",
      label: "Positive fitted amplitude envelope",
      value: baseline + envelope,
    },
    {
      id: "lower-envelope",
      label: "Negative fitted amplitude envelope",
      value: baseline - envelope,
    },
  ];
}
