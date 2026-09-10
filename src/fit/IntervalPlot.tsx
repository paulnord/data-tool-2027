import { useId, useRef, useState } from "react";
import type { FitRequest } from "../core/fit/schema";
import type {
  IntervalDefinition,
  IntervalFit,
  IntervalRange,
} from "../core/fit/intervals";
import { predict } from "../core/fit/solve";
import { plotScale, tickLabel, plotPath } from "./plotScale";
export const intervalColors = [
  "#2875a4",
  "#b45b20",
  "#7854a0",
  "#187a68",
  "#a03856",
];
export function IntervalPlot({
  request,
  intervals,
  results,
  active,
  domain,
  residual = false,
  colors = intervalColors,
  onRange,
  onBoundary,
}: {
  request: FitRequest;
  intervals: IntervalDefinition[];
  results: (IntervalFit | null)[];
  active: number;
  domain: IntervalRange;
  residual?: boolean;
  colors?: string[];
  onRange?: (range: IntervalRange) => void;
  onBoundary?: (interval: number, end: number, value: number) => void;
}) {
  const width = 600,
    height = residual ? 170 : 290,
    left = 72,
    right = 16,
    top = 18,
    bottom = 42;
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
  const curves = results.map((r, i) => {
    const range = intervals[i]?.range;
    if (residual || !r?.result || !range) return [];
    const settings = r.settings;
    return Array.from({ length: 400 }, (_, j) => {
      const t = range[0] + ((range[1] - range[0]) * j) / 399;
      return {
        x: t,
        y: predict(
          t,
          settings.model,
          r.result!.coefficients,
          settings.sinePeriod,
          settings.shape,
          settings.custom,
        ),
      };
    });
  });
  const sigma =
    !residual && request.uncertainty.kind === "supplied-common"
      ? request.uncertainty.sigmaY
      : 0;
  const values = [
    ...points.flatMap((p) => [p.y - sigma, p.y + sigma]),
    ...curves.flatMap((c) => c.map((p) => p.y).filter(Number.isFinite)),
    ...(residual ? [0] : []),
  ];
  const lo = values.reduce((a, v) => Math.min(a, v), Infinity),
    hi = values.reduce((a, v) => Math.max(a, v), -Infinity);
  const pad = Number.isFinite(lo + hi)
    ? Math.max((hi - lo) * 0.12, Math.abs(lo) * 0.01, 1e-9)
    : 1;
  const sy = plotScale(
      Number.isFinite(lo + hi) ? [lo - pad, hi + pad] : [0, 1],
      false,
    ),
    y = (v: number) => top + (1 - sy.fraction(v)) * (height - top - bottom);
  const at = (element: SVGSVGElement, clientX: number) => {
    const box = element.getBoundingClientRect(),
      scale = Math.min(box.width / width, box.height / height);
    return Math.max(
      domain[0],
      Math.min(
        domain[1],
        sx.value(
          ((clientX - box.left - (box.width - width * scale) / 2) / scale -
            left) /
            (width - left - right),
        ),
      ),
    );
  };
  return (
    <svg
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
        else setSelection([Math.min(d.start, value), Math.max(d.start, value)]);
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
      <defs>
        <clipPath id={id}>
          <rect
            x={left}
            y={top}
            width={width - left - right}
            height={height - top - bottom}
          />
        </clipPath>
      </defs>
      <rect
        x={left}
        y={top}
        width={width - left - right}
        height={height - top - bottom}
        fill="#fff"
        stroke="#a7becf"
      />
      {sx.ticks(5).map((v) => (
        <g key={v}>
          <line
            x1={x(v)}
            x2={x(v)}
            y1={top}
            y2={height - bottom}
            stroke="#e5edf3"
          />
          <text x={x(v)} y={height - bottom + 17} textAnchor="middle">
            {tickLabel(v)}
          </text>
        </g>
      ))}
      {sy.ticks(4).map((v) => (
        <g key={v}>
          <line
            x1={left}
            x2={width - right}
            y1={y(v)}
            y2={y(v)}
            stroke="#e5edf3"
          />
          <text x={left - 7} y={y(v) + 4} textAnchor="end">
            {tickLabel(v)}
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
                height={height - top - bottom}
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
        {points.map((p, i) => (
          <g key={i} fill={colors[p.interval] ?? "#9baab6"}>
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
            <circle cx={x(p.x)} cy={y(p.y)} r={2.7} />
          </g>
        ))}
        {curves.map((c, i) => (
          <path
            key={i}
            d={plotPath(c, x, y)}
            fill="none"
            stroke={colors[i]}
            strokeWidth={2}
            strokeDasharray={[undefined, "7 3", "3 3", "10 3 2 3", "2 3"][i]}
          />
        ))}
        {selection && (
          <rect
            x={x(selection[0])}
            y={top}
            width={x(selection[1]) - x(selection[0])}
            height={height - top - bottom}
            fill={colors[active]}
            opacity=".25"
          />
        )}
      </g>
      {!residual &&
        onBoundary &&
        intervals.flatMap(
          (s, i) =>
            s.range?.map((v, end) => (
              <g className="interval-handle" key={`${i}-${end}`}>
                <line
                  x1={x(v)}
                  x2={x(v)}
                  y1={top}
                  y2={height - bottom}
                  stroke={colors[i]}
                  strokeWidth={i === active ? 2 : 1}
                />
                <rect
                  role="slider"
                  tabIndex={0}
                  aria-label={`${request.dataset.yColumn.label}: ${s.name} ${end === 0 ? "from" : "to"}`}
                  aria-valuenow={v}
                  aria-valuemin={domain[0]}
                  aria-valuemax={domain[1]}
                  x={x(v) - 7}
                  y={top}
                  width={14}
                  height={height - top - bottom}
                  fill="transparent"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    const svg = e.currentTarget.ownerSVGElement!;
                    drag.current = { start: v, interval: i, end };
                    svg.setPointerCapture(e.pointerId);
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
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
            )) ?? [],
        )}
      <text x={(left + width - right) / 2} y={height - 5} textAnchor="middle">
        {request.dataset.xColumn.label} [{request.dataset.xColumn.unit ?? "?"}]
      </text>
      <text
        transform={`translate(14 ${(top + height - bottom) / 2}) rotate(-90)`}
        textAnchor="middle"
      >
        {residual ? "Residual" : request.dataset.yColumn.label} [
        {request.dataset.yColumn.unit ?? "?"}]
      </text>
      {!points.length && (
        <text x={width / 2} y={height / 2} textAnchor="middle">
          {residual
            ? "Fit an interval to inspect residuals"
            : "Open data and choose columns"}
        </text>
      )}
    </svg>
  );
}
