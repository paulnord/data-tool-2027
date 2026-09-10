import { FitErrorMessage } from "./FitErrorMessage";
import Assumptions from "./Assumptions";
import {
  forwardRef,
  useImperativeHandle,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  columnHeading,
  tableForAnalysis,
  type TableAnalysis,
} from "../core/fit/dataTable";
import {
  collisionRequests,
  collisionReport,
  type CollisionConfig,
  type CollisionChannel,
} from "../core/fit/collision";
import type { FitRequest } from "../core/fit/schema";
import { plotScale, tickLabel } from "./plotScale";
import "./collision.css";

const fmt = (v: number | null | undefined) =>
  v == null ? "Unavailable" : Number(v.toPrecision(6)).toString();
const slots = ["Object 1 · x", "Object 1 · y", "Object 2 · x", "Object 2 · y"];
function heading(source: TableAnalysis, i: number) {
  const t = tableForAnalysis(source);
  return columnHeading(
    t.headerRows
      ? t.cells[t.headerRows - 1]?.[i] || `Column ${i + 1}`
      : `Column ${i + 1}`,
    t.units[i],
  );
}
function rangeOf(values: number[]): [number, number] {
  const lo = values.reduce((a, b) => Math.min(a, b), Infinity),
    hi = values.reduce((a, b) => Math.max(a, b), -Infinity);
  return !values.length ? [0, 1] : [lo, hi === lo ? lo + 1 : hi];
}
function initial(source: TableAnalysis) {
  const t = tableForAnalysis(source),
    width = Math.max(0, ...t.cells.map((r) => r.length));
  const time =
    Array.from({ length: width }, (_, i) => i).find((i) =>
      /^(t|time)$/i.test(heading(source, i).label),
    ) ?? t.x;
  const columns = Array.from({ length: width }, (_, i) => i)
    .filter((i) => i !== time)
    .slice(0, 4);
  while (columns.length < 4) columns.push(-1);
  const times = t.cells
    .slice(t.headerRows)
    .flatMap((r) =>
      r[time]?.trim() && Number.isFinite(Number(r[time]))
        ? [Number(r[time])]
        : [],
    );
  const [lo, hi] = rangeOf(times),
    span = hi - lo;
  return {
    time,
    columns,
    windows: [lo, lo + 0.4 * span, lo + 0.6 * span, hi].map((v) =>
      String(Number(v.toPrecision(8))),
    ),
  };
}

function CollisionPlot({
  request,
  channel,
  config,
  residual = false,
  timeDomain,
  onBoundary,
}: {
  request: FitRequest;
  channel?: CollisionChannel;
  config: CollisionConfig;
  residual?: boolean;
  timeDomain: [number, number];
  onBoundary?: (index: number, value: number) => void;
}) {
  const rows = request.dataset.rows.filter((r) => r.x !== null && r.y !== null);
  const domain = timeDomain;
  const points = residual
    ? (["before", "after"] as const).flatMap(
        (phase) =>
          channel?.[phase].result?.residuals.map((r) => ({
            x: r.x,
            y: r.residual,
            phase,
          })) ?? [],
      )
    : rows.map((r) => ({
        x: r.x!,
        y: r.y!,
        phase:
          r.x! >= config.before[0] && r.x! <= config.before[1]
            ? "before"
            : r.x! >= config.after[0] && r.x! <= config.after[1]
              ? "after"
              : "gap",
      }));
  const sigma =
    !residual && request.uncertainty.kind === "supplied-common"
      ? request.uncertainty.sigmaY
      : 0;
  const values = points.flatMap((p) => [p.y - sigma, p.y + sigma]);
  if (!residual && channel)
    for (const phase of ["before", "after"] as const) {
      const r = channel[phase].result;
      if (r)
        values.push(
          ...channel[phase].interval.map(
            (t) => r.coefficients[0] + r.coefficients[1] * t,
          ),
        );
    }
  if (residual) values.push(0);
  const [lo, hi] = rangeOf(values),
    pad = (hi - lo) * 0.12;
  const sx = plotScale(domain, false),
    sy = plotScale([lo - pad, hi + pad], false);
  const width = 560,
    height = residual ? 145 : 245,
    left = 65,
    right = 18,
    top = 15,
    bottom = 42;
  const x = (v: number) => left + sx.fraction(v) * (width - left - right),
    y = (v: number) => top + (1 - sy.fraction(v)) * (height - top - bottom);
  const clipId = useId();
  const dragging = useRef<number | null>(null);
  const boundaryValues = [...config.before, ...config.after];
  const boundaryNames = ["Before from", "Before to", "After from", "After to"];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${request.dataset.yColumn.label} ${residual ? "residuals" : "versus time"}`}
      className="collision-plot"
      onPointerMove={(e) => {
        if (dragging.current === null || !onBoundary) return;
        const bounds = e.currentTarget.getBoundingClientRect();
        const scale = Math.min(bounds.width / width, bounds.height / height);
        const px =
          (e.clientX - bounds.left - (bounds.width - width * scale) / 2) /
          scale;
        onBoundary(
          dragging.current,
          sx.value((px - left) / (width - left - right)),
        );
      }}
      onPointerUp={(e) => {
        dragging.current = null;
        if (e.currentTarget.hasPointerCapture(e.pointerId))
          e.currentTarget.releasePointerCapture(e.pointerId);
      }}
      onPointerCancel={() => {
        dragging.current = null;
      }}
      onLostPointerCapture={() => {
        dragging.current = null;
      }}
    >
      <defs>
        <clipPath id={clipId}>
          <rect
            x={left}
            y={top}
            width={width - left - right}
            height={height - top - bottom}
          />
        </clipPath>
      </defs>
      {sy.ticks(4).map((v) => (
        <g key={v}>
          <line
            x1={left}
            x2={width - right}
            y1={y(v)}
            y2={y(v)}
            stroke="#dce5ed"
          />
          <text x={left - 6} y={y(v) + 4} textAnchor="end">
            {tickLabel(v)}
          </text>
        </g>
      ))}
      {sx.ticks(5).map((v) => (
        <text key={v} x={x(v)} y={height - 25} textAnchor="middle">
          {tickLabel(v)}
        </text>
      ))}
      <g clipPath={`url(#${clipId})`}>
        {(["before", "after"] as const).map((phase) => (
          <rect
            key={phase}
            className={`interval ${phase}`}
            x={x(config[phase][0])}
            y={top}
            width={x(config[phase][1]) - x(config[phase][0])}
            height={height - top - bottom}
          />
        ))}
        {residual && (
          <line
            x1={left}
            x2={width - right}
            y1={y(0)}
            y2={y(0)}
            stroke="#6d7780"
            strokeDasharray="3 3"
          />
        )}
        {points.map((p, i) => (
          <g key={i} className={p.phase}>
            {sigma > 0 && (
              <line
                className="error-bar"
                x1={x(p.x)}
                x2={x(p.x)}
                y1={y(p.y - sigma)}
                y2={y(p.y + sigma)}
              />
            )}
            <circle cx={x(p.x)} cy={y(p.y)} r={2.8}>
              <title>{`${p.x}, ${p.y}`}</title>
            </circle>
          </g>
        ))}
        {!residual &&
          (["before", "after"] as const).map((phase) => {
            const segment = channel?.[phase],
              r = segment?.result;
            return r && segment ? (
              <line
                key={phase}
                className={`model ${phase}`}
                x1={x(segment.interval[0])}
                x2={x(segment.interval[1])}
                y1={y(
                  r.coefficients[0] + r.coefficients[1] * segment.interval[0],
                )}
                y2={y(
                  r.coefficients[0] + r.coefficients[1] * segment.interval[1],
                )}
              />
            ) : null;
          })}
      </g>
      {!residual &&
        onBoundary &&
        boundaryValues.map((value, index) => (
          <g key={index} className="collision-boundary">
            <line
              x1={x(value)}
              x2={x(value)}
              y1={top}
              y2={height - bottom}
              stroke={index < 2 ? "#2875a4" : "#b45b20"}
              strokeDasharray="3 3"
            />
            <rect
              x={x(value) - 7}
              y={top}
              width={14}
              height={height - top - bottom}
              fill="transparent"
              role="slider"
              tabIndex={0}
              aria-label={`${request.dataset.yColumn.label}: ${boundaryNames[index]}`}
              aria-valuemin={domain[0]}
              aria-valuemax={domain[1]}
              aria-valuenow={value}
              onPointerDown={(e) => {
                e.preventDefault();
                dragging.current = index;
                e.currentTarget.ownerSVGElement!.setPointerCapture(e.pointerId);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                  e.preventDefault();
                  onBoundary(
                    index,
                    value +
                      ((e.key === "ArrowLeft" ? -1 : 1) *
                        (domain[1] - domain[0])) /
                        100,
                  );
                }
              }}
            />
          </g>
        ))}
      <rect
        x={left}
        y={top}
        width={width - left - right}
        height={height - top - bottom}
        fill="none"
        stroke="#8295a5"
      />
      <text x={(left + width - right) / 2} y={height - 6} textAnchor="middle">
        {request.dataset.xColumn.label} [
        {request.dataset.xColumn.unit ?? "units unspecified"}]
      </text>
      <text
        transform={`translate(13 ${(height - bottom + top) / 2}) rotate(-90)`}
        textAnchor="middle"
      >
        {residual ? "Residual" : request.dataset.yColumn.label} [
        {request.dataset.yColumn.unit ?? "units unspecified"}]
      </text>
    </svg>
  );
}

export type CollisionActions = {
  copy: () => Promise<void>;
  print: () => Promise<void>;
};

export default forwardRef<
  CollisionActions,
  {
    source: TableAnalysis;
    open: boolean;
    analysisControl: ReactNode;
    onReady: (ready: boolean) => void;
  }
>(function CollisionDraft({ source, open, analysisControl, onReady }, ref) {
  const defaults = useMemo(() => initial(source), [source]);
  const [time, setTime] = useState(defaults.time),
    [columns, setColumns] = useState(defaults.columns);
  const [windows, setWindows] = useState(defaults.windows),
    [sigmas, setSigmas] = useState(["", "", "", ""]);
  const [conditional, setConditional] = useState(false),
    [channels, setChannels] = useState<CollisionChannel[] | null>(null);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [details, setDetails] = useState(false);
  const worker = useRef<Worker | null>(null);
  const [noise, setNoise] = useState<"estimate" | "supplied">("estimate");
  const [includeDetails, setIncludeDetails] = useState(false);
  const table = tableForAnalysis(source),
    width = Math.max(0, ...table.cells.map((r) => r.length));
  const options = Array.from({ length: width }, (_, i) => ({
    i,
    ...heading(source, i),
  }));
  const config: CollisionConfig = {
    time,
    columns,
    sigmas: sigmas.map((s) =>
      noise === "estimate" ? null : s.trim() === "" ? NaN : Number(s),
    ),
    before: windows
      .slice(0, 2)
      .map((s) => (s.trim() === "" ? NaN : Number(s))) as [number, number],
    after: windows
      .slice(2, 4)
      .map((s) => (s.trim() === "" ? NaN : Number(s))) as [number, number],
    conditional,
  };
  const preview = useMemo(() => {
    try {
      return { requests: collisionRequests(source, config), error: "" };
    } catch (e) {
      let requests: FitRequest[] = [];
      try {
        requests = collisionRequests(source, {
          ...config,
          sigmas: [null, null, null, null],
        });
      } catch {
        /* Invalid columns or intervals have no preview. */
      }
      return { requests, error: e instanceof Error ? e.message : String(e) };
    }
  }, [source, time, columns, windows, sigmas, conditional, noise]);
  useEffect(() => () => worker.current?.terminate(), []);
  function invalidate() {
    worker.current?.terminate();
    worker.current = null;
    setBusy(false);
    setChannels(null);
    setError("");
    setNotice("");
  }
  function run() {
    invalidate();
    if (preview.error) {
      setError(preview.error);
      return;
    }
    const w = new Worker(new URL("./collision.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.current = w;
    setBusy(true);
    w.onmessage = (
      e: MessageEvent<{ channels?: CollisionChannel[]; error?: string }>,
    ) => {
      if (worker.current !== w) return;
      setBusy(false);
      setChannels(e.data.channels ?? null);
      setError(e.data.error ?? "");
      w.terminate();
      worker.current = null;
    };
    w.onerror = (e) => {
      setBusy(false);
      setError(e.message || "Fit worker failed");
      w.terminate();
      worker.current = null;
    };
    w.postMessage({ source, config });
  }
  const ready = channels !== null;
  useEffect(() => {
    onReady(ready);
  }, [ready, onReady]);
  useImperativeHandle(ref, () => ({
    copy: async () => {
      if (!channels) return;
      try {
        await navigator.clipboard.writeText(collisionReport(channels));
        setNotice("Report copied");
      } catch {
        setError("Clipboard unavailable. Print the report to PDF instead.");
      }
    },
    print: async () => {
      if (!channels) return;
      try {
        await window.print();
      } catch (e) {
        setError(String(e));
      }
    },
  }));
  const timeDomain = rangeOf(
    preview.requests[0]?.dataset.rows.flatMap((r) =>
      r.x === null ? [] : [r.x],
    ) ?? [],
  );
  function moveBoundary(index: number, value: number) {
    const w = windows.map(Number),
      gap = (timeDomain[1] - timeDomain[0]) * 1e-6;
    const lower = index === 0 ? timeDomain[0] : w[index - 1] + gap;
    const upper = index === 3 ? timeDomain[1] : w[index + 1] - gap;
    if (lower >= upper) return;
    invalidate();
    setWindows(
      windows.map((v, i) =>
        i === index ? String(Math.max(lower, Math.min(upper, value))) : v,
      ),
    );
  }
  return (
    <section
      className={`collision-dialog ${includeDetails ? "print-details" : ""}`}
      hidden={!open}
      aria-label="Collision analysis"
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "p") return;
        e.stopPropagation();
      }}
    >
      <aside className="collision-setup">
        {open && analysisControl}
        <h2>Data assignments</h2>
        <div className="collision-time">
          <label>
            Time column{" "}
            <select
              value={time}
              onChange={(e) => {
                invalidate();
                setTime(Number(e.target.value));
              }}
            >
              {options.map((o) => (
                <option key={o.i} value={o.i}>
                  {o.label}
                  {o.unit ? ` [${o.unit}]` : ""}
                </option>
              ))}
            </select>
          </label>
          <p>
            Choose the intervals on either side of the collision. Drag a dashed
            boundary on any graph to adjust all four, or enter exact times
            below.
          </p>
        </div>
        <label>
          Position uncertainties
          <select
            aria-label="Position uncertainties"
            value={noise}
            onChange={(e) => {
              invalidate();
              setNoise(e.target.value as "estimate" | "supplied");
            }}
          >
            <option value="estimate">Estimate scatter from residuals</option>
            <option value="supplied">Enter position uncertainties</option>
          </select>
        </label>
        <div className="collision-mappings">
          {slots.map((slot, i) => (
            <div key={slot}>
              <label>
                {slot}
                <select
                  aria-label={`${slot} column`}
                  value={columns[i]}
                  onChange={(e) => {
                    invalidate();
                    setColumns(
                      columns.map((c, j) =>
                        j === i ? Number(e.target.value) : c,
                      ),
                    );
                  }}
                >
                  <option value={-1}>Choose column</option>
                  {options.map((o) => (
                    <option key={o.i} value={o.i}>
                      {o.label}
                      {o.unit ? ` [${o.unit}]` : ""}
                    </option>
                  ))}
                </select>
              </label>
              {noise === "supplied" && (
                <label>
                  σ [{heading(source, columns[i]).unit || "position unit"}]
                  <input
                    type="number"
                    step="any"
                    aria-label={`${slot} uncertainty`}
                    value={sigmas[i]}
                    placeholder="Estimate"
                    onChange={(e) => {
                      invalidate();
                      setSigmas(
                        sigmas.map((s, j) => (j === i ? e.target.value : s)),
                      );
                    }}
                  />
                </label>
              )}
            </div>
          ))}
        </div>
        <div className="collision-intervals">
          {["Before", "After"].map((phase, p) => (
            <fieldset key={phase}>
              <legend>
                {phase} collision [{heading(source, time).unit || "time unit"}]
              </legend>
              {["from", "to"].map((label, j) => (
                <label key={label}>
                  {label}
                  <input
                    aria-label={`${phase} ${label}`}
                    type="number"
                    step="any"
                    value={windows[p * 2 + j]}
                    onChange={(e) => {
                      invalidate();
                      setWindows(
                        windows.map((v, k) =>
                          k === p * 2 + j ? e.target.value : v,
                        ),
                      );
                    }}
                  />
                </label>
              ))}
            </fieldset>
          ))}
          <button
            className="collision-fit-button"
            disabled={busy || !!preview.error}
            onClick={run}
          >
            {busy ? "Fitting…" : "Fit before and after"}
          </button>
        </div>
        {open && (
          <Assumptions
            checked={conditional}
            onChange={(checked) => {
              invalidate();
              setConditional(checked);
            }}
          />
        )}
        <p className="collision-help">
          {noise === "estimate"
            ? "Equal scatter is estimated separately for each fit."
            : "Enter a positive common σ for each position column, in that column’s units."}{" "}
          Single-fit exclusions are not inherited.
        </p>
        <label className="collision-print-option">
          <input
            type="checkbox"
            checked={includeDetails}
            onChange={(e) => setIncludeDetails(e.target.checked)}
          />{" "}
          Include fit details when printing
        </label>
        {includeDetails && (
          <p>
            Page 1: summary. Pages 2–5: one component’s fit details per page.
          </p>
        )}
      </aside>
      <div className="collision-workspace">
        <header className="collision-toolbar">
          <h1>Collision · before and after</h1>
          <p>{source.request.dataset.label}</p>
        </header>
        {(error || preview.error) && (
          <div role="alert" className="collision-error">
            <FitErrorMessage message={error || preview.error} />
          </div>
        )}
        <p role="status">
          {notice ||
            (busy
              ? "Fitting…"
              : channels
                ? `${channels.flatMap((c) => [c.before, c.after]).filter((s) => s.result).length} of 8 fits complete`
                : "Choose columns and intervals, then fit.")}
        </p>
        {channels && (
          <section className="collision-summary">
            <h2>Velocity components</h2>
            <p>
              Line slope = velocity component. Values after ± are standard
              errors, not 95% intervals.
            </p>
            <table aria-label="Collision velocity summary">
              <thead>
                <tr>
                  <th>Component</th>
                  <th>Position column</th>
                  <th>Unit</th>
                  <th>Before</th>
                  <th>After</th>
                </tr>
              </thead>
              <tbody>
                {channels.map((c, i) => (
                  <tr key={i}>
                    <th>{slots[i]}</th>
                    <td>{c.request.dataset.yColumn.label}</td>
                    <td>
                      {c.request.dataset.yColumn.unit ?? "position unit"}/
                      {c.request.dataset.xColumn.unit ?? "time unit"}
                    </td>
                    {(["before", "after"] as const).map((phase) => (
                      <td key={phase}>
                        {c[phase].result ? (
                          <>
                            {fmt(c[phase].result!.coefficients[1])}
                            {c[phase].result!.standardErrors[1].value !== null
                              ? ` ± ${fmt(c[phase].result!.standardErrors[1].value)}`
                              : " (SE unavailable)"}
                          </>
                        ) : (
                          "Fit unavailable"
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p>
              Before: {windows[0]}–{windows[1]}; after: {windows[2]}–
              {windows[3]} [{heading(source, time).unit || "time unit"}].
              Endpoints included.{" "}
              {conditional
                ? "Uncertainties are conditional on the stated assumptions; interval selection is not included."
                : "Descriptive fits; uncertainty assumptions have not been accepted."}
            </p>
          </section>
        )}
        <div className="collision-legend">
          <span className="before">● Before collision — solid line</span>
          <span className="after">● After collision — dashed line</span>
          <span>● Outside fit intervals</span>
        </div>
        <section className="collision-charts">
          {preview.requests.map((request, i) => (
            <article key={i}>
              <h2>
                {slots[i]} · {request.dataset.yColumn.label}
              </h2>
              <CollisionPlot
                request={request}
                channel={channels?.[i]}
                config={config}
                timeDomain={timeDomain}
                onBoundary={moveBoundary}
              />
            </article>
          ))}
        </section>
        <footer>
          <p>{source.request.source.context}</p>
          <p>
            Draft: setup is preserved while switching analyses with the same
            source table. Collision settings are not included in .trksess files.
            Copy or print the report to keep the results. Separate fits do not
            estimate covariance between velocity components.
          </p>
        </footer>
        {channels && (
          <>
            <button
              className="collision-details-toggle"
              aria-expanded={details}
              onClick={() => setDetails(!details)}
            >
              {details ? "Hide" : "Show"} residuals and fit details
            </button>
            <section
              className={`collision-details ${details ? "expanded" : ""}`}
            >
              <h2>Residuals and fit details</h2>
              {channels.map((c, i) => (
                <article key={i}>
                  <h3>
                    {slots[i]} · {c.request.dataset.yColumn.label}
                  </h3>
                  <CollisionPlot
                    request={c.request}
                    channel={c}
                    config={config}
                    timeDomain={timeDomain}
                    residual
                  />
                  <table aria-label={`${slots[i]} fit details`}>
                    <thead>
                      <tr>
                        <th>Interval</th>
                        <th>Intercept</th>
                        <th>Intercept SE</th>
                        <th>Slope 95% interval</th>
                        <th>N / df</th>
                        <th>RMS residual</th>
                        <th>Rank</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(["before", "after"] as const).map((phase) => {
                        const s = c[phase],
                          r = s.result;
                        return (
                          <tr key={phase}>
                            <th>{phase}</th>
                            {r ? (
                              <>
                                <td>{fmt(r.coefficients[0])}</td>
                                <td>{fmt(r.standardErrors[0].value)}</td>
                                <td>
                                  {r.intervals[1]?.map(fmt).join(" to ") ??
                                    "Unavailable"}
                                </td>
                                <td>
                                  {r.n} / {r.df}
                                </td>
                                <td>{fmt(r.rms)}</td>
                                <td>{r.rank}/2</td>
                              </>
                            ) : (
                              <td colSpan={6}>
                                <FitErrorMessage
                                  message={s.error ?? "Fit unavailable"}
                                />
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <p>
                    Intercept and RMS unit:{" "}
                    {c.request.dataset.yColumn.unit ?? "unspecified"}.{" "}
                    {c.request.uncertainty.kind === "supplied-common"
                      ? `Supplied σ = ${c.request.uncertainty.sigmaY}.`
                      : "Scatter estimated separately from each interval’s residuals."}
                  </p>
                  {(["before", "after"] as const).map((phase) => (
                    <div key={phase}>
                      {phase}:{" "}
                      {c[phase].error ? (
                        <FitErrorMessage message={c[phase].error!} />
                      ) : (
                        [
                          c[phase].result?.inference,
                          ...(c[phase].result?.warnings ?? []),
                          c[phase].result?.standardErrors[1].reason,
                        ]
                          .filter(Boolean)
                          .join(" ")
                      )}
                    </div>
                  ))}
                </article>
              ))}
            </section>
          </>
        )}
      </div>
    </section>
  );
});
