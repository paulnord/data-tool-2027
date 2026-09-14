import type { FitSettings } from "./schema";

export type PeakShapeOption = "skew" | "tail";
export function peakShapeEnabled(
  settings: FitSettings,
  option: PeakShapeOption,
) {
  if (settings.model !== "gaussian-shape") return false;
  const index = option === "skew" ? 4 : 5,
    normal = option === "skew" ? 0 : 1;
  return (
    !settings.parameters[index].fixed ||
    settings.parameters[index].value !== normal
  );
}

/** An unchecked option is fixed at the Gaussian value; other settings are preserved. */
export function withPeakShape(
  settings: FitSettings,
  option: PeakShapeOption,
  enabled: boolean,
): FitSettings {
  if (settings.model !== "gaussian" && settings.model !== "gaussian-shape")
    return settings;
  const parameters = settings.parameters.map((p) => ({ ...p }));
  if (settings.model === "gaussian")
    parameters.push({ value: 0, fixed: true }, { value: 1, fixed: true });
  const index = option === "skew" ? 4 : 5;
  parameters[index] = {
    value: enabled ? parameters[index].value : index === 4 ? 0 : 1,
    fixed: !enabled,
  };
  const next: FitSettings = {
    ...settings,
    model: "gaussian-shape",
    parameters,
  };
  return !peakShapeEnabled(next, "skew") && !peakShapeEnabled(next, "tail")
    ? { ...settings, model: "gaussian", parameters: parameters.slice(0, 4) }
    : next;
}
