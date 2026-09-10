import {
  analysisFromTable,
  tableForAnalysis,
  type TableAnalysis,
} from "./dataTable";
import {
  requestSchema,
  settingsSchema,
  type FitRequest,
  type FitSettings,
} from "./schema";
import { fit, type FitResult } from "./solve";
import { fitReportTable, reportTableTsv, type Cell } from "./report";
export type IntervalRange = [number, number];
export interface IntervalDefinition {
  name: string;
  range: IntervalRange | null;
  settings: FitSettings[];
}
export interface IntervalConfig {
  x: number;
  columns: number[];
  sigmas: (number | null)[];
  intervals: IntervalDefinition[];
  conditional: boolean;
}
export interface IntervalFit {
  request: FitRequest;
  settings: FitSettings;
  result: FitResult | null;
  error: string | null;
}
/** Independent numerical snapshots. No event finding, automatic range selection or derived mechanics. */
export function intervalRequests(
  source: TableAnalysis,
  config: Pick<IntervalConfig, "x" | "columns" | "sigmas">,
): FitRequest[] {
  const table = tableForAnalysis(source);
  const width = table.cells.reduce((n, r) => Math.max(n, r.length), 0);
  if (
    ![1, 2, 3, 4].includes(config.columns.length) ||
    config.sigmas.length !== config.columns.length ||
    new Set([config.x, ...config.columns]).size !== config.columns.length + 1 ||
    [config.x, ...config.columns].some(
      (i) => !Number.isInteger(i) || i < 0 || i >= width,
    )
  )
    throw Error(
      "Choose an X column and a different column for each data series.",
    );
  if (config.sigmas.some((s) => s !== null && (!Number.isFinite(s) || s <= 0)))
    throw Error(
      "Enter a positive uncertainty for every data series, or choose Estimate scatter.",
    );
  return config.columns.map((column, i) => {
    const mapped = analysisFromTable(
      { ...table, x: config.x, y: column, sigma: null },
      source.request.dataset.label,
    );
    const sameY = column === table.y,
      sigma = config.sigmas[i];
    return requestSchema.parse({
      ...mapped.request,
      source: source.request.source,
      dataset: {
        ...mapped.request.dataset,
        assumptions: {
          exactX:
            config.x === table.x &&
            source.request.dataset.assumptions.exactX === "known-false"
              ? "known-false"
              : "unknown",
          gaussianIndependent:
            sameY &&
            source.request.dataset.assumptions.gaussianIndependent ===
              "known-false"
              ? "known-false"
              : "unknown",
          correctModel: "unknown",
        },
      },
      uncertainty: {
        kind: sigma === null ? "unknown-equal" : "supplied-common",
        errorStructure:
          sameY &&
          source.request.uncertainty.errorStructure === "known-correlated"
            ? "known-correlated"
            : "unknown",
        ...(sigma === null
          ? {}
          : {
              sigmaY: sigma,
              provenance: {
                kind: "user-asserted",
                description:
                  "Common Y uncertainty entered for multi-interval fitting",
              },
            }),
      },
    });
  });
}
export function checkIntervalRanges(
  intervals: Pick<IntervalDefinition, "name" | "range">[],
) {
  if (intervals.length < 1 || intervals.length > 3)
    throw Error("Choose between one and three intervals.");
  for (const item of intervals) {
    if (!item.name.trim()) throw Error("Give each interval a name.");
    if (
      item.range &&
      (!item.range.every(Number.isFinite) || item.range[0] >= item.range[1])
    )
      throw Error(`${item.name}: select an increasing range.`);
  }
}
/** Fit only the interval explicitly requested by the student. */
export function fitInterval(
  source: TableAnalysis,
  config: IntervalConfig,
  index: number,
): IntervalFit[] {
  checkIntervalRanges(config.intervals);
  if (!Number.isInteger(index) || !config.intervals[index])
    throw Error("Choose an interval to fit.");
  const interval = config.intervals[index];
  if (!interval.range)
    throw Error("Select this interval on the graph before fitting.");
  const requests = intervalRequests(source, config);
  if (interval.settings.length !== requests.length)
    throw Error("Each data series needs its own parameter values.");
  if (
    interval.settings.some(
      (s) =>
        s.model !== interval.settings[0].model ||
        s.custom?.expression !== interval.settings[0].custom?.expression ||
        s.custom?.variable !== interval.settings[0].custom?.variable,
    )
  )
    throw Error(
      "Use the same equation for all data series within an interval.",
    );
  return requests.map((request, i) => {
    const settings: FitSettings = {
      ...interval.settings[i],
      conditionalInference: config.conditional,
      selectionAfterInspection: true,
      excludedIds: request.dataset.rows
        .filter(
          (r) =>
            r.x === null ||
            r.x < interval.range![0] ||
            r.x > interval.range![1],
        )
        .map((r) => r.id),
    };
    try {
      settingsSchema.parse(settings);
      return { request, settings, result: fit(request, settings), error: null };
    } catch (e) {
      return {
        request,
        settings,
        result: null,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  });
}
export function intervalReport(
  config: IntervalConfig,
  results: (IntervalFit[] | null)[],
): string {
  const blocks: Cell[][][] = config.intervals.flatMap((interval, i) =>
    config.columns.map((_, j) => {
      const entry = results[i]?.[j];
      return [
        ["Interval", interval.name],
        ["Range", ...(interval.range ?? ["Not selected"])],
        ["Data series", entry?.request.dataset.yColumn.label ?? j + 1],
        [],
        ...(entry?.result
          ? fitReportTable(entry.request, entry.settings, entry.result)
          : [[entry ? "Fit unavailable" : "Not fitted", entry?.error ?? null]]),
      ];
    }),
  );
  const widths = blocks.map((block) =>
    Math.max(5, ...block.map((row) => row.length)),
  );
  const rows: Cell[][] = [
    ["Multi-interval fit report"],
    [
      "Ranges selected by the student; inclusive endpoints. Overlapping ranges reuse observations, so fitted results may be correlated. Interval-selection uncertainty and cross-fit covariance are not modeled.",
    ],
    [],
    ...Array.from(
      { length: Math.max(...blocks.map((block) => block.length)) },
      (_, row) =>
        blocks.flatMap((block, i) => [
          ...(i ? [null] : []),
          ...Array.from(
            { length: widths[i] },
            (_, column) => block[row]?.[column] ?? null,
          ),
        ]),
    ),
  ];
  return reportTableTsv(rows);
}
