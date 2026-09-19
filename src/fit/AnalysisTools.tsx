import type { FitWorkspace } from "../core/fit/schema";
import type { Ref } from "react";

export type AnalysisTool = FitWorkspace["kind"];

export function AnalysisTools({
  value,
  onChange,
  selectRef,
}: {
  value: AnalysisTool;
  onChange: (value: AnalysisTool) => void;
  selectRef?: Ref<HTMLSelectElement>;
}) {
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
