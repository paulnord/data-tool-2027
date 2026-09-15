import { FitGuideLegend, layoutGuideLabels } from "./FitGuideLegend";
import { formatNumber } from "./formatNumber";
import { modelGuideValues } from "../core/fit/modelGuides";
import { AxisControls, YAxisControls, useYRange } from "./YAxisControls";
import { useId, useRef, useState } from "react";
import type { FitRequest } from "../core/fit/schema";
import type {
  IntervalDefinition,
  IntervalFit,
  IntervalRange,
} from "../core/fit/intervals";
import { plotScale, plotPath, linearDomain } from "./plotScale";
import { extensionDash, sampleFittedCurve } from "./fitCurve";
import type { ExportPlotSize } from "./exportSizing";
import { YAxisTitle } from "./YAxisTitle";
import {
  appearanceColors,
  appearanceStyle,
  PlotMarker,
  usePlotAppearance,
} from "./PlotAppearance";
export function IntervalPlot({
  request,
  intervals,
  results,
  active,
  domain,
  dataDomain = domain,
  residual = false,
  showGuides = false,
  height: requestedHeight,
  colors: requestedColors,
  onRange,
  onBoundary,
  onXRange,
  xCustom = false,
  renderSize,
  forcedYRange,
  yRange,
  onYRange,
}: {
  request: FitRequest;
  intervals: IntervalDefinition[];
  results: (IntervalFit | null)[];
  active: number;
  domain: IntervalRange;
  dataDomain?: IntervalRange;
  residual?: boolean;
  showGuides?: boolean;
  height?: number;
  colors?: string[];
  onRange?: (range: IntervalRange) => void;
  onBoundary?: (interval: number, end: number, value: number) => void;
  onXRange?: (range: IntervalRange | null) => void;
  xCustom?: boolean;
  renderSize?: ExportPlotSize;
  forcedYRange?: IntervalRange;
  yRange?: IntervalRange | null;
  onYRange?: (range: IntervalRange | null) => void;
}) {
  const appearance = usePlotAppearance();
  const colors = requestedColors ?? appearanceColors(appearance);
  const fontSize = renderSize?.fontSizePx ?? 11;
  const width = renderSize?.width ?? 600,
    height = renderSize?.height ?? requestedHeight ?? (residual ? 170 : 290),
    left = renderSize
      ? (renderSize.leftMarginPx ?? Math.max(58, fontSize * 5.2))
      : 72,
    right = renderSize ? Math.max(12, fontSize) : 16,
    baseTop = renderSize ? Math.max(10, fontSize * 0.9) : 18,
    bottom = renderSize ? fontSize * 3.2 : 42;
  const xTicks = renderSize
    ? Math.max(
        2,
        Math.min(5, Math.floor((width - left - right) / (fontSize * 5))),
      )
    : 5;
  const id = useId(),
    drag = useRef<{ start: number; interval?: number; end?: number } | null>(
      null,
    );
  const [selection, setSelection] = useState<IntervalRange | null>(null);
  const points = residual
    ? results.flatMap(
        (r, i) =>
          r?.result?.residuals.map((p) => ({
            x: p.x,
            y: p.residual,
            interval: i,
          })) ?? [],
      )
    : request.dataset.rows.flatMap((r) =>
        r.x === null || r.y === null
          ? []
          : [
              {
                x: r.x,
                y: r.y,
                interval: intervals.findIndex(
                  (s) => s.range && r.x! >= s.range[0] && r.x! <= s.range[1],
                ),
              },
            ],
      );
  const sx = plotScale(domain, false),
    x = (v: number) => left + sx.fraction(v) * (width - left - right);
  const curves = results.map((r) =>
    residual || !r?.result
      ? null
      : sampleFittedCurve(r.settings, r.result, domain),
  );
  const guideCurves = curves.flatMap((curve, i) => {
    const fit = results[i];
    if (!showGuides || !curve?.fitted.length || !fit?.result) return [];
    return modelGuideValues(
      curve.fitted[0].x,
      fit.settings,
      fit.result.coefficients,
    )
      .filter((guide) => guide.id !== "baseline" || curve.baseline === null)
      .map((guide) => ({
        ...guide,
        interval: i,
        points:
          guide.axis === "x"
            ? []
            : curve.fitted.map((point) => ({
                x: point.x,
                y: modelGuideValues(
                  point.x,
                  fit.settings,
                  fit.result!.coefficients,
                ).find((value) => value.id === guide.id)!.value,
              })),
      }));
  });
  const guideLabels = layoutGuideLabels(
    results.flatMap((fit, i) =>
      !residual && showGuides && fit?.result
        ? modelGuideValues(0, fit.settings, fit.result.coefficients)
            .filter((guide) => guide.symbol && Number.isFinite(guide.value))
            .map((guide) => ({
              id: guide.id,
              text: `${intervals.length > 1 ? `${i + 1}: ` : ""}${guide.symbol} = ${formatNumber(guide.value)}`,
              description: `${intervals[i]?.name || `Interval ${i + 1}`}: ${guide.label}: ${formatNumber(guide.value)} ${guide.axis === "x" ? (request.dataset.xColumn.unit ?? "") : (request.dataset.yColumn.unit ?? "")}`,
              color: colors[i],
              intervalIndex: i,
            }))
        : [],
    ),
    width - left - right,
    fontSize,
  );
  const top = baseTop + guideLabels.height;
  const yTicks = renderSize
    ? Math.max(
        residual ? 3 : 2,
        Math.min(
          6,
          Math.floor(Math.max(1, height - top - bottom) / (fontSize * 2.3)),
        ),
      )
    : 6;
  const sigma =
    !residual && request.uncertainty.kind === "supplied-common"
      ? request.uncertainty.sigmaY
      : 0;
  const values = [
    ...points.flatMap((p) => [p.y - sigma, p.y + sigma]),
    ...curves.flatMap((curve) =>
      curve
        ? [
            ...curve.fitted.map((p) => p.y).filter(Number.isFinite),
            ...(showGuides && curve.baseline !== null ? [curve.baseline] : []),
          ]
        : [],
    ),
    ...guideCurves.flatMap((guide) =>
      guide.points.map((point) => point.y).filter(Number.isFinite),
    ),
    ...(residual ? [0] : []),
  ];
  const automaticY = linearDomain(values);
  const [localY, setLocalY] = useYRange(
    `${request.dataset.yColumn.label}/${request.dataset.yColumn.unit}`,
  );
  const customY = onYRange ? yRange : localY;
  const setCustomY = onYRange ?? setLocalY;
  const yDomain = forcedYRange ?? customY ?? automaticY;
  const sy = plotScale(yDomain, false),
    y = (v: number) =>
      top + (1 - sy.fraction(v)) * Math.max(1, height - top - bottom);
  const at = (element: SVGSVGElement, clientX: number) => {
    const box = element.getBoundingClientRect(),
      scale = Math.min(box.width / width, box.height / height);
    return Math.max(
      dataDomain[0],
      Math.min(
        dataDomain[1],
        sx.value(
          ((clientX - box.left - (box.width - width * scale) / 2) / scale -
            left) /
            (width - left - right),
        ),
      ),
    );
  };
  return (
    <>
      {!residual && onRange && (
        <div className="fit-axis-controls">
          {onXRange && (
            <AxisControls
              axis="X"
              label={request.dataset.yColumn.label}
              domain={domain}
              custom={xCustom}
              onChange={onXRange}
            />
          )}
          <YAxisControls
            label={request.dataset.yColumn.label}
            domain={yDomain}
            custom={!!customY}
            onChange={setCustomY}
          />
        </div>
      )}
      <svg
        style={{
          ...appearanceStyle(appearance),
          ...(renderSize && {
            width,
            height,
            "--export-font-size": `${fontSize}px`,
          }),
        }}
        data-guide-minimum-height={
          guideLabels.height ? top + bottom + fontSize * 2.5 : undefined
        }
        data-guide-minimum-width={
          guideLabels.height
            ? left + right + guideLabels.minimumWidth
            : undefined
        }
        data-x-min={domain[0]}
        data-x-max={domain[1]}
        data-x-scale="linear"
        data-y-min={yDomain[0]}
        data-y-max={yDomain[1]}
        data-y-scale="linear"
        role="img"
        aria-label={`${request.dataset.yColumn.label} ${residual ? "residuals" : "interval plot"}`}
        className="interval-plot"
        viewBox={`0 0 ${width} ${height}`}
        onPointerDown={(e) => {
          if (!onRange || e.button !== 0 || drag.current) return;
          const start = at(e.currentTarget, e.clientX);
          drag.current = { start };
          setSelection([start, start]);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const value = at(e.currentTarget, e.clientX);
          if (d.interval !== undefined) onBoundary?.(d.interval, d.end!, value);
          else
            setSelection([Math.min(d.start, value), Math.max(d.start, value)]);
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          if (d && d.interval === undefined) {
            const value = at(e.currentTarget, e.clientX);
            if (Math.abs(value - d.start) > (domain[1] - domain[0]) * 0.002)
              onRange?.([Math.min(d.start, value), Math.max(d.start, value)]);
          }
          drag.current = null;
          setSelection(null);
          if (e.currentTarget.hasPointerCapture(e.pointerId))
            e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={() => {
          drag.current = null;
          setSelection(null);
        }}
        onLostPointerCapture={() => {
          drag.current = null;
          setSelection(null);
        }}
      >
        {!residual && (
          <desc>
            Fitted curves retain each interval's line pattern. Fainter dashed
            extensions show the model just beyond the first and last fitted
            observations. Optional guides mark model reference values such as
            centers, mean positions, asymptotes, and damped amplitude envelopes.
            Guide labels are keyed by interval above the plotting frame.
          </desc>
        )}
        <defs>
          <clipPath id={id}>
            <rect
              x={left}
              y={top}
              width={width - left - right}
              height={Math.max(1, height - top - bottom)}
            />
          </clipPath>
        </defs>
        <FitGuideLegend
          layout={guideLabels}
          left={left}
          top={baseTop}
          fontSize={fontSize}
        />
        <rect
          className="fit-plot-frame"
          data-plot-frame="true"
          style={renderSize ? { strokeWidth: 0.75 } : undefined}
          x={left}
          y={top}
          width={width - left - right}
          height={Math.max(1, height - top - bottom)}
          fill="#fff"
          stroke="#a7becf"
        />
        {sx.ticks(xTicks).map((v) => (
          <g key={v}>
            <line
              x1={x(v)}
              x2={x(v)}
              y1={top}
              y2={height - bottom}
              stroke="#e5edf3"
            />
            <text
              x={x(v)}
              y={height - bottom + (renderSize ? fontSize * 1.4 : 17)}
              textAnchor="middle"
            >
              {sx.label(v, xTicks)}
            </text>
          </g>
        ))}
        {sy.ticks(yTicks).map((v) => (
          <g key={v}>
            <line
              x1={left}
              x2={width - right}
              y1={y(v)}
              y2={y(v)}
              stroke="#e5edf3"
            />
            <text
              data-axis-tick="y"
              x={left - 7}
              y={y(v) + (renderSize ? fontSize * 0.35 : 4)}
              textAnchor="end"
            >
              {sy.label(v, yTicks)}
            </text>
          </g>
        ))}
        <g clipPath={`url(#${id})`}>
          {intervals.map(
            (s, i) =>
              s.range && (
                <rect
                  key={i}
                  x={x(s.range[0])}
                  y={top}
                  width={Math.max(0, x(s.range[1]) - x(s.range[0]))}
                  height={Math.max(1, height - top - bottom)}
                  fill={colors[i]}
                  opacity={i === active ? 0.12 : 0.06}
                />
              ),
          )}
          {residual && (
            <line
              x1={left}
              x2={width - right}
              y1={y(0)}
              y2={y(0)}
              stroke="#667"
              strokeDasharray="4 3"
            />
          )}
          {curves.map((curve, i) => {
            if (
              !showGuides ||
              !curve ||
              curve.baseline === null ||
              curve.baseline < yDomain[0] ||
              curve.baseline > yDomain[1]
            )
              return null;
            const sampled = [...curve.before, ...curve.fitted, ...curve.after];
            if (!sampled.length) return null;
            const from = sampled[0].x;
            const to = sampled[sampled.length - 1].x;
            const baseline = curve.baseline;
            const name = intervals[i]?.name || `Interval ${i + 1}`;
            return (
              <g key={i}>
                <line
                  className="model-guide model-guide-baseline"
                  aria-label={`${name}: fitted baseline y = b`}
                  data-mean-position={baseline}
                  data-interval-index={i}
                  x1={x(from)}
                  x2={x(to)}
                  y1={y(baseline)}
                  y2={y(baseline)}
                  stroke={colors[i]}
                  strokeWidth={renderSize ? 0.6 : 1}
                  strokeDasharray={renderSize ? "1 2.5" : "2 4"}
                  opacity={0.8}
                >
                  <title>{`${name}: mean position b = ${baseline}`}</title>
                </line>
              </g>
            );
          })}
          {guideCurves.map((guide) =>
            guide.axis === "x" ? (
              Number.isFinite(guide.value) &&
              guide.value >= domain[0] &&
              guide.value <= domain[1] ? (
                <line
                  key={`${guide.interval}-${guide.id}`}
                  className={`model-guide model-guide-${guide.id}`}
                  data-interval-index={guide.interval}
                  data-guide-axis="x"
                  data-guide-value={guide.value}
                  aria-label={`${intervals[guide.interval]?.name}: ${guide.label}`}
                  x1={x(guide.value)}
                  x2={x(guide.value)}
                  y1={top}
                  y2={height - bottom}
                  stroke={colors[guide.interval]}
                  strokeWidth={renderSize ? 0.65 : 1}
                  strokeDasharray="5 4"
                  opacity={0.65}
                  style={{ pointerEvents: "none" }}
                />
              ) : null
            ) : (
              <path
                key={`${guide.interval}-${guide.id}`}
                className={`model-guide model-guide-${guide.id}`}
                data-interval-index={guide.interval}
                aria-label={`${intervals[guide.interval]?.name}: ${guide.label}`}
                d={plotPath(guide.points, x, y)}
                fill="none"
                stroke={colors[guide.interval]}
                strokeWidth={renderSize ? 0.65 : 1}
                strokeDasharray="5 4"
                opacity={0.65}
                style={{ pointerEvents: "none" }}
              />
            ),
          )}
          {points.map((p, i) => (
            <g
              key={i}
              fill={colors[p.interval] ?? "var(--plot-outside-color, #9baab6)"}
              color={colors[p.interval] ?? "var(--plot-outside-color, #9baab6)"}
            >
              {sigma > 0 && (
                <line
                  x1={x(p.x)}
                  x2={x(p.x)}
                  y1={y(p.y - sigma)}
                  y2={y(p.y + sigma)}
                  stroke="currentColor"
                  opacity=".4"
                />
              )}
              <PlotMarker x={x(p.x)} y={y(p.y)} r={renderSize ? 1.5 : 2.7} />
            </g>
          ))}
          {curves.map((curve, i) =>
            curve ? (
              <g key={i}>
                {curve.fitted.length > 0 && (
                  <path
                    data-fit-part="fitted"
                    data-interval-index={i}
                    d={plotPath(curve.fitted, x, y)}
                    fill="none"
                    stroke={colors[i]}
                    strokeWidth={renderSize ? 1 : 2}
                    strokeDasharray={
                      [undefined, "7 3", "3 3", "10 3 2 3", "2 3"][i]
                    }
                  />
                )}
                {[curve.before, curve.after].map((part, side) =>
                  part.length > 1 ? (
                    <path
                      key={side}
                      data-fit-part="extrapolation"
                      data-interval-index={i}
                      d={plotPath(part, x, y)}
                      fill="none"
                      stroke={colors[i]}
                      strokeWidth={renderSize ? 0.75 : 1.5}
                      strokeDasharray={extensionDash(i)}
                      opacity={0.65}
                    >
                      <title>{`${intervals[i]?.name || `Interval ${i + 1}`}: model extension beyond fitted observations`}</title>
                    </path>
                  ) : null,
                )}
              </g>
            ) : null,
          )}
          {selection && (
            <rect
              x={x(selection[0])}
              y={top}
              width={x(selection[1]) - x(selection[0])}
              height={Math.max(1, height - top - bottom)}
              fill={colors[active]}
              opacity=".25"
            />
          )}
        </g>
        {!residual &&
          onBoundary &&
          intervals.flatMap(
            (s, i) =>
              s.range?.map(
                (v, end) =>
                  v >= domain[0] &&
                  v <= domain[1] && (
                    <g className="interval-handle" key={`${i}-${end}`}>
                      <line
                        x1={x(v)}
                        x2={x(v)}
                        y1={top}
                        y2={height - bottom}
                        stroke={colors[i]}
                        strokeWidth={renderSize ? 0.75 : i === active ? 2 : 1}
                      />
                      <rect
                        role="slider"
                        tabIndex={0}
                        aria-label={`${request.dataset.yColumn.label}: ${s.name} ${end === 0 ? "from" : "to"}`}
                        aria-valuenow={v}
                        aria-valuemin={dataDomain[0]}
                        aria-valuemax={dataDomain[1]}
                        x={x(v) - 7}
                        y={top}
                        width={14}
                        height={Math.max(1, height - top - bottom)}
                        fill="transparent"
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          const svg = e.currentTarget.ownerSVGElement!;
                          drag.current = { start: v, interval: i, end };
                          svg.setPointerCapture(e.pointerId);
                        }}
                        onKeyDown={(e) => {
                          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight")
                            return;
                          e.preventDefault();
                          onBoundary(
                            i,
                            end,
                            v +
                              ((e.key === "ArrowLeft" ? -1 : 1) *
                                (domain[1] - domain[0])) /
                                100,
                          );
                        }}
                      />
                    </g>
                  ),
              ) ?? [],
          )}
        <text
          data-axis-label="x"
          x={(left + width - right) / 2}
          y={height - (renderSize ? fontSize * 0.4 : 5)}
          textAnchor="middle"
        >
          {request.dataset.xColumn.label} [{request.dataset.xColumn.unit ?? "?"}
          ]
        </text>
        <YAxisTitle
          label={residual ? "Residual" : request.dataset.yColumn.label}
          unit={request.dataset.yColumn.unit ?? "?"}
          x={renderSize ? fontSize * 1.2 : 14}
          y={renderSize && residual ? height / 2 : (top + height - bottom) / 2}
          splitUnit={!!renderSize && residual}
          fontSize={fontSize}
        />
        {!points.length && (
          <text x={width / 2} y={height / 2} textAnchor="middle">
            {residual
              ? "Fit an interval to inspect residuals"
              : "Open data and choose columns"}
          </text>
        )}
      </svg>
    </>
  );
}
