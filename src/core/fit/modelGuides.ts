import type { FitSettings } from "./schema";
import {
  MOYAL_HALF_MAX_LEFT,
  MOYAL_HALF_MAX_RIGHT,
  moyalValueDerivative,
} from "./moyal";

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
  if (settings.model === "landau" || settings.model === "moyal")
    return [
      {
        id: "center",
        label: `Fitted ${settings.model === "moyal" ? "Moyal" : "Landau"} peak x = mpv`,
        value: coefficients[2],
        axis: "x",
        symbol: "mpv",
      },
      ...(settings.model === "moyal" &&
      coefficients[1] !== 0 &&
      coefficients[3] > 0
        ? [
            {
              id: "half-max-left",
              label: "Left half-height crossing (FWHM boundary)",
              value: coefficients[2] + MOYAL_HALF_MAX_LEFT * coefficients[3],
              axis: "x" as const,
              symbol: "x½ left",
            },
            {
              id: "half-max-right",
              label: "Right half-height crossing (FWHM boundary)",
              value: coefficients[2] + MOYAL_HALF_MAX_RIGHT * coefficients[3],
              axis: "x" as const,
              symbol: "x½ right",
            },
            {
              id: "half-height",
              label: "Half peak height relative to fitted background",
              value:
                coefficients[0] +
                ((coefficients[1] / coefficients[3]) *
                  moyalValueDerivative(0).value) /
                  2,
              symbol: "y½",
            },
          ]
        : []),
    ];
  if (
    settings.model === "sine" ||
    settings.model === "sine-free-period" ||
    settings.model === "fourier"
  )
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
