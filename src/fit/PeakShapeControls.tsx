import type { FitSettings } from "../core/fit/schema";
import { peakShapeEnabled, withPeakShape } from "../core/fit/peakShapeSettings";

export function PeakShapeControls({
  settings,
  onChange,
  labelPrefix = "",
  advancedFeatures = false,
}: {
  settings: FitSettings;
  onChange: (settings: FitSettings) => void;
  labelPrefix?: string;
  advancedFeatures?: boolean;
}) {
  if (settings.model !== "gaussian" && settings.model !== "gaussian-shape")
    return null;
  if (!advancedFeatures && settings.model !== "gaussian-shape") return null;
  return (
    <div
      className="peak-shape-controls"
      role="group"
      aria-label={`${labelPrefix}Peak shape`}
    >
      {(["skew", "tail"] as const).map((option) => {
        const label =
          option === "skew" ? "Allow skew" : "Adjust tail shape (kurtosis)";
        return (
          <label key={option} className="fit-check">
            <input
              type="checkbox"
              aria-label={`${labelPrefix}${label}`}
              checked={peakShapeEnabled(settings, option)}
              onChange={(event) =>
                onChange(withPeakShape(settings, option, event.target.checked))
              }
            />
            {label}
          </label>
        );
      })}
      <p className="fit-help">
        Both off gives an ordinary Gaussian. Each enabled option adds one
        adjustable shape parameter.
      </p>
    </div>
  );
}
