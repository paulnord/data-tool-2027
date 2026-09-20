import type { FitWorkspace } from "../core/fit/schema";
import type { Ref } from "react";

export type AnalysisTool = FitWorkspace["kind"];

export function AnalysisTools({
  value,
  onChange,
  selectRef,
  advancedFeatures = false,
}: {
  value: AnalysisTool;
  onChange: (value: AnalysisTool) => void;
  selectRef?: Ref<HTMLSelectElement>;
  advancedFeatures?: boolean;
}) {
  const showAdditionalTools = advancedFeatures || value !== "single-fit";
  return (
    <label className="fit-analysis-tools">
      Analysis tools
      <select
        ref={selectRef}
        aria-label="Analysis tools"
        value={value}
        onChange={(event) => onChange(event.target.value as AnalysisTool)}
      >
        <option value="single-fit">Single fit</option>
        {showAdditionalTools && (
          <optgroup label="Additional analysis tools">
            {(advancedFeatures || value === "model-comparison") && (
              <option value="model-comparison">Model comparison</option>
            )}
            {(advancedFeatures || value === "multi-interval") && (
              <option value="multi-interval">Multi-interval fit</option>
            )}
            {(advancedFeatures || value === "collision") && (
              <option value="collision">Collision · before and after</option>
            )}
          </optgroup>
        )}
      </select>
      {!advancedFeatures && value === "single-fit" && (
        <span className="fit-analysis-discovery">
          More analyses: Settings → Advanced features
        </span>
      )}
    </label>
  );
}
