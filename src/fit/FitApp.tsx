import SourceNotes from "./SourceNotes";
import PrintPages from "./PrintPages";
import DisplayMenu from "./DisplayMenu";
import {
  appearanceStyle,
  defaultPlotAppearance,
  PlotAppearanceContext,
  PlotMarker,
  usePlotAppearance,
} from "./PlotAppearance";
import { exportPlotGraph } from "./graphExport";
import { AxisControls, YAxisControls, type AxisRange } from "./YAxisControls";
import MultiInterval, { type MultiIntervalActions } from "./MultiInterval";
import { FitErrorMessage } from "./FitErrorMessage";
import { customFromModel } from "../core/fit/customFromModel";
import { CustomEquationEditor } from "./CustomEquationEditor";
import Assumptions from "./Assumptions";
import CollisionDraft, { type CollisionActions } from "./CollisionDraft";
import {
  plotScale,
  linearDomain,
  positiveDomain,
  plotPath,
  type GraphMode,
} from "./plotScale";
import {
  nonlinearModels,
  nonlinearModelIds,
  isNonlinearModel,
  nonlinearParameterUnit,
  suggestedParameters,
} from "../core/fit/nonlinearModels";
import TrackerImport from "./TrackerImport";
import {
  parseTracker,
  parseTrackerArchive,
  type TrackerProject,
} from "../import/tracker";
import { ImportPanel } from "./ImportPanel";
import { switchNoiseModel } from "../core/fit/noiseModel";
import { suppliedYErrorBars } from "../core/fit/errorBars";
import { meanConfidenceBand } from "../core/fit/confidenceBand";
import {
  rectangleExclusions,
  type SelectionRectangle,
} from "../core/fit/selection";
import {
  fitReportTsv,
  fitReportRows,
  fitCorrelationMatrix,
  type ReportSections,
  nameSavedSession,
} from "../core/fit/report";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { isTauri, invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { predict, type FitResult } from "../core/fit/solve";
import {
  initialSettings,
  parameterNames,
  requestSchema,
  sessionSchema,
  sessionVersion,
  sessionEngine,
  type FitRequest,
  type FitSettings,
  type FitSession,
  type DataTable,
} from "../core/fit/schema";
import { emptyRequest } from "../core/fit/empty";
import { listen } from "@tauri-apps/api/event";
import "./fit.css";

import constantSpeedExample from "../../examples/data/constant-speed.csv?raw";
import springExtensionExample from "../../examples/data/spring-extension.csv?raw";
import ballTossExample from "../../examples/data/ball-toss.csv?raw";
import exponentialDecayExample from "../../examples/data/exponential-decay.csv?raw";
import oscillationExample from "../../examples/data/oscillation.csv?raw";
import unequalUncertaintiesExample from "../../examples/data/unequal-uncertainties.csv?raw";
import powerLawExample from "../../examples/data/power-law-free.csv?raw";
import gaussianExample from "../../examples/data/gaussian.csv?raw";
import dampedSineExample from "../../examples/data/damped-sine.csv?raw";
import lorentzianExample from "../../examples/data/lorentzian.csv?raw";
import collisionExample from "../../examples/data/collision.csv?raw";
import cartTrackExample from "../../examples/data/cart-track.csv?raw";
import bounceIntervalsExample from "../../examples/data/bounce-intervals.csv?raw";
import oilDropIntervalsExample from "../../examples/data/oil-drop-intervals.csv?raw";
import pulsarPhotonIndexTemperatureExample from "../../examples/data/published-pulsar-photon-index-vs-temperature.csv?raw";
import asassnRadioExample from "../../examples/data/published/asassn14li-radio.trksess?raw";
import asassnXrayExample from "../../examples/data/published/asassn14li-xray.trksess?raw";
import ba137mExample from "../../examples/data/published/ba137m-decay.trksess?raw";
import besiiiExample from "../../examples/data/published/besiii-ppbarpi0-continuum.trksess?raw";
import chromiumExample from "../../examples/data/published/cri-rydberg.trksess?raw";
import ionChamberThickExample from "../../examples/data/published/ion-chamber-wall-thick.trksess?raw";
import ionChamberThinExample from "../../examples/data/published/ion-chamber-wall-thin.trksess?raw";
import pulsarBlcExample from "../../examples/data/published/pulsar-luminosity-vs-blc.trksess?raw";
import pulsarEdotExample from "../../examples/data/published/pulsar-luminosity-vs-edot.trksess?raw";
import pwnBlcExample from "../../examples/data/published/pwn-luminosity-vs-blc.trksess?raw";
import pwnEdotExample from "../../examples/data/published/pwn-luminosity-vs-edot.trksess?raw";
import supercooledWaterExample from "../../examples/data/published/supercooled-water-viscosity.trksess?raw";
import ymno3Example from "../../examples/data/published/ymno3-spin-precession.trksess?raw";
import dyfeo3Example from "../../examples/data/published/dyfeo3-spin-wave.trksess?raw";

const examples = [
  ["Constant speed", "constant-speed.csv", constantSpeedExample],
  ["Spring extension", "spring-extension.csv", springExtensionExample],
  ["Ball toss", "ball-toss.csv", ballTossExample],
  ["Exponential decay", "exponential-decay.csv", exponentialDecayExample],
  ["Oscillation", "oscillation.csv", oscillationExample],
  [
    "Unequal uncertainties",
    "unequal-uncertainties.csv",
    unequalUncertaintiesExample,
  ],
  ["Power law", "power-law-free.csv", powerLawExample],
  ["Gaussian peak", "gaussian.csv", gaussianExample],
  ["Damped sine", "damped-sine.csv", dampedSineExample],
  ["Lorentzian peak", "lorentzian.csv", lorentzianExample],
  ["Collision", "collision.csv", collisionExample],
  ["Cart track", "cart-track.csv", cartTrackExample],
  ["Bounce intervals", "bounce-intervals.csv", bounceIntervalsExample],
  ["Oil-drop intervals", "oil-drop-intervals.csv", oilDropIntervalsExample],
] as const;
const publishedExamples = [
  [
    "YMnO₃ Z-mode spin precession",
    "published/ymno3-spin-precession.trksess",
    ymno3Example,
  ],
  [
    "DyFeO₃ coherent spin wave",
    "published/dyfeo3-spin-wave.trksess",
    dyfeo3Example,
  ],
  [
    "Pulsar / photon index vs temperature",
    "published-pulsar-photon-index-vs-temperature.csv",
    pulsarPhotonIndexTemperatureExample,
  ],
  [
    "ASASSN-14li radio",
    "published/asassn14li-radio.trksess",
    asassnRadioExample,
  ],
  ["ASASSN-14li X-ray", "published/asassn14li-xray.trksess", asassnXrayExample],
  ["Ba-137m decay", "published/ba137m-decay.trksess", ba137mExample],
  [
    "BESIII continuum",
    "published/besiii-ppbarpi0-continuum.trksess",
    besiiiExample,
  ],
  ["Chromium Rydberg series", "published/cri-rydberg.trksess", chromiumExample],
  [
    "Ion chamber, thick walls",
    "published/ion-chamber-wall-thick.trksess",
    ionChamberThickExample,
  ],
  [
    "Ion chamber, thin walls",
    "published/ion-chamber-wall-thin.trksess",
    ionChamberThinExample,
  ],
  [
    "Pulsar / light-cylinder field",
    "published/pulsar-luminosity-vs-blc.trksess",
    pulsarBlcExample,
  ],
  [
    "Pulsar / spin-down power",
    "published/pulsar-luminosity-vs-edot.trksess",
    pulsarEdotExample,
  ],
  [
    "PWN / light-cylinder field",
    "published/pwn-luminosity-vs-blc.trksess",
    pwnBlcExample,
  ],
  [
    "PWN / spin-down power",
    "published/pwn-luminosity-vs-edot.trksess",
    pwnEdotExample,
  ],
  [
    "Supercooled water",
    "published/supercooled-water-viscosity.trksess",
    supercooledWaterExample,
  ],
] as const;
type State = {
  request: FitRequest;
  settings: FitSettings;
  originalRequest?: FitRequest;
  dataTable?: DataTable;
};
const number = (v: number | null) =>
  v === null
    ? "Unavailable"
    : v.toLocaleString("en-US", { maximumSignificantDigits: 7 });
const equations = {
  ...(Object.fromEntries(
    nonlinearModelIds.map((m) => [m, nonlinearModels[m].equation]),
  ) as Record<(typeof nonlinearModelIds)[number], string>),
  line: "y = b + m x",
  quadratic: "y = c₀ + c₁ x + c₂ x²",
  cubic: "y = c0 + c1*x + c2*x² + c3*x³",
  quartic: "y = c0 + c1*x + c2*x² + c3*x³ + c4*x⁴",
  sine: "y = b + s sin(2πx/T) + c cos(2πx/T)",
  "sine-free-period": "y = b + s sin(2πx/T) + c cos(2πx/T)",
  exponential: "y = b + a exp(kx)",
  "power-law": "y = b + a (x/xref)^p",
  reciprocal: "y = b + a xref/x",
  logarithmic: "y = b + a ln(x / xref)",
  "constant-acceleration": "y = y₀ + v₀ t + ½ a t²",
};
function fresh(): State {
  return {
    request: emptyRequest(crypto.randomUUID(), crypto.randomUUID()),
    settings: initialSettings("line"),
  };
}
function xBounds(state: State): AxisRange {
  const xs = state.request.dataset.rows.flatMap((row) =>
    row.x === null ? [] : [row.x],
  );
  const lo = xs.reduce((a, b) => Math.min(a, b), Infinity);
  const hi = xs.reduce((a, b) => Math.max(a, b), -Infinity);
  return xs.length ? [lo, hi === lo ? lo + 1 : hi] : [0, 1];
}
function Plot({
  state,
  result,
  range: requestedRange,
  mode = "linear",
  residual,
  onToggle,
  onSelect,
  manual = false,
  showBand = false,
  showErrorBars = false,
  showXAxis = true,
  idPrefix = "",
  printSize,
  yRange,
  onYRange,
  onXRange,
  xCustom = false,
  onLogX,
  onLogY,
}: {
  state: State;
  result: FitResult | null;
  range: [number, number];
  mode?: GraphMode;
  residual: boolean;
  onToggle: (id: string) => void;
  onSelect?: (
    box: SelectionRectangle,
    mode: "replace" | "add" | "subtract",
  ) => void;
  manual?: boolean;
  showBand?: boolean;
  showErrorBars?: boolean;
  showXAxis?: boolean;
  idPrefix?: string;
  printSize?: { width: number; height: number };
  yRange?: AxisRange | null;
  onYRange?: (range: AxisRange | null) => void;
  onXRange?: (range: AxisRange | null) => void;
  xCustom?: boolean;
  onLogX?: (log: boolean) => void;
  onLogY?: (log: boolean) => void;
}) {
  const appearance = usePlotAppearance();
  const logX = mode === "log-x" || mode === "log-log";
  const logY = !residual && (mode === "log-y" || mode === "log-log");
  const positiveXs = state.request.dataset.rows.flatMap((r) =>
    r.x !== null && r.x >= requestedRange[0] && r.x <= requestedRange[1]
      ? [r.x]
      : [],
  );
  const range: [number, number] =
    logX && requestedRange[0] <= 0
      ? positiveDomain(positiveXs)
      : requestedRange;
  const xScale = plotScale(range, logX);
  const plotRef = useRef<SVGSVGElement>(null);
  const [plotSize, setPlotSize] = useState({
    width: 780,
    height: residual ? 160 : 280,
  });
  useEffect(() => {
    const svg = plotRef.current;
    if (!svg || idPrefix) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setPlotSize({ width, height });
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);
  const [rubberBand, setRubberBand] = useState<SelectionRectangle | null>(null);
  const drag = useRef<{
    x: number;
    y: number;
    pointerId: number;
    rowId: string | null;
    mode: "replace" | "add" | "subtract";
  } | null>(null);
  const suppressClick = useRef(false);
  const coeff =
    result?.coefficients ?? state.settings.parameters.map((p) => p.value);
  const hasData = state.request.dataset.rows.some(
    (r) => r.x !== null && r.y !== null,
  );
  const showModel = hasData && (!!result || manual);
  const rows = state.request.dataset.rows.filter(
    (r) =>
      (!residual || !!result) &&
      r.x !== null &&
      r.y !== null &&
      (!logX || r.x > 0) &&
      (!logY || r.y > 0) &&
      r.x >= range[0] &&
      r.x <= range[1] &&
      (!residual ||
        Number.isFinite(
          predict(
            r.x!,
            state.settings.model,
            coeff,
            state.settings.sinePeriod,
            state.settings.shape,
            state.settings.custom,
          ),
        )) &&
      !(
        residual &&
        ["logarithmic", "power-law", "reciprocal"].includes(
          state.settings.model,
        ) &&
        r.x <= 0
      ),
  );
  const ys = rows.map((r) =>
    residual
      ? r.y! -
        predict(
          r.x!,
          state.settings.model,
          coeff,
          state.settings.sinePeriod,
          state.settings.shape,
          state.settings.custom,
        )
      : r.y!,
  );
  const period = ["sine-free-period", "damped-sine"].includes(
    state.settings.model,
  )
    ? coeff[3]
    : (state.settings.sinePeriod ?? 2 * Math.PI);
  const cycles = ["sine", "sine-free-period", "damped-sine"].includes(
    state.settings.model,
  )
    ? (range[1] - range[0]) / period
    : 0;
  const curveCount =
    !showModel || cycles > 800 || !Number.isFinite(cycles)
      ? 0
      : Math.max(160, Math.ceil(cycles * 40));
  const curve = Array.from({ length: curveCount }, (_, i) => {
    const t = xScale.value(i / (curveCount - 1));
    return {
      x: t,
      y: predict(
        t,
        state.settings.model,
        coeff,
        state.settings.sinePeriod,
        state.settings.shape,
        state.settings.custom,
      ),
    };
  });
  const band =
    !residual && showBand && result
      ? meanConfidenceBand(
          curve.filter((p) => Number.isFinite(p.y)).map((p) => p.x),
          state.request,
          state.settings,
          result,
        )
      : null;
  const errorBars =
    !residual && showErrorBars
      ? suppliedYErrorBars(state.request)
      : { bars: [], unavailable: 0 };
  const visibleIds = new Set(rows.map((r) => r.id));
  const visibleErrorBars = errorBars.bars.filter(
    (bar) =>
      bar.x >= range[0] &&
      bar.x <= range[1] &&
      (!logX || bar.x > 0) &&
      (!logY || visibleIds.has(bar.id)),
  );
  const plottedY = [
    ...ys,
    ...visibleErrorBars.flatMap((bar) => [bar.lower, bar.upper]),
    ...(!residual ? curve.map((p) => p.y).filter(Number.isFinite) : []),
    ...(band?.points.flatMap((p) => [p.lower, p.upper]) ?? []),
  ];
  const residualExtent = ys.reduce((m, v) => Math.max(m, Math.abs(v)), 0.001);
  const linearY = residual
    ? [-residualExtent * 1.24, residualExtent * 1.24]
    : linearDomain(plottedY);
  const logDomain = positiveDomain(plottedY);
  const logPad = (Math.log10(logDomain[1]) - Math.log10(logDomain[0])) * 0.12;
  const ymin = logY
    ? Math.max(Number.MIN_VALUE, 10 ** (Math.log10(logDomain[0]) - logPad))
    : linearY[0];
  const ymax = logY
    ? Math.min(Number.MAX_VALUE, 10 ** (Math.log10(logDomain[1]) + logPad))
    : linearY[1];
  const yDomain: AxisRange =
    !residual && yRange && (!logY || yRange[0] > 0) ? yRange : [ymin, ymax];
  const yScale = plotScale(yDomain, logY);
  const hiddenCount = state.request.dataset.rows.filter(
    (r) =>
      r.x !== null &&
      r.y !== null &&
      r.x >= requestedRange[0] &&
      r.x <= requestedRange[1] &&
      ((logX && r.x <= 0) || (logY && r.y <= 0)),
  ).length;
  const clippedIntervals =
    logY &&
    (visibleErrorBars.some((bar) => bar.lower <= 0) ||
      band?.points.some((p) => p.lower <= 0));
  // Print SVGs keep their intrinsic aspect ratios, so the common drawing width
  // gives both plots exactly the same scale in the preview and on paper.
  const { width, height } = idPrefix
    ? (printSize ?? { width: 720, height: residual ? 134 : 236 })
    : plotSize;
  const left = 82,
    right = 36,
    top = 8,
    bottom = showXAxis ? 52 : 6;
  const x = (v: number) => left + xScale.fraction(v) * (width - left - right),
    y = (v: number) => top + (1 - yScale.fraction(v)) * (height - top - bottom);
  function localPoint(svg: SVGSVGElement, clientX: number, clientY: number) {
    // CSS zoom is inconsistently included in getScreenCTM across WebViews.
    // Pointer client coordinates and this rectangle share viewport CSS pixels.
    // Account for SVG's default xMidYMid meet alignment during resize as well.
    const bounds = svg.getBoundingClientRect();
    const scale = Math.min(bounds.width / width, bounds.height / height);
    if (!(scale > 0)) return null;
    const p = {
      x: (clientX - bounds.left - (bounds.width - width * scale) / 2) / scale,
      y: (clientY - bounds.top - (bounds.height - height * scale) / 2) / scale,
    };
    return {
      x: Math.max(left, Math.min(width - right, p.x)),
      y: Math.max(top, Math.min(height - bottom, p.y)),
    };
  }
  function cancelSelection() {
    drag.current = null;
    setRubberBand(null);
    suppressClick.current = true;
  }
  const excluded = new Set([
    ...state.settings.excludedIds,
    ...state.request.dataset.rows
      .filter((row) => !row.included)
      .map((row) => row.id),
  ]);
  return (
    <>
      {(!idPrefix || !residual) && (hiddenCount > 0 || clippedIntervals) && (
        <p className="fit-log-notice" role="note">
          {hiddenCount > 0
            ? `${hiddenCount} nonpositive observation(s) cannot be shown on logarithmic axes; fit inclusion is unchanged. `
            : ""}
          {clippedIntervals
            ? "Uncertainty intervals reaching zero or below are clipped at the lower plot edge."
            : ""}
        </p>
      )}
      {!residual && onYRange && (
        <div className="fit-axis-controls">
          {onXRange && (
            <AxisControls
              axis="X"
              label="Data"
              domain={range}
              custom={xCustom}
              log={logX}
              onLogChange={onLogX}
              onChange={onXRange}
            />
          )}
          <YAxisControls
            label="Data"
            domain={yDomain}
            custom={!!yRange}
            log={logY}
            onLogChange={onLogY}
            onChange={onYRange}
          />
        </div>
      )}
      <svg
        data-x-min={range[0]}
        data-x-max={range[1]}
        data-y-min={yDomain[0]}
        data-y-max={yDomain[1]}
        ref={plotRef}
        className="fit-plot"
        style={appearanceStyle(appearance)}
        viewBox={`0 0 ${width} ${height}`}
        width={idPrefix ? width : undefined}
        height={idPrefix ? height : undefined}
        data-x-scale={logX ? "log" : "linear"}
        data-y-scale={logY ? "log" : "linear"}
        role="img"
        aria-label={residual ? "Residual plot" : "Data and fitted curve"}
        tabIndex={residual ? undefined : 0}
        onKeyDown={(e) => {
          if (e.key === "Escape") cancelSelection();
        }}
        onPointerDown={(e) => {
          if (!onSelect || e.button !== 0) return;
          const p = localPoint(e.currentTarget, e.clientX, e.clientY);
          if (!p) return;
          suppressClick.current = false;
          drag.current = {
            ...p,
            pointerId: e.pointerId,
            mode: e.altKey ? "subtract" : e.shiftKey ? "add" : "replace",
            rowId:
              (e.target as Element)
                .closest(".point[data-row-id]")
                ?.getAttribute("data-row-id") ?? null,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
          e.currentTarget.focus();
        }}
        onPointerMove={(e) => {
          const start = drag.current;
          if (!start || e.pointerId !== start.pointerId) return;
          const p = localPoint(e.currentTarget, e.clientX, e.clientY);
          if (!p) return;
          if (Math.hypot(p.x - start.x, p.y - start.y) < 4) return;
          suppressClick.current = true;
          setRubberBand({ x0: start.x, y0: start.y, x1: p.x, y1: p.y });
        }}
        onPointerUp={(e) => {
          const start = drag.current;
          if (!start || e.pointerId !== start.pointerId) return;
          const p = localPoint(e.currentTarget, e.clientX, e.clientY);
          drag.current = null;
          setRubberBand(null);
          if (e.currentTarget.hasPointerCapture(e.pointerId))
            e.currentTarget.releasePointerCapture(e.pointerId);
          if (!p) return;
          if (Math.hypot(p.x - start.x, p.y - start.y) < 4) {
            if (start.rowId && !suppressClick.current) onToggle(start.rowId);
            return;
          }
          suppressClick.current = true;
          const worldX = (v: number) =>
            xScale.value((v - left) / (width - left - right));
          const worldY = (v: number) =>
            yScale.value(1 - (v - top) / (height - top - bottom));
          onSelect?.(
            {
              x0: worldX(start.x),
              y0: worldY(start.y),
              x1: worldX(p.x),
              y1: worldY(p.y),
            },
            start.mode,
          );
        }}
        onPointerCancel={cancelSelection}
        onLostPointerCapture={() => {
          if (drag.current) cancelSelection();
        }}
      >
        {showXAxis && (
          <text
            className="fit-axis-label"
            x={(left + width - right) / 2}
            y={height - 12}
            textAnchor="middle"
          >
            {state.request.dataset.xColumn.label}
            {logX ? " (log scale)" : ""}
            {state.request.dataset.xColumn.unit
              ? ` [${state.request.dataset.xColumn.unit}]`
              : ""}
          </text>
        )}
        <text
          className="fit-axis-label"
          transform={`translate(16 ${(top + height - bottom) / 2}) rotate(-90)`}
          textAnchor="middle"
        >
          {residual ? "Residual" : state.request.dataset.yColumn.label}
          {logY ? " (log scale)" : ""}
          {state.request.dataset.yColumn.unit
            ? ` [${state.request.dataset.yColumn.unit}]`
            : ""}
        </text>
        {((residual && !result) || (!residual && !hasData)) && (
          <text className="fit-empty-plot" x="50%" y="50%" textAnchor="middle">
            {residual ? "Fit to show residuals" : "Paste or open data to begin"}
          </text>
        )}
        {!residual && showModel && curveCount === 0 && (
          <text className="fit-band-unavailable" x={left} y={height - 2}>
            Curve unavailable at this period/view; zoom in or use a valid
            period.
          </text>
        )}
        {errorBars.unavailable > 0 && (
          <text className="fit-band-unavailable" x={left} y={height - 2}>
            Some error bars exceed the numeric range and cannot be drawn.
          </text>
        )}
        {band?.reason && (
          <text className="fit-band-unavailable" x={left} y={height - 2}>
            Confidence band unavailable: {band.reason}
          </text>
        )}
        <defs>
          <clipPath
            id={`${idPrefix}${residual ? "clip-residual" : "clip-data"}`}
          >
            <rect
              x={left - 6}
              y={top}
              width={width - left - right + 12}
              height={height - top - bottom}
            />
          </clipPath>
        </defs>
        {yScale.ticks(idPrefix && residual ? 3 : 6).map((yy, i) => {
          return (
            <g key={i}>
              <line
                x1={left}
                x2={width - right}
                y1={y(yy)}
                y2={y(yy)}
                className="grid"
              />
              <text x={left - 10} y={y(yy) + 4} textAnchor="end">
                {yScale.label(yy, 6)}
              </text>
            </g>
          );
        })}
        {showXAxis &&
          xScale.ticks(6).map((xx, i) => {
            return (
              <text
                key={i}
                x={x(xx)}
                y={height - 30}
                textAnchor={i === 0 ? "start" : i === 5 ? "end" : "middle"}
              >
                {xScale.label(xx, 6)}
              </text>
            );
          })}
        <rect
          className="fit-plot-frame"
          x={left}
          y={top}
          width={width - left - right}
          height={height - top - bottom}
          vectorEffect="non-scaling-stroke"
        />
        <g
          clipPath={`url(#${idPrefix}${residual ? "clip-residual" : "clip-data"})`}
        >
          {band && band.points.length > 0 && (
            <path
              className="fit-confidence-band"
              aria-label="Pointwise 95% confidence band for the mean curve"
              d={
                plotPath(
                  [
                    ...band.points.map((p) => ({
                      x: p.x,
                      y: logY ? Math.max(ymin, p.upper) : p.upper,
                    })),
                    ...[...band.points].reverse().map((p) => ({
                      x: p.x,
                      y: logY ? Math.max(ymin, p.lower) : p.lower,
                    })),
                  ],
                  x,
                  y,
                ) + " Z"
              }
            />
          )}
          {residual && result ? (
            <line
              x1={left}
              x2={width - right}
              y1={y(0)}
              y2={y(0)}
              className="zero"
            />
          ) : !residual && showModel ? (
            <path d={plotPath(curve, x, y)} className="curve" />
          ) : null}
          {visibleErrorBars.map((bar) => (
            <path
              key={bar.id}
              className={
                excluded.has(bar.id)
                  ? "fit-error-bar excluded"
                  : "fit-error-bar"
              }
              data-row-id={bar.id}
              data-sigma={bar.sigma}
              data-lower={bar.lower}
              data-upper={bar.upper}
              d={`M${x(bar.x)},${y(logY ? Math.max(ymin, bar.lower) : bar.lower)} V${y(bar.upper)}${logY && bar.lower < ymin ? "" : ` M${x(bar.x) - 5},${y(bar.lower)} H${x(bar.x) + 5}`} M${x(bar.x) - 5},${y(bar.upper)} H${x(bar.x) + 5}`}
            />
          ))}
          {rows.map((r, i) => (
            <PlotMarker
              key={r.id}
              data-row-id={r.id}
              x={x(r.x!)}
              y={y(ys[i])}
              r={4}
              className={
                excluded.has(r.id) || !r.included ? "point excluded" : "point"
              }
              onClick={() => {
                if (!onSelect && !suppressClick.current) onToggle(r.id);
              }}
            >
              <title>{`${r.id}: ${r.x}, ${ys[i]}`}</title>
            </PlotMarker>
          ))}
          {rubberBand && (
            <rect
              className="fit-selection-box"
              x={Math.min(rubberBand.x0, rubberBand.x1)}
              y={Math.min(rubberBand.y0, rubberBand.y1)}
              width={Math.abs(rubberBand.x1 - rubberBand.x0)}
              height={Math.abs(rubberBand.y1 - rubberBand.y0)}
            />
          )}
        </g>
      </svg>
    </>
  );
}
function PrintReport({
  yRange,
  mode,
  state,
  result,
  range,
  showBand,
  showErrorBars,
  fullPageGraph,
  onFullPageGraphChange,
  onClose,
  manual,
}: {
  state: State;
  result: FitResult | null;
  manual: boolean;
  mode: GraphMode;
  yRange: AxisRange | null;
  range: [number, number];
  showBand: boolean;
  showErrorBars: boolean;
  fullPageGraph: boolean;
  onFullPageGraphChange: (enabled: boolean) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState("");
  const graphWidth = fullPageGraph ? 960 : 720;
  const dataHeight = fullPageGraph ? (result ? 402 : 586) : 236;
  const residualHeight = fullPageGraph ? 184 : 134;
  const printNumber = (value: number) =>
    value.toLocaleString("en-US", {
      maximumSignificantDigits: 7,
      useGrouping: false,
      notation:
        value !== 0 && (Math.abs(value) < 0.001 || Math.abs(value) >= 1e7)
          ? "scientific"
          : "standard",
    });
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`fit-print-dialog${fullPageGraph ? " full-page-graph" : ""}`}
      aria-label="Print report"
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const rect = e.currentTarget.getBoundingClientRect();
        if (
          e.clientX < rect.left ||
          e.clientX > rect.right ||
          e.clientY < rect.top ||
          e.clientY > rect.bottom
        )
          onClose();
      }}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="fit-print-controls">
        <button
          onClick={async () => {
            try {
              await window.print();
            } catch (e) {
              setError(`Printing failed: ${String(e)}`);
            }
          }}
        >
          Print…
        </button>
        <button onClick={onClose}>Close preview</button>
        <label>
          <input
            type="checkbox"
            checked={fullPageGraph}
            onChange={(e) => onFullPageGraphChange(e.target.checked)}
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
              <h1>{state.request.dataset.label}</h1>
              <p>
                {state.request.dataset.yColumn.label} [
                {state.request.dataset.yColumn.unit ?? "unspecified"}] vs{" "}
                {state.request.dataset.xColumn.label} [
                {state.request.dataset.xColumn.unit ?? "unspecified"}] ·{" "}
                {result
                  ? `${state.settings.model} fit`
                  : manual
                    ? "Manual preview · not fitted"
                    : "Data only · no current fit"}
              </p>
              <div className="fit-print-graphs">
                <Plot
                  yRange={yRange}
                  mode={mode}
                  state={state}
                  result={result}
                  range={range}
                  residual={false}
                  manual={manual}
                  onToggle={() => {}}
                  showBand={showBand}
                  showErrorBars={showErrorBars}
                  showXAxis={!result}
                  printSize={{ width: graphWidth, height: dataHeight }}
                  idPrefix="print-measure-"
                />
                {result && (
                  <Plot
                    mode={mode}
                    state={state}
                    result={result}
                    range={range}
                    residual
                    onToggle={() => {}}
                    showXAxis
                    printSize={{ width: graphWidth, height: residualHeight }}
                    idPrefix="print-measure-"
                  />
                )}
              </div>
              <p>
                Graph shows the current axis range.{" "}
                {showBand && result
                  ? "Shading: pointwise 95% confidence interval for the mean curve when available."
                  : ""}{" "}
                {showErrorBars
                  ? "Error bars: supplied ±1σ when available."
                  : ""}
              </p>
            </div>
          </div>
          <div className="fit-print-details">
            {state.settings.model === "custom" && (
              <p>
                y = {state.settings.custom!.expression}; independent variable:{" "}
                {state.settings.custom!.variable}. Starting values:{" "}
                {state.settings.parameters
                  .map(
                    (p, i) =>
                      `${state.settings.custom!.names[i]}=${p.value}${p.fixed ? " (fixed)" : ""}`,
                  )
                  .join("; ")}
              </p>
            )}
            {result && (
              <>
                <div className="fit-print-results">
                  <table aria-label="Print parameters">
                    <thead>
                      <tr>
                        <th>Parameter</th>
                        <th>Value</th>
                        <th>Standard error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parameterNames(
                        state.settings.model,
                        state.settings.custom,
                      ).map((name, i) => (
                        <tr key={name}>
                          <td>
                            {name}
                            {state.settings.model === "custom"
                              ? ` [${state.settings.custom!.units[i] || "?"}]`
                              : isNonlinearModel(state.settings.model)
                                ? ` [${nonlinearParameterUnit(state.settings.model, i, state.request.dataset.xColumn.unit, state.request.dataset.yColumn.unit)}]`
                                : ""}
                          </td>
                          <td>{printNumber(result.coefficients[i])}</td>
                          <td>
                            {result.standardErrors[i].value == null
                              ? result.standardErrors[i].reason
                              : printNumber(result.standardErrors[i].value!)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <table aria-label="Print statistics">
                    <thead>
                      <tr>
                        <th>Statistic</th>
                        <th>Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fitReportRows(state.request, state.settings, result).map(
                        ([name, value]) => (
                          <tr key={name}>
                            <td>{name}</td>
                            <td>
                              {value === null
                                ? "Unavailable"
                                : typeof value === "number"
                                  ? printNumber(value)
                                  : String(value)}
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                  <table
                    className="fit-correlation-table"
                    aria-label="Print parameter correlation matrix"
                  >
                    <caption>Parameter correlation matrix</caption>
                    <tbody>
                      {fitCorrelationMatrix(state.settings, result).map(
                        (row, i) => (
                          <tr key={i}>
                            {row.map((value, j) =>
                              i === 0 ? (
                                <th key={j}>
                                  {j === 0
                                    ? "Parameter"
                                    : value === null
                                      ? ""
                                      : String(value)}
                                </th>
                              ) : (
                                <td key={j}>
                                  {value === null
                                    ? "Unavailable"
                                    : typeof value === "number"
                                      ? value.toFixed(4)
                                      : String(value)}
                                </td>
                              ),
                            )}
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
                <p>Inference: {result.inference}</p>
                {result.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </>
            )}
            <p className="fit-print-source">
              Source: {state.request.source.fileName} ·{" "}
              {state.request.source.application}
            </p>
            <SourceNotes text={state.request.source.context} />
          </div>
        </article>
      </PrintPages>
    </dialog>
  );
}
export default function FitApp() {
  const [appearance, setAppearance] = useState(defaultPlotAppearance);
  const [reportSections, setReportSections] = useState<
    Required<ReportSections>
  >({
    statistics: true,
    correlation: true,
    observations: false,
    provenance: false,
  });
  const [fullPageGraph, setFullPageGraph] = useState(false);
  const chartRef = useRef<HTMLElement>(null);
  const settingsMenu = useRef<HTMLDetailsElement>(null);
  const exportMenu = useRef<HTMLDetailsElement>(null);
  const bandNote = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      for (const menu of [
        settingsMenu.current,
        exportMenu.current,
        bandNote.current,
      ]) {
        if (
          menu?.open &&
          event.target instanceof Node &&
          !menu.contains(event.target)
        )
          menu.removeAttribute("open");
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      for (const menu of [
        settingsMenu.current,
        exportMenu.current,
        bandNote.current,
      ]) {
        if (menu?.open) {
          menu.removeAttribute("open");
          menu.querySelector("summary")?.focus();
        }
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  const [trackerProject, setTrackerProject] = useState<TrackerProject | null>(
    null,
  );
  const collisionActions = useRef<CollisionActions>(null);
  const multiActions = useRef<MultiIntervalActions>(null);
  const [multiOpen, setMultiOpen] = useState(false);
  const [multiReady, setMultiReady] = useState(false);
  const [equationPending, setEquationPending] = useState(false);
  const [collisionReady, setCollisionReady] = useState(false);
  const [collisionOpen, setCollisionOpen] = useState(false);
  const [collisionRevision, setCollisionRevision] = useState(0);
  const [collisionSource, setCollisionSource] = useState<State | null>(null);
  const [mode, setMode] = useState<GraphMode>("linear");
  const [yRange, setYRange] = useState<AxisRange | null>(null);
  const logX = mode === "log-x" || mode === "log-log";
  const logY = mode === "log-y" || mode === "log-log";
  function changeLog(x: boolean, y: boolean) {
    if (x !== logX) {
      setRange(xBounds(state));
      setXCustom(false);
    }
    if (y !== logY) setYRange(null);
    setMode(x ? (y ? "log-log" : "log-x") : y ? "log-y" : "linear");
  }
  const [printPreview, setPrintPreview] = useState(false);
  const [dataPanel, setDataPanel] = useState<{
    source: string;
    text?: string;
    editing?: boolean;
    incoming?: State;
    fileName?: string;
    token?: string;
  } | null>({ source: "Untitled data", editing: true });
  function showData(value: NonNullable<typeof dataPanel>) {
    setDataPanel({ ...value, token: crypto.randomUUID() });
  }
  const [showBand, setShowBand] = useState(true);
  const [showErrorBars, setShowErrorBars] = useState(true);
  const [state, setState] = useState<State>(fresh),
    [result, setResult] = useState<{ state: State; value: FitResult } | null>(
      null,
    );
  const [manualState, setManualState] = useState<State | null>(null);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [dirty, setDirty] = useState(false),
    [pending, setPending] = useState<State | null>(null),
    [closePending, setClosePending] = useState(false);
  const [range, setRange] = useState<[number, number]>([0, 2]),
    [tab, setTab] = useState<"results" | "rows">("results");
  const [xCustom, setXCustom] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sigmaDraft, setSigmaDraft] = useState<string | null>(null);
  const [sigmaTouched, setSigmaTouched] = useState(false);
  const sigmaInvalid =
    sigmaDraft !== null &&
    (!(Number(sigmaDraft) > 0) || !Number.isFinite(Number(sigmaDraft)));
  const [displayScale, setDisplayScale] = useState(1);
  const activeWorker = useRef<Worker | null>(null);
  const past = useRef<State[]>([]),
    future = useRef<State[]>([]),
    input = useRef<HTMLInputElement>(null),
    dirtyRef = useRef(dirty);
  dirtyRef.current = dirty || sigmaDraft !== null || dataPanel !== null;
  const liveState = useRef(state);
  liveState.current = state;
  useEffect(() => {
    document.title = "Data Tool 2027";
    const listener = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", listener);
    let disposed = false;
    let unlisten: (() => void) | undefined;
    if (isTauri())
      getCurrentWindow()
        .onCloseRequested((e) => {
          if (dirtyRef.current) {
            e.preventDefault();
            setClosePending(true);
          }
        })
        .then((fn) => {
          if (disposed) fn();
          else unlisten = fn;
        });
    return () => {
      activeWorker.current?.terminate();
      disposed = true;
      unlisten?.();
      window.removeEventListener("beforeunload", listener);
    };
  }, []);
  function change(next: State, manual = false) {
    setSigmaDraft(null);
    setSigmaTouched(false);
    cancel();
    if (next.request !== state.request)
      next = {
        ...next,
        originalRequest: state.originalRequest ?? state.request,
        request: {
          ...next.request,
          requestId: crypto.randomUUID(),
          snapshotId: crypto.randomUUID(),
        },
      };
    setManualState(manual ? next : null);
    past.current = [...past.current.slice(-99), state];
    future.current = [];
    setState(next);
    setDirty(true);
    setError("");
    setNotice("");
  }
  function history(redo = false) {
    setManualState(null);
    setSigmaDraft(null);
    setSigmaTouched(false);
    cancel();
    const from = redo ? future : past,
      to = redo ? past : future;
    const next = from.current.at(-1);
    if (!next) return;
    from.current = from.current.slice(0, -1);
    to.current.push(state);
    setState(next);
    setDirty(true);
  }
  function bounds(next: State) {
    setYRange(null);
    setXCustom(false);
    setRange(xBounds(next));
  }
  function replace(next: State) {
    setManualState(null);
    setSigmaDraft(null);
    setSigmaTouched(false);
    cancel();
    setState(next);
    setResult(null);
    setDirty(false);
    setPending(null);
    past.current = [];
    future.current = [];
    bounds(next);
    setError("");
    setNotice("");
  }
  function propose(next: State) {
    if (dirtyRef.current) setPending(next);
    else replace(next);
  }
  const stale = !!result && (result.state !== state || sigmaDraft !== null);
  // A stale curve is not projected into changed models or datasets. Settings stay canonical.
  const current =
    result?.state === state && sigmaDraft === null ? result.value : null;
  function cancel() {
    activeWorker.current?.terminate();
    activeWorker.current = null;
    setBusy(false);
  }
  function run() {
    if (sigmaInvalid) return;
    cancel();
    setError("");
    setNotice("Fitting…");
    try {
      const worker = new Worker(new URL("./fit.worker.ts", import.meta.url), {
        type: "module",
      });
      activeWorker.current = worker;
      setBusy(true);
      const fail = (message: string) => {
        if (activeWorker.current !== worker) return;
        cancel();
        setError(message);
        setNotice("");
      };
      worker.onerror = (event) => fail(event.message || "Fit worker failed");
      worker.onmessage = (
        event: MessageEvent<{ result?: FitResult; error?: string }>,
      ) => {
        if (activeWorker.current !== worker || liveState.current !== state)
          return;
        if (event.data.error) {
          fail(event.data.error);
          return;
        }
        cancel();
        if (event.data.result) {
          setResult({ state, value: event.data.result });
          setNotice("Fit complete");
        }
      };
      worker.postMessage(state);
    } catch (e) {
      cancel();
      setError(String(e));
      setNotice("");
    }
  }
  function selectRectangle(
    box: SelectionRectangle,
    mode: "replace" | "add" | "subtract",
  ) {
    change({
      ...state,
      settings: {
        ...state.settings,
        excludedIds: rectangleExclusions(
          state.request.dataset.rows,
          box,
          state.settings.excludedIds,
          mode,
        ),
        selectionAfterInspection: true,
      },
    });
    setNotice(
      `${mode === "add" ? "Region added" : mode === "subtract" ? "Region excluded" : "Rectangle selected"}. Fit to update the results; Undo restores the previous selection.`,
    );
  }
  function toggle(id: string) {
    const ids = new Set(state.settings.excludedIds);
    ids.has(id) ? ids.delete(id) : ids.add(id);
    change({
      ...state,
      settings: {
        ...state.settings,
        excludedIds: [...ids],
        selectionAfterInspection: true,
      },
    });
  }
  async function importText(text: string, fileName = "Imported data") {
    try {
      if (/\.trk$/i.test(fileName)) {
        setTrackerProject(parseTracker(text, fileName));
        setError("");
        return;
      }
      if (/\.(csv|tsv|txt)$/i.test(fileName)) {
        showData({ source: fileName, text, fileName });
        return;
      }
      const withFileName = (request: FitRequest): FitRequest =>
        request.source.fileName === undefined && fileName !== "Imported data"
          ? { ...request, source: { ...request.source, fileName } }
          : request;
      const object = JSON.parse(text);
      if (object.format === "tracker-fit-session") {
        const parsed = sessionSchema.parse(object);
        showData({
          source: parsed.request.dataset.label,
          incoming: {
            request: withFileName(parsed.request),
            settings: parsed.settings,
            originalRequest: parsed.originalRequest,
            dataTable: parsed.dataTable,
          },
        });
      } else {
        const request = withFileName(requestSchema.parse(object));
        showData({
          source: request.dataset.label,
          incoming: { request, settings: initialSettings("line") },
        });
      }
    } catch (e) {
      setError(
        `Import rejected: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
  async function importArchive(bytes: Uint8Array, fileName: string) {
    try {
      setTrackerProject(parseTrackerArchive(bytes, fileName));
      setError("");
    } catch (e) {
      setError(`Import rejected: ${String(e)}`);
    }
  }
  async function importPath(path: string) {
    const name = path.split(/[\\/]/).at(-1)!;
    if (/\.trz$/i.test(path)) {
      const data = await invoke<ArrayBuffer>("read_tracker_archive", { path });
      await importArchive(new Uint8Array(data), name);
    } else
      await importText(await invoke<string>("read_fit_file", { path }), name);
  }
  const lastOpenDirectory = useRef<string | null>(null);
  async function openFile() {
    try {
      if (!isTauri()) {
        input.current?.click();
        return;
      }
      const defaultPath =
        lastOpenDirectory.current ??
        (await invoke<string>("data_files_directory"));
      const path = await open({
        defaultPath,
        multiple: false,
        filters: [
          {
            name: "Fit data or session",
            extensions: ["json", "trksess", "csv", "tsv", "txt", "trk", "trz"],
          },
        ],
      });
      if (typeof path === "string") {
        lastOpenDirectory.current = path.slice(
          0,
          Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1,
        );
        await importPath(path);
      }
    } catch (e) {
      setError(String(e));
    }
  }
  async function openExample(fileName: string, text: string) {
    await importText(text, fileName);
  }
  function session(): FitSession {
    return sessionSchema.parse({
      format: "tracker-fit-session",
      version: sessionVersion(state.settings),
      request: state.request,
      settings: state.settings,
      originalRequest: state.originalRequest,
      dataTable: state.dataTable,
      engine: sessionEngine(state.settings),
    });
  }
  async function saveFile() {
    if (sigmaInvalid) return;
    try {
      let saved = session();
      if (isTauri()) {
        const path = await save({
          defaultPath: "analysis.trksess",
          filters: [{ name: "Fit session", extensions: ["trksess"] }],
        });
        if (!path) return;
        saved = nameSavedSession(saved, path);
        await invoke("write_fit_file", {
          path,
          data: JSON.stringify(saved, null, 2),
        });
      } else {
        saved = nameSavedSession(saved, "analysis.trksess");
        const url = URL.createObjectURL(
          new Blob([JSON.stringify(saved, null, 2)], {
            type: "application/json",
          }),
        );
        const a = document.createElement("a");
        a.href = url;
        a.download = "analysis.trksess";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      if (liveState.current === state) {
        if (saved.request.dataset.label !== state.request.dataset.label) {
          cancel();
          const next = { ...state, request: saved.request };
          setState(next);
          setResult((previous) =>
            previous?.state === state ? { ...previous, state: next } : previous,
          );
        }
        setDirty(false);
      }
      setNotice(
        liveState.current === state
          ? "Session saved"
          : "Earlier snapshot saved; newer changes remain unsaved",
      );
    } catch (e) {
      setError(`Save failed: ${String(e)}`);
    }
  }
  async function copy() {
    if (!current) return;
    try {
      await navigator.clipboard.writeText(
        fitReportTsv(state.request, state.settings, current, reportSections),
      );
      setNotice("Report copied: statistics in two columns");
    } catch {
      setError(
        "Clipboard unavailable. Save the session to retain full-precision inputs.",
      );
    }
  }
  async function exportGraph(format: "svg" | "png" | "pdf") {
    exportMenu.current?.removeAttribute("open");
    const activePlots = multiOpen
      ? chartRef.current
          ?.closest(".fit-app")
          ?.querySelectorAll<SVGSVGElement>(
            ".multi-interval:not([hidden]) .interval-graphs svg.interval-plot",
          )
      : collisionOpen
        ? chartRef.current
            ?.closest(".fit-app")
            ?.querySelectorAll<SVGSVGElement>(
              ".collision-dialog:not([hidden]) .collision-charts svg.collision-plot, .collision-dialog:not([hidden]) .collision-details.expanded svg.collision-plot",
            )
        : chartRef.current?.querySelectorAll<SVGSVGElement>(
            'svg[aria-label="Data and fitted curve"], svg[aria-label="Residual plot"]',
          );
    const plots = Array.from(activePlots ?? []).filter(
      (plot) =>
        plot.getClientRects().length > 0 &&
        plot.clientWidth > 0 &&
        plot.clientHeight > 0,
    );
    const name =
      (state.request.dataset.label || "fit-graph")
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-|-$/g, "") || "fit-graph";
    try {
      await exportPlotGraph(plots, name, format);
    } catch (error) {
      setError(`Graph export failed: ${String(error)}`);
    }
  }
  useEffect(() => {
    if (!isTauri()) return;
    async function loadLaunch() {
      const launch = await invoke<{ path: string; ack: string | null } | null>(
        "take_launch",
      );
      if (!launch) return;
      let requestId = "00000000-0000-0000-0000-000000000000";
      try {
        if (/\.(trk|trz)$/i.test(launch.path)) {
          if (launch.ack)
            throw new Error(
              "Acknowledgments require a versioned JSON request or session",
            );
          await importPath(launch.path);
          return;
        }
        const text = await invoke<string>("read_fit_file", {
          path: launch.path,
        });
        if (!/\.(csv|tsv|txt)$/i.test(launch.path)) {
          const object = JSON.parse(text);
          const id = object.request?.requestId ?? object.requestId;
          if (
            typeof id === "string" &&
            /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)
          )
            requestId = id;
          if (object.format === "tracker-fit-session")
            sessionSchema.parse(object);
          else requestSchema.parse(object);
        } else if (launch.ack)
          throw new Error(
            "Acknowledgments require a versioned JSON request or session",
          );
        await importText(text, launch.path.split(/[\\/]/).pop());
        if (launch.ack)
          await invoke("acknowledge_launch", {
            data: JSON.stringify({
              format: "tracker-fit-ack",
              version: 1,
              requestId,
              status: "accepted",
            }),
          });
      } catch (e) {
        const message = String(e);
        setError(`Import rejected: ${message}`);
        if (launch.ack)
          await invoke("acknowledge_launch", {
            data: JSON.stringify({
              format: "tracker-fit-ack",
              version: 1,
              requestId,
              status: "error",
              message,
            }),
          }).catch((e) => setError(`Acknowledgment failed: ${String(e)}`));
      }
    }
    // Subscribe first so OS file-open events cannot fall between initial read and listener setup.
    let unlisten: (() => void) | undefined;
    let disposed = false;
    void listen("data-tool-open", () => {
      void loadLaunch();
    })
      .then((fn) => {
        if (disposed) {
          fn();
          return;
        }
        unlisten = fn;
        void loadLaunch();
      })
      .catch((e) => setError(String(e)));
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);
  useEffect(() => {
    if (
      (collisionOpen || multiOpen) &&
      (!collisionSource ||
        collisionSource.dataTable !== state.dataTable ||
        collisionSource.request.dataset.rows !== state.request.dataset.rows ||
        collisionSource.request.dataset.assumptions.exactX !==
          state.request.dataset.assumptions.exactX ||
        collisionSource.request.dataset.assumptions.gaussianIndependent !==
          state.request.dataset.assumptions.gaussianIndependent ||
        collisionSource.request.uncertainty.errorStructure !==
          state.request.uncertainty.errorStructure)
    ) {
      setCollisionSource(state);
      setCollisionRevision((v) => v + 1);
      setCollisionReady(false);
      setMultiReady(false);
    }
  }, [collisionOpen, multiOpen, state, collisionSource]);
  const analysisControl = (
    <label>
      Analysis
      <select
        aria-label="Analysis"
        value={
          multiOpen
            ? "multi-interval"
            : collisionOpen
              ? "collision"
              : state.settings.model
        }
        onChange={(e) => {
          if (e.target.value === "multi-interval") {
            setMultiOpen(true);
            setCollisionOpen(false);
            return;
          }
          setMultiOpen(false);
          if (e.target.value === "collision") {
            setCollisionOpen(true);
            return;
          }
          setCollisionOpen(false);
          if (e.target.value === state.settings.model) return;
          change({
            ...state,
            request: {
              ...state.request,
              dataset: {
                ...state.request.dataset,
                assumptions: {
                  ...state.request.dataset.assumptions,
                  correctModel: "unknown",
                },
              },
            },
            settings: {
              ...initialSettings(e.target.value as FitSettings["model"]),
              ...(isNonlinearModel(e.target.value)
                ? {
                    parameters: suggestedParameters(
                      e.target.value,
                      state.request,
                      state.settings.excludedIds,
                    ).map((value) => ({ value, fixed: false })),
                  }
                : {}),
              excludedIds: state.settings.excludedIds,
              selectionAfterInspection: state.settings.selectionAfterInspection,
              retainedPerRowUncertainty:
                state.settings.retainedPerRowUncertainty,
              physicalTimeConfirmed: state.settings.physicalTimeConfirmed,
            },
          });
        }}
      >
        <optgroup label="Single-curve fits">
          <option value="line">Straight line</option>
          <option value="quadratic">Quadratic</option>
          <option value="cubic">Cubic</option>
          <option value="quartic">Quartic</option>
          <option value="logarithmic">Logarithmic</option>
          <option value="sine">Sine · supplied period</option>
          <option value="sine-free-period">Sine · fit period</option>
          <option value="exponential">Exponential · supplied rate</option>
          <option value="power-law">Power law · supplied exponent</option>
          <option value="reciprocal">Reciprocal</option>
          {nonlinearModelIds.map((model) => (
            <option key={model} value={model}>
              {nonlinearModels[model].label}
            </option>
          ))}
          <option value="constant-acceleration">Constant acceleration</option>
          <option value="custom">Custom equation…</option>
        </optgroup>
        <optgroup label="Multiple intervals">
          <option value="multi-interval">Multi-interval fit…</option>
          <option value="collision">Collision · before and after</option>
        </optgroup>
      </select>
    </label>
  );
  const names = parameterNames(state.settings.model, state.settings.custom),
    u = state.request.uncertainty;
  const included = state.request.dataset.rows.filter(
    (r) => r.included && !state.settings.excludedIds.includes(r.id),
  ).length;
  return (
    <PlotAppearanceContext.Provider value={appearance}>
      <div
        className="fit-app"
        style={
          {
            ...appearanceStyle(appearance),
            "--fit-scale": displayScale,
            zoom: displayScale,
          } as CSSProperties
        }
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "p") {
            e.preventDefault();
            if (multiOpen) void multiActions.current?.print();
            else if (collisionOpen) void collisionActions.current?.print();
            else setPrintPreview(true);
            return;
          }
          if (
            (e.metaKey || e.ctrlKey) &&
            e.key.toLowerCase() === "z" &&
            !(e.target instanceof HTMLInputElement)
          ) {
            e.preventDefault();
            history(e.shiftKey);
          }
        }}
      >
        <header className="fit-header">
          <div className="fit-header-start">
            <div>
              <span className="fit-brand">EXPERIMENTAL DATA ANALYSIS</span>
              <h1>
                Data Tool 2027 <span>0.3</span>
              </h1>
            </div>
            <div
              className="fit-history-controls"
              role="group"
              aria-label="Analysis history"
            >
              <button
                aria-label="Undo analysis change"
                title="Undo (⌘Z)"
                disabled={multiOpen || !past.current.length}
                onClick={() => history()}
              >
                <span aria-hidden="true">↶</span> Undo
              </button>
              <button
                aria-label="Redo analysis change"
                title="Redo (⇧⌘Z)"
                disabled={multiOpen || !future.current.length}
                onClick={() => history(true)}
              >
                <span aria-hidden="true">↷</span> Redo
              </button>
            </div>
            <DisplayMenu
              scale={displayScale}
              onScale={setDisplayScale}
              appearance={appearance}
              onAppearance={setAppearance}
            />
            <details ref={settingsMenu} className="fit-settings-menu">
              <summary>
                Settings{" "}
                <span className="fit-menu-arrow" aria-hidden="true">
                  ▾
                </span>
              </summary>
              <div className="fit-settings-popover">
                <strong>Copy report sections</strong>
                <label>
                  <input
                    type="checkbox"
                    checked={reportSections.statistics}
                    onChange={(e) =>
                      setReportSections((s) => ({
                        ...s,
                        statistics: e.target.checked,
                      }))
                    }
                  />
                  Statistics
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={reportSections.correlation}
                    onChange={(e) =>
                      setReportSections((s) => ({
                        ...s,
                        correlation: e.target.checked,
                      }))
                    }
                  />
                  Parameter correlations
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={reportSections.observations}
                    onChange={(e) =>
                      setReportSections((s) => ({
                        ...s,
                        observations: e.target.checked,
                      }))
                    }
                  />
                  Observations and residuals
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={reportSections.provenance}
                    onChange={(e) =>
                      setReportSections((s) => ({
                        ...s,
                        provenance: e.target.checked,
                      }))
                    }
                  />
                  Source and notes
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={fullPageGraph}
                    onChange={(e) => setFullPageGraph(e.target.checked)}
                  />
                  Full-page graph when printing
                </label>
                <button
                  onClick={() =>
                    setReportSections({
                      statistics: true,
                      correlation: true,
                      observations: true,
                      provenance: true,
                    })
                  }
                >
                  Technical report
                </button>
                <button
                  onClick={() =>
                    setReportSections({
                      statistics: true,
                      correlation: true,
                      observations: false,
                      provenance: false,
                    })
                  }
                >
                  Compact report
                </button>
              </div>
            </details>
          </div>
          <nav>
            <button
              onClick={() =>
                showData({ source: state.request.dataset.label, editing: true })
              }
            >
              Data…
            </button>
            <button
              disabled={
                sigmaInvalid ||
                collisionOpen ||
                multiOpen ||
                (state.settings.model === "custom" && equationPending)
              }
              title={
                collisionOpen || multiOpen
                  ? "Multi-interval setup is not yet saved in sessions; switch to a single fit to save the source table."
                  : undefined
              }
              onClick={saveFile}
            >
              Save session
            </button>
            <button
              disabled={
                multiOpen
                  ? !multiReady
                  : collisionOpen
                    ? !collisionReady
                    : !current
              }
              onClick={() =>
                multiOpen
                  ? multiActions.current?.copy()
                  : collisionOpen
                    ? collisionActions.current?.copy()
                    : copy()
              }
            >
              Copy report
            </button>
            <button
              disabled={
                multiOpen ? !multiReady : collisionOpen && !collisionReady
              }
              onClick={() =>
                multiOpen
                  ? multiActions.current?.print()
                  : collisionOpen
                    ? collisionActions.current?.print()
                    : setPrintPreview(true)
              }
            >
              Print
            </button>
            <details ref={exportMenu} className="fit-export-menu">
              <summary>Export graph</summary>
              <div className="fit-export-popover" role="menu">
                <button role="menuitem" onClick={() => void exportGraph("svg")}>
                  SVG vector graphic
                </button>
                <button role="menuitem" onClick={() => void exportGraph("png")}>
                  PNG image
                </button>
                <button role="menuitem" onClick={() => void exportGraph("pdf")}>
                  PDF vector graphic
                </button>
              </div>
            </details>
          </nav>
        </header>
        <input
          ref={input}
          type="file"
          accept=".json,.trksess,.csv,.tsv,.txt,.trk,.trz"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) {
              if (/\.trz$/i.test(file.name)) {
                if (file.size > 100_000_000)
                  setError("Tracker archive exceeds 100 MB limit");
                else
                  await importArchive(
                    new Uint8Array(await file.arrayBuffer()),
                    file.name,
                  );
              } else if (file.size > 20_000_000)
                setError("File exceeds 20 MB limit");
              else await importText(await file.text(), file.name);
            }
            e.target.value = "";
          }}
        />
        {collisionSource && (
          <CollisionDraft
            key={collisionRevision}
            source={collisionSource}
            open={collisionOpen}
            ref={collisionActions}
            analysisControl={analysisControl}
            onReady={setCollisionReady}
          />
        )}
        {collisionSource && (
          <MultiInterval
            key={`multi-${collisionRevision}`}
            source={collisionSource}
            open={multiOpen}
            ref={multiActions}
            analysisControl={analysisControl}
            onReady={setMultiReady}
          />
        )}
        {trackerProject && (
          <TrackerImport
            project={trackerProject}
            onCancel={() => setTrackerProject(null)}
            onReview={(analysis) => {
              setTrackerProject(null);
              showData({
                source: analysis.request.dataset.label,
                incoming: analysis,
              });
            }}
          />
        )}
        {printPreview && (
          <PrintReport
            yRange={yRange}
            mode={mode}
            state={state}
            result={current}
            manual={manualState === state}
            range={range}
            showBand={showBand}
            showErrorBars={showErrorBars}
            fullPageGraph={fullPageGraph}
            onFullPageGraphChange={setFullPageGraph}
            onClose={() => setPrintPreview(false)}
          />
        )}
        {dataPanel && (
          <ImportPanel
            key={dataPanel.token}
            externalError={error}
            onOpen={openFile}
            examples={[
              ...examples.map(
                ([label, fileName, text]) =>
                  [`Built-in: ${label}`, fileName, text] as const,
              ),
              ...publishedExamples,
            ]}
            onOpenExample={openExample}
            source={dataPanel.source}
            text={dataPanel.text}
            fileName={dataPanel.fileName}
            analysis={
              dataPanel.incoming ?? (dataPanel.editing ? state : undefined)
            }
            reviewing={!!dataPanel.incoming}
            onClose={() => setDataPanel(null)}
            onApply={(next, replacement) => {
              setDataPanel(null);
              if (dataPanel.editing && !replacement) {
                const updated = { ...state, ...next };
                change(updated);
                bounds(updated);
              } else {
                dirtyRef.current = dirty || sigmaDraft !== null;
                propose(
                  replacement ? next : { ...dataPanel.incoming, ...next },
                );
              }
            }}
          />
        )}
        {(pending || closePending) && (
          <div className="fit-confirm" role="alert">
            <span>Keep or discard your unsaved analysis changes?</span>
            <button
              onClick={() => {
                setPending(null);
                setClosePending(false);
              }}
            >
              Keep working
            </button>
            <button
              onClick={() => {
                if (pending) replace(pending);
                else if (isTauri()) {
                  dirtyRef.current = false;
                  void getCurrentWindow().destroy();
                }
              }}
            >
              Discard changes
            </button>
          </div>
        )}
        {error && (
          <div role="alert" className="fit-error">
            <FitErrorMessage message={error} />
          </div>
        )}
        <div
          className="fit-layout"
          style={collisionOpen || multiOpen ? { display: "none" } : undefined}
        >
          <main className="fit-workspace">
            <section ref={chartRef} className="fit-chart">
              {current?.warnings
                .filter(
                  (w) =>
                    w.startsWith("Best period") ||
                    w.startsWith("Competing period"),
                )
                .map((w) => (
                  <p className="fit-help" role="alert" key={w}>
                    {w}
                  </p>
                ))}
              <div className="fit-chart-toolbar">
                <span className={`fit-status ${stale ? "stale" : ""}`}>
                  {busy
                    ? "Fitting…"
                    : stale
                      ? "Results stale"
                      : current
                        ? "Fitted"
                        : "Ready to fit"}
                </span>
                <div className="fit-band-controls">
                  <div className="fit-band-option">
                    <label>
                      <input
                        type="checkbox"
                        checked={showBand}
                        onChange={(e) => setShowBand(e.target.checked)}
                      />
                      Show 95% mean confidence band
                    </label>
                    <details ref={bandNote} className="fit-band-note">
                      <summary>Pointwise mean interval · assumptions</summary>
                      <p>
                        Conditional on the model and selected data. This is not
                        a prediction interval for individual observations or a
                        simultaneous 95% band for the entire curve.
                        {
                          " Selection after inspecting the data is not included in this uncertainty."
                        }
                      </p>
                    </details>
                  </div>
                  <label
                    title={
                      u.kind === "unknown-equal"
                        ? "No supplied y uncertainty; residual-estimated scatter is not used as a measurement error bar."
                        : "Supplied marginal y uncertainty, one standard deviation above and below each observation. Only shown on the data plot."
                    }
                  >
                    <input
                      type="checkbox"
                      checked={showErrorBars && u.kind !== "unknown-equal"}
                      disabled={u.kind === "unknown-equal"}
                      onChange={(e) => setShowErrorBars(e.target.checked)}
                    />
                    {u.kind === "unknown-equal"
                      ? "Error bars unavailable · σ unknown"
                      : "Show y error bars (±1σ)"}
                  </label>
                </div>
              </div>
              <div className="chart-label">
                {state.request.dataset.yColumn.label} [
                {state.request.dataset.yColumn.unit ?? "unspecified"}]
                <span>
                  {current
                    ? "Fitted model"
                    : manualState === state
                      ? "Manual preview · not fitted"
                      : "Data only"}
                </span>
              </div>
              <p className="fit-selection-help">
                Drag to select · Shift-drag adds · Option/Alt-drag excludes
              </p>
              <Plot
                mode={mode}
                state={state}
                result={current}
                yRange={yRange}
                onYRange={setYRange}
                onXRange={(next) => {
                  setRange(next ?? xBounds(state));
                  setXCustom(!!next);
                }}
                xCustom={xCustom}
                onLogX={(value) => changeLog(value, logY)}
                onLogY={(value) => changeLog(logX, value)}
                range={range}
                residual={false}
                manual={manualState === state}
                onToggle={toggle}
                onSelect={selectRectangle}
                showBand={showBand}
                showErrorBars={showErrorBars}
                showXAxis={false}
              />
              <Plot
                mode={mode}
                state={state}
                result={current}
                range={range}
                residual
                onToggle={toggle}
              />
            </section>
            <div className="fit-tabs">
              <button
                aria-pressed={tab === "results"}
                onClick={() => setTab("results")}
              >
                Fit diagnostics
              </button>
              <button
                aria-pressed={tab === "rows"}
                onClick={() => setTab("rows")}
              >
                Observations & exclusions
              </button>
            </div>
            {tab === "results" ? (
              <section className="fit-diagnostics">
                {current ? (
                  <>
                    <div className="fit-metrics">
                      {[
                        ["RMS residual", current.rms],
                        ["Degrees of freedom", current.df],
                        ["Centered R²", current.rSquared.value],
                        ["Q", current.q.value],
                      ].map(([label, value]) => (
                        <div key={label as string}>
                          <span>{label}</span>
                          <strong>{number(value as number | null)}</strong>
                        </div>
                      ))}
                    </div>
                    <details className="fit-diagnostic-details">
                      <summary>
                        Inference: {current.inference} · details
                        {current.warnings.length ? " · notes" : ""}
                      </summary>
                      <p>
                        Inference: {current.inference}. Standard errors use
                        model covariance (locally approximated for nonlinear
                        parameters). Intervals are marginal 95% intervals.
                      </p>
                      <p>
                        {current.q.value === null
                          ? `Q unavailable: ${current.q.reason}.`
                          : `Q is a tail probability, not the probability the model is true.`}{" "}
                        Rank {current.rank}; diagonal ratio{" "}
                        {number(current.diagonalRatio)}.
                      </p>
                      {current.warnings.map((w) => (
                        <p className="fit-warning" key={w}>
                          {w}
                        </p>
                      ))}
                    </details>
                  </>
                ) : (
                  <p>
                    {stale
                      ? "Settings have changed. Fit again to refresh the diagnostics."
                      : "Choose a model and fit. Diagnostics will appear here."}
                  </p>
                )}
              </section>
            ) : (
              <div className="fit-table-wrap">
                <button
                  onClick={() =>
                    showData({
                      source: state.request.dataset.label,
                      editing: true,
                    })
                  }
                >
                  Edit data
                </button>
                {state.originalRequest && (
                  <details>
                    <summary>
                      Original snapshot preserved · inspect original data
                    </summary>
                    <p>
                      {state.originalRequest.dataset.label} ·{" "}
                      {state.originalRequest.source.application}
                    </p>
                    <table>
                      <thead>
                        <tr>
                          <th>Original row</th>
                          <th>{state.originalRequest.dataset.xColumn.label}</th>
                          <th>{state.originalRequest.dataset.yColumn.label}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {state.originalRequest.dataset.rows.map((row) => (
                          <tr key={row.id}>
                            <td>{row.id}</td>
                            <td>
                              {row.x === null ? "Missing" : String(row.x)}
                            </td>
                            <td>
                              {row.y === null ? "Missing" : String(row.y)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                )}
                <table>
                  <thead>
                    <tr>
                      <th>Use</th>
                      <th>Row</th>
                      <th>{state.request.dataset.xColumn.label}</th>
                      <th>{state.request.dataset.yColumn.label}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.request.dataset.rows.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Include ${r.id}`}
                            disabled={!r.included}
                            checked={
                              r.included &&
                              !state.settings.excludedIds.includes(r.id)
                            }
                            onChange={() => toggle(r.id)}
                          />
                        </td>
                        <td>{r.id}</td>
                        <td>{number(r.x)}</td>
                        <td>{number(r.y)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </main>
          <aside className="fit-controls">
            <section>
              <div className="section-eyebrow">01 / ANALYSIS</div>
              {!collisionOpen && !multiOpen && analysisControl}
              {state.settings.model !== "custom" && (
                <button
                  className="edit-custom-equation"
                  onClick={() =>
                    change({
                      ...state,
                      settings: customFromModel(
                        state.settings,
                        state.request,
                        current?.coefficients,
                      ),
                      request: {
                        ...state.request,
                        dataset: {
                          ...state.request.dataset,
                          assumptions: {
                            ...state.request.dataset.assumptions,
                            correctModel: "unknown",
                          },
                        },
                      },
                    })
                  }
                >
                  Edit as custom equation
                </button>
              )}
              <div
                className={`fit-equation${state.settings.model === "custom" ? " custom-equation-preview" : ""}`}
              >
                {state.settings.model === "custom"
                  ? `y = ${state.settings.custom!.expression}`
                  : equations[state.settings.model]}
              </div>
              {state.settings.model === "custom" && (
                <CustomEquationEditor
                  definition={state.settings.custom!}
                  onPending={setEquationPending}
                  onApply={(custom) => {
                    const oldNames = names;
                    change({
                      ...state,
                      request: {
                        ...state.request,
                        dataset: {
                          ...state.request.dataset,
                          assumptions: {
                            ...state.request.dataset.assumptions,
                            correctModel: "unknown",
                          },
                        },
                      },
                      settings: {
                        ...state.settings,
                        custom,
                        conditionalInference: false,
                        parameters: custom.names.map((name) => {
                          const i = oldNames.indexOf(name);
                          return i < 0
                            ? { value: 1, fixed: false }
                            : {
                                ...state.settings.parameters[i],
                                value:
                                  current?.coefficients[i] ??
                                  state.settings.parameters[i].value,
                              };
                        }),
                      },
                    });
                  }}
                />
              )}
              {isNonlinearModel(state.settings.model) && (
                <p className="fit-help">
                  Values below are starting estimates. Edit them or fix known
                  parameters before fitting. Widths and decay times must be
                  positive. Nonlinear fits find a local solution; compare
                  different starts. Intervals and bands are approximate.
                </p>
              )}
              {state.settings.model === "sine-free-period" && (
                <>
                  <div className="fit-period-range">
                    {(["periodMin", "periodMax"] as const).map((key) => (
                      <label key={key}>
                        {key === "periodMin"
                          ? "Minimum period"
                          : "Maximum period"}{" "}
                        [{state.request.dataset.xColumn.unit ?? "unspecified"}]
                        <input
                          key={String(state.settings[key])}
                          aria-label={
                            key === "periodMin"
                              ? "Minimum period"
                              : "Maximum period"
                          }
                          type="number"
                          step="any"
                          defaultValue={state.settings[key]}
                          onBlur={(e) => {
                            const value = e.target.valueAsNumber;
                            if (
                              Number.isFinite(value) &&
                              value > 0 &&
                              (key === "periodMin"
                                ? value < state.settings.periodMax!
                                : value > state.settings.periodMin!)
                            )
                              change({
                                ...state,
                                settings: { ...state.settings, [key]: value },
                              });
                            else {
                              e.currentTarget.value = String(
                                state.settings[key],
                              );
                              setError(
                                "Period bounds must be positive, with minimum below maximum. Previous bound restored.",
                              );
                            }
                          }}
                        />
                      </label>
                    ))}
                  </div>
                  <p className="fit-help">
                    Fits T within this range; Fix T uses its table value. Errors
                    and bands are local approximations. Competing periods may
                    remain outside the range.
                  </p>
                  {current && (
                    <p className="fit-help">
                      Amplitude{" "}
                      {number(
                        Math.hypot(
                          current.coefficients[1],
                          current.coefficients[2],
                        ),
                      )}{" "}
                      · Phase{" "}
                      {number(
                        Math.atan2(
                          current.coefficients[2],
                          current.coefficients[1],
                        ),
                      )}{" "}
                      rad
                    </p>
                  )}
                </>
              )}
              {(state.settings.model === "exponential" ||
                state.settings.model === "power-law") && (
                <label>
                  {state.settings.model === "exponential"
                    ? "Supplied rate k (inverse x-unit)"
                    : "Supplied exponent p (dimensionless)"}
                  <input
                    key={state.settings.model + String(state.settings.shape)}
                    aria-label="Supplied shape"
                    type="number"
                    step="any"
                    defaultValue={state.settings.shape}
                    onBlur={(e) => {
                      const value = e.target.valueAsNumber;
                      if (Number.isFinite(value))
                        change({
                          ...state,
                          settings: { ...state.settings, shape: value },
                        });
                      else {
                        e.currentTarget.value = String(state.settings.shape);
                        setError(
                          "Enter a finite shape value. Previous value restored.",
                        );
                      }
                    }}
                  />
                  <span className="fit-help">
                    Held fixed; only b and a are fitted.
                  </span>
                </label>
              )}
              {["power-law", "reciprocal"].includes(state.settings.model) && (
                <p className="fit-help">
                  Positive x only; xref is one declared x-unit.
                </p>
              )}
              {state.settings.model === "sine" && (
                <label>
                  Supplied period T [
                  {state.request.dataset.xColumn.unit ?? "unspecified"}]
                  <input
                    aria-label="Sine period"
                    type="number"
                    min="0"
                    step="any"
                    value={state.settings.sinePeriod ?? 2 * Math.PI}
                    onChange={(e) => {
                      const value = e.target.valueAsNumber;
                      if (Number.isFinite(value) && value > 0)
                        change({
                          ...state,
                          settings: { ...state.settings, sinePeriod: value },
                        });
                    }}
                  />
                  <span className="fit-help">
                    Period is held fixed. s and c fit amplitude and phase; their
                    uncertainty is conditional on this period.
                  </span>
                </label>
              )}
              {state.settings.model === "logarithmic" && (
                <p className="fit-help">
                  Natural log; xref = 1{" "}
                  {state.request.dataset.xColumn.unit ?? "(x unit unspecified)"}
                  . Included x values must be positive.
                </p>
              )}
              {state.settings.model === "constant-acceleration" && (
                <label className="fit-check">
                  <input
                    type="checkbox"
                    checked={state.settings.physicalTimeConfirmed}
                    onChange={(e) =>
                      change({
                        ...state,
                        settings: {
                          ...state.settings,
                          physicalTimeConfirmed: e.target.checked,
                        },
                      })
                    }
                  />
                  Independent variable is physical time
                </label>
              )}
              <div className="parameter-heading">
                <span>Parameter</span>
                <span>Value</span>
                <span>Std. error</span>
                <span>Fix</span>
              </div>
              {names.map((name, i) => (
                <div className="fit-parameter" key={name}>
                  <label htmlFor={`parameter-${name}`}>
                    {name}
                    <span
                      className="parameter-unit"
                      hidden={state.settings.model === "custom"}
                    >
                      {state.settings.model === "custom"
                        ? state.settings.custom!.units[i] || "?"
                        : isNonlinearModel(state.settings.model)
                          ? nonlinearParameterUnit(
                              state.settings.model,
                              i,
                              state.request.dataset.xColumn.unit,
                              state.request.dataset.yColumn.unit,
                            )
                          : state.settings.model === "sine-free-period" &&
                              i === 3
                            ? (state.request.dataset.xColumn.unit ?? "?")
                            : i === 0 ||
                                state.settings.model === "logarithmic" ||
                                [
                                  "sine",
                                  "sine-free-period",
                                  "exponential",
                                  "power-law",
                                  "reciprocal",
                                ].includes(state.settings.model)
                              ? (state.request.dataset.yColumn.unit ?? "?")
                              : `${state.request.dataset.yColumn.unit ?? "?"}/${state.request.dataset.xColumn.unit ?? "?"}${["", "", "²", "³", "⁴"][i]}`}
                    </span>
                    {state.settings.model === "custom" && (
                      <input
                        className="custom-unit"
                        maxLength={100}
                        aria-label={`${name} unit`}
                        placeholder="unit"
                        value={state.settings.custom!.units[i]}
                        autoCapitalize="none"
                        autoCorrect="off"
                        autoComplete="off"
                        spellCheck={false}
                        onChange={(e) =>
                          change({
                            ...state,
                            settings: {
                              ...state.settings,
                              custom: {
                                ...state.settings.custom!,
                                units: state.settings.custom!.units.map(
                                  (unit, j) =>
                                    j === i ? e.target.value : unit,
                                ),
                              },
                            },
                          })
                        }
                      />
                    )}
                  </label>
                  <input
                    id={`parameter-${name}`}
                    aria-label={`${name} value`}
                    type="number"
                    step="any"
                    title={
                      current ? String(current.coefficients[i]) : undefined
                    }
                    value={
                      current
                        ? Number(current.coefficients[i].toPrecision(7))
                        : state.settings.parameters[i].value
                    }
                    onChange={(e) => {
                      const value = e.target.valueAsNumber;
                      if (Number.isFinite(value))
                        change(
                          {
                            ...state,
                            settings: {
                              ...state.settings,
                              parameters: state.settings.parameters.map(
                                (p, j) => ({
                                  ...p,
                                  value:
                                    j === i
                                      ? value
                                      : (current?.coefficients[j] ?? p.value),
                                }),
                              ),
                            },
                          },
                          true,
                        );
                    }}
                  />
                  {current ? (
                    <span
                      className="parameter-result"
                      title={
                        current.standardErrors[i].reason ??
                        "Parameter standard error"
                      }
                    >
                      {current.standardErrors[i].value === null
                        ? current.standardErrors[i].reason === "fixed"
                          ? "(fixed)"
                          : "—"
                        : number(current.standardErrors[i].value)}
                    </span>
                  ) : (
                    <span className="parameter-placeholder">—</span>
                  )}
                  <input
                    aria-label={`Fix ${name}`}
                    type="checkbox"
                    checked={state.settings.parameters[i].fixed}
                    onChange={(e) =>
                      change({
                        ...state,
                        settings: {
                          ...state.settings,
                          parameters: state.settings.parameters.map((p, j) => ({
                            ...p,
                            value: current?.coefficients[j] ?? p.value,
                            fixed: j === i ? e.target.checked : p.fixed,
                          })),
                        },
                      })
                    }
                  />
                </div>
              ))}
              <div className="fit-run-actions">
                <button
                  className="fit-primary"
                  onClick={run}
                  disabled={
                    busy ||
                    sigmaInvalid ||
                    (state.settings.model === "custom" && equationPending)
                  }
                >
                  Fit selected observations
                </button>
                {busy && (
                  <button
                    onClick={() => {
                      cancel();
                      setNotice("Fit cancelled");
                    }}
                  >
                    Cancel fit
                  </button>
                )}
              </div>
              {!collisionOpen && !multiOpen && (
                <Assumptions
                  checked={state.settings.conditionalInference}
                  onChange={(checked) =>
                    change({
                      ...state,
                      settings: {
                        ...state.settings,
                        conditionalInference: checked,
                      },
                    })
                  }
                />
              )}
              {current && (
                <details className="fit-intervals">
                  <summary>95% parameter intervals</summary>
                  <table>
                    <thead>
                      <tr>
                        <th>Parameter</th>
                        <th>Lower</th>
                        <th>Upper</th>
                      </tr>
                    </thead>
                    <tbody>
                      {names.map((name, i) => (
                        <tr key={name}>
                          <td>{name}</td>
                          <td>{number(current.intervals[i]?.[0] ?? null)}</td>
                          <td>{number(current.intervals[i]?.[1] ?? null)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              )}
            </section>
            <section>
              <div className="section-eyebrow">02 / UNCERTAINTY</div>
              <label>
                Noise model
                <select
                  aria-label="Noise model"
                  value={u.kind}
                  onChange={(e) => {
                    change({
                      ...state,
                      ...switchNoiseModel(
                        state.request,
                        state.settings,
                        e.target.value as FitRequest["uncertainty"]["kind"],
                      ),
                    });
                  }}
                >
                  <option value="unknown-equal">
                    Unknown · estimate equal scatter
                  </option>
                  <option value="supplied-common">Supplied common σ</option>
                  {(u.kind === "supplied-per-row" ||
                    state.settings.retainedPerRowUncertainty) && (
                    <option value="supplied-per-row">
                      Supplied per observation
                    </option>
                  )}
                </select>
              </label>
              {u.kind === "supplied-common" && (
                <label>
                  σ y [{state.request.dataset.yColumn.unit ?? "unspecified"}]
                  <input
                    type="text"
                    inputMode="decimal"
                    aria-label="Y uncertainty"
                    aria-invalid={sigmaTouched && sigmaInvalid}
                    aria-describedby={
                      sigmaTouched && sigmaInvalid ? "sigma-error" : undefined
                    }
                    value={sigmaDraft ?? String(u.sigmaY)}
                    onChange={(e) => {
                      cancel();
                      setSigmaDraft(e.target.value);
                      setSigmaTouched(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        e.currentTarget.blur();
                      }
                      if (e.key === "Escape") {
                        e.preventDefault();
                        setSigmaDraft(null);
                        setSigmaTouched(false);
                      }
                    }}
                    onBlur={() => {
                      if (sigmaDraft === null) return;
                      if (sigmaInvalid) {
                        setSigmaTouched(true);
                        return;
                      }
                      const sigmaY = Number(sigmaDraft);
                      if (sigmaY === u.sigmaY) {
                        setSigmaDraft(null);
                        setSigmaTouched(false);
                        return;
                      }
                      change({
                        ...state,
                        request: {
                          ...state.request,
                          uncertainty: {
                            ...u,
                            sigmaY,
                            provenance: {
                              kind: "user-asserted",
                              description: "Common sigma edited in fit window",
                            },
                          },
                        },
                      });
                    }}
                  />
                </label>
              )}
              {sigmaTouched && sigmaInvalid && (
                <p id="sigma-error" className="fit-help" role="alert">
                  Enter an uncertainty greater than zero, or press Escape to
                  restore the previous value.
                </p>
              )}
              <p className="fit-help">
                {u.kind === "unknown-equal"
                  ? "Equal weights. Scatter is estimated from residuals; Q is unavailable."
                  : "Absolute supplied uncertainties are never rescaled to force reduced χ² to one."}
              </p>
              <p className="fit-help">
                Error structure: {u.errorStructure}. x is{" "}
                {state.request.dataset.assumptions.exactX === "asserted"
                  ? "asserted exact"
                  : "not established as exact"}
                .
              </p>
            </section>
            <section>
              <div className="fit-history">
                <button
                  disabled={!past.current.length}
                  onClick={() => history()}
                >
                  Undo
                </button>
                <button
                  disabled={!future.current.length}
                  onClick={() => history(true)}
                >
                  Redo
                </button>
                <button
                  disabled={!state.settings.excludedIds.length}
                  onClick={() =>
                    change({
                      ...state,
                      settings: { ...state.settings, excludedIds: [] },
                    })
                  }
                >
                  Restore points
                </button>
              </div>
              <p role="status" className="fit-help">
                {notice ||
                  (dirty
                    ? "Unsaved analysis changes"
                    : "Local analysis · no data uploaded")}
              </p>
            </section>
            <section className="fit-source">
              <div className="section-eyebrow">SOURCE</div>
              <div>
                <h2>{state.request.dataset.label}</h2>
                <p>
                  {included} / {state.request.dataset.rows.length} observations
                  · {state.request.dataset.yColumn.label} vs{" "}
                  {state.request.dataset.xColumn.label}
                </p>
              </div>

              <p>{state.request.source.application}</p>
              <label>
                Source notes
                <textarea
                  key={`${state.request.requestId}-source`}
                  aria-label="Source notes"
                  rows={4}
                  defaultValue={state.request.source.context ?? ""}
                  placeholder="Describe the experiment or add comments…"
                  onBlur={(e) => {
                    const context = e.currentTarget.value.trim()
                      ? e.currentTarget.value
                      : null;
                    if (context !== state.request.source.context)
                      change({
                        ...state,
                        request: {
                          ...state.request,
                          source: { ...state.request.source, context },
                        },
                      });
                  }}
                />
              </label>
              <p>Snapshot {state.request.snapshotId}</p>
            </section>
          </aside>
        </div>
      </div>
    </PlotAppearanceContext.Provider>
  );
}
