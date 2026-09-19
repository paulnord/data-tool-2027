import { FitGuideLegend, layoutGuideLabels } from "./FitGuideLegend";
import { formatNumber as number } from "./formatNumber";
import {
  modelParameterUnit,
  modelNotationNote,
} from "../core/fit/modelNotation";
import { ModelSelector } from "./ModelSelector";
import { AnalysisTools, type AnalysisTool } from "./AnalysisTools";
import { equations } from "./modelEquations";
import SourceNotes from "./SourceNotes";
import { useModalDialog } from "./useModalDialog";
import { InterfaceScaleContext } from "./InterfaceScale";
import { moveMenuFocus, openMenuFromKey } from "./menuKeyboard";
import PrintPages from "./PrintPages";
import DisplayMenu from "./DisplayMenu";
import { EditableNumber } from "./EditableNumber";
import { YAxisTitle } from "./YAxisTitle";
import { sampleFittedCurve, extensionDash } from "./fitCurve";
import ExportSizeDialog from "./ExportSizeDialog";
import {
  DEFAULT_EXPORT_SIZING,
  fitExportPlotMargins,
  layoutExportPlots,
  type ExportSizing,
  type ExportPlotSize,
} from "./exportSizing";
import { flushSync } from "react-dom";
import {
  appearanceStyle,
  defaultPlotAppearance,
  PlotAppearanceContext,
  PlotMarker,
  usePlotAppearance,
} from "./PlotAppearance";
import { exportPlotGraph } from "./graphExport";
import { encodeCodeExportBundle } from "./codeExportArchive";
import { AxisControls, YAxisControls, type AxisRange } from "./YAxisControls";
import MultiInterval, { type MultiIntervalActions } from "./MultiInterval";
import { FitErrorMessage } from "./FitErrorMessage";
import {
  statisticReasonText,
  errorStructureText,
} from "../core/fit/diagnosticText";
import { customFromModel } from "../core/fit/customFromModel";
import { CustomEquationEditor } from "./CustomEquationEditor";
import Assumptions from "./Assumptions";
import CollisionDraft, { type CollisionActions } from "./CollisionDraft";
import ModelComparison, {
  type ModelComparisonActions,
} from "./ModelComparison";
import {
  plotScale,
  automaticDomain,
  plotPath,
  type GraphMode,
} from "./plotScale";
import {
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
import { modelGuideValues } from "../core/fit/modelGuides";
import { fitDerivedQuantities } from "../core/fit/derivedParameters";
import { PeakShapeControls } from "./PeakShapeControls";
import { UnsavedChangesDialog } from "./UnsavedChangesDialog";
import {
  buildCodeExportDescription,
  generateCodeExportBundle,
} from "../core/fit/codeExport";
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
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { isTauri, invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { predict, type FitResult } from "../core/fit/solve";
import {
  initialSettings,
  parameterNames,
  requestSchema,
  sessionSchema,
  createSession,
  type FitRequest,
  type FitSettings,
  type FitSession,
  type DataTable,
  type FitWorkspace,
} from "../core/fit/schema";
import {
  analysisFromTable,
  columnHeading,
  tableForAnalysis,
} from "../core/fit/dataTable";
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
import pulsarPhotonIndexTemperatureExample from "../../examples/data/published/pulsar-photon-index-vs-temperature.csv?raw";
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
import { publishedStudyCatalog } from "./publishedCatalog";

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
const publishedExampleContents: Record<
  (typeof publishedStudyCatalog)[number]["fileName"],
  string
> = {
  "asassn14li-radio.trksess": asassnRadioExample,
  "asassn14li-xray.trksess": asassnXrayExample,
  "ba137m-decay.trksess": ba137mExample,
  "besiii-ppbarpi0-continuum.trksess": besiiiExample,
  "cri-rydberg.trksess": chromiumExample,
  "dyfeo3-spin-wave.trksess": dyfeo3Example,
  "ion-chamber-wall-thick.trksess": ionChamberThickExample,
  "ion-chamber-wall-thin.trksess": ionChamberThinExample,
  "pulsar-luminosity-vs-blc.trksess": pulsarBlcExample,
  "pulsar-luminosity-vs-edot.trksess": pulsarEdotExample,
  "pulsar-photon-index-vs-temperature.csv": pulsarPhotonIndexTemperatureExample,
  "pwn-luminosity-vs-blc.trksess": pwnBlcExample,
  "pwn-luminosity-vs-edot.trksess": pwnEdotExample,
  "supercooled-water-viscosity.trksess": supercooledWaterExample,
  "ymno3-spin-precession.trksess": ymno3Example,
};
const publishedExamples = publishedStudyCatalog.map(
  ({ label, fileName, status }) =>
    [
      label,
      `published/${fileName}`,
      publishedExampleContents[fileName],
      status,
    ] as const,
);
type State = {
  request: FitRequest;
  settings: FitSettings;
  originalRequest?: FitRequest;
  dataTable?: DataTable;
  sessionFile?: FitSession;
};
function fresh(): State {
  return {
    request: emptyRequest(crypto.randomUUID(), crypto.randomUUID()),
    settings: initialSettings("line"),
  };
}
function xBounds(state: State, log = false): AxisRange {
  const xs = state.request.dataset.rows.flatMap((row) =>
    row.x === null ? [] : [row.x],
  );
  return automaticDomain(xs, log, 0.06);
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
  showGuides = false,
  showXAxis = true,
  idPrefix = "",
  printSize,
  fixedYRange,
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
  showGuides?: boolean;
  showXAxis?: boolean;
  idPrefix?: string;
  printSize?: {
    width: number;
    height: number;
    fontSizePx?: number;
    leftMarginPx?: number;
  };
  fixedYRange?: AxisRange;
  yRange?: AxisRange | null;
  onYRange?: (range: AxisRange | null) => void;
  onXRange?: (range: AxisRange | null) => void;
  xCustom?: boolean;
  onLogX?: (log: boolean) => void;
  onLogY?: (log: boolean) => void;
}) {
  const appearance = usePlotAppearance();
  const rowNames = new Map(
    state.request.dataset.rows.map((row, index) => [
      row.id,
      row.label ?? `Row ${index + 1}`,
    ]),
  );
  const logX = mode === "log-x" || mode === "log-log";
  const logY = !residual && (mode === "log-y" || mode === "log-log");
  const positiveXs = state.request.dataset.rows.flatMap((r) =>
    r.x !== null && r.x >= requestedRange[0] && r.x <= requestedRange[1]
      ? [r.x]
      : [],
  );
  const range: [number, number] =
    logX && requestedRange[0] <= 0
      ? automaticDomain(positiveXs, true, 0.06)
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
  const fittedCurve =
    !residual && showModel && result
      ? sampleFittedCurve(state.settings, result, range, logX)
      : null;
  const curve =
    fittedCurve?.fitted ??
    Array.from({ length: curveCount }, (_, i) => {
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
  const guideCurves =
    !residual && showGuides && showModel && curve.length
      ? modelGuideValues(curve[0].x, state.settings, coeff).map((guide) => ({
          ...guide,
          points:
            guide.axis === "x"
              ? []
              : curve.map((point) => ({
                  x: point.x,
                  y:
                    modelGuideValues(point.x, state.settings, coeff).find(
                      (candidate) => candidate.id === guide.id,
                    )?.value ?? NaN,
                })),
        }))
      : [];
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
    ...guideCurves.flatMap((guide) =>
      guide.points.map((point) => point.y).filter(Number.isFinite),
    ),
    ...(band?.points.flatMap((p) => [p.lower, p.upper]) ?? []),
  ];
  const residualExtent =
    ys.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 0.001;
  const automaticY: AxisRange = residual
    ? [-residualExtent * 1.24, residualExtent * 1.24]
    : automaticDomain(plottedY, logY);
  const yDomain: AxisRange =
    fixedYRange ??
    (!residual && yRange && (!logY || yRange[0] > 0) ? yRange : automaticY);
  const yScale = plotScale(yDomain, logY);
  const hiddenCount = state.request.dataset.rows.filter(
    (r) =>
      r.x !== null &&
      r.y !== null &&
      ((logX && r.x <= 0) ||
        (r.x >= requestedRange[0] &&
          r.x <= requestedRange[1] &&
          logY &&
          r.y <= 0)),
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
  const exportFont = printSize?.fontSizePx;
  const left = exportFont
      ? (printSize?.leftMarginPx ?? Math.max(58, exportFont * 5.2))
      : 82,
    right = exportFont ? Math.max(12, exportFont) : 36,
    baseTop = exportFont ? Math.max(8, exportFont * 0.75) : 8,
    bottom = showXAxis ? (exportFont ? exportFont * 3.2 : 52) : 6;
  const guideLabels = layoutGuideLabels(
    guideCurves
      .filter((guide) => guide.symbol && Number.isFinite(guide.value))
      .map((guide) => ({
        id: guide.id,
        text: `${guide.symbol} = ${number(guide.value)}`,
        description: `${guide.label}: ${number(guide.value)} ${guide.axis === "x" ? (state.request.dataset.xColumn.unit ?? "") : (state.request.dataset.yColumn.unit ?? "")}`,
        color: "var(--plot-fit-color)",
      })),
    width - left - right,
    exportFont ?? 12,
  );
  const top = baseTop + guideLabels.height;
  const errorCap = exportFont ? 2.5 : 5;
  const xTickCount = exportFont
    ? Math.max(
        2,
        Math.min(6, Math.floor((width - left - right) / (exportFont * 4))),
      )
    : 6;
  const yTickCount = exportFont
    ? Math.max(
        residual ? 3 : 2,
        Math.min(6, Math.floor((height - top - bottom) / (exportFont * 2.4))),
      )
    : idPrefix && residual
      ? 3
      : 6;
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
  const plotNotices = [
    ...(!residual &&
    showModel &&
    (fittedCurve ? fittedCurve.samplingUnavailable : curveCount === 0)
      ? [
          "Curve unavailable at this period/view; zoom in or use a valid period.",
        ]
      : []),
    ...(errorBars.unavailable > 0
      ? ["Some error bars exceed the numeric range and cannot be drawn."]
      : []),
    ...(band?.reason
      ? [`Confidence band unavailable: ${statisticReasonText(band.reason)}`]
      : []),
  ];
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
        style={{
          ...appearanceStyle(appearance),
          ...(exportFont
            ? ({ "--export-font-size": `${exportFont}px` } as CSSProperties)
            : {}),
        }}
        viewBox={`0 0 ${width} ${height}`}
        width={idPrefix ? width : undefined}
        height={idPrefix ? height : undefined}
        data-guide-minimum-height={
          guideLabels.height
            ? top + bottom + (exportFont ?? 12) * 2.5
            : undefined
        }
        data-guide-minimum-width={
          guideLabels.height
            ? left + right + guideLabels.minimumWidth
            : undefined
        }
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
            data-axis-label="x"
            x={(left + width - right) / 2}
            y={height - (exportFont ? exportFont * 0.4 : 12)}
            textAnchor="middle"
          >
            {state.request.dataset.xColumn.label}
            {logX ? " (log scale)" : ""}
            {state.request.dataset.xColumn.unit
              ? ` [${state.request.dataset.xColumn.unit}]`
              : ""}
          </text>
        )}
        <YAxisTitle
          label={`${residual ? "Residual" : state.request.dataset.yColumn.label}${logY ? " (log scale)" : ""}`}
          unit={state.request.dataset.yColumn.unit}
          x={exportFont ? exportFont * 1.2 : 16}
          y={exportFont && residual ? height / 2 : (top + height - bottom) / 2}
          splitUnit={!!exportFont && residual}
          fontSize={exportFont}
        />
        {((residual && !result) || (!residual && !hasData)) && (
          <text className="fit-empty-plot" x="50%" y="50%" textAnchor="middle">
            {residual ? "Fit to show residuals" : "Paste or open data to begin"}
          </text>
        )}
        {plotNotices.map((notice) =>
          exportFont ? (
            <desc key={notice} data-plot-notice="true">
              {notice}
            </desc>
          ) : (
            <text
              key={notice}
              className="fit-band-unavailable"
              x={left}
              y={height - 2}
            >
              {notice}
            </text>
          ),
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
        {yScale.ticks(yTickCount).map((yy, i) => {
          return (
            <g key={i}>
              <line
                x1={left}
                x2={width - right}
                y1={y(yy)}
                y2={y(yy)}
                className="grid"
              />
              <text
                data-axis-tick="y"
                x={left - 10}
                y={y(yy) + 4}
                textAnchor="end"
              >
                {yScale.label(yy, yTickCount)}
              </text>
            </g>
          );
        })}
        {showXAxis &&
          xScale.ticks(xTickCount).map((xx, i) => {
            return (
              <text
                key={i}
                x={x(xx)}
                y={
                  exportFont ? height - bottom + exportFont * 1.4 : height - 30
                }
                textAnchor={i === 0 ? "start" : i === 5 ? "end" : "middle"}
              >
                {xScale.label(xx, xTickCount)}
              </text>
            );
          })}
        <FitGuideLegend
          layout={guideLabels}
          left={left}
          top={baseTop}
          fontSize={exportFont ?? 12}
        />
        <rect
          className="fit-plot-frame"
          data-plot-frame="true"
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
                      y: logY ? Math.max(yDomain[0], p.upper) : p.upper,
                    })),
                    ...[...band.points].reverse().map((p) => ({
                      x: p.x,
                      y: logY ? Math.max(yDomain[0], p.lower) : p.lower,
                    })),
                  ],
                  x,
                  y,
                ) + " Z"
              }
            />
          )}
          {fittedCurve && (
            <desc>
              Fainter dashed ends extrapolate the model up to ten percent beyond
              the fitted observations. They are not additional measurements.
              {showGuides && fittedCurve.baseline !== null
                ? " The dotted b guide marks the fitted mean position, not the sample average."
                : ""}
            </desc>
          )}
          {showGuides &&
            fittedCurve?.baseline !== null &&
            fittedCurve?.baseline !== undefined &&
            fittedCurve.baseline >= yDomain[0] &&
            fittedCurve.baseline <= yDomain[1] &&
            fittedCurve.support &&
            (() => {
              const baseline = fittedCurve.baseline;
              const start =
                fittedCurve.before[0]?.x ?? fittedCurve.fitted[0]?.x;
              const end =
                fittedCurve.after.at(-1)?.x ?? fittedCurve.fitted.at(-1)?.x;
              if (start === undefined || end === undefined) return null;
              return (
                <g className="fit-mean-guide" style={{ pointerEvents: "none" }}>
                  <line
                    className="model-guide model-guide-baseline"
                    aria-label="Fitted baseline y = b"
                    data-mean-position={baseline}
                    x1={x(start)}
                    x2={x(end)}
                    y1={y(baseline)}
                    y2={y(baseline)}
                    stroke="var(--plot-fit-color)"
                    strokeWidth={exportFont ? 0.65 : 1}
                    strokeDasharray="1 4"
                    opacity={0.8}
                  >
                    <title>{`Fitted mean position: b = ${number(baseline)} ${state.request.dataset.yColumn.unit ?? ""}`}</title>
                  </line>
                </g>
              );
            })()}
          {residual && result ? (
            <line
              x1={left}
              x2={width - right}
              y1={y(0)}
              y2={y(0)}
              className="zero"
            />
          ) : !residual && showModel ? (
            <>
              {guideCurves
                .filter(
                  (guide) =>
                    guide.id !== "baseline" || fittedCurve?.baseline == null,
                )
                .map((guide) =>
                  guide.axis === "x" ? (
                    Number.isFinite(guide.value) &&
                    guide.value >= range[0] &&
                    guide.value <= range[1] &&
                    (!logX || guide.value > 0) ? (
                      <line
                        key={guide.id}
                        className={`model-guide model-guide-${guide.id}`}
                        aria-label={guide.label}
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
                      key={guide.id}
                      d={plotPath(guide.points, x, y)}
                      className={`model-guide model-guide-${guide.id}`}
                      aria-label={guide.label}
                    />
                  ),
                )}
              <path
                d={plotPath(curve, x, y)}
                className="curve"
                data-fit-part={result ? "fitted" : "manual"}
              />
              {fittedCurve &&
                [fittedCurve.before, fittedCurve.after].map(
                  (tail, index) =>
                    tail.length > 0 && (
                      <path
                        key={index}
                        d={plotPath(tail, x, y)}
                        className="fit-extrapolation"
                        data-fit-part="extrapolation"
                        data-extrapolation-side={
                          index === 0 ? "before" : "after"
                        }
                        strokeDasharray={extensionDash()}
                        style={{
                          fill: "none",
                          stroke: "var(--plot-fit-color)",
                          strokeWidth: exportFont ? 0.75 : 1.5,
                          opacity: 0.65,
                        }}
                      >
                        <title>
                          Model extrapolation beyond fitted observations
                        </title>
                      </path>
                    ),
                )}
            </>
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
              d={`M${x(bar.x)},${y(logY ? Math.max(yDomain[0], bar.lower) : bar.lower)} V${y(bar.upper)}${logY && bar.lower < yDomain[0] ? "" : ` M${x(bar.x) - errorCap},${y(bar.lower)} H${x(bar.x) + errorCap}`} M${x(bar.x) - errorCap},${y(bar.upper)} H${x(bar.x) + errorCap}`}
            />
          ))}
          {rows.map((r, i) => (
            <PlotMarker
              key={r.id}
              data-row-id={r.id}
              x={x(r.x!)}
              y={y(ys[i])}
              r={exportFont ? 1.5 : 4}
              className={
                excluded.has(r.id) || !r.included ? "point excluded" : "point"
              }
              onClick={() => {
                if (!onSelect && !suppressClick.current) onToggle(r.id);
              }}
            >
              <title>{`${rowNames.get(r.id)}: ${r.x}, ${ys[i]} (${excluded.has(r.id) || !r.included ? "excluded from fit" : "included in fit"})`}</title>
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
  showGuides,
  showResiduals,
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
  showGuides: boolean;
  showResiduals: boolean;
  fullPageGraph: boolean;
  onFullPageGraphChange: (enabled: boolean) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState("");
  const graphWidth = fullPageGraph ? 960 : 720;
  const hasResidualPlot = showResiduals && !!result;
  const derived = result
    ? fitDerivedQuantities(state.request, state.settings, result)
    : [];
  const dataHeight = fullPageGraph
    ? hasResidualPlot
      ? 402
      : 586
    : showResiduals
      ? 236
      : 370;
  const residualHeight = fullPageGraph ? 184 : 134;
  const printNumber = (value: number) => number(value).replaceAll(",", "");
  useModalDialog(dialog, ".fit-print-trigger");
  async function print() {
    setError("");
    try {
      await window.print();
    } catch (e) {
      setError(`Printing failed: ${String(e)}`);
    }
  }
  return (
    <dialog
      ref={dialog}
      className={`fit-print-dialog${fullPageGraph ? " full-page-graph" : ""}`}
      aria-label="Print report"
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
        <button onClick={() => void print()}>Print…</button>
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
                  showGuides={showGuides}
                  showXAxis={!hasResidualPlot}
                  printSize={{ width: graphWidth, height: dataHeight }}
                  idPrefix="print-measure-"
                />
                {hasResidualPlot && (
                  <Plot
                    mode={mode}
                    state={state}
                    result={result}
                    range={range}
                    residual
                    onToggle={() => {}}
                    showGuides={showGuides}
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
                {result &&
                showGuides &&
                modelGuideValues(0, state.settings, result.coefficients).length
                  ? " Dashed guides mark model reference values; labels appear above the graph."
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
                              ? statisticReasonText(
                                  result.standardErrors[i].reason,
                                )
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
                  {derived.length > 0 && (
                    <table
                      aria-label={
                        state.settings.model.startsWith("gaussian")
                          ? "Print derived peak quantities"
                          : "Print derived oscillation quantities"
                      }
                    >
                      <thead>
                        <tr>
                          <th>Derived quantity</th>
                          <th>Value</th>
                          <th>Standard error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {derived.map((quantity) => (
                          <tr key={quantity.id}>
                            <td>{quantity.label}</td>
                            <td>
                              {quantity.value === null
                                ? "Unavailable"
                                : printNumber(quantity.value)}{" "}
                              [{quantity.unit}]
                            </td>
                            <td>
                              {quantity.standardError.value === null
                                ? statisticReasonText(
                                    quantity.standardError.reason,
                                  )
                                : printNumber(quantity.standardError.value)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
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
  const [showResiduals, setShowResiduals] = useState(true);
  const [showGuides, setShowGuides] = useState(false);
  const [exportSizing, setExportSizing] = useState<ExportSizing | null>(null);
  const [exportSizeOpen, setExportSizeOpen] = useState(false);
  const [exportRender, setExportRender] = useState<{
    sizes: ExportPlotSize[];
    yRanges: AxisRange[];
  } | null>(null);
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
  const settingsPanel = useRef<HTMLDivElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsPosition, setSettingsPosition] = useState<CSSProperties>({});
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
  const comparisonActions = useRef<ModelComparisonActions>(null);
  const [comparisonReady, setComparisonReady] = useState(false);
  const [multiOpen, setMultiOpen] = useState(false);
  const [multiReady, setMultiReady] = useState(false);
  const [equationPending, setEquationPending] = useState(false);
  const [unsavedDraftWork, setUnsavedDraftWork] = useState(false);
  const [pendingDataEdit, setPendingDataEdit] = useState(false);
  const [collisionReady, setCollisionReady] = useState(false);
  const [collisionOpen, setCollisionOpen] = useState(false);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [comparisonVisited, setComparisonVisited] = useState(false);
  const [collisionRevision, setCollisionRevision] = useState(0);
  const [collisionSource, setCollisionSource] = useState<State | null>(null);
  const [initialWorkspace, setInitialWorkspace] = useState<FitWorkspace>();
  const [comparisonRevision, setComparisonRevision] = useState(0);
  const workspaceRevision = useRef(0);
  const dirtyWorkspaces = useRef(new Set<FitWorkspace["kind"]>());
  const analysisToolsSelect = useRef<HTMLSelectElement>(null);
  const restoreAnalysisToolsFocus = useRef(false);
  function draftChanged(kind: FitWorkspace["kind"]) {
    workspaceRevision.current += 1;
    dirtyWorkspaces.current.add(kind);
    setUnsavedDraftWork(true);
  }
  function viewChanged() {
    if (comparisonOpen) draftChanged("model-comparison");
    else if (multiOpen) draftChanged("multi-interval");
    else if (collisionOpen) draftChanged("collision");
    else {
      workspaceRevision.current += 1;
      setDirty(true);
    }
  }
  const [mode, setMode] = useState<GraphMode>("linear");
  const [yRange, setYRange] = useState<AxisRange | null>(null);
  const logX = mode === "log-x" || mode === "log-log";
  const logY = mode === "log-y" || mode === "log-log";
  function changeLog(x: boolean, y: boolean) {
    if (x !== logX) {
      setXRange(null);
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
  const [xRange, setXRange] = useState<AxisRange | null>(null);
  const range = xRange ?? xBounds(state, logX);
  const [tab, setTab] = useState<"results" | "rows">("results");
  const [busy, setBusy] = useState(false);
  const [sigmaDraft, setSigmaDraft] = useState<string | null>(null);
  const [sigmaTouched, setSigmaTouched] = useState(false);
  const [numericDraftInvalid, setNumericDraftInvalid] = useState(false);
  function numericDraftChanged(invalid: boolean) {
    setNumericDraftInvalid(invalid);
    if (invalid) {
      cancel();
      setNotice("");
    }
  }
  const sigmaInvalid =
    sigmaDraft !== null &&
    (!(Number(sigmaDraft) > 0) || !Number.isFinite(Number(sigmaDraft)));
  const [displayScale, setDisplayScale] = useState(1);
  useLayoutEffect(() => {
    if (!settingsOpen) return;
    const position = () => {
      if (!settingsMenu.current || !settingsPanel.current) return;
      const anchor = settingsMenu.current.getBoundingClientRect();
      const panel = settingsPanel.current.getBoundingClientRect();
      const left = Math.max(
        12,
        Math.min(anchor.left, innerWidth - panel.width - 12),
      );
      setSettingsPosition({
        left: (left - anchor.left) / displayScale,
        maxHeight: Math.max(
          80,
          (innerHeight - anchor.bottom - 12) / displayScale - 6,
        ),
      });
    };
    position();
    window.addEventListener("resize", position);
    return () => window.removeEventListener("resize", position);
  }, [settingsOpen, displayScale]);
  const activeWorker = useRef<Worker | null>(null);
  const past = useRef<State[]>([]),
    future = useRef<State[]>([]),
    input = useRef<HTMLInputElement>(null),
    dirtyRef = useRef(dirty);
  const pendingEquation = state.settings.model === "custom" && equationPending;
  dirtyRef.current =
    dirty ||
    unsavedDraftWork ||
    pendingEquation ||
    sigmaDraft !== null ||
    numericDraftInvalid ||
    dataPanel !== null;
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
    setError("");
    setNotice(redo ? "Analysis change redone" : "Analysis change undone");
  }
  function bounds() {
    setYRange(null);
    setXRange(null);
  }
  function replace(next: State) {
    const { sessionFile: restored, ...analysis } = next;
    setInitialWorkspace(restored?.workspace);
    dirtyWorkspaces.current.clear();
    workspaceRevision.current += 1;
    if (restored) {
      setCollisionSource(
        restored.workspace.kind === "single-fit" ? null : analysis,
      );
      setCollisionRevision((v) => v + 1);
      setComparisonRevision((v) => v + 1);
      setMultiReady(false);
      setCollisionReady(false);
      setComparisonReady(false);
      setMultiOpen(restored.workspace.kind === "multi-interval");
      setCollisionOpen(restored.workspace.kind === "collision");
      setComparisonOpen(restored.workspace.kind === "model-comparison");
      setComparisonVisited(restored.workspace.kind === "model-comparison");
      setShowResiduals(restored.view.showResiduals);
      setShowGuides(restored.view.showGuides);
      setShowErrorBars(restored.view.showErrorBars);
    }
    setManualState(null);
    setSigmaDraft(null);
    setSigmaTouched(false);
    cancel();
    setState(analysis);
    setResult(null);
    setDirty(false);
    setUnsavedDraftWork(false);
    setPendingDataEdit(false);
    setPending(null);
    past.current = [];
    future.current = [];
    bounds();
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
    if (sigmaInvalid || numericDraftInvalid) return;
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
  function rejectImport(fileName: string, reason: unknown) {
    setNotice("");
    setError(
      `Import rejected: ${fileName}. Your current data were kept.\nDetails: ${reason instanceof Error ? reason.message : String(reason)}`,
    );
  }
  async function importText(text: string, fileName = "Imported data") {
    setNotice("");
    setError("");
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
            sessionFile: parsed,
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
      rejectImport(fileName, e);
    }
  }
  async function importArchive(bytes: Uint8Array, fileName: string) {
    try {
      setTrackerProject(parseTrackerArchive(bytes, fileName));
      setError("");
    } catch (e) {
      rejectImport(fileName, e);
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
    const workspace = comparisonOpen
      ? comparisonActions.current?.session()
      : multiOpen
        ? multiActions.current?.session()
        : collisionOpen
          ? collisionActions.current?.session()
          : undefined;
    if ((comparisonOpen || multiOpen || collisionOpen) && !workspace)
      throw new Error("The workspace is still opening. Try saving again.");
    return createSession(
      {
        ...state,
        dataTable: workspace ? tableForAnalysis(state) : state.dataTable,
      },
      workspace ?? { kind: "single-fit" },
      { showResiduals, showGuides, showErrorBars },
    );
  }

  async function saveFile() {
    if (
      !comparisonOpen &&
      !multiOpen &&
      !collisionOpen &&
      (sigmaInvalid || numericDraftInvalid || pendingEquation)
    )
      return;
    try {
      setError("");
      let saved = session();
      const revision = workspaceRevision.current;
      const serialize = () => {
        const data = JSON.stringify(saved, null, 2);
        if (new TextEncoder().encode(data).length > 20_000_000)
          throw new Error(
            "Session exceeds the 20 MB limit; reduce the source table or number of candidates.",
          );
        return data;
      };
      if (isTauri()) {
        const path = await save({
          defaultPath: "analysis.trksess",
          filters: [{ name: "Fit session", extensions: ["trksess"] }],
        });
        if (!path) return;
        saved = nameSavedSession(saved, path);
        await invoke("write_fit_file", {
          path,
          data: serialize(),
        });
      } else {
        saved = nameSavedSession(saved, "analysis.trksess");
        const url = URL.createObjectURL(
          new Blob([serialize()], {
            type: "application/json",
          }),
        );
        const a = document.createElement("a");
        a.href = url;
        a.download = "analysis.trksess";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      const unchanged =
        liveState.current === state && workspaceRevision.current === revision;
      if (unchanged) {
        if (saved.request.dataset.label !== state.request.dataset.label) {
          cancel();
          const next = { ...state, request: saved.request };
          setState(next);
          setResult((previous) =>
            previous?.state === state ? { ...previous, state: next } : previous,
          );
        }
        setDirty(false);
        if (saved.workspace.kind !== "single-fit")
          dirtyWorkspaces.current.delete(saved.workspace.kind);
        setUnsavedDraftWork(dirtyWorkspaces.current.size > 0);
      }
      setNotice(
        unchanged
          ? saved.workspace.kind !== "single-fit"
            ? "Workspace session saved; reopen and fit to recalculate results"
            : "Session saved"
          : "Earlier version saved; newer changes remain unsaved",
      );
    } catch (e) {
      setError(`Save failed: ${String(e)}`);
    }
  }
  async function copy() {
    if (!current || numericDraftInvalid || pendingEquation) return;
    try {
      await navigator.clipboard.writeText(
        fitReportTsv(state.request, state.settings, current, reportSections),
      );
      setNotice("Report copied with the selected sections");
    } catch {
      setError(
        "Clipboard unavailable. Save the session to retain full-precision inputs.",
      );
    }
  }
  async function exportGraph(format: "svg" | "png" | "pdf") {
    if (
      exportRender ||
      (comparisonOpen
        ? !comparisonReady
        : !multiOpen &&
          !collisionOpen &&
          (numericDraftInvalid || pendingEquation))
    )
      return;
    setNotice("");
    setError("");
    exportMenu.current?.removeAttribute("open");
    const activePlots = comparisonOpen
      ? document.querySelectorAll<SVGSVGElement>(
          ".model-comparison .comparison-workspace > .comparison-plot-wrap svg",
        )
      : multiOpen
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
      (comparisonOpen
        ? "model-comparison"
        : state.request.dataset.label || "fit-graph"
      )
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-|-$/g, "") || "fit-graph";
    try {
      let outputPlots = plots;
      if (exportSizing) {
        const sizes = layoutExportPlots(
          exportSizing,
          plots.map((plot) =>
            /residual/i.test(plot.getAttribute("aria-label") ?? ""),
          ),
        );
        const yRanges = plots.map(
          (plot) =>
            [
              Number(plot.getAttribute("data-y-min")),
              Number(plot.getAttribute("data-y-max")),
            ] as AxisRange,
        );
        flushSync(() => setExportRender({ sizes, yRanges }));
        outputPlots = Array.from(
          document.querySelectorAll<SVGSVGElement>(".fit-export-render svg"),
        );
        const yTickWidths = outputPlots.flatMap((plot) =>
          Array.from(
            plot.querySelectorAll<SVGTextElement>('[data-axis-tick="y"]'),
          ).map((tick) => tick.getBBox().width),
        );
        const yTitleLineCounts = outputPlots.map((plot) =>
          Math.max(
            1,
            plot.querySelector('[data-axis-label="y"]')?.children.length ?? 1,
          ),
        );
        const fittedSizes = fitExportPlotMargins(
          sizes,
          yTickWidths,
          yTitleLineCounts,
        );
        flushSync(() => setExportRender({ sizes: fittedSizes, yRanges }));
        outputPlots = Array.from(
          document.querySelectorAll<SVGSVGElement>(".fit-export-render svg"),
        );
      }
      for (const plot of outputPlots) {
        const box = plot.viewBox.baseVal;
        if (
          Number(plot.dataset.guideMinimumHeight ?? 0) > box.height ||
          Number(plot.dataset.guideMinimumWidth ?? 0) > box.width
        )
          throw new Error(
            "Fit guide labels need more room. Increase the figure width or height, or hide fit guides.",
          );
      }
      const notices = [
        ...new Set(
          outputPlots.flatMap((plot) =>
            Array.from(plot.querySelectorAll("desc[data-plot-notice]"))
              .map((description) => description.textContent?.trim() ?? "")
              .filter(Boolean),
          ),
        ),
      ];
      await exportPlotGraph(
        outputPlots,
        name,
        format,
        exportSizing ?? undefined,
      );
      setNotice(["Graph exported.", ...notices].join(" "));
    } catch (error) {
      setError(`Graph export failed: ${String(error)}`);
    } finally {
      setExportRender(null);
    }
  }
  async function saveAnalysisBundle(
    bundle: ReturnType<typeof generateCodeExportBundle>,
  ) {
    const archive = encodeCodeExportBundle(bundle);
    if (isTauri()) {
      const path = await save({
        defaultPath: bundle.archiveName,
        filters: [{ name: "Analysis bundle", extensions: ["zip"] }],
      });
      if (!path) return false;
      await invoke("write_analysis_bundle", {
        path,
        data: Array.from(archive),
      });
    } else {
      const url = URL.createObjectURL(
        new Blob([new Uint8Array(archive)], { type: "application/zip" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = bundle.archiveName;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    return true;
  }
  async function exportCodeBundle(target: "scipy" | "root") {
    exportMenu.current?.removeAttribute("open");
    if (comparisonOpen) {
      try {
        const bundle = comparisonActions.current?.exportCode(target);
        if (bundle && (await saveAnalysisBundle(bundle)))
          setNotice("Model comparison analysis bundle exported");
      } catch (cause) {
        setError(`Code export failed: ${String(cause)}`);
      }
      return;
    }

    if (
      numericDraftInvalid ||
      pendingEquation ||
      comparisonOpen ||
      multiOpen ||
      collisionOpen
    )
      return;
    if (!current) {
      setError("Fit the current analysis before exporting code.");
      return;
    }
    try {
      const plot = chartRef.current?.querySelector<SVGSVGElement>(
        'svg[aria-label="Data and fitted curve"]',
      );
      const displayedY = plot
        ? ([
            Number(plot.getAttribute("data-y-min")),
            Number(plot.getAttribute("data-y-max")),
          ] as AxisRange)
        : yRange;
      const description = buildCodeExportDescription(
        state.request,
        state.settings,
        current,
        {
          mode,
          xRange: range,
          yRange:
            displayedY?.every(Number.isFinite) && displayedY[0] < displayedY[1]
              ? displayedY
              : null,
          showResiduals,
          showErrorBars,
          showGuides,
        },
      );
      const bundle = generateCodeExportBundle(description, target);
      if (!(await saveAnalysisBundle(bundle))) return;
      setNotice(
        `${target === "scipy" ? "SciPy" : "ROOT"} analysis bundle exported`,
      );
    } catch (cause) {
      setError(`Code export failed: ${String(cause)}`);
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
      setInitialWorkspace(undefined);
      setCollisionRevision((v) => v + 1);
      setCollisionReady(false);
      setMultiReady(false);
      dirtyWorkspaces.current.delete("multi-interval");
      dirtyWorkspaces.current.delete("collision");
      setUnsavedDraftWork(dirtyWorkspaces.current.size > 0);
    }
  }, [collisionOpen, multiOpen, state, collisionSource]);
  const analysisTool: AnalysisTool = comparisonOpen
    ? "model-comparison"
    : multiOpen
      ? "multi-interval"
      : collisionOpen
        ? "collision"
        : "single-fit";
  function selectAnalysisTool(value: AnalysisTool) {
    restoreAnalysisToolsFocus.current = true;
    setMultiOpen(value === "multi-interval");
    setCollisionOpen(value === "collision");
    setComparisonOpen(value === "model-comparison");
    if (value === "model-comparison") setComparisonVisited(true);
  }
  useEffect(() => {
    if (!restoreAnalysisToolsFocus.current) return;
    restoreAnalysisToolsFocus.current = false;
    const frame = requestAnimationFrame(() =>
      analysisToolsSelect.current?.focus({ preventScroll: true }),
    );
    return () => cancelAnimationFrame(frame);
  }, [analysisTool]);
  const analysisTools = (
    <AnalysisTools
      value={analysisTool}
      onChange={selectAnalysisTool}
      selectRef={analysisToolsSelect}
    />
  );
  const modelSelector = (
    <ModelSelector
      label="Model"
      value={state.settings.model}
      onChange={(value) => {
        if (
          value === state.settings.model ||
          (value === "gaussian" && state.settings.model === "gaussian-shape")
        )
          return;
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
            ...initialSettings(value as FitSettings["model"]),
            ...(isNonlinearModel(value)
              ? {
                  parameters: suggestedParameters(
                    value,
                    state.request,
                    state.settings.excludedIds,
                  ).map((value) => ({ value, fixed: false })),
                }
              : {}),
            excludedIds: state.settings.excludedIds,
            selectionAfterInspection: state.settings.selectionAfterInspection,
            retainedPerRowUncertainty: state.settings.retainedPerRowUncertainty,
            physicalTimeConfirmed: state.settings.physicalTimeConfirmed,
          },
        });
      }}
    />
  );
  const analysisTable = tableForAnalysis(state);
  const analysisWidth = Math.max(
    0,
    ...analysisTable.cells.map((row) => row.length),
  );
  const analysisColumns = Array.from({ length: analysisWidth }, (_, index) => ({
    index,
    label: columnHeading(
      analysisTable.headerRows
        ? analysisTable.cells[analysisTable.headerRows - 1]?.[index] ||
            `Column ${index + 1}`
        : `Column ${index + 1}`,
      analysisTable.units[index],
    ),
  })).filter(({ index }) => index !== analysisTable.label);
  function assignAnalysisColumns(
    update: Partial<Pick<DataTable, "x" | "y" | "sigma">>,
  ) {
    let next = { ...analysisTable, ...update };
    if (update.x !== undefined && update.x === analysisTable.y)
      next = { ...next, y: analysisTable.x };
    if (update.y !== undefined && update.y === analysisTable.x)
      next = { ...next, x: analysisTable.y };
    if (update.y !== undefined) next = { ...next, sigma: null };
    if (next.sigma === next.x || next.sigma === next.y)
      next = { ...next, sigma: null };
    try {
      const remapped = analysisFromTable(
        next,
        state.request.dataset.label,
        state,
        state.request.source.fileName,
      );
      change({ ...state, ...remapped });
      bounds();
    } catch (cause) {
      setError(
        `That column assignment cannot be analyzed: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
    }
  }
  const u = state.request.uncertainty;
  const uncertaintyChoice =
    u.kind === "supplied-per-row" && analysisTable.sigma !== null
      ? `column:${analysisTable.sigma}`
      : u.kind;
  function chooseUncertainty(value: string) {
    if (value.startsWith("column:")) {
      const sigma = Number(value.slice("column:".length));
      if (sigma !== analysisTable.sigma) {
        assignAnalysisColumns({ sigma });
        return;
      }
      change({
        ...state,
        ...switchNoiseModel(state.request, state.settings, "supplied-per-row"),
      });
      return;
    }
    change({
      ...state,
      ...switchNoiseModel(
        state.request,
        state.settings,
        value as FitRequest["uncertainty"]["kind"],
      ),
    });
  }
  const uncertaintyAssignment = (
    <div className="fit-analysis-uncertainty">
      <label>
        Y uncertainty
        <select
          aria-label="Y uncertainty source"
          value={uncertaintyChoice}
          onChange={(event) => chooseUncertainty(event.target.value)}
        >
          <option value="unknown-equal">
            Unknown · estimate equal scatter
          </option>
          <option value="supplied-common">Enter common σ</option>
          {analysisColumns
            .filter(
              (column) =>
                column.index !== analysisTable.x &&
                column.index !== analysisTable.y,
            )
            .map((column) => (
              <option key={column.index} value={`column:${column.index}`}>
                Use {column.label.label}
                {column.label.unit ? ` [${column.label.unit}]` : ""}
              </option>
            ))}
          {u.kind === "supplied-per-row" && analysisTable.sigma === null && (
            <option value="supplied-per-row">Supplied per observation</option>
          )}
        </select>
      </label>
      {u.kind === "supplied-common" && (
        <label>
          Common σ y [{state.request.dataset.yColumn.unit ?? "unspecified"}]
          <input
            type="text"
            inputMode="decimal"
            aria-label="Y uncertainty"
            aria-invalid={sigmaTouched && sigmaInvalid}
            aria-describedby={
              sigmaTouched && sigmaInvalid ? "sigma-error" : undefined
            }
            value={sigmaDraft ?? String(u.sigmaY)}
            onChange={(event) => {
              cancel();
              setSigmaDraft(event.target.value);
              setSigmaTouched(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              }
              if (event.key === "Escape") {
                event.preventDefault();
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
          Enter an uncertainty greater than zero, or press Escape to restore the
          previous value.
        </p>
      )}
      <p className="fit-help">
        {u.kind === "unknown-equal"
          ? "Equal weights. Scatter is estimated from residuals; Q is unavailable."
          : u.kind === "supplied-common"
            ? "The common σ is applied to every included observation and is not rescaled."
            : "The selected column supplies σ for each observation; values are not rescaled."}
      </p>
      <p className="fit-help">
        Error structure: {errorStructureText(u.errorStructure)}. x is{" "}
        {state.request.dataset.assumptions.exactX === "asserted"
          ? "asserted exact"
          : "not established as exact"}
        .
      </p>
    </div>
  );
  const columnAssignments = (
    extra?: ReactNode,
    includeUncertaintyColumn = true,
  ) => (
    <fieldset className="fit-analysis-columns">
      <legend>{extra ? "Columns and uncertainty" : "Columns"}</legend>
      {(["x", "y"] as const).map((axis) => (
        <label key={axis}>
          {axis.toUpperCase()}
          <select
            aria-label={`${axis.toUpperCase()} analysis column`}
            value={analysisTable[axis]}
            onChange={(event) =>
              assignAnalysisColumns({ [axis]: Number(event.target.value) })
            }
          >
            {analysisColumns.map((column) => (
              <option key={column.index} value={column.index}>
                {column.label.label}
                {column.label.unit ? ` [${column.label.unit}]` : ""}
              </option>
            ))}
          </select>
        </label>
      ))}
      {includeUncertaintyColumn && (
        <label className="fit-analysis-uncertainty-column">
          Y uncertainty column
          <select
            aria-label="Uncertainty analysis column"
            value={analysisTable.sigma ?? -1}
            onChange={(event) =>
              assignAnalysisColumns({
                sigma:
                  Number(event.target.value) < 0
                    ? null
                    : Number(event.target.value),
              })
            }
          >
            <option value={-1}>None</option>
            {analysisColumns
              .filter(
                (column) =>
                  column.index !== analysisTable.x &&
                  column.index !== analysisTable.y,
              )
              .map((column) => (
                <option key={column.index} value={column.index}>
                  {column.label.label}
                  {column.label.unit ? ` [${column.label.unit}]` : ""}
                </option>
              ))}
          </select>
        </label>
      )}
      {extra}
    </fieldset>
  );
  const analysisControl = (
    extra?: ReactNode,
    includeUncertaintyColumn = true,
  ) => (
    <>
      {modelSelector}
      {columnAssignments(extra, includeUncertaintyColumn)}
      {analysisTools}
    </>
  );
  const comparisonAnalysisControl = (uncertaintyControl: ReactNode) => (
    <>
      {analysisTools}
      {columnAssignments(uncertaintyControl)}
    </>
  );
  const names = parameterNames(state.settings.model, state.settings.custom);
  const derived = current
    ? fitDerivedQuantities(state.request, state.settings, current)
    : [];
  const included = state.request.dataset.rows.filter(
    (r) => r.included && !state.settings.excludedIds.includes(r.id),
  ).length;
  const hasRowLabels = state.request.dataset.rows.some(
    (row) => row.label !== undefined,
  );
  return (
    <InterfaceScaleContext.Provider value={displayScale}>
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
            if (e.target instanceof HTMLElement && e.target.closest("dialog")) {
              if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "p")
                e.preventDefault();
              return;
            }
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "p") {
              e.preventDefault();
              if (comparisonOpen) {
                comparisonActions.current?.print();
                return;
              }
              if (
                !multiOpen &&
                !collisionOpen &&
                (numericDraftInvalid || pendingEquation)
              )
                return;
              if (multiOpen) void multiActions.current?.print();
              else if (collisionOpen) void collisionActions.current?.print();
              else setPrintPreview(true);
              return;
            }
            if (
              (e.metaKey || e.ctrlKey) &&
              e.key.toLowerCase() === "z" &&
              !comparisonOpen &&
              !multiOpen &&
              !collisionOpen &&
              !(e.target instanceof HTMLInputElement) &&
              !(e.target instanceof HTMLTextAreaElement) &&
              !(e.target instanceof HTMLElement && e.target.isContentEditable)
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
                  title="Undo (⌘Z / Ctrl+Z)"
                  disabled={
                    multiOpen ||
                    collisionOpen ||
                    comparisonOpen ||
                    !past.current.length
                  }
                  onClick={() => history()}
                >
                  <span aria-hidden="true">↶</span> Undo
                </button>
                <button
                  aria-label="Redo analysis change"
                  title="Redo (⇧⌘Z / Ctrl+Shift+Z)"
                  disabled={
                    multiOpen ||
                    collisionOpen ||
                    comparisonOpen ||
                    !future.current.length
                  }
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
              <details
                ref={settingsMenu}
                className="fit-settings-menu"
                onToggle={(event) => setSettingsOpen(event.currentTarget.open)}
              >
                <summary>
                  Settings{" "}
                  <span className="fit-menu-arrow" aria-hidden="true">
                    ▾
                  </span>
                </summary>
                <div
                  ref={settingsPanel}
                  className="fit-settings-popover"
                  style={settingsPosition}
                >
                  <fieldset>
                    <legend>Graphs</legend>
                    <label>
                      <input
                        type="checkbox"
                        checked={showResiduals}
                        onChange={(e) => {
                          viewChanged();
                          setShowResiduals(e.target.checked);
                        }}
                      />
                      Show residual plots
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={showGuides}
                        onChange={(e) => {
                          viewChanged();
                          setShowGuides(e.target.checked);
                        }}
                      />
                      Show fit guides when available
                    </label>
                    <p>
                      Residual visibility applies to all analyses. Fit guides
                      follow single, multi-interval, and model-comparison fits
                      into printing and exports. Labels sit above the curves.
                    </p>
                  </fieldset>
                  <fieldset
                    disabled={collisionOpen || multiOpen || comparisonOpen}
                  >
                    <legend>Copy report sections</legend>
                    <p>Single-fit reports</p>
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
                  </fieldset>
                </div>
              </details>
            </div>
            <nav>
              <button
                className="fit-data-trigger"
                onClick={() =>
                  showData({
                    source: state.request.dataset.label,
                    editing: true,
                  })
                }
              >
                Data…
              </button>
              <button
                disabled={
                  !comparisonOpen &&
                  !multiOpen &&
                  !collisionOpen &&
                  (sigmaInvalid ||
                    numericDraftInvalid ||
                    (state.settings.model === "custom" && equationPending))
                }
                onClick={saveFile}
              >
                Save session
              </button>
              <button
                disabled={
                  comparisonOpen
                    ? !comparisonReady
                    : multiOpen
                      ? !multiReady
                      : collisionOpen
                        ? !collisionReady
                        : !current || numericDraftInvalid || pendingEquation
                }
                onClick={() =>
                  comparisonOpen
                    ? comparisonActions.current?.copy()
                    : multiOpen
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
                  comparisonOpen
                    ? !comparisonReady
                    : multiOpen
                      ? !multiReady
                      : collisionOpen
                        ? !collisionReady
                        : numericDraftInvalid || pendingEquation
                }
                className="fit-print-trigger"
                onClick={() =>
                  comparisonOpen
                    ? comparisonActions.current?.print()
                    : multiOpen
                      ? multiActions.current?.print()
                      : collisionOpen
                        ? collisionActions.current?.print()
                        : setPrintPreview(true)
                }
              >
                Print
              </button>
              <details ref={exportMenu} className="fit-export-menu">
                <summary onKeyDown={openMenuFromKey}>Export</summary>
                <div
                  className="fit-export-popover"
                  role="menu"
                  onKeyDown={moveMenuFocus}
                >
                  <button
                    role="menuitem"
                    disabled={
                      comparisonOpen
                        ? !comparisonReady
                        : !multiOpen &&
                          !collisionOpen &&
                          (numericDraftInvalid || pendingEquation)
                    }
                    onClick={() => void exportGraph("svg")}
                  >
                    SVG vector graphic
                  </button>
                  <button
                    role="menuitem"
                    disabled={
                      comparisonOpen
                        ? !comparisonReady
                        : !multiOpen &&
                          !collisionOpen &&
                          (numericDraftInvalid || pendingEquation)
                    }
                    onClick={() => void exportGraph("png")}
                  >
                    PNG image
                  </button>
                  <button
                    role="menuitem"
                    disabled={
                      comparisonOpen
                        ? !comparisonReady
                        : !multiOpen &&
                          !collisionOpen &&
                          (numericDraftInvalid || pendingEquation)
                    }
                    onClick={() => void exportGraph("pdf")}
                  >
                    PDF vector graphic
                  </button>
                  <hr />
                  <button
                    role="menuitem"
                    disabled={
                      comparisonOpen
                        ? !comparisonReady
                        : !current ||
                          numericDraftInvalid ||
                          pendingEquation ||
                          collisionOpen ||
                          multiOpen
                    }
                    onClick={() => void exportCodeBundle("scipy")}
                  >
                    Python / SciPy analysis bundle (.zip)
                  </button>
                  <button
                    role="menuitem"
                    disabled={
                      comparisonOpen
                        ? !comparisonReady
                        : !current ||
                          numericDraftInvalid ||
                          pendingEquation ||
                          collisionOpen ||
                          multiOpen
                    }
                    onClick={() => void exportCodeBundle("root")}
                  >
                    C++ / ROOT analysis bundle (.zip)
                  </button>
                  <button
                    role="menuitem"
                    className="fit-export-sizing-action"
                    onClick={() => {
                      exportMenu.current?.removeAttribute("open");
                      setExportSizeOpen(true);
                    }}
                  >
                    Figure size…
                  </button>
                  {exportSizing && (
                    <>
                      <p className="fit-export-size-summary">
                        {exportSizing.widthMm} × {exportSizing.heightMm} mm ·{" "}
                        {exportSizing.fontSizePt} pt labels
                      </p>
                      <button
                        role="menuitem"
                        onClick={() => setExportSizing(null)}
                      >
                        Use display size
                      </button>
                    </>
                  )}
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
              initialWorkspace={
                initialWorkspace?.kind === "collision"
                  ? initialWorkspace
                  : undefined
              }
              open={collisionOpen}
              showResiduals={showResiduals}
              exportSizes={collisionOpen ? exportRender?.sizes : undefined}
              ref={collisionActions}
              analysisControl={analysisTools}
              onReady={setCollisionReady}
              onDirty={() => draftChanged("collision")}
            />
          )}
          {collisionSource && (
            <MultiInterval
              key={`multi-${collisionRevision}`}
              source={collisionSource}
              initialWorkspace={
                initialWorkspace?.kind === "multi-interval"
                  ? initialWorkspace
                  : undefined
              }
              open={multiOpen}
              showGuides={showGuides}
              showResiduals={showResiduals}
              exportSizes={multiOpen ? exportRender?.sizes : undefined}
              ref={multiActions}
              analysisControl={analysisTools}
              onReady={setMultiReady}
              onDirty={() => draftChanged("multi-interval")}
            />
          )}
          {comparisonVisited && (
            <div hidden={!comparisonOpen}>
              <ModelComparison
                key={comparisonRevision}
                initialWorkspace={
                  initialWorkspace?.kind === "model-comparison"
                    ? initialWorkspace
                    : undefined
                }
                source={state}
                sourceResult={current}
                analysisControl={
                  comparisonOpen ? comparisonAnalysisControl : null
                }
                showResiduals={showResiduals}
                showErrorBars={showErrorBars}
                showGuides={showGuides}
                onErrorBarsChange={(show) => {
                  viewChanged();
                  setShowErrorBars(show);
                }}
                onDirty={() => draftChanged("model-comparison")}
                onReady={setComparisonReady}
                ref={comparisonActions}
                exportSizes={comparisonOpen ? exportRender?.sizes : undefined}
              />
            </div>
          )}
          {exportRender && !multiOpen && !collisionOpen && !comparisonOpen && (
            <div className="fit-export-render" aria-hidden="true" inert>
              {exportRender.sizes.map((size, index) => (
                <Plot
                  key={index}
                  state={state}
                  result={current}
                  mode={mode}
                  range={range}
                  residual={index > 0}
                  manual={manualState === state}
                  showBand={showBand}
                  showErrorBars={showErrorBars}
                  showGuides={showGuides}
                  showXAxis={index === exportRender.sizes.length - 1}
                  onToggle={() => {}}
                  fixedYRange={exportRender.yRanges[index]}
                  printSize={size}
                  idPrefix="export-"
                />
              ))}
            </div>
          )}
          {exportSizeOpen && (
            <ExportSizeDialog
              value={exportSizing ?? DEFAULT_EXPORT_SIZING}
              onApply={(sizing) => {
                setExportSizing(sizing);
                setExportSizeOpen(false);
              }}
              onClose={() => setExportSizeOpen(false)}
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
              showGuides={showGuides}
              showResiduals={showResiduals}
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
                { id: "synthetic", label: "Synthetic data", items: examples },
                {
                  id: "published",
                  label: "Published studies",
                  items: publishedExamples,
                },
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
                let incoming: State = replacement
                  ? next
                  : { ...dataPanel.incoming, ...next };
                if (incoming.sessionFile) {
                  try {
                    const { sessionFile, ...analysis } = incoming;
                    const parsed = createSession(
                      analysis,
                      sessionFile.workspace,
                      sessionFile.view,
                    );
                    incoming = { ...analysis, sessionFile: parsed };
                  } catch (cause) {
                    rejectImport(dataPanel.source, cause);
                    return;
                  }
                }
                setDataPanel(null);
                if (dataPanel.editing && !replacement) {
                  const updated = { ...state, ...next };
                  if (unsavedDraftWork) {
                    setPendingDataEdit(true);
                    setPending(updated);
                  } else {
                    change(updated);
                    bounds();
                  }
                } else {
                  setPendingDataEdit(false);
                  dirtyRef.current =
                    dirty ||
                    unsavedDraftWork ||
                    pendingEquation ||
                    sigmaDraft !== null;
                  propose(incoming);
                }
              }}
            />
          )}
          {(pending || closePending) && (
            <UnsavedChangesDialog
              message={
                pendingDataEdit
                  ? comparisonOpen
                    ? "Apply these data to every comparison candidate? Existing fit results will be cleared."
                    : "Apply these data and discard the unsaved interval analyses?"
                  : pending?.sessionFile
                    ? "Open the saved analysis setup and discard unsaved analysis changes?"
                    : pending && comparisonOpen
                      ? "Load the new dataset for every comparison candidate? Candidate equations and settings will be kept; existing fit results will be cleared."
                      : unsavedDraftWork
                        ? "Keep or discard your unsaved workspace changes? Use Save session to preserve the active workspace."
                        : "Keep or discard your unsaved analysis changes?"
              }
              onKeep={() => {
                setPending(null);
                setPendingDataEdit(false);
                setClosePending(false);
              }}
              onApply={() => {
                if (pending && pendingDataEdit) {
                  dirtyWorkspaces.current.delete("multi-interval");
                  dirtyWorkspaces.current.delete("collision");
                  setUnsavedDraftWork(dirtyWorkspaces.current.size > 0);
                  setPendingDataEdit(false);
                  setPending(null);
                  change(pending);
                  bounds();
                } else if (pending) replace(pending);
                else if (isTauri()) {
                  dirtyRef.current = false;
                  void getCurrentWindow().destroy();
                }
              }}
              action={pendingDataEdit ? "Apply data" : "Discard changes"}
            />
          )}
          {error && (
            <div role="alert" className="fit-error">
              <FitErrorMessage message={error} />
            </div>
          )}
          <div
            className="fit-layout"
            style={
              collisionOpen || multiOpen || comparisonOpen
                ? { display: "none" }
                : undefined
            }
          >
            <main className="fit-workspace">
              <section
                ref={chartRef}
                className={`fit-chart${showResiduals ? "" : " is-data-only"}`}
              >
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
                    {pendingEquation
                      ? "Equation edits pending"
                      : busy
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
                          Conditional on the model and selected data. This is
                          not a prediction interval for individual observations
                          or a simultaneous 95% band for the entire curve.
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
                        onChange={(e) => {
                          viewChanged();
                          setShowErrorBars(e.target.checked);
                        }}
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
                  onXRange={setXRange}
                  xCustom={!!xRange}
                  onLogX={(value) => changeLog(value, logY)}
                  onLogY={(value) => changeLog(logX, value)}
                  range={range}
                  residual={false}
                  manual={manualState === state}
                  onToggle={toggle}
                  onSelect={selectRectangle}
                  showBand={showBand}
                  showErrorBars={showErrorBars}
                  showGuides={showGuides}
                  showXAxis={!showResiduals}
                />
                {showResiduals && (
                  <Plot
                    mode={mode}
                    state={state}
                    result={current}
                    range={range}
                    residual
                    onToggle={toggle}
                  />
                )}
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
                      {derived.length > 0 && (
                        <div className="fit-derived">
                          <h3>
                            {state.settings.model.startsWith("gaussian")
                              ? "Derived peak quantities"
                              : "Derived oscillation quantities"}
                          </h3>
                          <table
                            aria-label={
                              state.settings.model.startsWith("gaussian")
                                ? "Derived peak quantities"
                                : "Derived oscillation quantities"
                            }
                          >
                            <thead>
                              <tr>
                                <th>Quantity</th>
                                <th>Value</th>
                                <th>Standard error</th>
                              </tr>
                            </thead>
                            <tbody>
                              {derived.map((quantity) => (
                                <tr key={quantity.id}>
                                  <td>{quantity.label}</td>
                                  <td>
                                    {number(quantity.value)} [{quantity.unit}]
                                  </td>
                                  <td
                                    title={
                                      quantity.standardError.reason
                                        ? statisticReasonText(
                                            quantity.standardError.reason,
                                          )
                                        : undefined
                                    }
                                  >
                                    {quantity.standardError.value === null
                                      ? statisticReasonText(
                                          quantity.standardError.reason,
                                        )
                                      : number(quantity.standardError.value)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <p>
                            {state.settings.model.startsWith("gaussian") ? (
                              "These moments describe the normalized peak, including its extrapolated tails. Standard errors use the full fitted covariance and a local approximation."
                            ) : (
                              <>
                                A and φ summarize s and c. Phase uses the
                                current X origin; separate sine/cosine
                                components would also be origin-dependent.
                                Standard errors use the full fitted covariance
                                and a local propagation.
                              </>
                            )}
                          </p>
                        </div>
                      )}
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
                            ? `Q unavailable: ${statisticReasonText(current.q.reason)}.`
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
                        Original data preserved · inspect before edits
                      </summary>
                      <p>
                        {state.originalRequest.dataset.label} ·{" "}
                        {state.originalRequest.source.application}
                      </p>
                      <table>
                        <thead>
                          <tr>
                            <th>
                              {state.originalRequest.dataset.rows.some(
                                (row) => row.label !== undefined,
                              )
                                ? "Original label"
                                : "Original row"}
                            </th>
                            <th>
                              {state.originalRequest.dataset.xColumn.label}
                            </th>
                            <th>
                              {state.originalRequest.dataset.yColumn.label}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {state.originalRequest.dataset.rows.map(
                            (row, index) => (
                              <tr key={row.id}>
                                <td>{row.label ?? index + 1}</td>
                                <td>
                                  {row.x === null ? "Missing" : String(row.x)}
                                </td>
                                <td>
                                  {row.y === null ? "Missing" : String(row.y)}
                                </td>
                              </tr>
                            ),
                          )}
                        </tbody>
                      </table>
                    </details>
                  )}
                  <table>
                    <thead>
                      <tr>
                        <th>Use</th>
                        <th>{hasRowLabels ? "Label" : "Row"}</th>
                        <th>{state.request.dataset.xColumn.label}</th>
                        <th>{state.request.dataset.yColumn.label}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.request.dataset.rows.map((r, index) => (
                        <tr key={r.id}>
                          <td>
                            <input
                              type="checkbox"
                              aria-label={`Include row ${index + 1}`}
                              disabled={!r.included}
                              checked={
                                r.included &&
                                !state.settings.excludedIds.includes(r.id)
                              }
                              onChange={() => toggle(r.id)}
                            />
                          </td>
                          <td>{r.label ?? index + 1}</td>
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
                {!collisionOpen &&
                  !multiOpen &&
                  !comparisonOpen &&
                  analysisControl(uncertaintyAssignment, false)}
                {state.settings.model !== "custom" && (
                  <button
                    className="edit-custom-equation"
                    disabled={
                      state.settings.parameters.length > 8 ||
                      state.settings.model === "gaussian-shape"
                    }
                    title={
                      state.settings.model === "gaussian-shape"
                        ? "This shape uses a mode calculation; export its SciPy/ROOT program to edit it."
                        : state.settings.parameters.length > 8
                          ? "Custom equations support at most eight parameters."
                          : undefined
                    }
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
                    {current
                      ? "Values below are fitted parameters. Editing them starts a new fit."
                      : "Values below are starting estimates. Edit them or fix known parameters before fitting."}{" "}
                    Widths and time constants must be positive. Nonlinear fits
                    find a local solution; compare different starts. Intervals
                    and bands are approximate.
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
                          [{state.request.dataset.xColumn.unit ?? "unspecified"}
                          ]
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
                      Fits T within this range; Fix T uses its table value.
                      Errors and bands are local approximations. Competing
                      periods may remain outside the range.
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
                {modelNotationNote(state.settings.model) && (
                  <p className="fit-help">
                    {modelNotationNote(state.settings.model)}
                  </p>
                )}
                {state.settings.model === "sine" && (
                  <label>
                    Supplied period T [
                    {state.request.dataset.xColumn.unit ?? "unspecified"}]
                    <EditableNumber
                      aria-label="Sine period"
                      aria-describedby={
                        numericDraftInvalid ? "numeric-draft-help" : undefined
                      }
                      isValid={(value) => value > 0}
                      value={state.settings.sinePeriod ?? 2 * Math.PI}
                      onInvalidChange={numericDraftChanged}
                      onRestoreInvalid={() => {
                        setError(
                          "The period must be greater than zero. The last valid value was restored.",
                        );
                      }}
                      onChange={(value) => {
                        change({
                          ...state,
                          settings: { ...state.settings, sinePeriod: value },
                        });
                      }}
                    />
                    <span className="fit-help">
                      Period is held fixed. s and c fit amplitude and phase;
                      their uncertainty is conditional on this period.
                    </span>
                  </label>
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
                <PeakShapeControls
                  settings={{
                    ...state.settings,
                    parameters: state.settings.parameters.map((p, i) => ({
                      ...p,
                      value: current?.coefficients[i] ?? p.value,
                    })),
                  }}
                  onChange={(settings) => change({ ...state, settings })}
                />
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
                        {modelParameterUnit(
                          state.settings,
                          i,
                          state.request.dataset.xColumn.unit,
                          state.request.dataset.yColumn.unit,
                        )}
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
                    <EditableNumber
                      key={`${state.settings.model}-${name}`}
                      id={`parameter-${name}`}
                      aria-label={`${name} value`}
                      aria-describedby={
                        numericDraftInvalid ? "numeric-draft-help" : undefined
                      }
                      title={
                        current ? String(current.coefficients[i]) : undefined
                      }
                      value={
                        current
                          ? Number(current.coefficients[i].toPrecision(7))
                          : state.settings.parameters[i].value
                      }
                      onInvalidChange={numericDraftChanged}
                      onRestoreInvalid={() => {
                        setError(
                          "Enter a finite parameter value. The last valid value was restored.",
                        );
                      }}
                      onChange={(value) => {
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
                          current.standardErrors[i].reason
                            ? statisticReasonText(
                                current.standardErrors[i].reason,
                              )
                            : "Parameter standard error"
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
                            parameters: state.settings.parameters.map(
                              (p, j) => ({
                                ...p,
                                value: current?.coefficients[j] ?? p.value,
                                fixed: j === i ? e.target.checked : p.fixed,
                              }),
                            ),
                          },
                        })
                      }
                    />
                  </div>
                ))}
                {numericDraftInvalid && (
                  <p id="numeric-draft-help" className="fit-help">
                    Finish entering a valid number, or press Escape to restore
                    the last valid value. Scientific notation such as 1e-3 is
                    accepted.
                  </p>
                )}
                <div className="fit-run-actions">
                  <button
                    className="fit-primary"
                    onClick={run}
                    disabled={
                      busy ||
                      sigmaInvalid ||
                      numericDraftInvalid ||
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
                <div className="fit-history">
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
                    {included} / {state.request.dataset.rows.length}{" "}
                    observations · {state.request.dataset.yColumn.label} vs{" "}
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
                <details>
                  <summary>Technical identifiers</summary>
                  <p>Snapshot ID: {state.request.snapshotId}</p>
                </details>
              </section>
            </aside>
          </div>
        </div>
      </PlotAppearanceContext.Provider>
    </InterfaceScaleContext.Provider>
  );
}
