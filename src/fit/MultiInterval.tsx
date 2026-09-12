import SourceNotes from "./SourceNotes";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
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
  initialSettings,
  parameterNames,
  type FitSettings,
} from "../core/fit/schema";
import { customFromModel } from "../core/fit/customFromModel";
import {
  nonlinearModelIds,
  nonlinearModels,
} from "../core/fit/nonlinearModels";
import {
  checkIntervalRanges,
  maxIntervals,
  intervalRequests,
  intervalReport,
  type IntervalConfig,
  type IntervalDefinition,
  type IntervalFit,
  type IntervalRange,
} from "../core/fit/intervals";
import { fitReportRows } from "../core/fit/report";
import { IntervalPlot } from "./IntervalPlot";
import { automaticDomain } from "./plotScale";
import { useYRange } from "./YAxisControls";
import type { ExportPlotSize } from "./exportSizing";
import { appearanceColors, usePlotAppearance } from "./PlotAppearance";
import { CustomEquationEditor } from "./CustomEquationEditor";
import { FitErrorMessage } from "./FitErrorMessage";
import Assumptions from "./Assumptions";
import "./multiInterval.css";
const fmt = (v: number | null | undefined) =>
  v == null ? "Unavailable" : Number(v.toPrecision(7)).toString();
const unitEntry = {
  autoCapitalize: "none",
  autoCorrect: "off",
  autoComplete: "off",
  spellCheck: false,
} as const;
const models: [FitSettings["model"], string][] = [
  ["line", "Straight line"],
  ["quadratic", "Quadratic"],
  ["cubic", "Cubic"],
  ["quartic", "Quartic"],
  ["sine", "Sine · supplied period"],
  ["sine-free-period", "Sine · fit period"],
  ["exponential", "Exponential · supplied rate"],
  ["power-law", "Power law · supplied exponent"],
  ["logarithmic", "Logarithmic"],
  ["reciprocal", "Reciprocal"],
  ["constant-acceleration", "Constant acceleration"],
  ...nonlinearModelIds.map(
    (m) => [m, nonlinearModels[m].label] as [FitSettings["model"], string],
  ),
  ["custom", "Custom equation…"],
];
function newInterval(index: number, count: number): IntervalDefinition {
  return {
    name: `Interval ${index + 1}`,
    range: null,
    settings: Array.from({ length: count }, () => initialSettings("line")),
  };
}
function parameterUnit(
  settings: FitSettings,
  source: TableAnalysis,
  name: string,
) {
  const custom =
    settings.model === "custom"
      ? settings.custom!
      : customFromModel(settings, source.request).custom!;
  return custom.units[custom.names.indexOf(name)] || "?";
}
export interface MultiIntervalActions {
  copy: () => Promise<void>;
  print: () => Promise<void>;
}
export default forwardRef<
  MultiIntervalActions,
  {
    source: TableAnalysis;
    open: boolean;
    showResiduals?: boolean;
    exportSizes?: ExportPlotSize[];
    analysisControl: ReactNode;
    onReady: (ready: boolean) => void;
  }
>(function MultiInterval(
  { source, open, showResiduals = true, exportSizes, analysisControl, onReady },
  ref,
) {
  const intervalColors = appearanceColors(usePlotAppearance());
  const liveGraphs = useRef<HTMLDivElement>(null);
  const table = useMemo(() => tableForAnalysis(source), [source]);
  const width = table.cells.reduce((n, r) => Math.max(n, r.length), 0);
  const heading = (i: number) =>
    columnHeading(
      table.headerRows
        ? table.cells[table.headerRows - 1]?.[i] || `Column ${i + 1}`
        : `Column ${i + 1}`,
      table.units[i],
    );
  const [xColumn, setXColumn] = useState(table.x),
    [columns, setColumns] = useState([table.y]);
  const [sigmas, setSigmas] = useState([""]),
    [noise, setNoise] = useState("estimate");
  const [intervals, setIntervals] = useState<IntervalDefinition[]>(() => [
    newInterval(0, 1),
    newInterval(1, 1),
  ]);
  const [rangeDrafts, setRangeDrafts] = useState<string[][]>([
    ["", ""],
    ["", ""],
  ]);
  const [results, setResults] = useState<(IntervalFit[] | null)[]>([
    null,
    null,
  ]);
  const [active, setActive] = useState(0),
    [curve, setCurve] = useState(0),
    [conditional, setConditional] = useState(false),
    [includeDetails, setIncludeDetails] = useState(false);
  const [busy, setBusy] = useState<number | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [equationPending, setEquationPending] = useState(false);
  const worker = useRef<Worker | null>(null);
  function cancel() {
    worker.current?.terminate();
    worker.current = null;
    setBusy(null);
  }
  useEffect(() => () => worker.current?.terminate(), []);
  function invalidate(index?: number) {
    cancel();
    setResults((old) =>
      old.map((r, i) => (index === undefined || index === i ? null : r)),
    );
    setError("");
    setNotice("");
  }
  const config: IntervalConfig = {
    x: xColumn,
    columns,
    sigmas: sigmas.map((s) =>
      noise === "estimate" ? null : s.trim() ? Number(s) : NaN,
    ),
    intervals,
    conditional,
  };
  const preview = useMemo(() => {
    try {
      return { requests: intervalRequests(source, config), error: "" };
    } catch (e) {
      // Invalid uncertainties still permit looking at the data and choosing ranges.
      try {
        return {
          requests: intervalRequests(source, {
            ...config,
            sigmas: columns.map(() => null),
          }),
          error: (e as Error).message,
        };
      } catch {
        return { requests: [], error: (e as Error).message };
      }
    }
  }, [source, xColumn, columns, sigmas, noise]);
  let rangeError = "";
  try {
    checkIntervalRanges(intervals);
  } catch (e) {
    rangeError = (e as Error).message;
  }
  const xs = table.cells
    .slice(table.headerRows)
    .flatMap((row) =>
      row[xColumn]?.trim() && Number.isFinite(Number(row[xColumn]))
        ? [Number(row[xColumn])]
        : [],
    );
  const low = xs.reduce((a, v) => Math.min(a, v), Infinity),
    high = xs.reduce((a, v) => Math.max(a, v), -Infinity);
  const dataDomain: IntervalRange =
    Number.isFinite(low) && Number.isFinite(high)
      ? [low, high === low ? low + 1 : high]
      : [0, 1];
  const [customX, setCustomX] = useYRange(
    `${source.request.snapshotId}/${xColumn}`,
  );
  const domain = customX ?? automaticDomain(xs, false, 0.06);
  const selected = intervals[active],
    settings = selected.settings[curve] ?? selected.settings[0];
  const names = parameterNames(settings.model, settings.custom);
  const ready = results.some((r) => r?.some((f) => f.result));
  useEffect(() => onReady(ready), [ready, onReady]);
  useImperativeHandle(ref, () => ({
    copy: async () => {
      if (!ready) return;
      try {
        await navigator.clipboard.writeText(intervalReport(config, results));
        setNotice("Report copied");
      } catch {
        setError("Clipboard unavailable. Print the report to PDF instead.");
      }
    },
    print: async () => {
      if (!ready) return;
      try {
        await window.print();
      } catch (e) {
        setError(String(e));
      }
    },
  }));
  function updateInterval(next: IntervalDefinition, index = active) {
    invalidate(index);
    setIntervals((old) => old.map((v, i) => (i === index ? next : v)));
  }
  const pending = useCallback(
    (value: boolean) => {
      setEquationPending(value);
      if (value) {
        worker.current?.terminate();
        worker.current = null;
        setBusy(null);
        setResults((old) => old.map((r, i) => (i === active ? null : r)));
      }
    },
    [active],
  );
  function selectRange(range: IntervalRange, index = active) {
    const next = { ...intervals[index], range };
    updateInterval(next, index);
    setRangeDrafts((old) =>
      old.map((v, i) =>
        i === index ? range.map((n) => String(Number(n.toPrecision(10)))) : v,
      ),
    );
  }
  function boundary(index: number, end: number, value: number) {
    const range = intervals[index].range;
    if (!range) return;
    const gap = (dataDomain[1] - dataDomain[0]) * 1e-6;
    const bounded = Math.max(
      end === 0 ? dataDomain[0] : range[0] + gap,
      Math.min(end === 0 ? range[1] - gap : dataDomain[1], value),
    );
    selectRange(end === 0 ? [bounded, range[1]] : [range[0], bounded], index);
  }
  function numericRange(end: number, text: string) {
    const draft = rangeDrafts[active].map((v, i) => (i === end ? text : v));
    setRangeDrafts((old) => old.map((v, i) => (i === active ? draft : v)));
    updateInterval({
      ...selected,
      range: draft.every((s) => s.trim() && Number.isFinite(Number(s)))
        ? (draft.map(Number) as IntervalRange)
        : null,
    });
  }
  function chooseModel(model: FitSettings["model"]) {
    setEquationPending(false);
    updateInterval({
      ...selected,
      settings: columns.map(() => initialSettings(model)),
    });
  }
  function changeSettings(next: FitSettings) {
    updateInterval({
      ...selected,
      settings: selected.settings.map((s, i) => (i === curve ? next : s)),
    });
  }
  function changeShared(field: string, value: number | boolean) {
    updateInterval({
      ...selected,
      settings: selected.settings.map((s) => ({ ...s, [field]: value })),
    });
  }
  function fitSelected() {
    if (preview.error || rangeError || equationPending || !selected.range)
      return;
    cancel();
    setError("");
    setNotice("");
    const index = active;
    const w = new Worker(new URL("./interval.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.current = w;
    setBusy(index);
    w.onmessage = (
      event: MessageEvent<{ result?: IntervalFit[]; error?: string }>,
    ) => {
      if (worker.current !== w) return;
      worker.current = null;
      w.terminate();
      setBusy(null);
      if (event.data.error) {
        setError(event.data.error);
        return;
      }
      setResults((old) =>
        old.map((r, i) => (i === index ? event.data.result! : r)),
      );
      setNotice(
        `${intervals[index].name}: ${event.data.result!.filter((r) => r.result).length} of ${columns.length} data series fitted`,
      );
    };
    w.onerror = (e) => {
      if (worker.current !== w) return;
      cancel();
      setError(e.message || "Fit worker failed");
    };
    w.postMessage({ source, config, index });
  }
  function curveCount(count: number) {
    invalidate();
    setCurve(0);
    const candidates = Array.from({ length: width }, (_, i) => i).filter(
      (i) => i !== xColumn,
    );
    const next = columns.slice(0, count);
    for (const i of candidates)
      if (next.length < count && !next.includes(i)) next.push(i);
    while (next.length < count) next.push(-1);
    setColumns(next);
    setSigmas(next.map((_, i) => sigmas[i] ?? ""));
    setIntervals((old) =>
      old.map((item) => ({
        ...item,
        settings: next.map(
          (_, i) =>
            item.settings[i] ?? {
              ...structuredClone(item.settings[0]),
              ...(item.settings[0].custom
                ? {
                    custom: {
                      ...item.settings[0].custom,
                      units: item.settings[0].custom.units.map(() => ""),
                    },
                  }
                : {}),
            },
        ),
      })),
    );
  }
  function countIntervals(count: number) {
    cancel();
    setEquationPending(false);
    setActive(Math.min(active, count - 1));
    setIntervals((old) =>
      Array.from(
        { length: count },
        (_, i) => old[i] ?? newInterval(i, columns.length),
      ),
    );
    setRangeDrafts((old) =>
      Array.from({ length: count }, (_, i) => old[i] ?? ["", ""]),
    );
    setResults((old) =>
      Array.from({ length: count }, (_, i) => old[i] ?? null),
    );
    setError("");
    setNotice("");
  }
  return (
    <section
      className={`multi-interval ${includeDetails ? "with-fit-details" : ""} ${showResiduals ? "" : "without-residuals"}`}
      hidden={!open}
      aria-label="Multi-interval analysis"
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "p") return;
        e.stopPropagation();
      }}
    >
      <aside className="interval-controls">
        {open && analysisControl}
        <h2>Data series</h2>
        <label>
          Data series
          <select
            aria-label="Number of data series"
            value={columns.length}
            onChange={(e) => curveCount(Number(e.target.value))}
          >
            <option value={1}>One data series</option>
            <option value={2}>Two data series</option>
            <option value={3}>Three data series</option>
            <option value={4}>Four data series</option>
          </select>
        </label>
        <label>
          X column
          <select
            aria-label="Interval X column"
            value={xColumn}
            onChange={(e) => {
              invalidate();
              setXColumn(Number(e.target.value));
              setIntervals((old) => old.map((i) => ({ ...i, range: null })));
              setRangeDrafts((old) => old.map(() => ["", ""]));
            }}
          >
            {Array.from({ length: width }, (_, i) => (
              <option key={i} value={i}>
                {heading(i).label}
              </option>
            ))}
          </select>
        </label>
        {columns.map((v, i) => (
          <label key={i}>
            Data series {i + 1}
            <select
              aria-label={`Data series ${i + 1} column`}
              value={v}
              onChange={(e) => {
                invalidate();
                setColumns((old) =>
                  old.map((c, j) => (i === j ? Number(e.target.value) : c)),
                );
              }}
            >
              <option value={-1}>Choose column…</option>
              {Array.from({ length: width }, (_, j) => (
                <option key={j} value={j}>
                  {heading(j).label}
                </option>
              ))}
            </select>
          </label>
        ))}
        <label>
          Y uncertainties
          <select
            aria-label="Interval noise model"
            value={noise}
            onChange={(e) => {
              invalidate();
              setNoise(e.target.value);
            }}
          >
            <option value="estimate">Estimate scatter separately</option>
            <option value="supplied">
              Enter uncertainty for each data series
            </option>
          </select>
        </label>
        {noise === "supplied" &&
          columns.map((_, i) => (
            <label key={i}>
              Data series {i + 1} σ
              <input
                aria-label={`Data series ${i + 1} sigma`}
                type="number"
                step="any"
                value={sigmas[i]}
                onChange={(e) => {
                  invalidate();
                  setSigmas((old) =>
                    old.map((s, j) => (i === j ? e.target.value : s)),
                  );
                }}
              />
            </label>
          ))}
        <h2>Intervals</h2>
        <label>
          How many?
          <select
            aria-label="Number of intervals"
            value={intervals.length}
            onChange={(e) => countIntervals(Number(e.target.value))}
          >
            {Array.from({ length: maxIntervals }, (_, i) => i + 1).map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </label>
        <div className="interval-tabs" aria-label="Choose interval">
          {intervals.map((item, i) => (
            <button
              key={i}
              aria-pressed={i === active}
              style={{ borderColor: intervalColors[i] }}
              onClick={() => {
                setActive(i);
                setEquationPending(false);
              }}
            >
              {item.name || `Interval ${i + 1}`}
              {results[i]?.some((r) => r.result) ? " ✓" : ""}
            </button>
          ))}
        </div>
        <button
          className="interval-fit-button"
          disabled={
            busy !== null ||
            !!preview.error ||
            !!rangeError ||
            !selected.range ||
            equationPending
          }
          onClick={fitSelected}
        >
          Fit {selected.name || "selected interval"}
        </button>
        {busy !== null && (
          <button
            onClick={() => {
              cancel();
              setNotice("Fit cancelled");
            }}
          >
            Cancel fit
          </button>
        )}
        {open && (
          <Assumptions
            checked={conditional}
            onChange={(v) => {
              invalidate();
              setConditional(v);
            }}
          />
        )}
        <label>
          Name
          <input
            aria-label="Interval name"
            value={selected.name}
            maxLength={60}
            onChange={(e) =>
              setIntervals((old) =>
                old.map((s, i) =>
                  i === active ? { ...s, name: e.target.value } : s,
                ),
              )
            }
          />
        </label>
        <p className="interval-instruction">
          Drag across a data graph to select <strong>{selected.name}</strong>.
          Move its boundary lines to refine the range. Ranges may overlap;
          shared observations can correlate the fitted results.
        </p>
        <div className="interval-range">
          {["From", "To"].map((name, i) => (
            <label key={name}>
              {name}
              <input
                aria-label={`Interval ${name.toLowerCase()}`}
                type="number"
                step="any"
                placeholder="Select on graph"
                value={rangeDrafts[active][i]}
                onChange={(e) => numericRange(i, e.target.value)}
              />
            </label>
          ))}
        </div>
        <label>
          Equation
          <select
            aria-label="Interval equation"
            value={settings.model}
            onChange={(e) =>
              chooseModel(e.target.value as FitSettings["model"])
            }
          >
            {models.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {settings.model !== "custom" && (
          <p className="interval-equation-preview">
            y ={" "}
            {
              customFromModel(
                settings,
                preview.requests[curve] ?? source.request,
              ).custom!.expression
            }
          </p>
        )}
        {settings.model === "custom" && (
          <CustomEquationEditor
            key={active}
            definition={settings.custom!}
            onPending={pending}
            onApply={(custom) => {
              updateInterval({
                ...selected,
                settings: selected.settings.map((s) => {
                  const oldNames = parameterNames(s.model, s.custom);
                  return {
                    ...s,
                    custom: {
                      ...custom,
                      units: custom.names.map(
                        (n) => s.custom!.units[oldNames.indexOf(n)] ?? "",
                      ),
                    },
                    parameters: custom.names.map(
                      (n) =>
                        s.parameters[oldNames.indexOf(n)] ?? {
                          value: 1,
                          fixed: false,
                        },
                    ),
                  };
                }),
              });
            }}
          />
        )}
        {settings.model === "sine-free-period" && (
          <div className="interval-range">
            {(["periodMin", "periodMax"] as const).map((field, i) => (
              <label key={field}>
                {i === 0 ? "Minimum period" : "Maximum period"}
                <input
                  aria-label={
                    i === 0
                      ? "Interval minimum period"
                      : "Interval maximum period"
                  }
                  type="number"
                  step="any"
                  value={settings[field]}
                  onChange={(e) => {
                    if (Number.isFinite(e.target.valueAsNumber))
                      changeShared(field, e.target.valueAsNumber);
                  }}
                />
              </label>
            ))}
          </div>
        )}
        {settings.model === "sine" && (
          <label>
            Supplied period
            <input
              aria-label="Interval supplied period"
              type="number"
              step="any"
              value={settings.sinePeriod}
              onChange={(e) => {
                if (Number.isFinite(e.target.valueAsNumber))
                  changeShared("sinePeriod", e.target.valueAsNumber);
              }}
            />
          </label>
        )}
        {["exponential", "power-law"].includes(settings.model) && (
          <label>
            Supplied {settings.model === "exponential" ? "rate" : "exponent"}
            <input
              aria-label="Interval supplied shape"
              type="number"
              step="any"
              value={settings.shape}
              onChange={(e) => {
                if (Number.isFinite(e.target.valueAsNumber))
                  changeShared("shape", e.target.valueAsNumber);
              }}
            />
          </label>
        )}
        {settings.model === "constant-acceleration" && (
          <label>
            <input
              type="checkbox"
              checked={settings.physicalTimeConfirmed}
              onChange={(e) =>
                changeShared("physicalTimeConfirmed", e.target.checked)
              }
            />
            X represents physical time
          </label>
        )}
        <details
          className="interval-parameters"
          open={settings.model !== "line"}
          key={`${active}-${settings.model}`}
        >
          <summary>Starting values and fixed parameters</summary>
          {columns.length > 1 && (
            <label>
              Parameters for
              <select
                aria-label="Parameter data series"
                value={curve}
                onChange={(e) => setCurve(Number(e.target.value))}
              >
                {columns.map((c, i) => (
                  <option key={i} value={i}>
                    Data series {i + 1}: {heading(c).label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <p>
            Each data series is fitted separately. Values here are starting
            values; fitted values appear beside the graphs.
          </p>
          {names.map((name, i) => (
            <div className="interval-parameter" key={name}>
              <label>
                {name}
                <input
                  aria-label={`${name} interval value`}
                  type="number"
                  step="any"
                  value={settings.parameters[i].value}
                  onChange={(e) => {
                    if (Number.isFinite(e.target.valueAsNumber))
                      changeSettings({
                        ...settings,
                        parameters: settings.parameters.map((p, j) =>
                          i === j ? { ...p, value: e.target.valueAsNumber } : p,
                        ),
                      });
                  }}
                />
              </label>
              <label>
                <input
                  aria-label={`Fix interval ${name}`}
                  type="checkbox"
                  checked={settings.parameters[i].fixed}
                  onChange={(e) =>
                    changeSettings({
                      ...settings,
                      parameters: settings.parameters.map((p, j) =>
                        i === j ? { ...p, fixed: e.target.checked } : p,
                      ),
                    })
                  }
                />
                Fix
              </label>
              {settings.model === "custom" && (
                <input
                  aria-label={`${name} interval unit`}
                  placeholder="unit"
                  {...unitEntry}
                  maxLength={100}
                  value={settings.custom!.units[i]}
                  onChange={(e) =>
                    changeSettings({
                      ...settings,
                      custom: {
                        ...settings.custom!,
                        units: settings.custom!.units.map((u, j) =>
                          i === j ? e.target.value : u,
                        ),
                      },
                    })
                  }
                />
              )}
            </div>
          ))}
        </details>
        <label className="interval-print-option">
          <input
            type="checkbox"
            checked={includeDetails}
            onChange={(e) => setIncludeDetails(e.target.checked)}
          />
          Include {showResiduals ? "residuals and " : ""}diagnostics when
          printing
        </label>
        <p className="interval-draft-note">
          Draft: interval setup is kept while switching analyses. Copy or print
          results before closing; multi-interval sessions are not saved yet.
        </p>
      </aside>
      <main className="interval-workspace">
        <header>
          <h1>Multi-interval fit</h1>
          <p>{source.request.dataset.label}</p>
        </header>
        {(error || preview.error || rangeError) && (
          <div role="alert" className="interval-error">
            <FitErrorMessage message={error || preview.error || rangeError} />
          </div>
        )}
        <p role="status">
          {busy !== null
            ? `Fitting ${intervals[busy].name}…`
            : notice ||
              "Select an interval on the graph, choose its equation, then fit."}
        </p>
        <div className="interval-overview">
          <div className="interval-legend">
            {intervals.map((s, i) => (
              <span key={i} style={{ color: intervalColors[i] }}>
                {i + 1}. {s.name}:{" "}
                {s.range
                  ? `${fmt(s.range[0])}–${fmt(s.range[1])}`
                  : "range not selected"}
              </span>
            ))}
          </div>
          <table className="interval-print-overview">
            <thead>
              <tr>
                <th>Interval</th>
                <th>Range (X units)</th>
                <th>Equation</th>
                <th>Fits complete</th>
              </tr>
            </thead>
            <tbody>
              {intervals.map((s, i) => (
                <tr key={i}>
                  <th>{s.name}</th>
                  <td>{s.range?.map(fmt).join(" to ") ?? "Not selected"}</td>
                  <td>
                    {s.settings[0].model === "custom"
                      ? `y = ${s.settings[0].custom!.expression}`
                      : models.find((m) => m[0] === s.settings[0].model)?.[1]}
                  </td>
                  <td>
                    {results[i]?.filter((r) => r.result).length ?? 0}/
                    {columns.length}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div
            ref={liveGraphs}
            className={`interval-graphs curves-${columns.length}`}
          >
            {preview.requests.map((request, i) => (
              <article key={i}>
                <h2>{request.dataset.yColumn.label}</h2>
                <IntervalPlot
                  request={request}
                  intervals={intervals}
                  results={results.map((r) => r?.[i] ?? null)}
                  active={active}
                  domain={domain}
                  dataDomain={dataDomain}
                  height={showResiduals ? 290 : 460}
                  onRange={selectRange}
                  onBoundary={boundary}
                  xCustom={!!customX}
                  onXRange={setCustomX}
                />
                {showResiduals && (
                  <div className="interval-live-residual">
                    <IntervalPlot
                      request={request}
                      intervals={intervals}
                      results={results.map((r) => r?.[i] ?? null)}
                      active={active}
                      domain={domain}
                      residual
                    />
                  </div>
                )}
              </article>
            ))}
          </div>
          <table
            className="interval-print-parameters"
            aria-label="Printed interval parameters"
          >
            <thead>
              <tr>
                <th>Interval / data series</th>
                <th>Parameters (± standard error)</th>
                <th>Inference</th>
              </tr>
            </thead>
            <tbody>
              {intervals.flatMap((item, index) =>
                columns.map((column, i) => {
                  const entry = results[index]?.[i];
                  return (
                    <tr key={`${index}-${i}`}>
                      <th>
                        {item.name} · {heading(column).label}
                      </th>
                      <td>
                        {entry?.result
                          ? parameterNames(
                              entry.settings.model,
                              entry.settings.custom,
                            ).map((name, j) => (
                              <div key={name}>
                                {name} = {fmt(entry.result!.coefficients[j])}
                                {entry.settings.parameters[j].fixed
                                  ? " (fixed)"
                                  : entry.result!.standardErrors[j].value ===
                                      null
                                    ? " (SE unavailable)"
                                    : ` ± ${fmt(entry.result!.standardErrors[j].value)}`}{" "}
                                [
                                {parameterUnit(
                                  entry.settings,
                                  { ...source, request: entry.request },
                                  name,
                                )}
                                ]
                              </div>
                            ))
                          : entry?.error || "Not fitted"}
                      </td>
                      <td>{entry?.result?.inference ?? "Unavailable"}</td>
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
          <SourceNotes text={source.request.source.context} />
        </div>
        <section className="interval-results" aria-label="Interval fit results">
          {intervals.map((item, index) => (
            <article key={index} className="interval-result-section">
              <h2 style={{ color: intervalColors[index] }}>{item.name}</h2>
              <p>
                Range: {item.range?.map(fmt).join(" to ") ?? "not selected"} [
                {heading(xColumn).unit || "?"}]. Endpoints included. Equation:{" "}
                {item.settings[0].model === "custom"
                  ? `y = ${item.settings[0].custom!.expression}`
                  : models.find((m) => m[0] === item.settings[0].model)?.[1]}
                .
              </p>
              {!results[index] && (
                <p>
                  Not fitted. Select this interval and fit it after inspecting
                  the graph.
                </p>
              )}
              {results[index]?.map((entry, i) => (
                <section key={i} className="interval-curve-result">
                  <h3>{entry.request.dataset.yColumn.label}</h3>
                  {entry.result ? (
                    <>
                      <table
                        aria-label={`${item.name} ${entry.request.dataset.yColumn.label} parameters`}
                      >
                        <thead>
                          <tr>
                            <th>Parameter</th>
                            <th>Value</th>
                            <th>Unit</th>
                            <th>Standard error</th>
                            <th>95% interval</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parameterNames(
                            entry.settings.model,
                            entry.settings.custom,
                          ).map((name, j) => (
                            <tr key={name}>
                              <th>
                                {entry.settings.model === "line" && name === "m"
                                  ? "m (slope)"
                                  : name}
                              </th>
                              <td>{fmt(entry.result!.coefficients[j])}</td>
                              <td>
                                {parameterUnit(
                                  entry.settings,
                                  { ...source, request: entry.request },
                                  name,
                                )}
                              </td>
                              <td>
                                {entry.result!.standardErrors[j].reason ===
                                "fixed"
                                  ? "Fixed"
                                  : fmt(entry.result!.standardErrors[j].value)}
                              </td>
                              <td>
                                {entry
                                  .result!.intervals[j]?.map(fmt)
                                  .join(" to ") ?? "Unavailable"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <p>
                        {entry.result.n} observations · {entry.result.df}{" "}
                        degrees of freedom · RMS residual{" "}
                        {fmt(entry.result.rms)} · {entry.result.inference}{" "}
                        inference.
                      </p>
                      <details
                        className="interval-result-diagnostics"
                        open={includeDetails || undefined}
                      >
                        <summary>
                          {showResiduals
                            ? "Residuals and diagnostics"
                            : "Diagnostics"}
                        </summary>
                        {showResiduals && (
                          <IntervalPlot
                            request={entry.request}
                            colors={[intervalColors[index]]}
                            intervals={[item]}
                            results={[entry]}
                            active={0}
                            domain={domain}
                            residual
                          />
                        )}
                        <table>
                          <tbody>
                            {fitReportRows(
                              entry.request,
                              entry.settings,
                              entry.result,
                            ).map(([name, value]) => (
                              <tr key={name}>
                                <th>{name}</th>
                                <td>
                                  {value === null
                                    ? "Unavailable"
                                    : String(value)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {entry.result.warnings.map((w) => (
                          <p key={w}>{w}</p>
                        ))}
                      </details>
                    </>
                  ) : (
                    <div role="alert">
                      <FitErrorMessage
                        message={entry.error ?? "Fit unavailable"}
                      />
                    </div>
                  )}
                </section>
              ))}
            </article>
          ))}
        </section>
        <footer>
          Separate fits; uncertainty in interval selection and covariance
          between fits are not included. Use the copied report in a spreadsheet
          for further calculations.
        </footer>
      </main>
      {exportSizes && (
        <div className="fit-export-render" aria-hidden="true" inert>
          {preview.requests.flatMap((request, i) =>
            (showResiduals ? [false, true] : [false]).map((residual, part) => {
              const index = i * (showResiduals ? 2 : 1) + part;
              const live =
                liveGraphs.current?.querySelectorAll<SVGSVGElement>(
                  "svg.interval-plot",
                )[index];
              const yRange: IntervalRange | undefined = live
                ? [Number(live.dataset.yMin), Number(live.dataset.yMax)]
                : undefined;
              return (
                <IntervalPlot
                  key={`${i}-${part}`}
                  request={request}
                  intervals={intervals}
                  results={results.map((result) => result?.[i] ?? null)}
                  active={active}
                  domain={domain}
                  dataDomain={dataDomain}
                  residual={residual}
                  renderSize={exportSizes[index]}
                  forcedYRange={yRange}
                  onBoundary={residual ? undefined : boundary}
                />
              );
            }),
          )}
        </div>
      )}
    </section>
  );
});
