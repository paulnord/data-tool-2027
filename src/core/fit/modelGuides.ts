import type { FitSettings } from "./schema";

export interface ModelGuideValue {
  id: string;
  label: string;
  value: number;
}

/** Optional visual references supplied by a model, never additional fitted terms. */
export function modelGuideValues(
  x: number,
  settings: FitSettings,
  coefficients: readonly number[],
): ModelGuideValue[] {
  if (settings.model !== "damped-sine") return [];
  const [baseline, sine, cosine, , decayTime] = coefficients;
  const envelope = Math.hypot(sine, cosine) * Math.exp(-x / decayTime);
  return [
    { id: "baseline", label: "Fitted baseline y = b", value: baseline },
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
