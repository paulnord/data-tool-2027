import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  compareModels,
  comparisonCompatibility,
  type ComparisonCandidate,
  type ModelComparison as ComparisonResult,
} from "../core/fit/modelComparison";
import {
  initialSettings,
  parameterNames,
  sessionSchema,
  type FitRequest,
  type FitSettings,
} from "../core/fit/schema";
import {
  isNonlinearModel,
  nonlinearModelIds,
  nonlinearModels,
  suggestedParameters,
} from "../core/fit/nonlinearModels";
import { predict, type FitResult } from "../core/fit/solve";
import { reportTableTsv } from "../core/fit/report";
import { automaticDomain, plotPath, plotScale } from "./plotScale";
import { FitErrorMessage } from "./FitErrorMessage";
import "./modelComparison.css";

type Analysis = { request: FitRequest; settings: FitSettings };
type Draft = Analysis & { label: string };

const models: [FitSettings["model"], string][] = [
  ["line", "Straight line"],
  ["quadratic", "Quadratic"],
  ["cubic", "Cubic"],
  ["quartic", "Quartic"],
  ["logarithmic", "Logarithmic"],
  ["sine", "Sine · supplied period"],
  ["sine-free-period", "Sine · fit period"],
  ["exponential", "Exponential · supplied rate"],
  ["power-law", "Power law · supplied exponent"],
  ["reciprocal", "Reciprocal"],
  ...nonlinearModelIds.map(
    (model) =>
      [model, nonlinearModels[model].label] as [FitSettings["model"], string],
  ),
  ["constant-acceleration", "Constant acceleration"],
  ["custom", "Custom equation (load a session to configure)"],
];

const format = (value: number | null) => {
  if (value === null) return "Unavailable";
  if (value !== 0 && (Math.abs(value) < 1e-4 || Math.abs(value) >= 1e7))
    return value.toExponential(5);
  return value.toLocaleString("en-US", { maximumSignificantDigits: 7 });
};

function fromCurrent(source: Analysis, result: FitResult | null): Draft {
  return {
    label: "Current analysis",
    request: source.request,
    settings: result
      ? {
          ...source.settings,
          parameters: source.settings.parameters.map((parameter, index) => ({
            ...parameter,
            value: result.coefficients[index] ?? parameter.value,
          })),
        }
      : source.settings,
  };
}

function alternate(source: Analysis): Draft {
  const model = source.settings.model === "line" ? "quadratic" : "line";
  return {
    label: "Candidate B",
    request: source.request,
    settings: settingsFor(model, source),
  };
}

function settingsFor(model: FitSettings["model"], source: Analysis) {
  const settings = initialSettings(model);
  settings.excludedIds = source.settings.excludedIds.slice();
  settings.conditionalInference = source.settings.conditionalInference;
  settings.physicalTimeConfirmed = source.settings.physicalTimeConfirmed;
  settings.selectionAfterInspection = source.settings.selectionAfterInspection;
  settings.retainedPerRowUncertainty =
    source.settings.retainedPerRowUncertainty;
  if (isNonlinearModel(model))
    settings.parameters = suggestedParameters(
      model,
      source.request,
      settings.excludedIds,
    ).map((value) => ({ value, fixed: false }));
  return settings;
}

function ComparisonPlot({
  candidates,
  showResiduals,
}: {
  candidates: ComparisonCandidate[];
  showResiduals: boolean;
}) {
  const width = 760,
    height = 330,
    left = 70,
    right = 22,
    top = 18,
    bottom = 50;
  const observations = candidates[0].result.residuals;
  const xDomain = automaticDomain(
    observations.map((row) => row.x),
    false,
    0.04,
  );
  const sample = Array.from(
    { length: 420 },
    (_, i) => xDomain[0] + (i * (xDomain[1] - xDomain[0])) / 419,
  );
  const curves = candidates.map((candidate) =>
    sample.map((x) => ({
      x,
      y: predict(
        x,
        candidate.settings.model,
        candidate.result.coefficients,
        candidate.settings.sinePeriod,
        candidate.settings.shape,
        candidate.settings.custom,
      ),
    })),
  );
  const yDomain = automaticDomain(
    [
      ...observations.map((row) => row.y),
      ...curves.flatMap((curve) => curve.map((point) => point.y)),
    ],
    false,
    0.08,
  );
  const xScale = plotScale(xDomain, false);
  const yScale = plotScale(yDomain, false);
  const xTicks = xScale.ticks(6);
  const yTicks = yScale.ticks(5);
  const x = (value: number) =>
    left +
    ((value - xDomain[0]) / (xDomain[1] - xDomain[0])) * (width - left - right);
  const y = (value: number) =>
    top +
    (1 - (value - yDomain[0]) / (yDomain[1] - yDomain[0])) *
      (height - top - bottom);
  const residualHeight = 150;
  const residualExtent =
    Math.max(
      ...candidates.flatMap((candidate) =>
        candidate.result.residuals.map((row) => Math.abs(row.residual)),
      ),
      0.001,
    ) * 1.18;
  const residualScale = plotScale([-residualExtent, residualExtent], false);
  const residualTicks = residualScale.ticks(3);
  const residualY = (value: number) =>
    8 +
    (1 - (value + residualExtent) / (2 * residualExtent)) *
      (residualHeight - 43);
  return (
    <div className="comparison-plot-wrap">
      <svg
        className="comparison-plot"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Compared fitted curves"
      >
        <rect
          className="comparison-frame"
          x={left}
          y={top}
          width={width - left - right}
          height={height - top - bottom}
        />
        {yTicks.map((tick) => (
          <g key={`y-${tick}`}>
            <line
              className="comparison-grid"
              x1={left}
              x2={width - right}
              y1={y(tick)}
              y2={y(tick)}
            />
            <text
              className="comparison-tick"
              x={left - 8}
              y={y(tick) + 4}
              textAnchor="end"
            >
              {yScale.label(tick, 5)}
            </text>
          </g>
        ))}
        {xTicks.map((tick) => (
          <g key={`x-${tick}`}>
            <line
              className="comparison-grid"
              x1={x(tick)}
              x2={x(tick)}
              y1={top}
              y2={height - bottom}
            />
            {!showResiduals && (
              <text
                className="comparison-tick"
                x={x(tick)}
                y={height - bottom + 17}
                textAnchor="middle"
              >
                {xScale.label(tick, 6)}
              </text>
            )}
          </g>
        ))}
        <text x={width / 2} y={height - 10} textAnchor="middle">
          {candidates[0].request.dataset.xColumn.label}
          {candidates[0].request.dataset.xColumn.unit
            ? ` [${candidates[0].request.dataset.xColumn.unit}]`
            : ""}
        </text>
        <text
          transform={`translate(16 ${height / 2}) rotate(-90)`}
          textAnchor="middle"
        >
          {candidates[0].request.dataset.yColumn.label}
          {candidates[0].request.dataset.yColumn.unit
            ? ` [${candidates[0].request.dataset.yColumn.unit}]`
            : ""}
        </text>
        {curves.map((curve, i) => (
          <path
            key={candidates[i].id}
            className={`comparison-curve comparison-curve-${i + 1}`}
            d={plotPath(curve, x, y)}
          />
        ))}
        {observations.map((row) => (
          <circle
            key={row.id}
            className="comparison-point"
            cx={x(row.x)}
            cy={y(row.y)}
            r="3"
          />
        ))}
      </svg>
      {showResiduals && (
        <svg
          className="comparison-residual-plot"
          viewBox={`0 0 ${width} ${residualHeight}`}
          role="img"
          aria-label="Compared residuals"
        >
          <rect
            className="comparison-frame"
            x={left}
            y="8"
            width={width - left - right}
            height={residualHeight - 43}
          />
          {residualTicks.map((tick) => (
            <g key={`residual-y-${tick}`}>
              <line
                className="comparison-grid"
                x1={left}
                x2={width - right}
                y1={residualY(tick)}
                y2={residualY(tick)}
              />
              <text
                className="comparison-tick"
                x={left - 8}
                y={residualY(tick) + 4}
                textAnchor="end"
              >
                {residualScale.label(tick, 3)}
              </text>
            </g>
          ))}
          {xTicks.map((tick) => (
            <g key={`residual-x-${tick}`}>
              <line
                className="comparison-grid"
                x1={x(tick)}
                x2={x(tick)}
                y1="8"
                y2={residualHeight - 35}
              />
              <text
                className="comparison-tick"
                x={x(tick)}
                y={residualHeight - 27}
                textAnchor="middle"
              >
                {xScale.label(tick, 6)}
              </text>
            </g>
          ))}
          <line
            className="comparison-zero"
            x1={left}
            x2={width - right}
            y1={residualY(0)}
            y2={residualY(0)}
          />
          <text
            transform={`translate(16 ${residualHeight / 2}) rotate(-90)`}
            textAnchor="middle"
          >
            Residual
          </text>
          <text x={width / 2} y={residualHeight - 8} textAnchor="middle">
            {candidates[0].request.dataset.xColumn.label}
            {candidates[0].request.dataset.xColumn.unit
              ? ` [${candidates[0].request.dataset.xColumn.unit}]`
              : ""}
          </text>
          {candidates.flatMap((candidate, candidateIndex) =>
            candidate.result.residuals.map((row) =>
              candidateIndex === 0 ? (
                <circle
                  key={`${candidate.id}-${row.id}`}
                  className="comparison-residual-1"
                  cx={x(row.x)}
                  cy={residualY(row.residual)}
                  r="3"
                />
              ) : (
                <rect
                  key={`${candidate.id}-${row.id}`}
                  className="comparison-residual-2"
                  x={x(row.x) - 2.7}
                  y={residualY(row.residual) - 2.7}
                  width="5.4"
                  height="5.4"
                />
              ),
            ),
          )}
        </svg>
      )}
      <div className="comparison-legend" aria-label="Compared curve legend">
        {candidates.map((candidate, i) => (
          <span key={candidate.id} className={`comparison-key-${i + 1}`}>
            {candidate.label}: {candidate.settings.model}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function ModelComparison({
  source,
  sourceResult,
  analysisControl,
  showResiduals,
}: {
  source: Analysis;
  sourceResult: FitResult | null;
  analysisControl: ReactNode;
  showResiduals: boolean;
}) {
  const [drafts, setDrafts] = useState<[Draft, Draft]>(() => [
    fromCurrent(source, sourceResult),
    alternate(source),
  ]);
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [fitted, setFitted] = useState<ComparisonCandidate[] | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const workers = useRef(new Set<Worker>());
  const revision = useRef(0);
  useEffect(
    () => () => {
      revision.current += 1;
      for (const worker of workers.current) worker.terminate();
      workers.current.clear();
    },
    [],
  );
  const incompatibilities = useMemo(
    () => comparisonCompatibility(drafts[0], drafts[1]),
    [drafts],
  );
  const unavailableReasons = comparison
    ? [
        ...new Set(
          comparison.metrics.flatMap((metric) =>
            [
              metric.logLikelihood,
              metric.aic,
              metric.aicc,
              metric.deltaAicc,
              metric.akaikeWeight,
              metric.bic,
            ].flatMap((statistic) =>
              statistic.reason ? [statistic.reason.replaceAll("-", " ")] : [],
            ),
          ),
        ),
      ]
    : [];
  function change(index: number, draft: Draft) {
    revision.current += 1;
    setBusy(false);
    setDrafts(
      (current) =>
        current.map((value, i) => (i === index ? draft : value)) as [
          Draft,
          Draft,
        ],
    );
    setComparison(null);
    setFitted(null);
    setError("");
    setNotice("");
  }
  function fitDraft(draft: Draft) {
    return new Promise<FitResult>((resolve, reject) => {
      const worker = new Worker(new URL("./fit.worker.ts", import.meta.url), {
        type: "module",
      });
      workers.current.add(worker);
      const done = () => {
        workers.current.delete(worker);
        worker.terminate();
      };
      worker.onerror = (event) => {
        done();
        reject(new Error(event.message || "Fit worker failed"));
      };
      worker.onmessage = (
        event: MessageEvent<{ result?: FitResult; error?: string }>,
      ) => {
        done();
        if (event.data.result) resolve(event.data.result);
        else reject(new Error(event.data.error || "Fit failed"));
      };
      worker.postMessage({ request: draft.request, settings: draft.settings });
    });
  }
  async function run() {
    if (incompatibilities.length) {
      setError(`Comparison blocked: ${incompatibilities.join("; ")}.`);
      return;
    }
    const token = ++revision.current;
    setBusy(true);
    setComparison(null);
    setFitted(null);
    setError("");
    setNotice("Refitting both candidates…");
    try {
      const results = await Promise.all(drafts.map(fitDraft));
      const candidates = drafts.map((draft, i) => ({
        ...draft,
        id: `candidate-${i + 1}`,
        result: results[i],
      }));
      if (revision.current !== token) return;
      const next = compareModels(candidates);
      setFitted(candidates);
      setComparison(next);
      setNotice("Comparison complete");
    } catch (cause) {
      if (revision.current !== token) return;
      setError(cause instanceof Error ? cause.message : String(cause));
      setNotice("");
    } finally {
      if (revision.current === token) setBusy(false);
    }
  }
  async function loadSession(index: number, file: File) {
    const token = ++revision.current;
    setBusy(false);
    if (file.size > 20_000_000) {
      setError("Session exceeds the 20 MB limit.");
      return;
    }
    try {
      const session = sessionSchema.parse(JSON.parse(await file.text()));
      if (revision.current !== token) return;
      change(index, {
        label: file.name.replace(/\.trksess$/i, ""),
        request: session.request,
        settings: session.settings,
      });
    } catch (cause) {
      if (revision.current !== token) return;
      setError(
        `Candidate ${index + 1} was not changed: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
    }
  }
  async function copy() {
    if (!comparison?.compatible) return;
    const headers = [
      "Candidate",
      "Model",
      "n",
      "Model parameters",
      "Likelihood parameters",
      "Objective",
      "log likelihood",
      "AIC",
      "AICc",
      "delta AICc",
      "Akaike weight",
      "BIC",
      "Inference",
    ];
    const text = reportTableTsv([
      headers,
      ...comparison.metrics.map((metric) => [
        metric.label,
        metric.model,
        metric.n,
        metric.modelParameters,
        metric.likelihoodParameters,
        metric.objective,
        metric.logLikelihood.value ?? metric.logLikelihood.reason,
        metric.aic.value ?? metric.aic.reason,
        metric.aicc.value ?? metric.aicc.reason,
        metric.deltaAicc.value ?? metric.deltaAicc.reason,
        metric.akaikeWeight.value ?? metric.akaikeWeight.reason,
        metric.bic.value ?? metric.bic.reason,
        metric.inference,
      ]),
    ]);
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Comparison table copied");
    } catch {
      setError("Clipboard unavailable.");
    }
  }
  return (
    <section className="model-comparison">
      <aside className="comparison-controls">
        {analysisControl}
        <h2>Candidate fits</h2>
        {drafts.map((draft, i) => (
          <fieldset key={i} disabled={busy}>
            <legend>Candidate {i + 1}</legend>
            <label>
              Label
              <input
                value={draft.label}
                maxLength={100}
                onChange={(event) =>
                  change(i, { ...draft, label: event.target.value })
                }
              />
            </label>
            <label>
              Model
              <select
                aria-label={`Candidate ${i + 1} model`}
                value={draft.settings.model}
                onChange={(event) => {
                  const model = event.target.value as FitSettings["model"];
                  change(i, {
                    ...draft,
                    settings: settingsFor(model, draft),
                  });
                }}
              >
                {models.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <p>
              <strong>{fitted ? "Fitted" : "Starting"} parameters:</strong>{" "}
              {parameterNames(draft.settings.model, draft.settings.custom)
                .map(
                  (name, j) =>
                    `${name}=${format(fitted?.[i].result.coefficients[j] ?? draft.settings.parameters[j].value)}${draft.settings.parameters[j].fixed ? " (fixed)" : ""}`,
                )
                .join("; ")}
            </p>
            <label className="comparison-file">
              Load fit session…
              <input
                type="file"
                accept=".trksess,.json"
                aria-label={`Load candidate ${i + 1} fit session`}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void loadSession(i, file);
                  event.target.value = "";
                }}
              />
            </label>
            {i === 0 && (
              <button
                onClick={() => change(0, fromCurrent(source, sourceResult))}
              >
                Use current analysis
              </button>
            )}
          </fieldset>
        ))}
        <button
          className="comparison-run"
          disabled={busy || incompatibilities.length > 0}
          onClick={run}
        >
          {busy ? "Comparing…" : "Refit and compare"}
        </button>
        <button disabled={!comparison?.compatible} onClick={() => void copy()}>
          Copy comparison table
        </button>
        <p>
          Both candidates are refitted. Formal criteria require the same
          observations, exclusions, uncertainties, and likelihood assumptions.
        </p>
      </aside>
      <main className="comparison-workspace">
        <header>
          <div>
            <h1>Model comparison</h1>
            <p>Relative support among the fitted candidates</p>
          </div>
          <p role="status">
            {notice || "Configure two candidates, then compare."}
          </p>
        </header>
        {incompatibilities.length > 0 && !error && (
          <div className="comparison-warning" role="note">
            Comparison currently blocked: {incompatibilities.join("; ")}.
          </div>
        )}
        {error && (
          <div className="comparison-error" role="alert">
            <FitErrorMessage message={error} />
          </div>
        )}
        {comparison?.compatible && fitted ? (
          <>
            <ComparisonPlot candidates={fitted} showResiduals={showResiduals} />
            <div className="comparison-table-wrap">
              <table aria-label="Model comparison statistics">
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>n</th>
                    <th>k model</th>
                    <th>K likelihood</th>
                    <th>Objective</th>
                    <th>log L</th>
                    <th>AIC</th>
                    <th>AICc</th>
                    <th>ΔAICc</th>
                    <th>Akaike weight</th>
                    <th>BIC</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.metrics.map((metric) => (
                    <tr key={metric.id}>
                      <th>
                        {metric.label}
                        <small>{metric.model}</small>
                      </th>
                      <td>{metric.n}</td>
                      <td>{metric.modelParameters}</td>
                      <td>{metric.likelihoodParameters}</td>
                      <td>{format(metric.objective)}</td>
                      {[
                        metric.logLikelihood,
                        metric.aic,
                        metric.aicc,
                        metric.deltaAicc,
                        metric.akaikeWeight,
                        metric.bic,
                      ].map((statistic, i) => (
                        <td key={i} title={statistic.reason ?? undefined}>
                          {format(statistic.value)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {comparison.metrics.some((metric) => metric.warnings.length) && (
              <div className="comparison-fit-warnings" role="note">
                <h2>Fit warnings</h2>
                {comparison.metrics.flatMap((metric) =>
                  metric.warnings.map((warning, index) => (
                    <p key={`${metric.id}-${index}`}>
                      <strong>{metric.label}:</strong> {warning}
                    </p>
                  )),
                )}
              </div>
            )}
            <div className="comparison-notes">
              <p>
                Lower AICc/BIC indicates more relative support within only this
                candidate set. When at least two AICc values are available,
                Akaike weights sum to one across those candidates; they are not
                probabilities that a model is true.
              </p>
              <p>
                k model counts free curve parameters. K likelihood also counts
                the fitted common variance when scatter is unknown. Objective is
                χ² with supplied standard deviations and SSE when common scatter
                is unknown.
              </p>
              {comparison.metrics.some(
                (metric) => metric.inference === "conditional",
              ) && (
                <p>
                  Criteria are conditional on the accepted assumptions; those
                  assumptions are not verified by the calculation.
                </p>
              )}
              {unavailableReasons.length > 0 && (
                <p>
                  Some formal statistics are unavailable:{" "}
                  {unavailableReasons.join("; ")}. Hover an unavailable cell for
                  its recorded reason.
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="comparison-empty">
            No comparison results yet. A candidate loaded from a session is
            staged here and does not replace the analysis in the main workspace.
          </div>
        )}
      </main>
    </section>
  );
}
