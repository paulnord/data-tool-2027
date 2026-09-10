import {
  analysisFromTable,
  tableForAnalysis,
  type TableAnalysis,
} from "./dataTable";
import {
  initialSettings,
  requestSchema,
  type FitRequest,
  type FitSettings,
} from "./schema";
import { fit, type FitResult } from "./solve";

export type CollisionConfig = {
  time: number;
  columns: number[];
  sigmas: (number | null)[];
  before: [number, number];
  after: [number, number];
  conditional: boolean;
};
export type CollisionSegment = {
  interval: [number, number];
  settings: FitSettings;
  result: FitResult | null;
  error: string | null;
};
export type CollisionChannel = {
  request: FitRequest;
  before: CollisionSegment;
  after: CollisionSegment;
};

/** Independent line fits from an immutable table; intervals are inclusive and disjoint. */
export function collisionRequests(
  source: TableAnalysis,
  config: CollisionConfig,
): FitRequest[] {
  const table = tableForAnalysis(source);
  const width = Math.max(0, ...table.cells.map((r) => r.length));
  if (
    config.columns.length !== 4 ||
    config.sigmas.length !== 4 ||
    new Set([config.time, ...config.columns]).size !== 5 ||
    [config.time, ...config.columns].some(
      (i) => !Number.isInteger(i) || i < 0 || i >= width,
    )
  )
    throw Error("Choose one time column and four different position columns.");
  if (config.sigmas.some((s) => s !== null && (!Number.isFinite(s) || s <= 0)))
    throw Error(
      "Each supplied position uncertainty must be positive, or leave it blank to estimate scatter.",
    );
  if (
    ![...config.before, ...config.after].every(Number.isFinite) ||
    config.before[0] >= config.before[1] ||
    config.after[0] >= config.after[1] ||
    config.before[1] >= config.after[0]
  )
    throw Error(
      "Choose increasing, nonoverlapping before and after intervals, with a gap around the collision.",
    );
  return config.columns.map((column, i) => {
    const mapped = analysisFromTable(
      { ...table, x: config.time, y: column, sigma: null },
      source.request.dataset.label,
    );
    const sameY = column === table.y;
    const sigma = config.sigmas[i];
    return requestSchema.parse({
      ...mapped.request,
      source: source.request.source,
      dataset: {
        ...mapped.request.dataset,
        assumptions: {
          exactX:
            config.time === table.x &&
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
                  "Common position uncertainty entered in collision draft",
              },
            }),
      },
    });
  });
}

export function collisionFits(
  source: TableAnalysis,
  config: CollisionConfig,
): CollisionChannel[] {
  return collisionRequests(source, config).map((request) => {
    const segment = (interval: [number, number]): CollisionSegment => {
      const settings: FitSettings = {
        ...initialSettings("line"),
        conditionalInference: config.conditional,
        selectionAfterInspection: true,
        excludedIds: request.dataset.rows
          .filter((r) => r.x === null || r.x < interval[0] || r.x > interval[1])
          .map((r) => r.id),
      };
      try {
        return {
          interval,
          settings,
          result: fit(request, settings),
          error: null,
        };
      } catch (error) {
        return {
          interval,
          settings,
          result: null,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    };
    return {
      request,
      before: segment(config.before),
      after: segment(config.after),
    };
  });
}

export function collisionReport(channels: CollisionChannel[]): string {
  const rows: (string | number)[][] = [
    ["Collision fit report", channels[0]?.request.dataset.label ?? ""],
    [
      "Model",
      "position = intercept + slope × time; interval endpoints included",
    ],
    [
      "Position",
      "Interval",
      "From",
      "To",
      "Time unit",
      "Slope",
      "Slope unit",
      "Slope SE",
      "Slope 95% lower",
      "Slope 95% upper",
      "Intercept",
      "Intercept SE",
      "Position unit",
      "N",
      "df",
      "RMS residual",
      "Rank",
      "Inference",
      "Uncertainty",
      "Notes",
    ],
  ];
  for (const channel of channels)
    for (const name of ["before", "after"] as const) {
      const { request } = channel,
        s = channel[name],
        r = s.result;
      rows.push([
        request.dataset.yColumn.label,
        name,
        ...s.interval,
        request.dataset.xColumn.unit ?? "unspecified",
        r?.coefficients[1] ?? "Unavailable",
        `${request.dataset.yColumn.unit ?? "position unit"}/${request.dataset.xColumn.unit ?? "time unit"}`,
        r?.standardErrors[1].value ?? "Unavailable",
        r?.intervals[1]?.[0] ?? "Unavailable",
        r?.intervals[1]?.[1] ?? "Unavailable",
        r?.coefficients[0] ?? "Unavailable",
        r?.standardErrors[0].value ?? "Unavailable",
        request.dataset.yColumn.unit ?? "unspecified",
        r?.n ?? "",
        r?.df ?? "",
        r?.rms ?? "",
        r?.rank ?? "",
        r?.inference ?? "Failed",
        request.uncertainty.kind === "supplied-common"
          ? `Common sigma = ${request.uncertainty.sigmaY}`
          : "Equal unknown scatter, estimated separately per interval",
        s.error ??
          [...(r?.warnings ?? []), r?.standardErrors[1].reason ?? ""]
            .filter(Boolean)
            .join(" "),
      ]);
    }
  rows.push(
    ["Source notes", channels[0]?.request.source.context ?? ""],
    [
      "Scope",
      "Separate fits; cross-fit covariance and uncertainty in interval selection are not modeled. Single-fit exclusions are not inherited. Original source table is unchanged.",
    ],
  );
  return rows
    .map((row) =>
      row.map((v) => String(v).replace(/[\t\r\n]+/g, " ")).join("\t"),
    )
    .join("\n");
}
