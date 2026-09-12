import {
  nonlinearModels,
  nonlinearModelIds,
  isNonlinearModel,
  nonlinearParameterUnit,
} from "./nonlinearModels";
import {
  parameterNames,
  type FitRequest,
  type FitSettings,
  type FitSession,
} from "./schema";
import type { FitResult } from "./solve";
export type Cell = string | number | boolean | null;
export type ReportRow = readonly [statistic: string, value: Cell];
export type ReportSections = {
  statistics?: boolean;
  correlation?: boolean;
  observations?: boolean;
  provenance?: boolean;
};
export function fitCorrelationMatrix(
  settings: FitSettings,
  result: FitResult,
): Cell[][] {
  const names = parameterNames(settings.model, settings.custom);
  if (!result.covariance)
    return [["Parameter correlation matrix", "Unavailable"]];
  return [
    ["Parameter correlation matrix", ...names],
    ...names.map((name, i) => [
      name,
      ...names.map((_, j) => {
        const denominator = Math.sqrt(
          result.covariance![i][i] * result.covariance![j][j],
        );
        return denominator > 0
          ? result.covariance![i][j] / denominator
          : null;
      }),
    ]),
  ];
}
/** Summary statistics alone use one statistic/value pair per row.
 * Parameters and observations retain their conventional rectangular tables.
 */
export function fitReportRows(
  _request: FitRequest,
  _settings: FitSettings,
  result: FitResult,
): ReportRow[] {
  const rows: ReportRow[] = [
    ["n", result.n],
    ["rank", result.rank],
    ["df", result.df],
    ["SSE", result.sse],
    ["RMS residual", result.rms],
    ["Estimated scatter", result.scatter.value],
    ["Weighted residual sum", result.weightedObjective.value],
    ["Weighted residual sum / df", result.reducedObjective.value],
    ["Q", result.q.value],
    ["Centered R²", result.rSquared.value],
  ];
  for (const [label, statistic] of [
    ["Estimated scatter", result.scatter],
    ["Weighted residual sum", result.weightedObjective],
    ["Weighted residual sum / df", result.reducedObjective],
    ["Q", result.q],
    ["Centered R²", result.rSquared],
  ] as const) {
    if (statistic.reason)
      rows.push([`${label} unavailable reason`, statistic.reason]);
  }
  return rows;
}
function cell(value: Cell): string {
  if (value === null) return "";
  let text = String(value);
  if (typeof value === "string" && /^\s*[=+@-]/.test(text)) text = `'${text}`;
  return /[\t\r\n"]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
export function fitReportTable(
  request: FitRequest,
  settings: FitSettings,
  result: FitResult,
  sections: ReportSections = {},
): Cell[][] {
  const names = parameterNames(settings.model, settings.custom);
  const equations = {
    ...(Object.fromEntries(
      nonlinearModelIds.map((m) => [m, nonlinearModels[m].equation]),
    ) as Record<(typeof nonlinearModelIds)[number], string>),
    line: "y = b + m*x",
    quadratic: "y = c0 + c1*x + c2*x^2",
    cubic: "y = c0 + c1*x + c2*x² + c3*x³",
    quartic: "y = c0 + c1*x + c2*x² + c3*x³ + c4*x⁴",
    sine: "y = b + s sin(2πx/T) + c cos(2πx/T)",
    "sine-free-period": "y = b + s sin(2πx/T) + c cos(2πx/T)",
    exponential: "y = b + a exp(kx)",
    "power-law": "y = b + a (x/xref)^p",
    reciprocal: "y = b + a xref/x",
    logarithmic: "y = b + a ln(x / xref)",
    "constant-acceleration": "y = y0 + v0*t + 0.5*a*t^2",
  };
  const rows: Cell[][] = [
    ["Dataset", request.dataset.label],
    [
      "Model",
      settings.model === "custom"
        ? `y = ${settings.custom!.expression}`
        : equations[settings.model],
    ],
    ...(settings.model === "custom"
      ? [
          ["Independent variable", settings.custom!.variable],
          [
            "Parameter units",
            names
              .map((n, i) => `${n}: ${settings.custom!.units[i] || "?"}`)
              .join("; "),
          ],
          [
            "Starting parameters",
            settings.parameters
              .map(
                (p, i) => `${names[i]}=${p.value}${p.fixed ? " (fixed)" : ""}`,
              )
              .join("; "),
          ],
          ["Solver", result.engine],
        ]
      : []),
    ...(isNonlinearModel(settings.model)
      ? [
          [
            "Interval method",
            "Local Jacobian approximation when nonlinear parameters are free",
          ],
        ]
      : []),
    ...(settings.model === "sine"
      ? [["Supplied period T", settings.sinePeriod ?? 2 * Math.PI]]
      : []),
    ...(settings.model === "logarithmic"
      ? [["Log reference xref", "1 declared x-unit"]]
      : []),
    ...(settings.model === "sine-free-period"
      ? [
          ["Minimum searched period", settings.periodMin!],
          ["Maximum searched period", settings.periodMax!],
          [
            "Amplitude",
            Math.hypot(result.coefficients[1], result.coefficients[2]),
          ],
          [
            "Phase (rad)",
            Math.atan2(result.coefficients[2], result.coefficients[1]),
          ],
          ["Interval method", "Local linear approximation when T is free"],
        ]
      : []),
    ...(["exponential", "power-law"].includes(settings.model)
      ? [
          [
            "Supplied shape",
            settings.shape ?? (settings.model === "exponential" ? -1 : 2),
          ],
        ]
      : []),
    ...(isNonlinearModel(settings.model)
      ? [
          ["Solver", result.engine],
          [
            "Starting parameters",
            settings.parameters
              .map(
                (p, i) => `${names[i]}=${p.value}${p.fixed ? " (fixed)" : ""}`,
              )
              .join("; "),
          ],
          [
            "Parameter units",
            names
              .map(
                (name, i) =>
                  `${name}: ${nonlinearParameterUnit(settings.model as (typeof nonlinearModelIds)[number], i, request.dataset.xColumn.unit, request.dataset.yColumn.unit)}`,
              )
              .join("; "),
          ],
        ]
      : []),
    ["Inference", result.inference],
    ["x unit", request.dataset.xColumn.unit],
    ["y unit", request.dataset.yColumn.unit],
    [],
    ["Parameter", "Value", "Standard error", "95% lower", "95% upper"],
    ...names.map((name, i) => [
      name,
      result.coefficients[i],
      result.standardErrors[i].value ?? result.standardErrors[i].reason,
      ...(result.intervals[i] ?? [null, null]),
    ]),
    [],
    ["Statistic", "Value"],
    ...fitReportRows(request, settings, result).map((row) => [...row]),
    [],
    ["Row", "x", "y", "predicted", "residual"],
    ...result.residuals.map((row) => [
      row.id,
      row.x,
      row.y,
      row.predicted,
      row.residual,
    ]),
    [],
    ...fitCorrelationMatrix(settings, result),
  ];
  if (result.warnings.length)
    rows.push([], ["Notes"], ...result.warnings.map((warning) => [warning]));
  rows.push(
    [],
    ["Source file", request.source.fileName ?? null],
    ["Source application", request.source.application],
    ["Source notes", request.source.context],
  );
  const remove = (header: string) => {
    const start = rows.findIndex((row) => row[0] === header);
    if (start < 0) return;
    let end = start + 1;
    while (end < rows.length && rows[end].length > 0) end++;
    rows.splice(Math.max(0, start - 1), end - start + 1);
  };
  if (sections.statistics === false) remove("Statistic");
  if (sections.correlation === false) remove("Parameter correlation matrix");
  if (sections.observations === false) remove("Row");
  if (sections.provenance === false) remove("Source file");
  return rows;
}

export function reportTableTsv(rows: Cell[][]): string {
  return rows.map((row) => row.map(cell).join("\t")).join("\r\n") + "\r\n";
}

export function fitReportTsv(
  request: FitRequest,
  settings: FitSettings,
  result: FitResult,
  sections?: ReportSections,
): string {
  return reportTableTsv(fitReportTable(request, settings, result, sections));
}

/** Name only an untitled pasted dataset; preserve deliberately supplied titles. */
export function nameSavedSession(
  session: FitSession,
  fileName: string,
): FitSession {
  if (
    session.request.dataset.label !== "Pasted data" ||
    session.request.source.fileName != null
  )
    return session;
  const label = fileName
    .split(/[\\/]/)
    .at(-1)!
    .replace(/\.trksess$/i, "")
    .trim();
  if (!label) return session;
  return {
    ...session,
    request: {
      ...session.request,
      dataset: { ...session.request.dataset, label },
    },
  };
}
