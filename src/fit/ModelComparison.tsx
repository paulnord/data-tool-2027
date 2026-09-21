import { formatNumber as format } from "./formatNumber";
import { modelGuideValues } from "../core/fit/modelGuides";
import { FitGuideLegend, layoutGuideLabels } from "./FitGuideLegend";
import { ModelSelector } from "./ModelSelector";
import {
  CandidateSettings,
  CandidateDiagnostics,
  weightingText,
  type ComparisonAnalysis,
  type ComparisonDraft,
} from "./ComparisonFitControls";
import { switchNoiseModel } from "../core/fit/noiseModel";
import {
  rectangleExclusions,
  type SelectionRectangle,
  type SelectionMode,
} from "../core/fit/selection";
import { EditableNumber } from "./EditableNumber";
import Assumptions from "./Assumptions";
import {
  buildCodeExportDescription,
  generateCodeExportBundle,
  type CodeExportBundle,
} from "../core/fit/codeExport";
import { sessionEngine } from "../core/fit/schema";
import { fitReportTsv } from "../core/fit/report";
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
  sessionSchema,
  analysisSchema,
  type FitRequest,
  type FitSettings,
  type ComparisonWorkspace,
} from "../core/fit/schema";
import {
  isNonlinearModel,
  suggestedParameters,
} from "../core/fit/nonlinearModels";
import type { FitResult, Statistic } from "../core/fit/solve";
import { createPortal } from "react-dom";
import { suppliedYErrorBars } from "../core/fit/errorBars";
import type { ExportPlotSize } from "./exportSizing";
import { YAxisTitle } from "./YAxisTitle";
import { AxisControls } from "./YAxisControls";
import PrintPages from "./PrintPages";
import { useModalDialog } from "./useModalDialog";
import { reportTableTsv } from "../core/fit/report";
import { automaticDomain, plotPath, plotScale } from "./plotScale";
import { FitErrorMessage } from "./FitErrorMessage";
import { sampleModelCurve } from "./fitCurve";
import { polynomialDegree } from "../core/fit/polynomialModels";
import { modelDisplayName } from "./modelDisplay";
import "./modelComparison.css";

type Analysis = ComparisonAnalysis;
type Draft = ComparisonDraft;

const candidateColors = [
  "#cc7f32",
  "#176b8e",
  "#457a45",
  "#92519d",
  "#9b6539",
  "#337e8d",
];

function fromCurrent(source: Analysis, result: FitResult | null): Draft {
  return {
    ...source,
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
  if (
    polynomialDegree(source.settings.model) !== undefined &&
    polynomialDegree(model) !== undefined &&
    source.settings.polynomialBasis
  )
    settings.polynomialBasis = source.settings.polynomialBasis;
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

type ComparisonAxes = {
  xRange: [number, number] | null;
  yRange: [number, number] | null;
  logX: boolean;
  logY: boolean;
};

function ComparisonPlot({
  axes,
  onAxes,
  candidates,
  showResiduals,
  showErrorBars,
  showGuides,
  sizes,
  onSelect,
  onToggle,
}: {
  axes: ComparisonAxes;
  onAxes?: (axes: ComparisonAxes) => void;
  onSelect?: (box: SelectionRectangle, mode: SelectionMode) => void;
  onToggle?: (id: string) => void;
  candidates: (Omit<ComparisonCandidate, "result"> & { result?: FitResult })[];
  showResiduals: boolean;
  showErrorBars: boolean;
  showGuides: boolean;
  sizes?: ExportPlotSize[];
}) {
  const font = sizes?.[0].fontSizePx ?? 12;
  const width = sizes?.[0].width ?? 760,
    left = sizes?.[0].leftMarginPx ?? (sizes ? Math.max(58, font * 5.2) : 90),
    right = sizes ? Math.max(12, font) : 22;
  const guides = showGuides
    ? candidates.flatMap((candidate, candidateIndex) =>
        candidate.result
          ? modelGuideValues(
              0,
              candidate.settings,
              candidate.result.coefficients,
            ).map((guide) => ({ ...guide, candidateIndex }))
          : [],
      )
    : [];
  const guideLabels = layoutGuideLabels(
    guides
      .filter((guide) => guide.symbol && Number.isFinite(guide.value))
      .map((guide) => ({
        id: guide.id,
        candidateIndex: guide.candidateIndex,
        text: `${guide.candidateIndex + 1}: ${guide.symbol} = ${format(guide.value)}`,
        description: `${candidates[guide.candidateIndex].label}: ${guide.label}; ${format(guide.value)} ${guide.axis === "x" ? (candidates[guide.candidateIndex].request.dataset.xColumn.unit ?? "") : (candidates[guide.candidateIndex].request.dataset.yColumn.unit ?? "")}`,
        color: candidateColors[guide.candidateIndex],
      })),
    width - left - right,
    font,
  );
  const candidateLegendHeight =
    font * Math.max(3, candidates.length * 1.3 + 0.4);
  const legendHeight = candidateLegendHeight + guideLabels.height;
  const sizedTop = legendHeight + font;
  const sizedGap = Math.max(6, font * 0.6);
  const sizedResidualBottom = Math.max(40, font * 3.3);
  const sizedFrames =
    sizes && showResiduals
      ? Math.max(
          1,
          sizes.reduce((sum, size) => sum + size.height, 0) -
            sizedTop -
            sizedGap * 2 -
            sizedResidualBottom,
        )
      : null;
  const sizedDataHeight =
    sizedFrames === null ? null : sizedTop + sizedGap + sizedFrames * 0.75;
  const sizedResidualHeight =
    sizedFrames === null
      ? null
      : sizedGap + sizedResidualBottom + sizedFrames * 0.25;
  const height =
      sizedDataHeight ??
      sizes?.[0].height ??
      (showResiduals ? 326 : 474) + legendHeight,
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
  const observations = candidates[0].request.dataset.rows.filter(
    (row): row is typeof row & { x: number; y: number } =>
      row.x !== null && row.y !== null,
  );
  const includedIds = new Set(
    observations
      .filter(
        (row) =>
          row.included && !candidates[0].settings.excludedIds.includes(row.id),
      )
      .map((row) => row.id),
  );
  const errorBars = showErrorBars
    ? suppliedYErrorBars(candidates[0].request)
    : { bars: [], unavailable: 0 };
  // Measurement uncertainties remain meaningful when a row is excluded from fitting.
  const bars = errorBars.bars;
  const { logX, logY } = axes;
  const visibleObservations = observations.filter(
    (row) => (!logX || row.x > 0) && (!logY || row.y > 0),
  );
  const xDomain =
    axes.xRange ??
    automaticDomain(
      observations.map((row) => row.x),
      logX,
      0.06,
    );
  const sample = Array.from({ length: 420 }, (_, i) =>
    plotScale(xDomain, logX).value(i / 419),
  );
  const curveSamples = candidates.map((candidate) =>
    candidate.result
      ? sampleModelCurve(candidate.settings, candidate.result, xDomain, logX)
      : { points: [], samplingUnavailable: false },
  );
  const curves = curveSamples.map((curve) => curve.points);
  const unavailableCurves = curveSamples.flatMap((curve, index) =>
    curve.samplingUnavailable ? [index + 1] : [],
  );
  const curveNotice = unavailableCurves.length
    ? `${unavailableCurves.length === 1 ? "Curve" : "Curves"} ${unavailableCurves.join(", ")} unavailable at this period/view; zoom in or use a valid period.`
    : null;
  const guideCurves = guides.map((guide) => ({
    ...guide,
    points:
      guide.axis === "x"
        ? []
        : sample.map((x) => ({
            x,
            y: modelGuideValues(
              x,
              candidates[guide.candidateIndex].settings,
              candidates[guide.candidateIndex].result!.coefficients,
            ).find((value) => value.id === guide.id)!.value,
          })),
  }));
  const yDomain =
    axes.yRange ??
    automaticDomain(
      [
        ...observations.map((row) => row.y),
        ...bars.flatMap((bar) => [bar.lower, bar.upper]),
        ...curves.flatMap((curve) => curve.map((point) => point.y)),
        ...guideCurves.flatMap((guide) => guide.points.map((point) => point.y)),
      ],
      logY,
      0.12,
    );
  const xScale = plotScale(xDomain, logX);
  const yScale = plotScale(yDomain, logY);
  const xTicks = xScale.ticks(6);
  const yTicks = yScale.ticks(5);
  const x = (value: number) =>
    left + xScale.fraction(value) * (width - left - right);
  const y = (value: number) =>
    top + (1 - yScale.fraction(value)) * (height - top - bottom);
  const residualHeight = sizedResidualHeight ?? sizes?.[1]?.height ?? 148,
    residualTop = sizes ? Math.max(6, font * 0.6) : 8,
    residualBottom = Math.max(40, font * 3.3);
  const residualMaximum = candidates.reduce(
    (maximum, candidate) =>
      (candidate.result?.residuals ?? []).reduce(
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
  const drag = useRef<{
    x: number;
    y: number;
    pointerId: number;
    mode: SelectionMode;
    rowId: string | null;
  } | null>(null);
  const [rubberBand, setRubberBand] = useState<SelectionRectangle | null>(null);
  function localPoint(svg: SVGSVGElement, clientX: number, clientY: number) {
    const matrix = svg.getScreenCTM();
    if (!matrix) return null;
    const point = new DOMPoint(clientX, clientY).matrixTransform(
      matrix.inverse(),
    );
    return {
      x: Math.max(left, Math.min(width - right, point.x)),
      y: Math.max(top, Math.min(height - bottom, point.y)),
    };
  }
  function cancelSelection() {
    drag.current = null;
    setRubberBand(null);
  }
  return (
    <div className="comparison-plot-wrap">
      {onAxes && (
        <div className="fit-axis-controls">
          {(["X", "Y"] as const).map((axis) => (
            <AxisControls
              key={axis}
              axis={axis}
              label="Comparison"
              domain={axis === "X" ? xDomain : yDomain}
              custom={!!(axis === "X" ? axes.xRange : axes.yRange)}
              log={axis === "X" ? logX : logY}
              onChange={(range) =>
                onAxes({ ...axes, [axis === "X" ? "xRange" : "yRange"]: range })
              }
              onLogChange={(log) =>
                onAxes({
                  ...axes,
                  [axis === "X" ? "logX" : "logY"]: log,
                  [axis === "X" ? "xRange" : "yRange"]: null,
                })
              }
            />
          ))}
        </div>
      )}
      {visibleObservations.length < observations.length && (
        <p className="fit-log-notice" role="note">
          {observations.length - visibleObservations.length} nonpositive
          observation(s) cannot be shown on logarithmic axes; fit inclusion is
          unchanged.
        </p>
      )}
      {logY && bars.some((bar) => bar.lower <= 0 && bar.upper > 0) && (
        <p className="fit-log-notice" role="note">
          Uncertainty intervals reaching zero or below are clipped at the lower
          plot edge.
        </p>
      )}
      <svg
        data-x-scale={logX ? "log" : "linear"}
        data-y-scale={logY ? "log" : "linear"}
        className="comparison-plot"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Compared fitted curves"
        style={svgStyle}
        data-x-min={xDomain[0]}
        data-x-max={xDomain[1]}
        data-guide-minimum-height={
          guideLabels.height ? top + bottom + font * 2.5 : undefined
        }
        data-guide-minimum-width={
          guideLabels.height
            ? left + right + guideLabels.minimumWidth
            : undefined
        }
        tabIndex={onSelect ? 0 : undefined}
        onKeyDown={(event) => {
          if (event.key === "Escape") cancelSelection();
        }}
        onPointerDown={(event) => {
          if (!onSelect || event.button !== 0) return;
          const point = localPoint(
            event.currentTarget,
            event.clientX,
            event.clientY,
          );
          if (!point) return;
          drag.current = {
            ...point,
            pointerId: event.pointerId,
            mode: event.altKey
              ? "subtract"
              : event.shiftKey
                ? "add"
                : "replace",
            rowId:
              (event.target as Element)
                .closest("[data-row-id]")
                ?.getAttribute("data-row-id") ?? null,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
          event.currentTarget.focus();
        }}
        onPointerMove={(event) => {
          const start = drag.current;
          if (!start || event.pointerId !== start.pointerId) return;
          const point = localPoint(
            event.currentTarget,
            event.clientX,
            event.clientY,
          );
          if (point && Math.hypot(point.x - start.x, point.y - start.y) >= 4)
            setRubberBand({
              x0: start.x,
              y0: start.y,
              x1: point.x,
              y1: point.y,
            });
        }}
        onPointerUp={(event) => {
          const start = drag.current;
          if (!start || event.pointerId !== start.pointerId) return;
          const point = localPoint(
            event.currentTarget,
            event.clientX,
            event.clientY,
          );
          cancelSelection();
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
          if (!point) return;
          if (Math.hypot(point.x - start.x, point.y - start.y) < 4) {
            if (start.rowId) onToggle?.(start.rowId);
            return;
          }
          const worldX = (v: number) =>
            xScale.value((v - left) / (width - left - right));
          const worldY = (v: number) =>
            yScale.value(1 - (v - top) / (height - top - bottom));
          onSelect?.(
            {
              x0: worldX(start.x),
              x1: worldX(point.x),
              y0: worldY(start.y),
              y1: worldY(point.y),
            },
            start.mode,
          );
        }}
        onPointerCancel={cancelSelection}
        onLostPointerCapture={cancelSelection}
        data-y-min={yDomain[0]}
        data-y-max={yDomain[1]}
      >
        <desc>
          {candidates
            .map(
              (candidate, i) =>
                `${i + 1}: ${candidate.label}; ${modelDisplayName(candidate.settings)}; data: ${candidate.request.dataset.label}`,
            )
            .join(". ")}
        </desc>
        {errorBars.unavailable > 0 && (
          <desc data-plot-notice="true">
            Some supplied error bars exceed the numeric range and are
            unavailable.
          </desc>
        )}
        {curveNotice && <desc data-plot-notice="true">{curveNotice}</desc>}
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
            >{`${i + 1}: ${modelDisplayName(candidate.settings)}`}</text>
          </g>
        ))}
        <FitGuideLegend
          layout={guideLabels}
          left={left}
          top={candidateLegendHeight}
          fontSize={font}
        />
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
            {logX ? " (log scale)" : ""}
            {candidates[0].request.dataset.xColumn.unit
              ? ` [${candidates[0].request.dataset.xColumn.unit}]`
              : ""}
          </text>
        )}
        <YAxisTitle
          label={`${candidates[0].request.dataset.yColumn.label}${logY ? " (log scale)" : ""}`}
          unit={candidates[0].request.dataset.yColumn.unit ?? null}
          x={font * 1.1}
          y={top + (height - top - bottom) / 2}
          splitUnit={!!sizes}
          fontSize={font}
        />
        <g clipPath={`url(#${clipId}-data)`}>
          {guideCurves.map((guide) => {
            const attributes = {
              className: `model-guide model-guide-${guide.id} comparison-curve-${guide.candidateIndex + 1}`,
              "aria-label": `${candidates[guide.candidateIndex].label}: ${guide.label}`,
              "data-candidate-index": guide.candidateIndex,
            };
            return guide.axis === "x" ? (
              Number.isFinite(guide.value) &&
              guide.value >= xDomain[0] &&
              guide.value <= xDomain[1] ? (
                <line
                  key={`${guide.candidateIndex}-${guide.id}`}
                  {...attributes}
                  data-guide-axis="x"
                  data-guide-value={guide.value}
                  x1={x(guide.value)}
                  x2={x(guide.value)}
                  y1={top}
                  y2={height - bottom}
                />
              ) : null
            ) : (
              <path
                key={`${guide.candidateIndex}-${guide.id}`}
                {...attributes}
                d={plotPath(guide.points, x, y)}
              />
            );
          })}
          {bars
            .filter(
              (bar) =>
                (!logX || bar.x > 0) &&
                (!logY ||
                  (bar.upper > 0 &&
                    visibleObservations.some((row) => row.id === bar.id))),
            )
            .map((bar) => (
              <path
                key={bar.id}
                className="comparison-error-bar"
                data-row-id={bar.id}
                d={`M${x(bar.x)},${y(logY ? Math.max(yDomain[0], bar.lower) : bar.lower)}V${y(bar.upper)}${logY && bar.lower < yDomain[0] ? "" : ` M${x(bar.x) - 3},${y(bar.lower)}h6`} M${x(bar.x) - 3},${y(bar.upper)}h6`}
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
          {visibleObservations.map((row) => (
            <circle
              key={row.id}
              data-row-id={row.id}
              data-included={includedIds.has(row.id)}
              className={`comparison-point ${includedIds.has(row.id) ? "" : "is-excluded"}`}
              cx={x(row.x)}
              cy={y(row.y)}
              r={markerRadius}
            />
          ))}
        </g>
        {rubberBand && (
          <rect
            className="comparison-selection-box"
            x={Math.min(rubberBand.x0, rubberBand.x1)}
            y={Math.min(rubberBand.y0, rubberBand.y1)}
            width={Math.abs(rubberBand.x1 - rubberBand.x0)}
            height={Math.abs(rubberBand.y1 - rubberBand.y0)}
          />
        )}
      </svg>
      {!sizes && curveNotice && (
        <p className="fit-log-notice" role="note">
          {curveNotice}
        </p>
      )}
      {showResiduals && candidates.every((candidate) => candidate.result) && (
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
            {logX ? " (log scale)" : ""}
            {candidates[0].request.dataset.xColumn.unit
              ? ` [${candidates[0].request.dataset.xColumn.unit}]`
              : ""}
          </text>
          <g clipPath={`url(#${clipId}-residual)`}>
            {candidates.flatMap((candidate, candidateIndex) =>
              (candidate.result?.residuals ?? [])
                .filter((row) => !logX || row.x > 0)
                .map((row) =>
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
                      className={`comparison-residual-${candidateIndex + 1}`}
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

function comparisonModelName(
  candidates: readonly Pick<ComparisonCandidate, "id" | "settings">[],
  id: string,
) {
  const candidate = candidates.find((item) => item.id === id);
  return candidate ? modelDisplayName(candidate.settings) : "Unknown model";
}

function ComparisonPrintReport({
  axes,
  candidates,
  comparison,
  showResiduals,
  showErrorBars,
  showGuides,
  onClose,
}: {
  axes: ComparisonAxes;
  candidates: ComparisonCandidate[];
  comparison: ComparisonResult;
  showResiduals: boolean;
  showErrorBars: boolean;
  showGuides: boolean;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [fullPageGraph, setFullPageGraph] = useState(false);
  const [error, setError] = useState("");
  useModalDialog(dialog, ".fit-print-trigger");
  const rows: Array<[string, (metric: ComparisonMetrics) => string]> = [
    ["Model", (m) => comparisonModelName(candidates, m.id)],
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
                  axes={axes}
                  candidates={candidates}
                  showResiduals={showResiduals}
                  showErrorBars={showErrorBars}
                  showGuides={showGuides}
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
                {candidate.label}: {modelDisplayName(candidate.settings)};
                source: {candidate.request.dataset.label}; inference:{" "}
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
  exportCode: (target: "scipy" | "root") => CodeExportBundle | null;
  session: () => ComparisonWorkspace;
};

export default function ModelComparison({
  source,
  sourceResult,
  initialWorkspace: saved,
  analysisControl,
  showResiduals,
  showErrorBars,
  showGuides,
  onErrorBarsChange,
  onReady,
  onDirty,
  exportSizes,
  advancedFeatures = false,
  ref,
}: {
  source: Analysis;
  sourceResult: FitResult | null;
  initialWorkspace?: ComparisonWorkspace;
  analysisControl: ((uncertaintyControl: ReactNode) => ReactNode) | null;
  showResiduals: boolean;
  showErrorBars: boolean;
  showGuides: boolean;
  onErrorBarsChange: (show: boolean) => void;
  onReady: (ready: boolean) => void;
  onDirty: () => void;
  exportSizes?: ExportPlotSize[];
  advancedFeatures?: boolean;
  ref?: Ref<ModelComparisonActions>;
}) {
  const [drafts, setDrafts] = useState<Draft[]>(
    () =>
      saved?.candidates.map(({ label, analysis }) => ({
        label,
        request: analysis.request,
        settings: analysis.settings,
        dataTable: analysis.dataTable,
        originalRequest: analysis.originalRequest,
      })) ?? [fromCurrent(source, sourceResult), alternate(source)],
  );
  const [activeCandidate, setActiveCandidate] = useState(
    saved?.activeCandidate ?? 0,
  );
  const previousSource = useRef(source.request);
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [fitted, setFitted] = useState<ComparisonCandidate[] | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [axes, setAxes] = useState<ComparisonAxes>({
    xRange: null,
    yRange: null,
    logX: false,
    logY: false,
  });
  const [invalid, setInvalid] = useState<Record<string, boolean>>({});
  const invalidDraft = Object.values(invalid).some(Boolean);
  const invalidCallbacks = useMemo(
    () =>
      drafts.map(
        (_, i) => (value: boolean) =>
          setInvalid((previous) =>
            previous[`candidate-${i}`] === value
              ? previous
              : { ...previous, [`candidate-${i}`]: value },
          ),
      ),
    [drafts.length],
  );
  const ready = !!comparison?.compatible && !!fitted && !busy && !invalidDraft;
  const [selectionHistory, setSelectionHistory] = useState<FitSettings[][]>([]);
  const observations = drafts[0].request.dataset.rows;
  const selectionAvailable = drafts.every(
    (d) =>
      JSON.stringify(
        d.request.dataset.rows.map((row) => [row.x, row.y, row.included]),
      ) ===
      JSON.stringify(
        drafts[0].request.dataset.rows.map((row) => [
          row.x,
          row.y,
          row.included,
        ]),
      ),
  );
  const usedCount = observations.filter(
    (row) =>
      row.included &&
      row.x !== null &&
      row.y !== null &&
      !drafts[0].settings.excludedIds.includes(row.id),
  ).length;
  useEffect(() => {
    const previous = previousSource.current;
    previousSource.current = source.request;
    if (
      previous.dataset.rows !== source.request.dataset.rows ||
      previous.requestId !== source.request.requestId ||
      (drafts.every((d) => d.request.dataset.rows.length === 0) &&
        source.request.dataset.rows.length > 0)
    ) {
      useSharedData(source);
    }
  }, [source.request]);
  useEffect(() => onReady(ready), [ready, onReady]);
  useImperativeHandle(ref, () => ({
    copy,
    exportCode,
    session,
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
    () => [
      ...new Set(
        drafts
          .slice(1)
          .flatMap((draft) => comparisonCompatibility(drafts[0], draft)),
      ),
    ],
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
  function changeAll(next: Draft[]) {
    revision.current += 1;
    setBusy(false);
    setDrafts(next);
    setComparison(null);
    setFitted(null);
    setError("");
    setNotice("");
    onDirty();
  }
  function change(index: number, draft: Draft) {
    changeAll(drafts.map((value, i) => (i === index ? draft : value)));
  }
  function useSharedData(analysis: Analysis) {
    setAxes({ xRange: null, yRange: null, logX: false, logY: false });
    setSelectionHistory([]);
    setInvalid({});
    changeAll(
      drafts.map((draft) => ({
        ...analysis,
        label: draft.label,
        settings: {
          ...draft.settings,
          excludedIds: analysis.settings.excludedIds.slice(),
          retainedPerRowUncertainty:
            analysis.settings.retainedPerRowUncertainty,
          conditionalInference: analysis.settings.conditionalInference,
          physicalTimeConfirmed: analysis.settings.physicalTimeConfirmed,
          selectionAfterInspection: analysis.settings.selectionAfterInspection,
        },
      })),
    );
  }
  function selectPoints(box: SelectionRectangle, mode: SelectionMode) {
    if (!selectionAvailable) return;
    setSelectionHistory((previous) => [
      ...previous,
      drafts.map((d) => d.settings),
    ]);
    changeAll(
      drafts.map((draft) => ({
        ...draft,
        settings: {
          ...draft.settings,
          excludedIds: rectangleExclusions(
            draft.request.dataset.rows,
            box,
            draft.settings.excludedIds,
            mode,
          ),
          selectionAfterInspection: true,
        },
      })),
    );
  }
  function togglePoint(id: string) {
    if (!selectionAvailable) return;
    const index = observations.findIndex((row) => row.id === id);
    const row = observations[index];
    if (!row?.included || row.x === null || row.y === null) return;
    const excluded = drafts[0].settings.excludedIds.includes(id);
    setSelectionHistory((previous) => [
      ...previous,
      drafts.map((d) => d.settings),
    ]);
    changeAll(
      drafts.map((draft) => {
        const rowId = draft.request.dataset.rows[index].id;
        const ids = new Set(draft.settings.excludedIds);
        if (excluded) ids.delete(rowId);
        else ids.add(rowId);
        return {
          ...draft,
          settings: {
            ...draft.settings,
            excludedIds: [...ids],
            selectionAfterInspection: true,
          },
        };
      }),
    );
  }
  function exportCode(target: "scipy" | "root") {
    if (!ready || !fitted) return null;
    const plot = document.querySelector(
      ".comparison-workspace > .comparison-plot-wrap .comparison-plot",
    );
    const xRange = [
      Number(plot?.getAttribute("data-x-min")),
      Number(plot?.getAttribute("data-x-max")),
    ] as [number, number];
    const yRange = [
      Number(plot?.getAttribute("data-y-min")),
      Number(plot?.getAttribute("data-y-max")),
    ] as [number, number];
    const files: Record<string, string> = {
      "README.md":
        "# Model comparison analyses\n\nEach candidate folder contains its own CSV, model setup, and executable analysis. Run each from its folder. comparison.tsv contains the Data Tool comparison.\n",
      "comparison.tsv": comparisonText(),
    };
    fitted.forEach((candidate, i) => {
      const bundle = generateCodeExportBundle(
        buildCodeExportDescription(
          candidate.request,
          candidate.settings,
          candidate.result,
          {
            mode: axes.logX
              ? axes.logY
                ? "log-log"
                : "log-x"
              : axes.logY
                ? "log-y"
                : "linear",
            xRange,
            yRange,
            showResiduals,
            showErrorBars,
            showGuides,
          },
        ),
        target,
      );
      for (const [name, contents] of Object.entries(bundle.files))
        files[`candidate-${i + 1}/${name}`] = contents;
    });
    return {
      archiveName: `model-comparison-${target}.zip`,
      directoryName: `model-comparison-${target}`,
      files,
    };
  }
  function session(): ComparisonWorkspace {
    if (invalidDraft || busy)
      throw new Error(
        "Finish the fit and apply or restore incomplete candidate settings before saving.",
      );
    return {
      kind: "model-comparison",
      activeCandidate,
      candidates: drafts.map((draft) => ({
        label: draft.label,
        analysis: analysisSchema.parse({
          request: draft.request,
          settings: draft.settings,
          originalRequest: draft.originalRequest,
          dataTable: draft.dataTable,
          engine: sessionEngine(draft.settings),
        }),
      })),
    };
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
    if (invalidDraft || !usedCount) return;
    if (incompatibilities.length) {
      setError(`Comparison blocked: ${incompatibilities.join("; ")}.`);
      return;
    }
    const token = ++revision.current;
    setBusy(true);
    setComparison(null);
    setFitted(null);
    setError("");
    setNotice("Refitting all candidates…");
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
      if (session.workspace.kind !== "single-fit")
        throw new Error(
          "Open workspace sessions through Data… to restore the whole workspace.",
        );
      if (revision.current !== token) return;
      setActiveCandidate(index);
      change(index, {
        label: file.name.replace(/\.trksess$/i, ""),
        request: session.request,
        settings: session.settings,
        originalRequest: session.originalRequest,
        dataTable: session.dataTable,
      });
    } catch (cause) {
      if (revision.current !== token) return;
      setError(
        `Candidate ${index + 1} was not changed: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
    }
  }
  function comparisonText() {
    if (!comparison?.compatible) return "";
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
        comparisonModelName(fitted ?? [], metric.id),
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
    return (
      text +
      "\n\n" +
      (fitted ?? [])
        .map(
          (candidate) =>
            `${candidate.label}\n${weightingText(candidate.request)}\n${fitReportTsv(candidate.request, candidate.settings, candidate.result)}`,
        )
        .join("\n\n")
    );
  }
  async function copy() {
    if (!ready) return;
    try {
      await navigator.clipboard.writeText(comparisonText());
      setNotice("Comparison table copied");
    } catch {
      setError("Clipboard unavailable.");
    }
  }
  const uncertaintyControl = (
    <div className="comparison-column-uncertainty">
      <label>
        Y uncertainty model
        <select
          aria-label="Comparison Y uncertainty model"
          value={drafts[0].request.uncertainty.kind}
          disabled={busy}
          onChange={(event) => {
            try {
              changeAll(
                drafts.map((draft) => ({
                  ...draft,
                  ...switchNoiseModel(
                    draft.request,
                    draft.settings,
                    event.target.value as FitRequest["uncertainty"]["kind"],
                  ),
                })),
              );
            } catch (cause) {
              setError(String(cause));
            }
          }}
        >
          <option value="unknown-equal">
            Unknown · estimate equal scatter
          </option>
          <option value="supplied-common">Supplied common σ</option>
          {drafts.every(
            (d) =>
              d.request.uncertainty.kind === "supplied-per-row" ||
              d.settings.retainedPerRowUncertainty,
          ) && (
            <option value="supplied-per-row">Supplied per observation</option>
          )}
        </select>
      </label>
      {drafts[0].request.uncertainty.kind === "supplied-common" && (
        <label>
          {`Uniform σᵧ [${drafts[0].request.dataset.yColumn.unit ?? "unspecified"}]`}
          <EditableNumber
            aria-label="Comparison Y uncertainty"
            value={drafts[0].request.uncertainty.sigmaY}
            isValid={(value) => value > 0}
            onInvalidChange={(value) =>
              setInvalid((previous) => ({ ...previous, sigma: value }))
            }
            onRestoreInvalid={() => {}}
            onChange={(sigmaY) =>
              changeAll(
                drafts.map((draft) => ({
                  ...draft,
                  request: {
                    ...draft.request,
                    uncertainty: {
                      kind: "supplied-common",
                      sigmaY,
                      errorStructure: draft.request.uncertainty.errorStructure,
                      provenance: {
                        kind: "user-asserted",
                        description: "Common sigma edited in model comparison",
                      },
                    },
                  },
                })),
              )
            }
          />
        </label>
      )}
      <p className="comparison-weighting">{weightingText(drafts[0].request)}</p>
      <p>Showing or hiding error bars does not change these fitting weights.</p>
    </div>
  );
  return (
    <section className="model-comparison">
      <aside className="comparison-controls">
        {analysisControl?.(uncertaintyControl)}
        <h2>Models</h2>
        <div
          className="comparison-candidate-tabs"
          role="tablist"
          aria-label="Candidate models"
        >
          {drafts.map((_, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={activeCandidate === i}
              onClick={() => {
                onDirty();
                setActiveCandidate(i);
              }}
            >
              Candidate {i + 1}
            </button>
          ))}
        </div>
        {drafts.map((draft, i) => (
          <fieldset key={i} disabled={busy} hidden={i !== activeCandidate}>
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
            <ModelSelector
              label="Model"
              ariaLabel={`Candidate ${i + 1} model`}
              value={draft.settings.model}
              advancedFeatures={advancedFeatures}
              onChange={(value) =>
                change(i, {
                  ...draft,
                  settings: settingsFor(value as FitSettings["model"], draft),
                })
              }
            />
            <CandidateSettings
              key={`${draft.request.requestId}-${draft.settings.model}`}
              draft={draft}
              labelPrefix={`Candidate ${i + 1}`}
              result={fitted?.[i].result}
              advancedFeatures={advancedFeatures}
              onChange={(next) => change(i, next)}
              onInvalid={invalidCallbacks[i]}
            />
            <p className="comparison-candidate-weighting">
              {weightingText(draft.request)}
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
            {drafts.length > 2 && (
              <button
                onClick={() => {
                  setInvalid({});
                  setSelectionHistory([]);
                  setActiveCandidate(0);
                  changeAll(drafts.filter((_, index) => index !== i));
                }}
              >
                Remove candidate
              </button>
            )}
          </fieldset>
        ))}
        <button
          disabled={busy || drafts.length >= 6}
          onClick={() => {
            setSelectionHistory([]);
            setActiveCandidate(drafts.length);
            changeAll([
              ...drafts,
              {
                ...alternate(drafts[0]),
                label: `Candidate ${drafts.length + 1}`,
              },
            ]);
          }}
        >
          Add model
        </button>
        <section className="comparison-shared-controls">
          <h2>Shared data and assumptions</h2>
          <p>
            {drafts[0].request.dataset.label} · {usedCount} of{" "}
            {observations.length} observations included
          </p>
          <button onClick={() => useSharedData(source)}>
            Use opened data for all models
          </button>
          {incompatibilities.length > 0 && (
            <button onClick={() => useSharedData(drafts[0])}>
              Use candidate 1 data for all models
            </button>
          )}
          <Assumptions
            checked={drafts.every((d) => d.settings.conditionalInference)}
            onChange={(checked) =>
              changeAll(
                drafts.map((d) => ({
                  ...d,
                  settings: { ...d.settings, conditionalInference: checked },
                })),
              )
            }
          />
        </section>
        <button
          className="fit-primary"
          disabled={
            busy || invalidDraft || !usedCount || incompatibilities.length > 0
          }
          onClick={run}
        >
          {busy ? "Comparing…" : "Refit and compare"}
        </button>

        <p>
          All candidates are refitted here; no separate single fit is required.
          Formal criteria require the same observations, exclusions,
          uncertainties, and likelihood assumptions.
        </p>
      </aside>
      <main className="comparison-workspace">
        <header>
          <div>
            <h1>Model comparison</h1>
            <p>Relative support among the fitted candidates</p>
          </div>
          <p role="status">
            {notice ||
              "Configure models, choose shared data and uncertainties, then compare."}
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
        <p className="comparison-fit-basis">
          {usedCount} observations · {weightingText(drafts[0].request)}
        </p>
        <label
          className="comparison-error-control"
          title="Supplied marginal y uncertainty, ±1 standard deviation. Only shown on the data plot."
        >
          <input
            type="checkbox"
            checked={
              showErrorBars &&
              drafts[0].request.uncertainty.kind !== "unknown-equal"
            }
            disabled={drafts[0].request.uncertainty.kind === "unknown-equal"}
            onChange={(event) => onErrorBarsChange(event.target.checked)}
          />
          {drafts[0].request.uncertainty.kind === "unknown-equal"
            ? "Error bars unavailable · σ unknown"
            : "Show y error bars (±1σ)"}
        </label>
        <p className="comparison-selection-help">
          Click a point to toggle · Drag to select · Shift-drag adds ·
          Option/Alt-drag excludes · Selection applies to all models
        </p>
        <ComparisonPlot
          axes={axes}
          onAxes={setAxes}
          candidates={
            fitted && !invalidDraft
              ? fitted
              : drafts.map((draft, i) => ({
                  ...draft,
                  id: `candidate-${i + 1}`,
                }))
          }
          showResiduals={showResiduals}
          showErrorBars={showErrorBars}
          showGuides={showGuides}
          onSelect={!busy && selectionAvailable ? selectPoints : undefined}
          onToggle={togglePoint}
        />
        <details className="comparison-observations">
          <summary>Observations & exclusions · {usedCount} included</summary>
          <p>
            Selection applies to all models. Source-excluded and missing rows
            remain excluded.
          </p>
          <button
            disabled={!selectionHistory.length}
            onClick={() => {
              const previous = selectionHistory[selectionHistory.length - 1];
              setSelectionHistory((history) => history.slice(0, -1));
              changeAll(
                drafts.map((d, i) => ({
                  ...d,
                  settings: {
                    ...d.settings,
                    excludedIds: previous[i].excludedIds.slice(),
                    selectionAfterInspection:
                      previous[i].selectionAfterInspection,
                  },
                })),
              );
            }}
          >
            Undo selection
          </button>
          <button
            disabled={!drafts[0].settings.excludedIds.length}
            onClick={() => {
              setSelectionHistory((history) => [
                ...history,
                drafts.map((d) => d.settings),
              ]);
              changeAll(
                drafts.map((d) => ({
                  ...d,
                  settings: {
                    ...d.settings,
                    excludedIds: [],
                    selectionAfterInspection: true,
                  },
                })),
              );
            }}
          >
            Include all available points
          </button>
          <div className="comparison-observation-scroll">
            <table aria-label="Comparison observations">
              <thead>
                <tr>
                  <th>Use</th>
                  <th>Row</th>
                  <th>
                    {drafts[0].request.dataset.xColumn.label} [
                    {drafts[0].request.dataset.xColumn.unit ?? "unspecified"}]
                  </th>
                  <th>
                    {drafts[0].request.dataset.yColumn.label} [
                    {drafts[0].request.dataset.yColumn.unit ?? "unspecified"}]
                  </th>
                  <th>σ y used</th>
                </tr>
              </thead>
              <tbody>
                {observations.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Include ${row.id}`}
                        checked={
                          row.included &&
                          row.x !== null &&
                          row.y !== null &&
                          !drafts[0].settings.excludedIds.includes(row.id)
                        }
                        disabled={
                          !row.included ||
                          row.x === null ||
                          row.y === null ||
                          busy ||
                          !selectionAvailable
                        }
                        onChange={() => togglePoint(row.id)}
                      />
                    </td>
                    <th>{row.id}</th>
                    <td>{row.x ?? "Missing"}</td>
                    <td>{row.y ?? "Missing"}</td>
                    <td>
                      {drafts[0].request.uncertainty.kind === "unknown-equal"
                        ? "Estimated"
                        : drafts[0].request.uncertainty.kind ===
                            "supplied-common"
                          ? drafts[0].request.uncertainty.sigmaY
                          : (drafts[0].request.uncertainty.sigmaByRow[row.id] ??
                            "Missing")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
        {comparison?.compatible && fitted && !invalidDraft ? (
          <>
            {exportSizes && (
              <div className="fit-export-render" aria-hidden="true" inert>
                <ComparisonPlot
                  axes={axes}
                  candidates={fitted}
                  showResiduals={showResiduals}
                  showErrorBars={showErrorBars}
                  showGuides={showGuides}
                  sizes={exportSizes}
                />
              </div>
            )}
            {printOpen &&
              createPortal(
                <ComparisonPrintReport
                  axes={axes}
                  candidates={fitted}
                  comparison={comparison}
                  showResiduals={showResiduals}
                  showErrorBars={showErrorBars}
                  showGuides={showGuides}
                  onClose={() => setPrintOpen(false)}
                />,
                document.querySelector(".fit-app")!,
              )}
            <details className="comparison-statistics-help">
              <summary>How to read these statistics</summary>
              <p>
                First inspect the residuals and supplied uncertainties; then
                compare models. Every model here uses the same included
                observations and uncertainty treatment.
              </p>
              <dl>
                <dt>n, k model, and df</dt>
                <dd>
                  n is the included observation count; k counts adjustable curve
                  parameters, excluding fixed parameters. Residual degrees of
                  freedom are df = n − k.
                </dd>
                <dt>χ² or SSE</dt>
                <dd>
                  With supplied σ, χ² = Σ[(y − fitted y)/σ]². Without supplied
                  σ, SSE = Σ(y − fitted y)² in squared Y units. Smaller means
                  closer agreement with the observations, before accounting for
                  extra parameters.
                </dd>
                <dt>χ²/df</dt>
                <dd>
                  Values near 1 are plausible when the model and supplied
                  uncertainties describe the data. Large values can reflect
                  model mismatch or underestimated uncertainties; unusually
                  small values can reflect overestimated uncertainties or
                  correlated errors. This is not proof that a model is correct.
                  It is unavailable as an independent check when scatter is
                  estimated from the same residuals.
                </dd>
                <dt>K likelihood and log L</dt>
                <dd>
                  K counts free curve parameters plus one if common variance is
                  estimated. log L measures agreement under the Gaussian
                  uncertainty model; larger is better before the parameter
                  penalty.
                </dd>
                <dt>AIC, AICc, and BIC</dt>
                <dd>
                  These scores balance agreement against parameter count. Lower
                  is preferred. AIC = 2K − 2 log L; BIC = K log n − 2 log L.
                  This app uses AIC with supplied absolute σ and AICc with
                  estimated common scatter. The AICc correction is approximate
                  for nonlinear models and requires n &gt; K + 1. Absolute
                  scores can be negative; compare differences, not closeness to
                  zero.
                </dd>
                <dt>Δ and Akaike weight</dt>
                <dd>
                  Δ is the chosen score minus the lowest eligible score.
                  Relative weights are proportional to exp(−Δ/2) and sum to 1
                  over eligible candidates. For two candidates with Δ = 0 and 4,
                  their weights are about 0.88 and 0.12. They describe relative
                  support within this set, not probabilities that a model is
                  true. All candidates can still be poor descriptions.
                </dd>
              </dl>
            </details>
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
                        <small>{comparisonModelName(fitted, metric.id)}</small>
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
            <details className="comparison-individual-results">
              <summary>Individual fit parameters and diagnostics</summary>
              <div className="comparison-diagnostics">
                {fitted.map((candidate) => (
                  <CandidateDiagnostics
                    key={candidate.id}
                    draft={candidate}
                    result={candidate.result}
                  />
                ))}
              </div>
            </details>
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
            Choose models and refit here. You can import data before any single
            fit, bring over the current custom equation, or configure a custom
            equation directly in a candidate panel.
          </div>
        )}
      </main>
    </section>
  );
}
