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
  if (!advancedFeatures) {
    return (
      <div className="fit-analysis-tools fit-analysis-tools-collapsed">
        {value === "single-fit" ? (
          <span className="fit-analysis-discovery">
            More analyses: Settings → Advanced features
          </span>
        ) : (
          <button type="button" onClick={() => onChange("single-fit")}>
            Back to single fit
          </button>
        )}
      </div>
    );
  }

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
        <optgroup label="Additional analysis tools">
          <option value="model-comparison">Model comparison</option>
          <option value="multi-interval">Multi-interval fit</option>
          <option value="collision">Collision · before and after</option>
        </optgroup>
      </select>
    </label>
  );
}
