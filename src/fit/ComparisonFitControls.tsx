import { formatNumber as display } from "./formatNumber";
import {
  modelParameterUnit,
  modelNotationNote,
} from "../core/fit/modelNotation";
import { equations } from "./modelEquations";
import { useCallback, useEffect, useState } from "react";
import {
  parameterNames,
  type FitRequest,
  type FitSettings,
  type FitSession,
} from "../core/fit/schema";
import type { FitResult } from "../core/fit/solve";
import { statisticReasonText } from "../core/fit/diagnosticText";
import { fitCorrelationMatrix, fitReportRows } from "../core/fit/report";
import { fitDerivedQuantities } from "../core/fit/derivedParameters";
import { EditableNumber } from "./EditableNumber";
import { CustomEquationEditor } from "./CustomEquationEditor";
import { PeakShapeControls } from "./PeakShapeControls";

export type ComparisonAnalysis = {
  request: FitRequest;
  settings: FitSettings;
  originalRequest?: FitRequest;
  dataTable?: FitSession["dataTable"];
};
export type ComparisonDraft = ComparisonAnalysis & { label: string };

export function weightingText(request: FitRequest) {
  const u = request.uncertainty;
  const unit = request.dataset.yColumn.unit ?? "Y units";
  if (u.kind === "unknown-equal")
    return "Equal weights: measurement σ is unknown; scatter is estimated from residuals. Supplied σ values, if retained, are not used.";
  if (u.kind === "supplied-common")
    return `Supplied common σ = ${display(u.sigmaY)} ${unit}; every included observation is fitted with weight 1/σ². The absolute σ scale is retained.`;
  return `Supplied per-observation σ (${unit}) is used in the fit: each included observation has weight 1/σᵢ². The absolute σ scale is retained.`;
}

export function CandidateSettings({
  draft,
  labelPrefix,
  result,
  onChange,
  onInvalid,
}: {
  draft: ComparisonDraft;
  labelPrefix: string;
  result?: FitResult;
  onChange: (draft: ComparisonDraft) => void;
  onInvalid: (invalid: boolean) => void;
}) {
  const [invalidNumbers, setInvalidNumbers] = useState<Record<string, boolean>>(
    {},
  );
  const [equationPending, setEquationPending] = useState(false);
  const pending = useCallback(
    (value: boolean) => setEquationPending(value),
    [],
  );
  const invalid =
    equationPending || Object.values(invalidNumbers).some(Boolean);
  useEffect(() => {
    onInvalid(invalid);
  }, [invalid, onInvalid]);
  useEffect(() => () => onInvalid(false), [onInvalid]);
  const settings = draft.settings;
  const names = parameterNames(settings.model, settings.custom);
  function update(patch: Partial<FitSettings>, useFit = false) {
    onChange({
      ...draft,
      settings: {
        ...settings,
        ...(useFit
          ? {
              parameters: settings.parameters.map((p, i) => ({
                ...p,
                value: result?.coefficients[i] ?? p.value,
              })),
            }
          : {}),
        ...patch,
      },
    });
  }
  function numeric(
    key: string,
    value: number,
    onChange: (value: number) => void,
    isValid?: (value: number) => boolean,
  ) {
    return (
      <EditableNumber
        aria-label={`${labelPrefix} ${key}`}
        value={value}
        isValid={isValid}
        onChange={onChange}
        onInvalidChange={(bad) =>
          setInvalidNumbers((previous) =>
            previous[key] === bad ? previous : { ...previous, [key]: bad },
          )
        }
        onRestoreInvalid={() => {}}
      />
    );
  }
  return (
    <div className="comparison-model-settings">
      <PeakShapeControls
        settings={{
          ...settings,
          parameters: settings.parameters.map((p, i) => ({
            ...p,
            value: result?.coefficients[i] ?? p.value,
          })),
        }}
        labelPrefix={`${labelPrefix} `}
        onChange={(settings) => {
          setInvalidNumbers({});
          onChange({ ...draft, settings });
        }}
      />
      <p className="fit-equation" aria-label="Model equation">
        {settings.model === "custom"
          ? `y = ${settings.custom!.expression}`
          : equations[settings.model]}
      </p>
      {modelNotationNote(settings.model) && (
        <p className="fit-help">{modelNotationNote(settings.model)}</p>
      )}
      {settings.model === "custom" && (
        <CustomEquationEditor
          definition={settings.custom!}
          onPending={pending}
          onApply={(custom) => {
            update({
              custom,
              parameters: custom.names.map((name) => {
                const index = names.indexOf(name);
                return index < 0
                  ? { value: 1, fixed: false }
                  : {
                      ...settings.parameters[index],
                      value:
                        result?.coefficients[index] ??
                        settings.parameters[index].value,
                    };
              }),
            });
            setEquationPending(false);
          }}
        />
      )}
      {settings.model === "sine" && (
        <label>
          Supplied period T [{draft.request.dataset.xColumn.unit ?? "X units"}]
          {numeric(
            "Sine period",
            settings.sinePeriod ?? 2 * Math.PI,
            (value) => update({ sinePeriod: value }),
            (value) => value > 0,
          )}
        </label>
      )}
      {settings.model === "sine-free-period" && (
        <div className="comparison-period-bounds">
          <label>
            Minimum period
            {numeric(
              "Minimum period",
              settings.periodMin!,
              (value) => update({ periodMin: value }),
              (value) => value > 0 && value < settings.periodMax!,
            )}
          </label>
          <label>
            Maximum period
            {numeric(
              "Maximum period",
              settings.periodMax!,
              (value) => update({ periodMax: value }),
              (value) => value > settings.periodMin!,
            )}
          </label>
          <p>
            Free T is fitted within these bounds. Fix T to use its entered
            value.
          </p>
        </div>
      )}
      {["exponential", "power-law"].includes(settings.model) && (
        <label>
          {settings.model === "exponential"
            ? "Supplied rate (inverse X unit)"
            : "Supplied exponent (dimensionless)"}
          {numeric(
            "Supplied shape",
            settings.shape ?? (settings.model === "exponential" ? -1 : 2),
            (value) => update({ shape: value }),
          )}
        </label>
      )}
      <p>
        <strong>{result ? "Fitted parameters" : "Starting parameters"}</strong>{" "}
        · edit values or fix parameters before refitting.
      </p>
      {names.map((name, i) => (
        <div className="comparison-parameter" key={`${settings.model}-${name}`}>
          <label>
            {name}
            <span className="parameter-unit">
              {modelParameterUnit(
                settings,
                i,
                draft.request.dataset.xColumn.unit,
                draft.request.dataset.yColumn.unit,
              )}
            </span>
            {numeric(
              `${name} value`,
              result?.coefficients[i] ?? settings.parameters[i].value,
              (value) =>
                update({
                  parameters: settings.parameters.map((p, j) => ({
                    ...p,
                    value:
                      j === i ? value : (result?.coefficients[j] ?? p.value),
                  })),
                }),
            )}
          </label>
          <label className="comparison-check">
            <input
              type="checkbox"
              aria-label={`${labelPrefix} Fix ${name}`}
              checked={settings.parameters[i].fixed}
              onChange={(event) =>
                update({
                  parameters: settings.parameters.map((p, j) => ({
                    ...p,
                    value: result?.coefficients[j] ?? p.value,
                    fixed: j === i ? event.target.checked : p.fixed,
                  })),
                })
              }
            />
            Fix
          </label>
          {settings.model === "custom" && (
            <label>
              Unit
              <input
                aria-label={`${labelPrefix} ${name} unit`}
                value={settings.custom!.units[i]}
                maxLength={100}
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                onChange={(event) =>
                  update({
                    custom: {
                      ...settings.custom!,
                      units: settings.custom!.units.map((u, j) =>
                        i === j ? event.target.value : u,
                      ),
                    },
                  })
                }
              />
            </label>
          )}
          {result && (
            <span title={statisticReasonText(result.standardErrors[i].reason)}>
              SE:{" "}
              {result.standardErrors[i].value === null
                ? statisticReasonText(result.standardErrors[i].reason)
                : display(result.standardErrors[i].value)}
            </span>
          )}
        </div>
      ))}
      {settings.model === "constant-acceleration" && (
        <label className="comparison-check">
          <input
            type="checkbox"
            checked={!!settings.physicalTimeConfirmed}
            onChange={(event) =>
              update({ physicalTimeConfirmed: event.target.checked })
            }
          />
          X is physical time
        </label>
      )}
      {invalid && (
        <p role="note">
          Finish the number or apply the equation before fitting or exporting.
          Escape restores a numeric entry.
        </p>
      )}
    </div>
  );
}

export function CandidateDiagnostics({
  draft,
  result,
}: {
  draft: ComparisonDraft;
  result: FitResult;
}) {
  const names = parameterNames(draft.settings.model, draft.settings.custom);
  const derived = fitDerivedQuantities(draft.request, draft.settings, result);
  const correlation = fitCorrelationMatrix(draft.settings, result);
  return (
    <section className="comparison-candidate-diagnostics">
      <h3>
        {draft.label} · {draft.settings.model}
      </h3>
      <p>{weightingText(draft.request)}</p>
      <table aria-label={`${draft.label} parameter results`}>
        <thead>
          <tr>
            <th>Parameter</th>
            <th>Value</th>
            <th>Standard error</th>
            <th>95% interval</th>
          </tr>
        </thead>
        <tbody>
          {names.map((name, i) => (
            <tr key={name}>
              <th>
                {name}
                {` [${modelParameterUnit(draft.settings, i, draft.request.dataset.xColumn.unit, draft.request.dataset.yColumn.unit)}]`}
              </th>
              <td>{display(result.coefficients[i])}</td>
              <td>
                {result.standardErrors[i].value === null
                  ? statisticReasonText(result.standardErrors[i].reason)
                  : display(result.standardErrors[i].value)}
              </td>
              <td>
                {result.intervals[i]?.map(display).join(" to ") ??
                  "Unavailable"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <details>
        <summary>Fit diagnostics and parameter correlations</summary>
        <table aria-label={`${draft.label} fit diagnostics`}>
          <tbody>
            {fitReportRows(draft.request, draft.settings, result).map(
              ([name, value]) => (
                <tr key={name}>
                  <th>{name}</th>
                  <td>
                    {typeof value === "number"
                      ? display(value)
                      : String(value ?? "Unavailable")}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
        <table aria-label={`${draft.label} parameter correlations`}>
          <tbody>
            {correlation.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) =>
                  j === 0 ? (
                    <th key={j}>{cell}</th>
                  ) : (
                    <td key={j}>
                      {typeof cell === "number"
                        ? display(cell)
                        : String(cell ?? "Unavailable")}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      {derived.length > 0 && (
        <table aria-label={`${draft.label} derived quantities`}>
          <thead>
            <tr>
              <th>Quantity</th>
              <th>Value</th>
              <th>Standard error</th>
            </tr>
          </thead>
          <tbody>
            {derived.map((q) => (
              <tr key={q.id}>
                <th>{q.label}</th>
                <td>
                  {display(q.value)} [{q.unit}]
                </td>
                <td>
                  {q.standardError.value === null
                    ? statisticReasonText(q.standardError.reason)
                    : display(q.standardError.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
