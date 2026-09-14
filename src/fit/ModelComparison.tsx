import {
  useEffect,
  useImperativeHandle,
  type Ref,
  type CSSProperties,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  compareModels,
  comparisonCompatibility,
  type ComparisonCandidate,
  type ComparisonMetrics,
  type ModelComparison as ComparisonResult,
} from "../core/fit/modelComparison";
import { statisticReasonText } from "../core/fit/diagnosticText";
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
import { predict, type FitResult, type Statistic } from "../core/fit/solve";
import { createPortal } from "react-dom";
import { suppliedYErrorBars } from "../core/fit/errorBars";
import type { ExportPlotSize } from "./exportSizing";
import { YAxisTitle } from "./YAxisTitle";
import PrintPages from "./PrintPages";
import { useModalDialog } from "./useModalDialog";
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
  showErrorBars,
  sizes,
}: {
  candidates: ComparisonCandidate[];
  showResiduals: boolean;
  showErrorBars: boolean;
  sizes?: ExportPlotSize[];
}) {
  const font = sizes?.[0].fontSizePx ?? 12;
  const legendHeight = font * 3;
  const sizedTop = legendHeight + font;
  const sizedGap = Math.max(6, font * 0.6);
  const sizedResidualBottom = Math.max(40, font * 3.3);
  const sizedFrames =
    sizes && showResiduals
      ? sizes.reduce((sum, size) => sum + size.height, 0) -
        sizedTop -
        sizedGap * 2 -
        sizedResidualBottom
      : null;
  const sizedDataHeight =
    sizedFrames === null ? null : sizedTop + sizedGap + sizedFrames * 0.75;
  const sizedResidualHeight =
    sizedFrames === null
      ? null
      : sizedGap + sizedResidualBottom + sizedFrames * 0.25;
  const width = sizes?.[0].width ?? 760,
    height =
      sizedDataHeight ??
      sizes?.[0].height ??
      (showResiduals ? 326 : 474) + legendHeight,
    left = sizes?.[0].leftMarginPx ?? (sizes ? Math.max(58, font * 5.2) : 90),
    right = sizes ? Math.max(12, font) : 22,
    top = legendHeight + (sizes ? font : 18),
    bottom = sizes
      ? showResiduals
        ? Math.max(6, font * 0.6)
        : Math.max(40, font * 3.6)
      : showResiduals
        ? 8
        : 50;
  const markerRadius = sizes ? 1.5 : 3;
  const squareHalf = sizes ? 1.35 : 2.7;
  const legendLeft = sizes ? Math.min(left, 12) : left;
  const svgStyle = {
    fontSize: font,
    "--comparison-curve-width": sizes ? 1 : 2.5,
    "--comparison-marker-stroke": sizes ? 0.75 : 1.5,
  } as CSSProperties;
  const clipId = useId();
  const observations = candidates[0].result.residuals;
  const includedIds = new Set(observations.map((row) => row.id));
  const errorBars = showErrorBars
    ? suppliedYErrorBars(candidates[0].request)
    : { bars: [], unavailable: 0 };
  const bars = errorBars.bars.filter((bar) => includedIds.has(bar.id));
  const xDomain = automaticDomain(
    observations.map((row) => row.x),
    false,
    0.06,
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
      ...bars.flatMap((bar) => [bar.lower, bar.upper]),
      ...curves.flatMap((curve) => curve.map((point) => point.y)),
    ],
    false,
    0.12,
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
  const residualHeight = sizedResidualHeight ?? sizes?.[1]?.height ?? 148,
    residualTop = sizes ? Math.max(6, font * 0.6) : 8,
    residualBottom = Math.max(40, font * 3.3);
  const residualMaximum = candidates.reduce(
    (maximum, candidate) =>
      candidate.result.residuals.reduce(
        (value, row) =>
          Number.isFinite(row.residual)
            ? Math.max(value, Math.abs(row.residual))
            : value,
        maximum,
      ),
    0,
  );
  // Only exact-zero residuals need a fallback. Display units must not flatten
  // a small but resolved difference between the fitted models.
  const residualExtent =
    residualMaximum > 0
      ? Math.min(Number.MAX_VALUE, residualMaximum * 1.12)
      : 1;
  const residualScale = plotScale([-residualExtent, residualExtent], false);
  const residualTicks = residualScale.ticks(3);
  const residualY = (value: number) =>
    residualTop +
    ((1 - value / residualExtent) / 2) *
      (residualHeight - residualTop - residualBottom);
  return (
    <div className="comparison-plot-wrap">
      <svg
        className="comparison-plot"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Compared fitted curves"
        style={svgStyle}
        data-y-min={yDomain[0]}
        data-y-max={yDomain[1]}
      >
        <desc>
          {candidates
            .map(
              (candidate, i) =>
                `${i + 1}: ${candidate.label}; ${candidate.settings.model}; data: ${candidate.request.dataset.label}`,
            )
            .join(". ")}
        </desc>
        {errorBars.unavailable > 0 && (
          <desc data-plot-notice="true">
            Some supplied error bars exceed the numeric range and are
            unavailable.
          </desc>
        )}
        {candidates.map((candidate, i) => (
          <g key={candidate.id}>
            <line
              className={`comparison-curve comparison-curve-${i + 1}`}
              x1={legendLeft}
              x2={legendLeft + 20}
              y1={font * (i * 1.3 + 0.9)}
              y2={font * (i * 1.3 + 0.9)}
            />
            <text
              x={legendLeft + 27}
              y={font * (i * 1.3 + 1.2)}
            >{`${i + 1}: ${candidate.settings.model}`}</text>
          </g>
        ))}
        <defs>
          <clipPath id={`${clipId}-data`}>
            <rect
              x={left}
              y={top}
              width={width - left - right}
              height={height - top - bottom}
            />
          </clipPath>
        </defs>
        <rect
          className="comparison-frame fit-plot-frame"
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
              data-axis-tick="y"
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
        {!showResiduals && (
          <text
            data-axis-label="x"
            x={width / 2}
            y={height - 10}
            textAnchor="middle"
          >
            {candidates[0].request.dataset.xColumn.label}
            {candidates[0].request.dataset.xColumn.unit
              ? ` [${candidates[0].request.dataset.xColumn.unit}]`
              : ""}
          </text>
        )}
        <YAxisTitle
          label={candidates[0].request.dataset.yColumn.label}
          unit={candidates[0].request.dataset.yColumn.unit ?? null}
          x={font * 1.1}
          y={top + (height - top - bottom) / 2}
          splitUnit={!!sizes}
          fontSize={font}
        />
        <g clipPath={`url(#${clipId}-data)`}>
          {bars.map((bar) => (
            <path
              key={bar.id}
              className="comparison-error-bar"
              data-row-id={bar.id}
              d={`M${x(bar.x)},${y(bar.lower)}V${y(bar.upper)} M${x(bar.x) - 3},${y(bar.lower)}h6 M${x(bar.x) - 3},${y(bar.upper)}h6`}
            >
              <title>{`Supplied y uncertainty: ±${format(bar.sigma)} ${candidates[0].request.dataset.yColumn.unit ?? ""}`}</title>
            </path>
          ))}
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
              r={markerRadius}
            />
          ))}
        </g>
      </svg>
      {showResiduals && (
        <svg
          className="comparison-residual-plot"
          width={width}
          height={residualHeight}
          viewBox={`0 0 ${width} ${residualHeight}`}
          role="img"
          aria-label="Compared residuals"
          style={svgStyle}
          data-y-min={-residualExtent}
          data-y-max={residualExtent}
        >
          <defs>
            <clipPath id={`${clipId}-residual`}>
              <rect
                x={left}
                y={residualTop}
                width={width - left - right}
                height={residualHeight - residualTop - residualBottom}
              />
            </clipPath>
          </defs>
          <rect
            className="comparison-frame fit-plot-frame"
            x={left}
            y={residualTop}
            width={width - left - right}
            height={residualHeight - residualTop - residualBottom}
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
                data-axis-tick="y"
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
                y1={residualTop}
                y2={residualHeight - residualBottom}
              />
              <text
                className="comparison-tick"
                x={x(tick)}
                y={residualHeight - residualBottom + 17}
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
          <YAxisTitle
            label="Residual"
            unit={candidates[0].request.dataset.yColumn.unit ?? null}
            x={font * 1.1}
            y={
              sizes
                ? residualHeight / 2
                : residualTop +
                  (residualHeight - residualTop - residualBottom) / 2
            }
            splitUnit={!!sizes}
            fontSize={font}
          />
          <text
            data-axis-label="x"
            x={width / 2}
            y={residualHeight - 8}
            textAnchor="middle"
          >
            {candidates[0].request.dataset.xColumn.label}
            {candidates[0].request.dataset.xColumn.unit
              ? ` [${candidates[0].request.dataset.xColumn.unit}]`
              : ""}
          </text>
          <g clipPath={`url(#${clipId}-residual)`}>
            {candidates.flatMap((candidate, candidateIndex) =>
              candidate.result.residuals.map((row) =>
                candidateIndex === 0 ? (
                  <circle
                    key={`${candidate.id}-${row.id}`}
                    className="comparison-residual-1"
                    cx={x(row.x)}
                    cy={residualY(row.residual)}
                    r={markerRadius}
                  />
                ) : (
                  <rect
                    key={`${candidate.id}-${row.id}`}
                    className="comparison-residual-2"
                    x={x(row.x) - squareHalf}
                    y={residualY(row.residual) - squareHalf}
                    width={squareHalf * 2}
                    height={squareHalf * 2}
                  />
                ),
              ),
            )}
          </g>
        </svg>
      )}
    </div>
  );
}

function comparisonStatisticText(statistic: Statistic) {
  if (statistic.value !== null) return format(statistic.value);
  if (statistic.reason === "not-applicable-known-variance")
    return "Not applicable";
  return statisticReasonText(statistic.reason);
}

function ComparisonPrintReport({
  candidates,
  comparison,
  showResiduals,
  showErrorBars,
  onClose,
}: {
  candidates: ComparisonCandidate[];
  comparison: ComparisonResult;
  showResiduals: boolean;
  showErrorBars: boolean;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [fullPageGraph, setFullPageGraph] = useState(false);
  const [error, setError] = useState("");
  useModalDialog(dialog, ".fit-print-trigger");
  const rows: Array<[string, (metric: ComparisonMetrics) => string]> = [
    ["Model", (m) => m.model],
    ["Observations n", (m) => format(m.n)],
    ["Degrees of freedom df", (m) => format(m.df)],
    ["Free curve parameters k", (m) => format(m.modelParameters)],
    ["Likelihood parameters K", (m) => format(m.likelihoodParameters)],
    [
      comparison.rankingCriterion === "AIC" ? "χ²" : "SSE",
      (m) => format(m.objective),
    ],
    [
      "χ²/df (reduced chi-squared)",
      (m) => comparisonStatisticText(m.reducedChiSquared),
    ],
    ["Log likelihood", (m) => comparisonStatisticText(m.logLikelihood)],
    ["AIC", (m) => comparisonStatisticText(m.aic)],
    ["AICc", (m) => comparisonStatisticText(m.aicc)],
    [
      `Δ${comparison.rankingCriterion}`,
      (m) => comparisonStatisticText(m.delta),
    ],
    ["Akaike weight", (m) => comparisonStatisticText(m.akaikeWeight)],
    ["BIC", (m) => comparisonStatisticText(m.bic)],
    ["Inference", (m) => m.inference],
  ];
  async function print() {
    try {
      await window.print();
    } catch (cause) {
      setError(`Printing failed: ${String(cause)}`);
    }
  }
  return (
    <dialog
      ref={dialog}
      className={`fit-print-dialog${fullPageGraph ? " full-page-graph" : ""}`}
      aria-label="Print model comparison"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          onClose();
      }}
      onKeyDown={(event) => {
        if (
          (event.metaKey || event.ctrlKey) &&
          event.key.toLowerCase() === "p"
        ) {
          event.preventDefault();
          event.stopPropagation();
          void print();
        }
      }}
    >
      <div className="fit-print-controls">
        <button onClick={() => void print()}>Print…</button>
        <button onClick={onClose}>Close preview</button>
        <label>
          <input
            type="checkbox"
            checked={fullPageGraph}
            onChange={(event) => setFullPageGraph(event.target.checked)}
          />
          Full-page graph
        </label>
        <span>
          US Letter · Portrait
          {fullPageGraph ? " · Graph rotated on the first page" : ""}
        </span>
        {error && <p role="alert">{error}</p>}
      </div>
      <PrintPages fullPageGraph={fullPageGraph}>
        <article>
          <div className="fit-print-graph-sheet">
            <div className="fit-print-graph-content">
              <h1>Model comparison</h1>
              <p>{candidates[0].request.dataset.label}</p>
              <div className="fit-print-graphs">
                <ComparisonPlot
                  candidates={candidates}
                  showResiduals={showResiduals}
                  showErrorBars={showErrorBars}
                  sizes={
                    showResiduals
                      ? [
                          {
                            width: fullPageGraph ? 960 : 720,
                            height: (fullPageGraph ? 650 : 380) * 0.75,
                            fontSizePx: 12,
                            leftMarginPx: 90,
                          },
                          {
                            width: fullPageGraph ? 960 : 720,
                            height: (fullPageGraph ? 650 : 380) * 0.25,
                            fontSizePx: 12,
                            leftMarginPx: 90,
                          },
                        ]
                      : [
                          {
                            width: fullPageGraph ? 960 : 720,
                            height: fullPageGraph ? 650 : 380,
                            fontSizePx: 12,
                            leftMarginPx: 90,
                          },
                        ]
                  }
                />
              </div>
            </div>
          </div>
          <div className="fit-print-details">
            <div className="fit-print-results comparison-print-statistics">
              <h2>Comparison statistics</h2>
              <table aria-label="Printed model comparison statistics">
                <thead>
                  <tr>
                    <th>Statistic</th>
                    {comparison.metrics.map((metric) => (
                      <th key={metric.id}>{metric.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([label, value]) => (
                    <tr key={label}>
                      <th>{label}</th>
                      {comparison.metrics.map((metric) => (
                        <td key={metric.id}>{value(metric)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              Ranking uses {comparison.rankingCriterion} within this candidate
              set. Akaike weights are relative support, not posterior model
              probabilities. BIC is a separate criterion.
            </p>
            <p>
              χ²/df uses supplied absolute Y uncertainties and df = n − k. When
              scatter is estimated from the residuals, χ²/df is unavailable as
              an independent fit-quality check. Error bars show supplied ±1σ on
              observations only.
            </p>
            <p>
              {comparison.rankingCriterion === "AIC"
                ? "The estimated-variance AICc correction is not applicable with supplied known sigmas."
                : "AICc counts estimated variance, requires n > K + 1, and is approximate for nonlinear models."}
            </p>
            {candidates.map((candidate) => (
              <p key={candidate.id}>
                {candidate.label}: {candidate.settings.model}; source:{" "}
                {candidate.request.dataset.label}; inference:{" "}
                {candidate.result.inference}.
                {candidate.result.warnings.length > 0
                  ? ` Warnings: ${candidate.result.warnings.join("; ")}`
                  : ""}
              </p>
            ))}
          </div>
        </article>
      </PrintPages>
    </dialog>
  );
}

export type ModelComparisonActions = {
  copy: () => Promise<void>;
  print: () => void;
};

export default function ModelComparison({
  source,
  sourceResult,
  analysisControl,
  showResiduals,
  showErrorBars,
  onErrorBarsChange,
  onReady,
  exportSizes,
  ref,
}: {
  source: Analysis;
  sourceResult: FitResult | null;
  analysisControl: ReactNode;
  showResiduals: boolean;
  showErrorBars: boolean;
  onErrorBarsChange: (show: boolean) => void;
  onReady: (ready: boolean) => void;
  exportSizes?: ExportPlotSize[];
  ref?: Ref<ModelComparisonActions>;
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
  const [printOpen, setPrintOpen] = useState(false);
  const ready = !!comparison?.compatible && !!fitted && !busy;
  useEffect(() => onReady(ready), [ready, onReady]);
  useImperativeHandle(ref, () => ({
    copy,
    print: () => {
      if (ready) setPrintOpen(true);
    },
  }));
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
              metric.delta,
              metric.akaikeWeight,
              metric.bic,
            ].flatMap((statistic) =>
              statistic.reason &&
              statistic.reason !== "not-applicable-known-variance"
                ? [statistic.reason.replaceAll("-", " ")]
                : [],
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
      "df",
      "Model parameters",
      "Likelihood parameters",
      comparison.rankingCriterion === "AIC" ? "χ²" : "SSE",
      "χ²/df (reduced chi-squared)",
      "log likelihood",
      "AIC",
      "AICc",
      `delta ${comparison.rankingCriterion}`,
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
        metric.df,
        metric.modelParameters,
        metric.likelihoodParameters,
        metric.objective,
        metric.reducedChiSquared.value ??
          statisticReasonText(metric.reducedChiSquared.reason),
        metric.logLikelihood.value ?? metric.logLikelihood.reason,
        metric.aic.value ?? metric.aic.reason,
        metric.aicc.value ?? metric.aicc.reason,
        metric.delta.value ?? metric.delta.reason,
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
            <p className="comparison-source">
              Data: {draft.request.dataset.label}
            </p>
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
            <button
              onClick={() => change(i, fromCurrent(source, sourceResult))}
            >
              Use current analysis
            </button>
          </fieldset>
        ))}
        <button
          className="comparison-run"
          disabled={busy || incompatibilities.length > 0}
          onClick={run}
        >
          {busy ? "Comparing…" : "Refit and compare"}
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
            <label
              className="comparison-error-control"
              title="Supplied marginal y uncertainty, ±1 standard deviation. Only shown on the data plot."
            >
              <input
                type="checkbox"
                checked={
                  showErrorBars &&
                  fitted[0].request.uncertainty.kind !== "unknown-equal"
                }
                disabled={
                  fitted[0].request.uncertainty.kind === "unknown-equal"
                }
                onChange={(event) => onErrorBarsChange(event.target.checked)}
              />
              {fitted[0].request.uncertainty.kind === "unknown-equal"
                ? "Error bars unavailable · σ unknown"
                : "Show y error bars (±1σ)"}
            </label>
            <ComparisonPlot
              candidates={fitted}
              showResiduals={showResiduals}
              showErrorBars={showErrorBars}
            />
            {exportSizes && (
              <div className="fit-export-render" aria-hidden="true" inert>
                <ComparisonPlot
                  candidates={fitted}
                  showResiduals={showResiduals}
                  showErrorBars={showErrorBars}
                  sizes={exportSizes}
                />
              </div>
            )}
            {printOpen &&
              createPortal(
                <ComparisonPrintReport
                  candidates={fitted}
                  comparison={comparison}
                  showResiduals={showResiduals}
                  showErrorBars={showErrorBars}
                  onClose={() => setPrintOpen(false)}
                />,
                document.querySelector(".fit-app")!,
              )}
            <div className="comparison-table-wrap">
              <table aria-label="Model comparison statistics">
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>n</th>
                    <th title="Residual degrees of freedom: n minus free curve parameters">
                      df
                    </th>
                    <th>k model</th>
                    <th>K likelihood</th>
                    <th>
                      {comparison.rankingCriterion === "AIC" ? "χ²" : "SSE"}
                    </th>
                    <th title="Chi-squared per degree of freedom (reduced chi-squared)">
                      χ²/df
                    </th>
                    <th>log L</th>
                    <th>AIC</th>
                    <th>AICc</th>
                    <th>Δ{comparison.rankingCriterion}</th>
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
                      <td>{metric.df}</td>
                      <td>{metric.modelParameters}</td>
                      <td>{metric.likelihoodParameters}</td>
                      <td>{format(metric.objective)}</td>
                      <td
                        title={
                          metric.reducedChiSquared.reason
                            ? statisticReasonText(
                                metric.reducedChiSquared.reason,
                              )
                            : "Chi-squared per degree of freedom"
                        }
                      >
                        {format(metric.reducedChiSquared.value)}
                      </td>
                      {[
                        metric.logLikelihood,
                        metric.aic,
                        metric.aicc,
                        metric.delta,
                        metric.akaikeWeight,
                        metric.bic,
                      ].map((statistic, i) => (
                        <td key={i} title={statistic.reason ?? undefined}>
                          {statistic.reason === "not-applicable-known-variance"
                            ? "Not applicable"
                            : format(statistic.value)}
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
                Relative support uses {comparison.rankingCriterion}: lower is
                better within this candidate set. Akaike weights use that same
                criterion and sum to one when at least two values are available;
                they are not probabilities that a model is true. BIC is shown as
                a separate criterion.
              </p>
              <p>
                {comparison.rankingCriterion === "AIC"
                  ? "With supplied measurement uncertainties, the unknown-variance AICc correction does not apply."
                  : "AICc includes a small-sample correction for estimated equal scatter. Its nonlinear use is approximate and depends on the model and error assumptions."}
              </p>
              <p>
                k model counts free curve parameters. K likelihood also counts
                the fitted common variance when scatter is unknown. Objective is
                χ² with supplied standard deviations and SSE when common scatter
                is unknown.
              </p>
              <p>
                χ²/df is chi-squared per residual degree of freedom, with df = n
                − k model. It requires supplied absolute measurement
                uncertainties and positive df. When scatter is estimated from
                these residuals, dividing by that estimate would force χ²/df to
                one, so it is unavailable as an independent fit-quality check.
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
